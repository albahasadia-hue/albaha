import type {
  ConciergeAction,
  ConciergeContextState,
  ConciergeDockTarget,
  ConciergeItem,
  ConciergeReply,
  ForecastData,
  IndexedGuideRecord,
  RouteTiming,
  SeasonKey,
  StopBase,
  TimingStation,
  TripPlan,
  TripStyle,
} from './portalTypes';
import {
  climateCities,
  createGuideRecordIndex,
  geo,
  guidePlaceAliases,
  images,
  plannableDestinations,
  places,
  stops,
  tourGuideArtMap,
  tourGuideCategoryMedia,
} from './portalStaticData';
import {
  clock,
  durationLabel,
  formatNum,
  nearbyOrder,
  normalizeAr,
  tripDistance,
  tripLeg,
} from './portalHelpers';

export const APPROVED_GUIDE_GREETING =
  'مرحبًا بك في الباحة. أنا مرشدك السياحي الذكي. تبغى أخطّط لك رحلة، أو أساعدك تكتشف وجهة؟';

export const UNCONFIRMED_HOURS_NOTICE = 'موعد الزيارة يحتاج تأكيدًا من الجهة المشغّلة.';

export const CONCIERGE_FAILURE_NOTICE =
  'تعذّر تجهيز الاقتراح الآن. يمكنك الرجوع إلى رحلتك المحفوظة أو إعادة المحاولة.';

export const WEEKDAY_NAMES_AR = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

export interface StartPointRef {
  id: string;
  label: string;
  region: string;
  lat: number;
  lng: number;
}

const START_POINT_REFS: StartPointRef[] = [
  { id: 'baha-city', label: 'مدينة الباحة', region: 'city', lat: 20.0129, lng: 41.4677 },
  { id: 'hussam', label: 'منتزه الأمير حسام', region: 'city', lat: 20.01047, lng: 41.44972 },
  { id: 'raghdan', label: 'غابة رغدان', region: 'city', lat: 20.02298, lng: 41.43581 },
  { id: 'makhwah', label: 'محافظة المخواة', region: 'south', lat: 19.776, lng: 41.438 },
  { id: 'baljurashi', label: 'محافظة بلجرشي', region: 'baljurashi', lat: 19.85944, lng: 41.55722 },
  { id: 'mandaq', label: 'محافظة المندق', region: 'mandaq', lat: 20.17887, lng: 41.26408 },
  { id: 'bani-hasan', label: 'بني حسن', region: 'bani-hasan', lat: 20.05224, lng: 41.39772 },
  { id: 'aqiq', label: 'محافظة العقيق', region: 'aqiq', lat: 20.26405, lng: 41.6654 },
  { id: 'qilwah', label: 'محافظة قلوة', region: 'qilwah', lat: 19.9462, lng: 41.2464 },
  { id: 'qura', label: 'محافظة القرى', region: 'qura', lat: 20.1816, lng: 41.3455 },
];

const START_POINT_MATCHERS: [string, RegExp][] = [
  ['hussam', /من (?:منتزه )?الامير حسام|انطلاق.*الامير حسام/],
  ['raghdan', /من (?:غابه |منتزه )?رغدان|انطلاق.*رغدان/],
  ['makhwah', /من (?:محافظه )?المخواه|انطلاق.*المخواه|اقيم في المخواه|نازل في المخواه/],
  ['baljurashi', /من (?:محافظه )?بلجرشي|انطلاق.*بلجرشي|اقيم في بلجرشي|نازل في بلجرشي/],
  ['mandaq', /من (?:محافظه )?المندق|انطلاق.*المندق|اقيم في المندق/],
  ['bani-hasan', /من بني حسن|انطلاق.*بني حسن|اقيم في بني حسن/],
  ['aqiq', /من (?:محافظه )?العقيق|انطلاق.*العقيق/],
  ['qilwah', /من (?:محافظه )?قلوه|انطلاق.*قلوه/],
  ['qura', /من (?:محافظه )?القري|انطلاق.*القري/],
  ['baha-city', /من (?:مدينه )?الباحه|من وسط الباحه|من قلب الباحه|انطلاق.*الباحه|داخل الباحه|اقيم في الباحه/],
];

const WEEKDAY_PATTERNS: [number, RegExp][] = [
  [6, /(?:يوم )?السبت|السبت الجاي|السبت القادم/],
  [0, /(?:يوم )?الاحد|الاحد الجاي|الاحد القادم/],
  [1, /(?:يوم )?الاثنين|الإثنين/],
  [2, /(?:يوم )?الثلاثاء|الثلاثا/],
  [3, /(?:يوم )?الاربعاء|الاربعا/],
  [4, /(?:يوم )?الخميس/],
  [5, /(?:يوم )?الجمعه/],
];

export interface WeeklyMarketRule {
  guideId: string;
  name: string;
  district: string;
  region: string;
  activeDay: number;
  activeDayLabel: string;
  windowLabel: string;
  relatedStopId: string;
  pattern: RegExp;
  alternatives: string[];
}

export const WEEKLY_MARKET_RULES: WeeklyMarketRule[] = [
  {
    guideId: 'saturday-market',
    name: 'سوق السبت التاريخي',
    district: 'بلجرشي',
    region: 'baljurashi',
    activeDay: 6,
    activeDayLabel: 'السبت',
    windowLabel: 'كل يوم سبت صباحًا (نحو 6:00 ص – 12:30 م)',
    relatedStopId: 'baljurashi-center',
    pattern: /سوق السبت/,
    alternatives: ['museums-09', 'khazim-farm'],
  },
  {
    guideId: 'tuesday-market',
    name: 'سوق الثلاثاء الشعبي',
    district: 'المخواة',
    region: 'south',
    activeDay: 2,
    activeDayLabel: 'الثلاثاء',
    windowLabel: 'كل يوم ثلاثاء صباحًا (نحو 6:00 ص – 12:30 م)',
    relatedStopId: 'ain',
    pattern: /سوق الثلاثاء|سوق الثلاثا/,
    alternatives: ['ain', 'shada', 'park-shorouq'],
  },
];

let cachedGuideIndex: IndexedGuideRecord[] | null = null;
export function getIndexedGuideRecords(): IndexedGuideRecord[] {
  if (!cachedGuideIndex) {
    cachedGuideIndex = createGuideRecordIndex(normalizeAr);
  }
  return cachedGuideIndex;
}

/**
 * Current Asia/Riyadh wall-clock date, weekday (0=Sun..6=Sat), minute-of-day, and season.
 */
export function getRiyadhNowInfo(nowDate = new Date()): {
  dateStr: string;
  dayOfWeek: number;
  dayNameAr: string;
  minute: number;
  month: number;
  season: SeasonKey;
} {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(nowDate)
      .map((p) => [p.type, p.value])
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[parts.weekday] ?? nowDate.getDay();
  const month = Number(parts.month) || 5;
  const season: SeasonKey =
    month >= 3 && month <= 5
      ? 'spring'
      : month >= 6 && month <= 8
        ? 'summer'
        : month >= 9 && month <= 11
          ? 'autumn'
          : 'winter';
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    dayOfWeek,
    dayNameAr: WEEKDAY_NAMES_AR[dayOfWeek] || 'اليوم',
    minute: (Number(parts.hour) || 9) * 60 + (Number(parts.minute) || 0),
    month,
    season,
  };
}

export function createInitialConciergeContext(season: SeasonKey): ConciergeContextState {
  return {
    days: null,
    style: null,
    region: 'all',
    pace: 'balanced',
    mode: null,
    place: null,
    activeStopId: null,
    activeGuideId: null,
    season,
    month: null,
    visitDay: null,
    visitDateLabel: null,
    startPoint: null,
    start: null,
    budget: null,
    returnByEnd: null,
    focus: null,
    locked: null,
    lockedIds: [],
    completedIds: [],
    excludedIds: [],
    lastGuideItemId: null,
    recentPlaceIds: [],
    interests: [],
    withChildren: false,
    lessWalking: false,
    hasUnsavedPreview: false,
    pendingClarification: null,
    pendingTopic: null,
    lastPlan: null,
    previousPlan: null,
  };
}

