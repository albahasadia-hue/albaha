import type {
  ApprovedTrip,
  RouteTiming,
  ScheduledStation,
  TimingStation,
  TripStyle,
} from './portalTypes';
import {
  conciergeDays,
  conciergeRegions,
  maxTripDays,
  places,
  typeLabels,
} from './portalStaticData';
import { clock, formatNum, tripLeg } from './portalHelpers';

export function routeTimingValid(
  timing: RouteTiming | null | undefined,
  ids: string[] | undefined = timing?.stations?.map((row) => row.id)
): boolean {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    Boolean(timing) &&
    Array.isArray(timing?.stations) &&
    timing.stations.length === ids.length &&
    new Set(ids).size === ids.length &&
    timing.stations.every(
      (row, i) =>
        row.id === ids[i] &&
        places.has(row.id) &&
        Number.isInteger(row.day) &&
        row.day >= 1 &&
        row.day <= maxTripDays &&
        Number.isInteger(row.start) &&
        Number.isInteger(row.end) &&
        row.start >= 0 &&
        row.end <= 1440 &&
        row.start < row.end &&
        (i === 0 ||
          row.day > timing.stations[i - 1].day ||
          (row.day === timing.stations[i - 1].day && row.start >= timing.stations[i - 1].end))
    )
  );
}

export function timedSchedule(timing: RouteTiming): {
  stations: ScheduledStation[];
  visit_minutes: number;
  drive_minutes: number;
} {
  const scheduled: ScheduledStation[] = timing.stations.map((row) => {
    const stop = places.get(row.id)!;
    return {
      id: row.id,
      name: stop.name,
      day: row.day,
      start: row.start,
      end: row.end,
      drive_minutes: row.drive_minutes ?? null,
      drive_estimated: Boolean(row.drive_estimated),
      visit_minutes: row.end - row.start,
      latitude: stop.lat,
      longitude: stop.lng,
    };
  });
  return {
    stations: scheduled,
    visit_minutes: scheduled.reduce((total, row) => total + row.visit_minutes, 0),
    drive_minutes: scheduled.reduce((total, row) => total + (row.drive_minutes || 0), 0),
  };
}

interface CompactSharedPlanPayload {
  v: 1;
  r: string;
  d: number;
  s: TripStyle;
  st: Array<[string, number, number, number]>;
}

export interface DecodedSharedTrip {
  region: string;
  days: string;
  style: TripStyle;
  ids: string[];
  timing: RouteTiming;
  approved: ApprovedTrip;
}