export function parseVisitDayAr(
  normalizedQuestion: string,
  baseDayOfWeek: number
): { dayOfWeek: number; label: string; isExplicit: boolean } | null {
  const sanitizedQuestion = normalizedQuestion
    .replace(/سوق\s+(?:السبت|الثلاثاء|الثلاثا)(?:\s+(?:التاريخي|الشعبي))?/g, ' ')
    .replace(/\s+/g, ' ');
  if (/اليوم|النهارده|هاليوم/.test(sanitizedQuestion)) {
    return {
      dayOfWeek: baseDayOfWeek,
      label: `اليوم (${WEEKDAY_NAMES_AR[baseDayOfWeek]})`,
      isExplicit: true,
    };
  }
  if (/بكره|بكرا|غدا|غداً|تاني يوم/.test(sanitizedQuestion)) {
    const tomorrow = (baseDayOfWeek + 1) % 7;
    return {
      dayOfWeek: tomorrow,
      label: `غدًا (${WEEKDAY_NAMES_AR[tomorrow]})`,
      isExplicit: true,
    };
  }
  for (const [dayNum, pat] of WEEKDAY_PATTERNS) {
    if (pat.test(sanitizedQuestion)) {
      const nextHint = /الجاي|القادم/.test(sanitizedQuestion) ? ' القادم' : '';
      return {
        dayOfWeek: dayNum,
        label: `يوم ${WEEKDAY_NAMES_AR[dayNum]}${nextHint}`,
        isExplicit: true,
      };
    }
  }
  return null;
}

export function parseStartPointAr(normalizedQuestion: string): StartPointRef | null {
  for (const [id, pat] of START_POINT_MATCHERS) {
    if (pat.test(normalizedQuestion)) {
      return START_POINT_REFS.find((s) => s.id === id) || null;
    }
  }
  return null;
}

export function getStartPointRef(labelOrId: string | null | undefined): StartPointRef {
  if (labelOrId) {
    const byKey = START_POINT_REFS.find(
      (ref) => ref.id === labelOrId || normalizeAr(ref.label) === normalizeAr(labelOrId)
    );
    if (byKey) return byKey;
    const stop = places.get(labelOrId);
    if (stop) return { id: stop.id, label: stop.name, region: stop.region, lat: stop.lat, lng: stop.lng };
  }
  return START_POINT_REFS[0];
}

function normalizeClockHour(rawHour: number, periodHint: string): number {
  const h = rawHour % 24;
  if (/م|مسا|عصر|بعد الظهر|ليل/.test(periodHint)) {
    return h < 12 ? h + 12 : h;
  }
  if (/ص|صباح|فجر/.test(periodHint)) {
    return h === 12 ? 0 : h;
  }
  return h >= 1 && h <= 6 ? h + 12 : h;
}

export function parseTimeWindowAndReturnAr(normalizedQuestion: string): {
  start: number | null;
  budget: number | null;
  returnByEnd: number | null;
} {
  let start: number | null = null;
  let budget: number | null = null;
  let returnByEnd: number | null = null;

  if (/بعد الغداء|بعد الغدا/.test(normalizedQuestion)) {
    start = 13 * 60 + 30;
  } else if (/من الصبح|الصباح الباكر|صباحا/.test(normalizedQuestion)) {
    start = 9 * 60;
  } else if (/بعد العصر|المساء/.test(normalizedQuestion)) {
    start = 16 * 60;
  }

  const returnMatch = normalizedQuestion.match(
    /(?:ارجع|نرجع|عوده|الرجوع|قبل|لحد|الي|إلى|حتى)(?:.{0,16}?)(?:الساعه\s*)?(\d{1,2})(?::(\d{2}))?\s*(ص|صباحا|صباح|م|مساء|مسا|عصر|العصر|المساء)?/
  );
  if (returnMatch) {
    const hr = Number(returnMatch[1]);
    const mn = Number(returnMatch[2] || 0);
    const hint = returnMatch[3] || (hr <= 10 ? 'مساء' : '');
    const h24 = normalizeClockHour(hr, hint);
    if (h24 >= 8 && h24 <= 23) {
      returnByEnd = h24 * 60 + mn;
    }
  }

  const startMatch = normalizedQuestion.match(
    /(?:من|ابدا|نبدأ|الساعه|ساعه|في تمام)\s*(?:الساعه\s*)?(\d{1,2})(?::(\d{2}))?\s*(ص|صباحا|صباح|م|مساء|مسا|عصر|العصر|ظهر)?/
  );
  if (startMatch) {
    const hr = Number(startMatch[1]);
    const mn = Number(startMatch[2] || 0);
    const hint = startMatch[3] || '';
    const candidate = normalizeClockHour(hr, hint) * 60 + mn;
    if (candidate >= 360 && candidate <= 22 * 60 && candidate !== returnByEnd) {
      start = candidate;
    }
  }

  const hoursMatch = normalizedQuestion.match(/(\d+|ساعتين|ثلاث ساعات|اربع ساعات|خمس ساعات|نصف يوم)\s*ساع?/);
  if (/نصف يوم/.test(normalizedQuestion)) budget = 240;
  else if (/ساعتين/.test(normalizedQuestion)) budget = 120;
  else if (/ثلاث ساعات|٣ ساعات/.test(normalizedQuestion)) budget = 180;
  else if (/اربع ساعات|٤ ساعات/.test(normalizedQuestion)) budget = 240;
  else if (/خمس ساعات|٥ ساعات/.test(normalizedQuestion)) budget = 300;
  else if (hoursMatch && /^\d+$/.test(hoursMatch[1])) {
    budget = Math.min(10, Math.max(1, Number(hoursMatch[1]))) * 60;
  }

  if (start !== null && returnByEnd !== null && returnByEnd > start) {
    budget = returnByEnd - start;
  }

  return { start, budget, returnByEnd };
}

/**
 * Computes driving duration and label distinguishing verified route table legs from estimated mountain legs.
 */
export function computeLegDetailed(
  from: Pick<StopBase, 'id' | 'lat' | 'lng'> | { id?: string; lat: number; lng: number },
  to: StopBase
): {
  minutes: number;
  km: number | null;
  mode: 'computed' | 'estimated';
  label: string;
} {
  if ('id' in from && from.id && geo.routes[`${from.id}-${to.id}`]) {
    const leg = geo.routes[`${from.id}-${to.id}`];
    return {
      minutes: leg.min,
      km: leg.km,
      mode: 'computed',
      label: `وقت قيادة محسوب على الطريق (${formatNum(leg.min)} دقيقة · ${formatNum(leg.km)} كم)`,
    };
  }
  const fromStop: StopBase = {
    id: from.id || 'origin',
    name: '',
    region: '',
    tag: '',
    desc: '',
    types: ['family'],
    min: 0,
    lat: from.lat,
    lng: from.lng,
    image: '',
  };
  const leg = tripLeg(fromStop, to);
  const approxKm = Math.round(tripDistance(fromStop, to) * 1.42);
  if (!leg.estimated && leg.km !== null) {
    return {
      minutes: leg.min,
      km: leg.km,
      mode: 'computed',
      label: `وقت قيادة محسوب على الطريق (${formatNum(leg.min)} دقيقة · ${formatNum(leg.km)} كم)`,
    };
  }
  return {
    minutes: leg.min,
    km: approxKm || null,
    mode: 'estimated',
    label: `وقت انتقال تقديري (${formatNum(leg.min)} دقيقة)`,
  };
}

export function getHoursStatusLabel(stop: StopBase): string {
  const hv = stop.operational?.hoursVerified;
  if (hv) {
    return `${hv.label} (${hv.source})`;
  }
  return UNCONFIRMED_HOURS_NOTICE;
}

export function getGuideThumbnailUrl(place: IndexedGuideRecord): string {
  if (place.trip && places.has(place.trip)) {
    const imgKey = places.get(place.trip)!.image;
    if (images[imgKey]) return images[imgKey];
  }
  const pool = tourGuideCategoryMedia[place.category] || tourGuideCategoryMedia.parks;
  let acc = 0;
  for (let i = 0; i < place.id.length; i += 1) acc = (acc * 31 + place.id.charCodeAt(i)) >>> 0;
  const key = pool[pool.length ? acc % pool.length : 0];
  return tourGuideArtMap[key] || images[key] || '';
}

export function findNearestStopTo(
  referenceStopId: string,
  excludeIds: string[] = []
): { stop: StopBase; leg: ReturnType<typeof computeLegDetailed> } | null {
  const ref = places.get(referenceStopId);
  if (!ref) return null;
  const exclude = new Set([referenceStopId, ...excludeIds]);
  const candidates = stops.filter(
    (s) => !exclude.has(s.id) && (s.operational?.qualifiedPlannable !== false || ['shada', 'baljurashi-center'].includes(s.id))
  );
  if (!candidates.length) return null;
  let best: { stop: StopBase; dist: number } | null = null;
  for (const cand of candidates) {
    const dist = tripDistance(ref, cand);
    if (!best || dist < best.dist) best = { stop: cand, dist };
  }
  if (!best) return null;
  return {
    stop: best.stop,
    leg: computeLegDetailed(ref, best.stop),
  };
}

export function resolveStopIdFromGuideId(guideId: string | null | undefined): string | null {
  if (!guideId) return null;
  if (places.has(guideId)) return guideId;
  const rec = getIndexedGuideRecords().find((r) => r.id === guideId);
  if (rec?.trip && places.has(rec.trip)) return rec.trip;
  return null;
}

export interface PlanBuildOptions {
  days: number;
  region: string;
  style: TripStyle;
  season: SeasonKey;
  month: number | null;
  start: number;
  budget: number;
  returnByEnd: number | null;
  startPointLabel: string | null;
  visitDay: number | null;
  withChildren: boolean;
  lessWalking: boolean;
  indoorOnly: boolean;
  includeIds?: string[];
  excludeIds?: string[];
  lockedIds?: string[];
  completedIds?: string[];
  originCoords?: { lat: number; lng: number } | null;
  includeMarketExclusionNote?: boolean;
  preserveOrder?: boolean;
}

export function buildConstraintPlan(opts: PlanBuildOptions): {
  plan: TripPlan;
  excludedReasons: string[];
  returnLegMinutes: number | null;
  withinReturnWindow: boolean;
} {
  const excludedSet = new Set(opts.excludeIds || []);
  const completedSet = new Set(opts.completedIds || []);
  const lockedSet = new Set(opts.lockedIds || []);
  const excludedReasons: string[] = [];

  const pool = stops.filter((stop) => {
    if (excludedSet.has(stop.id) || completedSet.has(stop.id)) return false;
    const ops = stop.operational;
    if (opts.region !== 'all' && stop.region !== opts.region && !lockedSet.has(stop.id)) {
      return false;
    }
    if (opts.indoorOnly && !ops?.indoorOrCovered && !lockedSet.has(stop.id)) {
      if (ops?.walkingLevel === 'steep' || stop.id === 'khairah-forest-park') {
        excludedReasons.push(`${stop.name}: استُبعد لطبيعته المكشوفة أو انحداره أثناء الأجواء الماطرة/الضبابية.`);
      }
      return false;
    }
    if ((opts.lessWalking || opts.withChildren) && ops?.walkingLevel === 'steep' && !lockedSet.has(stop.id)) {
      excludedReasons.push(`${stop.name}: استُبعدت لتضمنها ${ops.walkingLabel} بينما طُلِب مشي خفيف وملاءمة للعائلة.`);
      return false;
    }
    if (ops?.activeDays && opts.visitDay !== null && !ops.activeDays.includes(opts.visitDay) && !lockedSet.has(stop.id)) {
      if (opts.includeMarketExclusionNote) {
        excludedReasons.push(`${stop.name}: السوق الأسبوعي ينعقد يومًا محددًا ولا يتوافق مع اليوم المختار.`);
      }
      return false;
    }
    return ops?.qualifiedPlannable || opts.includeIds?.includes(stop.id) || lockedSet.has(stop.id) || ['hussam', 'raghdan', 'ain'].includes(stop.id);
  });

  let candidates = pool.filter((s) => {
    if (opts.includeIds?.includes(s.id) || lockedSet.has(s.id)) return true;
    if (opts.style === 'family') return s.types.includes('family') || s.operational?.familyFriendly;
    if (opts.style !== 'all') return s.types.includes(opts.style);
    return true;
  });

  if (candidates.length < 2) {
    candidates = stops.filter(
      (s) =>
        !excludedSet.has(s.id) &&
        !completedSet.has(s.id) &&
        (!opts.lessWalking || s.operational?.walkingLevel !== 'steep') &&
        (!opts.indoorOnly || s.operational?.indoorOrCovered || s.operational?.walkingLevel === 'light')
    );
  }

  // Keep locked stops first, then preferred/include stops, then highest priority family/light-walk
  candidates.sort((a, b) => {
    const aLocked = lockedSet.has(a.id) ? 4 : opts.includeIds?.includes(a.id) ? 3 : 0;
    const bLocked = lockedSet.has(b.id) ? 4 : opts.includeIds?.includes(b.id) ? 3 : 0;
    if (aLocked !== bLocked) return bLocked - aLocked;
    const aQualified = a.operational?.qualifiedPlannable ? 2 : 0;
    const bQualified = b.operational?.qualifiedPlannable ? 2 : 0;
    return bQualified - aQualified;
  });

  const maxPerDay = opts.indoorOnly
    ? 3
    : opts.budget <= 210
      ? 2
      : opts.days > 1
        ? (opts.withChildren || opts.lessWalking ? 3 : 3)
        : 4;
  const maxStops = Math.min(candidates.length, Math.max(opts.days * 2, opts.days * maxPerDay));

  let picked: StopBase[];
  if (opts.preserveOrder && opts.includeIds?.length) {
    const orderedExplicit = opts.includeIds
      .map((id) => places.get(id))
      .filter((s): s is StopBase => Boolean(s && !excludedSet.has(s.id) && !completedSet.has(s.id)));
    picked = orderedExplicit.length ? orderedExplicit : nearbyOrder(candidates.slice(0, maxStops), candidates[0]);
  } else {
    picked = nearbyOrder(candidates.slice(0, maxStops), candidates[0]);
  }

  const startRef = opts.originCoords
    ? { id: 'origin', label: opts.startPointLabel || 'نقطة الانطلاق', region: opts.region, ...opts.originCoords }
    : getStartPointRef(opts.startPointLabel);

  const stations: TimingStation[] = [];
  let cursor = opts.start;
  let day = 1;
  let stopsInDay = 0;
  const targetPerDay = opts.days > 1 ? Math.max(1, Math.ceil(picked.length / opts.days)) : maxPerDay;
  const maxEndOfDay =
    opts.returnByEnd && opts.days === 1
      ? opts.returnByEnd - 20
      : Math.min(20 * 60, Math.max(opts.start + opts.budget, opts.start + 300));

  for (let i = 0; i < picked.length; i += 1) {
    const stop = picked[i];
    if (opts.days > 1 && stopsInDay >= targetPerDay && day < opts.days) {
      day += 1;
      stopsInDay = 0;
      cursor = opts.start;
    }

    const prevStation = stopsInDay > 0 ? stations[stations.length - 1] : null;
    const prev = prevStation ? places.get(prevStation.id) || startRef : startRef;
    let leg = computeLegDetailed(prev, stop);
    const visitDur = opts.lessWalking ? Math.min(stop.min, 60) : stop.min;
    const hv = stop.operational?.hoursVerified;

    let actualStart = stopsInDay === 0 ? opts.start : cursor + leg.minutes;
    if (hv && actualStart < hv.openStartMin) {
      actualStart = hv.openStartMin;
    }

    if (hv && actualStart + Math.min(visitDur, 45) > hv.openEndMin) {
      if (day < opts.days && stopsInDay > 0) {
        day += 1;
        stopsInDay = 0;
        cursor = opts.start;
        leg = computeLegDetailed(startRef, stop);
        actualStart = Math.max(opts.start, hv.openStartMin);
      } else {
        excludedReasons.push(`${stop.name}: الوقت المقترح (${clock(actualStart)}) يتجاوز موعد الإغلاق المنشور (${clock(hv.openEndMin)}).`);
        continue;
      }
    }

    if (actualStart + Math.min(visitDur, 45) > maxEndOfDay) {
      if (day < opts.days) {
        day += 1;
        stopsInDay = 0;
        cursor = opts.start;
        leg = computeLegDetailed(startRef, stop);
        actualStart = Math.max(opts.start, hv?.openStartMin || 0);
      } else {
        excludedReasons.push(`${stop.name}: استُثنيت حفاظًا على موعد الانتهاء والرجوع المحدد.`);
        continue;
      }
    }

    const plannedDur = Math.min(visitDur, Math.max(40, maxEndOfDay - actualStart));
    const end = actualStart + plannedDur;
    stations.push({
      id: stop.id,
      day,
      start: actualStart,
      end,
      drive_minutes: stopsInDay === 0 ? null : leg.minutes,
      drive_estimated: leg.mode === 'estimated',
      drive_mode: leg.mode,
      locked: lockedSet.has(stop.id),
      completed: false,
    });
    cursor = end;
    stopsInDay += 1;
  }

  let returnLegMinutes: number | null = null;
  let withinReturnWindow = true;
  if (stations.length && opts.returnByEnd !== null) {
    const lastStop = places.get(stations[stations.length - 1].id)!;
    const returnDest: StopBase = {
      ...lastStop,
      id: startRef.id,
      lat: startRef.lat,
      lng: startRef.lng,
    };
    const backLeg = computeLegDetailed(lastStop, returnDest);
    returnLegMinutes = backLeg.minutes;
    const finalEnd = stations[stations.length - 1].end;
    if (finalEnd + backLeg.minutes > opts.returnByEnd) {
      withinReturnWindow = false;
    }
  }

  const assumptions = [
    `نقطة الانطلاق: ${startRef.label}`,
    `بداية الجولة: ${clock(opts.start)}`,
    ...(opts.visitDay !== null ? [`يوم الزيارة: ${WEEKDAY_NAMES_AR[opts.visitDay]}`] : []),
    ...(opts.returnByEnd !== null
      ? [`الرجوع قبل: ${clock(opts.returnByEnd)}${returnLegMinutes !== null ? ` (العودة ${formatNum(returnLegMinutes)} د)` : ''}`]
      : []),
    ...(opts.lessWalking || opts.withChildren ? ['تفضيل: مناسب للعائلة بمشي خفيف'] : []),
    ...(opts.indoorOnly ? ['مراعاة الطقس: أولوية للوجهات الداخلية والمغطاة'] : []),
  ];

  const ids = stations.map((s) => s.id);
  const timing: RouteTiming = {
    season: opts.season,
    month: opts.month,
    start: opts.start,
    limit: opts.start + opts.budget,
    locked: opts.lockedIds?.[0] || null,
    lockedIds: [...lockedSet],
    completedIds: [...completedSet],
    visitDay: opts.visitDay,
    startPoint: startRef.label,
    returnByEnd: opts.returnByEnd,
    returnDriveMinutes: returnLegMinutes,
    lessWalking: opts.lessWalking,
    stations,
  };

  return {
    plan: {
      days: String(opts.days),
      region: opts.region,
      style: opts.style,
      ids,
      timing,
      assumptions,
      warnings: excludedReasons,
    },
    excludedReasons,
    returnLegMinutes,
    withinReturnWindow,
  };
}