function parseClockMinutes(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h >= 24 || m < 0 || m >= 60) return fallback;
  return h * 60 + m;
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeSharedTrip(trip: ApprovedTrip): string {
  const st: Array<[string, number, number, number]> = trip.stations.map((row, idx) => {
    const start = parseClockMinutes(row.starts_at, 540 + idx * 75);
    const end = parseClockMinutes(row.ends_at, start + Math.max(30, row.visit_minutes || 60));
    return [row.id, row.day, start, Math.max(start + 15, end)];
  });
  const payload: CompactSharedPlanPayload = {
    v: 1,
    r: Object.hasOwn(conciergeRegions, trip.region) ? trip.region : 'all',
    d: Math.max(1, Math.min(maxTripDays, Number(trip.days) || 1)),
    s: Object.hasOwn(typeLabels, trip.style) ? trip.style : 'all',
    st,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSharedTrip(rawToken: string | null | undefined): DecodedSharedTrip | null {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length > 4096) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(rawToken.trim())) as Partial<CompactSharedPlanPayload>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.st) || parsed.st.length === 0 || parsed.st.length > 24) {
      return null;
    }
    const region = typeof parsed.r === 'string' && Object.hasOwn(conciergeRegions, parsed.r) ? parsed.r : 'all';
    const daysNum = Number(parsed.d);
    if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > maxTripDays) return null;
    const style: TripStyle =
      typeof parsed.s === 'string' && Object.hasOwn(typeLabels, parsed.s) ? (parsed.s as TripStyle) : 'all';

    const stations: TimingStation[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < parsed.st.length; i += 1) {
      const tuple = parsed.st[i];
      if (!Array.isArray(tuple) || tuple.length < 4) return null;
      const [id, day, start, end] = tuple;
      if (typeof id !== 'string' || !places.has(id) || seen.has(id)) return null;
      if (!Number.isInteger(day) || day < 1 || day > daysNum) return null;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end) {
        return null;
      }
      seen.add(id);

      let driveMinutes: number | null = null;
      let driveEstimated = false;
      if (i > 0 && stations[i - 1].day === day) {
        const prevStop = places.get(stations[i - 1].id)!;
        const currStop = places.get(id)!;
        const leg = tripLeg(prevStop, currStop);
        driveMinutes = leg.min;
        driveEstimated = leg.estimated;
      }

      stations.push({
        id,
        day,
        start,
        end,
        drive_minutes: driveMinutes,
        drive_estimated: driveEstimated,
      });
    }

    stations.sort((a, b) => a.day - b.day || a.start - b.start);
    const ids = stations.map((s) => s.id);
    const timing: RouteTiming = {
      season: 'autumn',
      month: null,
      start: stations[0].start,
      limit: 540,
      locked: null,
      stations,
    };
    if (!routeTimingValid(timing, ids)) return null;

    const scheduled = timedSchedule(timing);
    const approved: ApprovedTrip = {
      schema_version: 1,
      status: 'approved',
      approved_at: new Date().toISOString(),
      region,
      region_name: conciergeRegions[region] || 'كل المناطق',
      days: daysNum,
      style,
      style_name: typeLabels[style] || 'كل التجارب',
      season: null,
      timezone: 'Asia/Riyadh',
      visit_minutes: scheduled.visit_minutes,
      drive_minutes: scheduled.drive_minutes,
      stations: scheduled.stations.map(({ start, end, ...stop }) => ({
        ...stop,
        starts_at: clock(start),
        ends_at: clock(end),
      })),
    };

    return {
      region,
      days: String(daysNum),
      style,
      ids,
      timing,
      approved,
    };
  } catch {
    return null;
  }
}

export function buildSharedTripUrl(trip: ApprovedTrip, origin = window.location.origin): string {
  const token = encodeSharedTrip(trip);
  return `${origin.replace(/\/+$/, '')}/planner?plan=${encodeURIComponent(token)}`;
}

export function buildSharedTripSummaryText(trip: ApprovedTrip, shareUrl: string): string {
  const daysLabel = conciergeDays[String(trip.days)] || `${formatNum(trip.days)} أيام`;
  const byDay = new Map<number, string[]>();
  for (const row of trip.stations) {
    const list = byDay.get(row.day) || [];
    list.push(`${row.name} (${row.starts_at}–${row.ends_at})`);
    byDay.set(row.day, list);
  }
  const dayLines = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, items]) => `• اليوم ${formatNum(day)}: ${items.join(' ← ')}`);

  return [
    `خطة رحلة معتمدة في الباحة (${daysLabel} · ${trip.region_name || 'الباحة'})`,
    ...dayLines,
    '',
    `استعرض المسار التفاعلي على الخريطة:`,
    shareUrl,
  ].join('\n');
}

export function buildPlatformShareLinks(trip: ApprovedTrip, shareUrl: string): {
  title: string;
  summaryText: string;
  whatsappUrl: string;
  telegramUrl: string;
  xUrl: string;
  mailtoUrl: string;
} {
  const daysLabel = conciergeDays[String(trip.days)] || `${formatNum(trip.days)} أيام`;
  const title = `خطة رحلة في الباحة (${daysLabel})`;
  const summaryText = buildSharedTripSummaryText(trip, shareUrl);
  const shortTweet = `خطة رحلتي المعتمدة في الباحة (${daysLabel} · ${formatNum(trip.stations.length)} محطات)`;

  return {
    title,
    summaryText,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(summaryText)}`,
    telegramUrl: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shortTweet)}`,
    xUrl: `https://x.com/intent/tweet?text=${encodeURIComponent(shortTweet)}&url=${encodeURIComponent(shareUrl)}`,
    mailtoUrl: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(summaryText)}`,
  };
}