export function buildItemsFromPlan(plan: TripPlan): ConciergeItem[] {
  return plan.timing.stations
    .map((row) => {
      const stop = places.get(row.id);
      if (!stop) return null;
      const city = stop.operational?.district || stop.region;
      return {
        id: stop.id,
        guideId: stop.operational?.guideId,
        image: images[stop.image] || '',
        action: { type: 'place', value: stop.id, label: `تفاصيل ${stop.name}` },
        title: row.locked ? `${stop.name} · مثبتة` : stop.name,
        detail: `${city} · ${stop.tag}`,
        time: `${clock(row.start)} – ${clock(row.end)}`,
      } as ConciergeItem;
    })
    .filter((x): x is ConciergeItem => Boolean(x));
}

export interface ServerConciergeRequestPayload {
  question?: string;
  intent?: string;
  preference?: { field: string; value: unknown };
  city?: string;
  placeId?: string | null;
  guidePlaceId?: string | null;
  context: ConciergeContextState;
  savedState?: {
    days: string;
    region: string;
    style: TripStyle;
    ids: string[];
    timing: RouteTiming | null;
    completedIds: string[];
    lockedIds: string[];
  };
  weather?: {
    city: string;
    tempC?: number;
    conditionLabel?: string;
    isWet?: boolean;
    source?: string;
    observedAt?: string;
  } | null;
  demoRain?: boolean;
  requestSeq?: number;
}

/**
 * Pure deterministic tool-backed planner invoked both from `/api/concierge` and offline fallback.
 */
export function runGroundedPlannerTurn(
  payload: ServerConciergeRequestPayload
): ConciergeReply {
  const nowRiyadh = getRiyadhNowInfo();
  const nextCtx: ConciergeContextState = {
    ...payload.context,
    lockedIds: [...(payload.context.lockedIds || payload.savedState?.lockedIds || [])],
    completedIds: [...(payload.context.completedIds || payload.savedState?.completedIds || [])],
    interests: [...(payload.context.interests || [])],
  };

  if (payload.placeId && places.has(payload.placeId)) {
    nextCtx.place = payload.placeId;
    nextCtx.activeStopId = payload.placeId;
  }
  if (payload.guidePlaceId) {
    nextCtx.activeGuideId = payload.guidePlaceId;
    const mappedStop = resolveStopIdFromGuideId(payload.guidePlaceId);
    if (mappedStop) {
      nextCtx.place = mappedStop;
      nextCtx.activeStopId = mappedStop;
    }
  }

  const rawText = (payload.question || '').trim();
  const q = normalizeAr(rawText);
  const intent = payload.intent || '';

  // 1) Handle explicit today re-plan action or spoken/typed re-plan request
  if (
    intent === 'replan-remaining' ||
    /اعد ترتيب المتبقي|اعاده ترتيب المتبقي|تعديل بقيه اليوم|تحديث المسار اليوم/.test(q)
  ) {
    const baseIds =
      nextCtx.lastPlan?.ids.length
        ? nextCtx.lastPlan.ids
        : payload.savedState?.ids || [];
    const remainingIds = baseIds.filter((id) => !nextCtx.completedIds.includes(id));
    if (!remainingIds.length) {
      return {
        text: 'كل محطات خطتك مسجّلة كمكتملة الآن! يمكنك بدء خطة جديدة أو استكشاف وجهة أخرى من الدليل.',
        speechText: 'تم إكمال جميع محطات خطتك الحالية.',
        context: nextCtx,
        sourceMode: 'demo',
      };
    }
    const lastCompletedId = nextCtx.completedIds[nextCtx.completedIds.length - 1];
    const lastCompletedStop = lastCompletedId ? places.get(lastCompletedId) : null;
    const startClock = Math.max(nowRiyadh.minute, nextCtx.start || 9 * 60, 9 * 60);
    const rebuilt = buildConstraintPlan({
      days: Number(nextCtx.days || payload.savedState?.days || 1),
      region: nextCtx.region || 'all',
      style: nextCtx.style || 'family',
      season: nextCtx.season || nowRiyadh.season,
      month: nextCtx.month,
      start: startClock,
      budget: nextCtx.budget || 360,
      returnByEnd: nextCtx.returnByEnd,
      startPointLabel: lastCompletedStop?.name || nextCtx.startPoint || 'مدينة الباحة',
      visitDay: nextCtx.visitDay ?? nowRiyadh.dayOfWeek,
      withChildren: nextCtx.withChildren,
      lessWalking: nextCtx.lessWalking,
      indoorOnly: Boolean(payload.demoRain || payload.weather?.isWet),
      includeIds: remainingIds,
      lockedIds: nextCtx.lockedIds,
      completedIds: nextCtx.completedIds,
      originCoords: lastCompletedStop ? { lat: lastCompletedStop.lat, lng: lastCompletedStop.lng } : null,
    });
    nextCtx.lastPlan = rebuilt.plan;
    nextCtx.hasUnsavedPreview = true;
    const first = places.get(rebuilt.plan.ids[0]);
    return {
      text: `أعدت ترتيب المحطات المتبقية بدءًا من ${clock(startClock)} مع تثبيت المحطات المختارة. اضغط على أي وجهة للتفاصيل:`,
      speechText: `أعدت ترتيب المحطات المتبقية من الساعة ${clock(startClock)}. المحطة التالية هي ${first?.name || 'الأولى'}.`,
      plan: rebuilt.plan,
      items: buildItemsFromPlan(rebuilt.plan),
      actions: [
        { type: 'preview-plan', value: rebuilt.plan, label: 'عاين التعديل' },
        { type: 'apply-plan', value: rebuilt.plan, label: 'احفظ التعديل' },
        ...(first ? [{ type: 'dock-map-stop', value: first.id, label: 'اعرض على الخريطة' } as ConciergeAction] : []),
      ],
      context: nextCtx,
      sourceMode: 'demo',
    };
  }

  // 2) Rain / Bad Weather Scenario or Live Wet Weather
  if (
    intent === 'rain-demo' ||
    payload.demoRain ||
    /امطار|مطر|الامطار الغزيره|ضباب|جو ممطر|طقس سيئ|اذا المطر|وقت المطر/.test(q) ||
    (intent === 'weather-plan' && payload.weather?.isWet)
  ) {
    const startInfo = parseStartPointAr(q);
    const timeWin = parseTimeWindowAndReturnAr(q);
    const startPoint = startInfo?.label || nextCtx.startPoint || 'مدينة الباحة';
    const startMin = timeWin.start ?? nextCtx.start ?? 9 * 60;
    const budgetMin = timeWin.budget ?? nextCtx.budget ?? 360;
    const returnBy = timeWin.returnByEnd ?? nextCtx.returnByEnd ?? 18 * 60;
    nextCtx.startPoint = startPoint;
    nextCtx.start = startMin;
    nextCtx.returnByEnd = returnBy;
    nextCtx.mode = 'plan';

    const rebuilt = buildConstraintPlan({
      days: 1,
      region: nextCtx.region || 'all',
      style: 'family',
      season: nextCtx.season || nowRiyadh.season,
      month: nextCtx.month,
      start: startMin,
      budget: budgetMin,
      returnByEnd: returnBy,
      startPointLabel: startPoint,
      visitDay: nextCtx.visitDay ?? nowRiyadh.dayOfWeek,
      withChildren: true,
      lessWalking: true,
      indoorOnly: true,
      lockedIds: nextCtx.lockedIds,
      completedIds: nextCtx.completedIds,
    });
    nextCtx.lastPlan = rebuilt.plan;
    nextCtx.hasUnsavedPreview = true;
    const weatherSrc = payload.weather?.source || 'Open-Meteo';
    const weatherState = payload.demoRain
      ? 'محاكاة أمطار وضباب على المرتفعات'
      : payload.weather?.conditionLabel
        ? `${payload.weather.conditionLabel}${typeof payload.weather.tempC === 'number' ? ` (${formatNum(Math.round(payload.weather.tempC))}°)` : ''}`
        : 'أجواء ماطرة ومغيمة';
    const first = places.get(rebuilt.plan.ids[0]);
    return {
      text: `خطة مقترحة للأجواء الماطرة (${weatherState}) بأولوية المواقع المغطاة. اضغط على أي وجهة للتفاصيل:`,
      speechText: `مع الأجواء الماطرة والضباب، رتبت لك مسارًا داخليًا ومغطى يبدأ بـ ${first?.name || 'المتحف الأبنوي'}.`,
      plan: rebuilt.plan,
      items: buildItemsFromPlan(rebuilt.plan),
      actions: [
        { type: 'preview-plan', value: rebuilt.plan, label: 'عاين التعديل' },
        { type: 'apply-plan', value: rebuilt.plan, label: 'احفظ التعديل' },
        ...(first ? [{ type: 'dock-map-stop', value: first.id, label: 'اعرض على الخريطة' } as ConciergeAction] : []),
      ],
      context: nextCtx,
      sourceMode: 'demo',
    };
  }

  // 3) Check "أول محطة" / "المحطة الأولى" / Explicit Map Navigation Command: "ورّني X على الخريطة"
  const activePlan = nextCtx.lastPlan || (payload.savedState?.timing ? {
    days: payload.savedState.days,
    region: payload.savedState.region,
    style: payload.savedState.style,
    ids: payload.savedState.ids,
    timing: payload.savedState.timing,
  } : null);

  if (/اول محطه|المحطه الاولي/.test(q) && /ورني|اعرض|خريطه|خريط/.test(q)) {
    const firstId = activePlan?.ids[0] || payload.savedState?.ids[0] || 'hussam';
    const firstStop = places.get(firstId);
    if (firstStop) {
      nextCtx.activeStopId = firstStop.id;
      nextCtx.place = firstStop.id;
      const inSaved = Boolean(payload.savedState?.ids.includes(firstStop.id));
      const dockTarget: ConciergeDockTarget = {
        kind: 'map-stop',
        stopId: firstStop.id,
        isExploration: !inSaved,
        message: `المحطة الأولى: ${firstStop.name}`,
      };
      return {
        text: `هذه أول محطة على الخريطة: ${firstStop.name} (${firstStop.operational?.district || ''}). المدة المقترحة ${formatNum(firstStop.min)} دقيقة.`,
        speechText: `أعرض لك الآن المحطة الأولى ${firstStop.name} على الخريطة.`,
        dockTarget,
        actions: [
          { type: 'dock-map-stop', value: firstStop.id, label: 'اعرض على الخريطة' },
        ],
        context: nextCtx,
        sourceMode: 'demo',
      };
    }
  }

  // 4) Nearest station / proximity question: "وش أقرب محطة لها؟" or "أقرب وجهة لذي عين"
  if (/اقرب محطه|اقرب مكان|اقرب وجهه|جنبها|قريب منها/.test(q)) {
    const records = getIndexedGuideRecords();
    const explicitStop = stops.find((s) => q.includes(normalizeAr(s.name)));
    const refId = explicitStop?.id || nextCtx.activeStopId || nextCtx.place || activePlan?.ids[0] || 'hussam';
    const refStop = places.get(refId);
    if (refStop) {
      const nearest = findNearestStopTo(refStop.id);
      if (nearest) {
        const hoursTxt = getHoursStatusLabel(nearest.stop);
        const guideMatch = records.find((r) => r.id === nearest.stop.operational?.guideId);
        return {
          text: `أقرب محطة إلى «${refStop.name}» هي ${nearest.stop.name} (${formatNum(nearest.leg.minutes)} د تقريبًا):`,
          speechText: `أقرب محطة إلى ${refStop.name} هي ${nearest.stop.name}، وتبعد ${nearest.leg.minutes} دقيقة تقريبًا.`,
          items: [
            {
              id: nearest.stop.id,
              guideId: guideMatch?.id,
              image: images[nearest.stop.image] || '',
              title: nearest.stop.name,
              detail: `${nearest.stop.operational?.district || ''} · ${nearest.stop.tag}`,
              action: { type: 'place', value: nearest.stop.id, label: `تفاصيل ${nearest.stop.name}` },
            },
          ],
          actions: [
            { type: 'dock-map-stop', value: nearest.stop.id, label: 'اعرض على الخريطة' },
            { type: 'stop', value: { id: nearest.stop.id, add: true }, label: `أضف ${nearest.stop.name}` },
          ],
          context: nextCtx,
          sourceMode: 'demo',
        };
      }
    }
  }

  // 5) Missing coordinates check when asking to show a guide record that lacks coordinates
  const guideRecords = getIndexedGuideRecords();
  const explicitGuideMatch = guidePlaceAliases.find(([, pat]) => pat.test(q))?.[0] ||
    guideRecords.find((r) => q.length >= 4 && q.includes(normalizeAr(r.name)))?.id ||
    null;

  // Map inspection request: "ورّني X على الخريطة" / "اعرض X على الخريطة" / "وين ذي عين على الخريطة"
  if (/(?:ورني|وريني|اعرض|اظهر|شوف|فرجني|افتح).*خريط/.test(q) || intent === 'show-on-map') {
    const wantsFirstStop = /اول محط|اول وجه|المحطه الاول/.test(q);
    const firstPlanStopId = activePlan?.ids[0] || payload.savedState?.ids[0] || stops[0]?.id || null;
    const targetGuide = explicitGuideMatch ? guideRecords.find((r) => r.id === explicitGuideMatch) : null;
    const stopFromGuide = targetGuide?.trip && places.has(targetGuide.trip) ? places.get(targetGuide.trip)! : null;
    const directStop = wantsFirstStop
      ? (firstPlanStopId ? places.get(firstPlanStopId) || null : null)
      : stopFromGuide ||
        stops.find((s) => q.includes(normalizeAr(s.name))) ||
        (nextCtx.activeStopId ? places.get(nextCtx.activeStopId) : null) ||
        (firstPlanStopId && /المحط/.test(q) ? places.get(firstPlanStopId) || null : null);

    if (targetGuide && !targetGuide.coordinates && !stopFromGuide) {
      const nearGuide = guideRecords.find((r) => r.district === targetGuide.district && r.trip && places.has(r.trip));
      return {
        text: `«${targetGuide.name}» (${targetGuide.district}) لا يتضمن إحداثيات للخريطة التفاعلية؛ يمكنك فتح تفاصيله من البطاقة.${nearGuide ? ` أقرب معلم بإحداثيات متاحة: ${nearGuide.name}.` : ''}`,
        speechText: `وجهة ${targetGuide.name} غير مزودة بإحداثيات للخريطة التفاعلية، لكن يمكنك فتح تفاصيلها من الدليل.`,
        dockTarget: {
          kind: 'guide-place',
          guideId: targetGuide.id,
          missingCoordinates: true,
        },
        items: [
          {
            guideId: targetGuide.id,
            image: getGuideThumbnailUrl(targetGuide),
            title: targetGuide.name,
            detail: `${targetGuide.district} · ${targetGuide.categoryLabel}`,
            action: { type: 'guide-place', value: targetGuide.id, label: 'اعرض التفاصيل' },
          },
        ],
        actions: [
          { type: 'guide-place', value: targetGuide.id, label: 'اعرض تفاصيل الوجهة' },
          ...(nearGuide?.trip ? [{ type: 'dock-map-stop', value: nearGuide.trip, label: `اعرض ${nearGuide.name} على الخريطة` } as ConciergeAction] : []),
        ],
        context: nextCtx,
        sourceMode: 'demo',
      };
    }

    if (directStop) {
      const inSaved = Boolean(payload.savedState?.ids.includes(directStop.id));
      nextCtx.activeStopId = directStop.id;
      nextCtx.place = directStop.id;
      return {
        text: `${directStop.name} (${directStop.operational?.district || directStop.region}) جاهزة على الخريطة.`,
        speechText: `أعرض لك ${directStop.name} الآن على الخريطة.`,
        dockTarget: {
          kind: 'map-stop',
          stopId: directStop.id,
          isExploration: !inSaved,
          message: inSaved ? `محطة في خطتك: ${directStop.name}` : `تستكشف الآن ${directStop.name}`,
        },
        actions: [
          { type: 'dock-map-stop', value: directStop.id, label: 'اعرض على الخريطة' },
        ],
        context: nextCtx,
        sourceMode: 'demo',
      };
    }
  }

  // 6) Active destination page context: "أقدر أضيفها بعد الغداء؟" / adding current page place into itinerary
  const contextualAddAsk = /(?:اقدر|يمديني|ممكن|هل).*(?:اضيفها|اضيفه|أضيفها|نزورها|ازورها|نضيفها)|بعد الغداء/.test(q);
  if (
    contextualAddAsk ||
    ((payload.placeId || payload.guidePlaceId) && /اضف|اضيف|بعد الغداء|الساعه|هذا المكان|هنا|نفسها/.test(q))
  ) {
    const resolvedId =
      resolveStopIdFromGuideId(explicitGuideMatch) ||
      nextCtx.activeStopId ||
      nextCtx.place ||
      resolveStopIdFromGuideId(payload.guidePlaceId) ||
      payload.placeId ||
      'ain';
    const targetStop = places.get(resolvedId);
    if (targetStop) {
      const startTime = parseTimeWindowAndReturnAr(q).start ?? 13 * 60 + 30;
      const originRef = getStartPointRef(nextCtx.startPoint || 'مدينة الباحة');
      const priorStopId = activePlan?.ids[activePlan.ids.length - 1];
      const priorStop = priorStopId && priorStopId !== targetStop.id ? places.get(priorStopId) : null;
      const leg = computeLegDetailed(priorStop || originRef, targetStop);
      const arriveMin = startTime + leg.minutes;
      const visitDur = targetStop.min;
      const departMin = arriveMin + visitDur;
      const hv = targetStop.operational?.hoursVerified;
      const openEnd = hv?.openEndMin ?? 22 * 60;
      const fits = arriveMin >= (hv?.openStartMin ?? 0) && departMin <= openEnd;

      const updatedIds = [...new Set([...(activePlan?.ids || ['hussam', 'raghdan']), targetStop.id])];
      const rebuilt = buildConstraintPlan({
        days: Number(activePlan?.days || nextCtx.days || 1),
        region: 'all',
        style: activePlan?.style || 'all',
        season: nextCtx.season || nowRiyadh.season,
        month: nextCtx.month,
        start: activePlan?.timing.start || 9 * 60,
        budget: 540,
        returnByEnd: nextCtx.returnByEnd,
        startPointLabel: originRef.label,
        visitDay: nextCtx.visitDay ?? nowRiyadh.dayOfWeek,
        withChildren: nextCtx.withChildren,
        lessWalking: false,
        indoorOnly: false,
        includeIds: updatedIds,
        lockedIds: nextCtx.lockedIds,
      });

      if (fits) {
        nextCtx.lastPlan = rebuilt.plan;
        nextCtx.hasUnsavedPreview = true;
        return {
          text: `نعم، تناسب إضافة «${targetStop.name}» الساعة ${clock(arriveMin)} (${formatNum(visitDur)} د) ضمن المواعيد. اضغط على أي محطة للتفاصيل:`,
          speechText: `نعم، تقدر تضيف ${targetStop.name} بعد الغداء الساعة ${clock(arriveMin)} وتنهي الزيارة قبل موعد الإغلاق.`,
          plan: rebuilt.plan,
          items: buildItemsFromPlan(rebuilt.plan),
          actions: [
            { type: 'preview-plan', value: rebuilt.plan, label: 'عاين التعديل' },
            { type: 'apply-plan', value: rebuilt.plan, label: 'احفظ التعديل' },
            { type: 'dock-map-stop', value: targetStop.id, label: 'اعرض على الخريطة' },
          ],
          context: nextCtx,
          sourceMode: 'demo',
        };
      } else {
        return {
          text: `إضافة «${targetStop.name}» بعد الغداء تتعارض مع موعد الإغلاق (${clock(openEnd)}). يفضّل تقديم الزيارة صباحًا.`,
          speechText: `الوقت بعد الغداء قريب من موعد إغلاق ${targetStop.name}. أنصحك بتقديم الزيارة صباحًا.`,
          actions: [
            { type: 'dock-map-stop', value: targetStop.id, label: 'اعرض على الخريطة' },
          ],
          context: nextCtx,
          sourceMode: 'demo',
        };
      }
    }
  }

  // 7) Weekly Market Rule Check (Saturday Market / Tuesday Market)
  const mentionedMarket = WEEKLY_MARKET_RULES.find((m) => m.pattern.test(q));
  const resolvedDay = parseVisitDayAr(q, nowRiyadh.dayOfWeek);
  const effectiveDay: number | null =
    resolvedDay?.dayOfWeek ?? nextCtx.visitDay;
  const hasPendingMarket = Boolean(
    !intent &&
      nextCtx.pendingTopic &&
      WEEKLY_MARKET_RULES.some((m) => m.guideId === nextCtx.pendingTopic)
  );

  if (mentionedMarket || ((nextCtx.pendingClarification === 'day' || hasPendingMarket) && resolvedDay)) {
    const activeMarket =
      mentionedMarket ||
      WEEKLY_MARKET_RULES.find((m) => m.guideId === nextCtx.pendingTopic) ||
      WEEKLY_MARKET_RULES[0];
    const dayNum = resolvedDay?.dayOfWeek ?? null;

    if (dayNum === null && (mentionedMarket || nextCtx.visitDay === null)) {
      nextCtx.pendingClarification = 'day';
      nextCtx.pendingTopic = activeMarket.guideId;
      return {
        text: `«${activeMarket.name}» في ${activeMarket.district} ينعقد **${activeMarket.windowLabel}** فقط.\nأي يوم تخطط لزيارتك حتى أؤكد لك إمكانية إدراجه أو أقترح البديل الأنسب؟`,
        actions: [
          { type: 'intent', value: { text: `يوم ${activeMarket.activeDayLabel} ${activeMarket.name}` }, label: `زيارة يوم ${activeMarket.activeDayLabel}` },
          { type: 'intent', value: { text: `يوم الخميس ${activeMarket.name}` }, label: 'زيارة يوم الخميس (اعرض البديل)' },
        ],
        context: nextCtx,
        sourceMode: 'demo',
      };
    }

    const chosenDay = dayNum ?? effectiveDay ?? nowRiyadh.dayOfWeek;
    nextCtx.visitDay = chosenDay;
    nextCtx.visitDateLabel = `يوم ${WEEKDAY_NAMES_AR[chosenDay]}`;
    nextCtx.pendingClarification = null;

    if (chosenDay !== activeMarket.activeDay) {
      nextCtx.pendingTopic = activeMarket.guideId;
      const altPlan = buildConstraintPlan({
        days: 1,
        region: activeMarket.region,
        style: 'heritage',
        season: nextCtx.season || nowRiyadh.season,
        month: nextCtx.month,
        start: 9 * 60,
        budget: 360,
        returnByEnd: nextCtx.returnByEnd,
        startPointLabel: `محافظة ${activeMarket.district}`,
        visitDay: chosenDay,
        withChildren: nextCtx.withChildren,
        lessWalking: nextCtx.lessWalking,
        indoorOnly: false,
        includeIds: activeMarket.alternatives,
        includeMarketExclusionNote: true,
      });
      nextCtx.lastPlan = altPlan.plan;
      nextCtx.hasUnsavedPreview = true;
      const altNames = activeMarket.alternatives
        .map((id) => places.get(id)?.name)
        .filter(Boolean)
        .join('، ');
      return {
        text: `تنبيه: «${activeMarket.name}» لا ينعقد يوم **${WEEKDAY_NAMES_AR[chosenDay]}** لأن موعده المنشور هو **${activeMarket.windowLabel}**.\nاستبعدت السوق من خطة ${WEEKDAY_NAMES_AR[chosenDay]} وأعددتُ لك بديلًا قريبًا في ${activeMarket.district}: ${altNames}.`,
        plan: altPlan.plan,
        items: buildItemsFromPlan(altPlan.plan),
        actions: [
          { type: 'preview-plan', value: altPlan.plan, label: 'عاين التعديل' },
          { type: 'dock-map-stop', value: activeMarket.alternatives[0], label: 'اعرض البديل على الخريطة' },
          { type: 'intent', value: { text: `يوم ${activeMarket.activeDayLabel}` }, label: `رتّبها يوم ${activeMarket.activeDayLabel}` },
        ],
        context: nextCtx,
        sourceMode: 'demo',
      };
    }

    nextCtx.pendingTopic = null;
    const marketPlan = buildConstraintPlan({
      days: 1,
      region: activeMarket.region,
      style: 'heritage',
      season: nextCtx.season || nowRiyadh.season,
      month: nextCtx.month,
      start: 8 * 60,
      budget: 360,
      returnByEnd: nextCtx.returnByEnd,
      startPointLabel: `محافظة ${activeMarket.district}`,
      visitDay: chosenDay,
      withChildren: nextCtx.withChildren,
      lessWalking: nextCtx.lessWalking,
      indoorOnly: false,
      includeIds: [activeMarket.relatedStopId, ...activeMarket.alternatives],
      includeMarketExclusionNote: true,
    });
    nextCtx.lastPlan = marketPlan.plan;
    nextCtx.hasUnsavedPreview = true;
    return {
      text: `يوافق يوم ${WEEKDAY_NAMES_AR[chosenDay]} موعد «${activeMarket.name}» في بداية المسار. اضغط على أي محطة للتفاصيل:`,
      speechText: `ممتاز، يوم ${WEEKDAY_NAMES_AR[chosenDay]} صباحًا يوافق موعد ${activeMarket.name}. أدرجته في بداية خطتك.`,
      plan: marketPlan.plan,
      items: buildItemsFromPlan(marketPlan.plan),
      actions: [
        { type: 'preview-plan', value: marketPlan.plan, label: 'عاين التعديل' },
        { type: 'apply-plan', value: marketPlan.plan, label: 'احفظ التعديل' },
        { type: 'dock-map-stop', value: activeMarket.relatedStopId, label: 'اعرض على الخريطة' },
      ],
      context: nextCtx,
      sourceMode: 'demo',
    };
  }

  // 8) Pin / Lock, Swap / Replace, or Reschedule inside chat
  if (/ثبت|اقفل/.test(q)) {
    const targetStop = stops.find((s) => q.includes(normalizeAr(s.name))) || (nextCtx.activeStopId ? places.get(nextCtx.activeStopId) : null);
    if (targetStop) {
      if (!nextCtx.lockedIds.includes(targetStop.id)) nextCtx.lockedIds.push(targetStop.id);
      nextCtx.locked = targetStop.id;
      return {
        text: `تم تثبيت محطة «${targetStop.name}» في خطتك، ولن تتغير أو تُستبدل عند إعادة الترتيب.`,
        speechText: `ثبّت لك محطة ${targetStop.name}.`,
        actions: [{ type: 'lock-stop', value: targetStop.id, label: 'ثبّت المحطة' }],
        context: nextCtx,
        sourceMode: 'demo',
      };
    }
  }

  if (/بدل|استبدل|غير المحطه/.test(q) && activePlan) {
    const targetStop =
      stops.find((s) => q.includes(normalizeAr(s.name))) ||
      (nextCtx.activeStopId ? places.get(nextCtx.activeStopId) : places.get(activePlan.ids[0]));
    if (targetStop) {
      const replacement = stops.find(
        (s) =>
          s.id !== targetStop.id &&
          !activePlan.ids.includes(s.id) &&
          s.operational?.qualifiedPlannable &&
          (!nextCtx.lessWalking || s.operational.walkingLevel !== 'steep')
      );
      if (replacement) {
        const newIds = activePlan.ids.map((id) => (id === targetStop.id ? replacement.id : id));
        const rebuilt = buildConstraintPlan({
          days: Number(activePlan.days || 1),
          region: 'all',
          style: activePlan.style,
          season: nextCtx.season || nowRiyadh.season,
          month: nextCtx.month,
          start: activePlan.timing.start,
          budget: 480,
          returnByEnd: nextCtx.returnByEnd,
          startPointLabel: nextCtx.startPoint || 'مدينة الباحة',
          visitDay: nextCtx.visitDay,
          withChildren: nextCtx.withChildren,
          lessWalking: nextCtx.lessWalking,
          indoorOnly: false,
          includeIds: newIds,
          lockedIds: nextCtx.lockedIds,
        });
        nextCtx.lastPlan = rebuilt.plan;
        nextCtx.hasUnsavedPreview = true;
        return {
          text: `بدّلت «${targetStop.name}» بمحطة ${replacement.name}. اضغط على أي محطة للتفاصيل:`,
          speechText: `بدلت ${targetStop.name} بمحطة ${replacement.name}.`,
          plan: rebuilt.plan,
          items: buildItemsFromPlan(rebuilt.plan),
          actions: [
            { type: 'preview-plan', value: rebuilt.plan, label: 'عاين التعديل' },
            { type: 'apply-plan', value: rebuilt.plan, label: 'احفظ التعديل' },
            { type: 'dock-map-stop', value: replacement.id, label: 'اعرض على الخريطة' },
          ],
          context: nextCtx,
          sourceMode: 'demo',
        };
      }
    }
  }

  // 9) Full Multi-Constraint Trip Planning ("أبغى رحلة عائلية..." / "خطط لي يوم في الباحة..." / "عايزك ترتبلي رحلة")
  const withChildren = /عايل|عائليه|عائلة|اطفال|اولاد|عائلي/.test(q);
  const lessWalking = /مشي خفيف|مشي اقل|بدون مشي|كبار السن|مريحه|سهله/.test(q) || withChildren;
  const startInfo = parseStartPointAr(q);
  const timeWin = parseTimeWindowAndReturnAr(q);
  const dayMatch = parseVisitDayAr(q, nowRiyadh.dayOfWeek);

  const isPlanningAsk =
    intent === 'plan' ||
    intent === 'timed-plan' ||
    /خطط|خطه|رحله|مسار|برنامج|جوله|رتب|ترتب|نظّم|نظم/.test(q) ||
    Boolean(startInfo || timeWin.returnByEnd || (dayMatch && withChildren));

  if (isPlanningAsk) {
    // Check if visitor asked simply "أبغى رحلة عائلية" without any starting point, day, or duration -> ask 1 helpful targeted question!
    const underspecifiedFamily =
      withChildren &&
      !dayMatch &&
      !startInfo &&
      timeWin.start === null &&
      timeWin.returnByEnd === null &&
      !/\d|يوم|ايام|صباح|مساء|م/.test(q) &&
      q.length < 36 &&
      nextCtx.visitDay === null &&
      nextCtx.startPoint === null;

    if (underspecifiedFamily) {
      nextCtx.withChildren = true;
      nextCtx.lessWalking = true;
      nextCtx.style = 'family';
      nextCtx.mode = 'plan';
      return {
        text: 'من أين تنطلق وما اليوم أو الوقت المناسب لرحلتك العائلية؟',
        speechText: 'بكل سرور، لترتيب رحلة عائلية بمشي خفيف، من أين تنطلق وما هو اليوم أو الوقت المناسب لك؟',
        actions: [
          {
            type: 'intent',
            value: { text: 'السبت من مدينة الباحة من 9 الصبح وأرجع قبل 6 المساء مع أطفال ومشي خفيف' },
            label: 'السبت من الباحة (9 ص – 6 م)',
          },
          {
            type: 'intent',
            value: { text: 'اليوم من مدينة الباحة نصف يوم عائلي بمشي خفيف' },
            label: 'اليوم نصف يوم في الباحة',
          },
        ],
        context: nextCtx,
        sourceMode: 'demo',
      };
    }

    const daysCount = /يومان|يومين/.test(q)
      ? 2
      : /ثلاثه|3/.test(q)
        ? 3
        : /اربعه|4/.test(q)
          ? 4
          : 1;
    const visitDay = dayMatch?.dayOfWeek ?? nextCtx.visitDay ?? nowRiyadh.dayOfWeek;
    const startPoint = startInfo?.label || nextCtx.startPoint || 'مدينة الباحة';
    const startMin = timeWin.start ?? nextCtx.start ?? 9 * 60;
    const returnBy = timeWin.returnByEnd ?? nextCtx.returnByEnd ?? (startMin <= 11 * 60 ? 18 * 60 : null);
    const budgetMin = timeWin.budget ?? (returnBy && returnBy > startMin ? returnBy - startMin : 420);

    nextCtx.days = String(daysCount);
    nextCtx.style = withChildren ? 'family' : /تراث|تاريخ/.test(q) ? 'heritage' : /طبيع|غابه|جبال/.test(q) ? 'nature' : 'all';
    nextCtx.region = startInfo?.region || nextCtx.region || 'all';
    nextCtx.withChildren = withChildren || nextCtx.withChildren;
    nextCtx.lessWalking = lessWalking || nextCtx.lessWalking;
    nextCtx.startPoint = startPoint;
    nextCtx.visitDay = visitDay;
    nextCtx.visitDateLabel = dayMatch?.label || WEEKDAY_NAMES_AR[visitDay];
    nextCtx.start = startMin;
    nextCtx.budget = budgetMin;
    nextCtx.returnByEnd = returnBy;
    nextCtx.mode = 'plan';
    nextCtx.pendingClarification = null;
    nextCtx.pendingTopic = null;

    const built = buildConstraintPlan({
      days: daysCount,
      region: 'all',
      style: nextCtx.style,
      season: nextCtx.season || nowRiyadh.season,
      month: nextCtx.month,
      start: startMin,
      budget: budgetMin,
      returnByEnd: returnBy,
      startPointLabel: startPoint,
      visitDay,
      withChildren: nextCtx.withChildren,
      lessWalking: nextCtx.lessWalking,
      indoorOnly: false,
      lockedIds: nextCtx.lockedIds,
      completedIds: nextCtx.completedIds,
    });
    nextCtx.lastPlan = built.plan;
    nextCtx.hasUnsavedPreview = true;
    const firstStop = places.get(built.plan.ids[0]);
    const retNote =
      built.returnLegMinutes !== null && returnBy !== null
        ? ` مع العودة إلى ${startPoint} قبل ${clock(returnBy)}`
        : '';

    return {
      text: `خطة زيارتك ليوم ${nextCtx.visitDateLabel} انطلاقًا من ${startPoint} (${clock(startMin)})${retNote}. اضغط على أي محطة للتفاصيل:`,
      speechText: `جهزت لك خطة زيارتك المقترحة ليوم ${WEEKDAY_NAMES_AR[visitDay]} انطلاقًا من ${startPoint}، وتضم ${formatNum(built.plan.ids.length)} محطات تبدأ بـ ${firstStop?.name || 'الأولى'}.`,
      plan: built.plan,
      items: buildItemsFromPlan(built.plan),
      actions: [
        { type: 'preview-plan', value: built.plan, label: 'عاين التعديل' },
        { type: 'apply-plan', value: built.plan, label: 'احفظ التعديل' },
        ...(firstStop ? [{ type: 'dock-map-stop', value: firstStop.id, label: 'اعرض على الخريطة' } as ConciergeAction] : []),
      ],
      context: nextCtx,
      sourceMode: 'demo',
    };
  }

  // 10) Operational hours / details question on a specific destination
  if (/ساعات|متى يفتح|متى يقفل|تفتح|تغلق|مفتوح|مغلق|دوام|مرافق|وصول|مدخل/.test(q)) {
    const targetStop =
      stops.find((s) => q.includes(normalizeAr(s.name))) ||
      (explicitGuideMatch ? places.get(resolveStopIdFromGuideId(explicitGuideMatch) || '') : null) ||
      (nextCtx.activeStopId ? places.get(nextCtx.activeStopId) : null);
    if (targetStop) {
      const hoursStr = getHoursStatusLabel(targetStop);
      return {
        text: `${targetStop.name} (${targetStop.operational?.district || targetStop.region}): ${hoursStr}. افتح صفحة الوجهة لكامل التفاصيل:`,
        speechText: `${targetStop.name}: ${hoursStr}`,
        items: [
          {
            id: targetStop.id,
            image: images[targetStop.image] || '',
            title: targetStop.name,
            detail: `${targetStop.operational?.district || targetStop.region} · ${targetStop.tag}`,
            action: { type: 'place', value: targetStop.id },
          },
        ],
        actions: [{ type: 'dock-map-stop', value: targetStop.id, label: 'اعرض على الخريطة' }],
        context: nextCtx,
        sourceMode: 'demo',
      };
    }
  }

  return {
    text: APPROVED_GUIDE_GREETING,
    speechText: APPROVED_GUIDE_GREETING,
    context: nextCtx,
    sourceMode: 'demo',
    delegateToDirectory: true,
  };
}
