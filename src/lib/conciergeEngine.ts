import type {
  ConciergeAction,
  ConciergeContextState,
  ConciergeItem,
  ConciergeReply,
  IndexedGuideRecord,
  RouteTiming,
  ScheduledStation,
  SeasonKey,
  StopBase,
  TimingStation,
  TravelProfileKey,
  TripPlan,
  TripStyle,
} from './portalTypes';
import {
  climateCities,
  conciergeDays,
  conciergePrompts,
  conciergeRegions,
  conciergeSections,
  destinationAreas,
  expandedStops,
  geo,
  guidePlaceAliases,
  images,
  maxTripDays,
  monthWords,
  placeNotes,
  places,
  seasons,
  stopVisit,
  stops,
  tourGuide,
  tourGuideArtMap,
  tourGuideCategoryMedia,
  travelProfiles,
  travelSources,
  typeLabels,
} from './portalStaticData';
import {
  byId,
  clock,
  durationLabel,
  formatNum,
  getSegment,
  monthName,
  nearbyOrder,
  normalizeAr,
  qsAll,
  routePath,
  tripLeg,
} from './portalHelpers';
import { forecast, isWet, localTime, weatherNames } from './weatherAndShowcase';
import { FAQ_ITEMS } from '@/data/faqData';
import {
  APPROVED_GUIDE_GREETING,
  CONCIERGE_FAILURE_NOTICE,
  createInitialConciergeContext,
  type ServerConciergeRequestPayload,
} from './plannerTools';

export interface ConciergeInput {
  intent?: string;
  text?: string;
  profile?: TravelProfileKey | string;
  field?: string;
  value?: unknown;
  id?: string;
  city?: string;
}

export interface ConciergeTripSnapshot {
  choices: string[];
  approved: boolean;
  stations: ScheduledStation[];
}

export interface ConciergeSimulationRequest {
  input: ConciergeInput;
  context: ConciergeContextState;
  trip: ConciergeTripSnapshot;
}

export interface ConciergeSimulationDeps {
  getCurrentSeason: () => SeasonKey;
  scheduleTrip: (stopIds?: Set<string>, totalDays?: string) => { stations: ScheduledStation[] };
  getGuideRecords: () => IndexedGuideRecord[];
}

export interface ConciergeControllerDeps extends ConciergeSimulationDeps {
  signal: AbortSignal;
  getState: () => {
    choices: Set<string>;
    approved: boolean;
    region: string;
    days: string;
    style: TripStyle;
    savedTiming: RouteTiming | null;
    routeDraft: TripPlan | null;
    completedIds?: string[];
    lockedIds?: string[];
    activeStopId?: string | null;
  };
  getActivePageContext?: () => {
    placeId: string | null;
    guidePlaceId: string | null;
    activeStopId: string | null;
    lockedIds: string[];
    completedIds: string[];
  };
  applySavedPlan: (plan: TripPlan) => void;
  setRouteDraft: (plan: TripPlan | null) => void;
  toggleStop: (stop: StopBase) => void;
  goToSection: (id: string) => void;
  selectDestination: (id: string) => void;
  focusStopFromConcierge?: (
    stopId: string,
    opts?: { message?: string; isExploration?: boolean }
  ) => Promise<void> | void;
  dockAtGuidePlace?: (
    guideId: string,
    opts?: { missingCoordinates?: boolean; message?: string }
  ) => void;
  toggleLockStop?: (stopId: string) => boolean;
  markStopVisited?: (stopId: string) => void;
  onSpeakReply?: (text: string) => void;
  onModeBadgeChange?: (mode: 'live' | 'demo') => void;
  openPanel: (kind: string) => void;
  closePanel: () => void;
  downloadTripPdf: () => void;
  hasTourGuidePlace: (id: string) => boolean;
  openGuideFilter?: (opts: { category?: string; district?: string; query?: string }) => void;
  openFaq?: (faqId?: string) => void;
}

export const conciergeInitialContext: ConciergeContextState =
  createInitialConciergeContext('spring');

const conciergeNames: Record<string, RegExp> = {
  hussam: /حسام|البحيره/,
  raghdan: /رغدان/,
  ain: /ذي العين|ذي عين|ذى عين/,
  shada: /شدا|شدي/,
  ...Object.fromEntries(
    expandedStops.map((stop) => [
      stop.id,
      new RegExp(`${normalizeAr(stop.name)}|${normalizeAr(stop.county)}`),
    ])
  ),
};

const conciergePreferenceValues: Record<string, Record<string, string>> = {
  days: conciergeDays,
  style: typeLabels,
  region: conciergeRegions,
  pace: { relaxed: 'على مهل', balanced: 'متوازن' },
};

const conciergeIntent = (
  value: string | Record<string, unknown>,
  label?: string
): ConciergeAction => ({
  type: 'intent',
  value,
  label: label ?? (typeof value === 'string' ? conciergePrompts[value] : ''),
});

const conciergeLink = (value: string): ConciergeAction => ({
  type: 'section',
  value,
  label: conciergeSections[value]?.label ?? value,
});

const conciergePreference = (
  field: string,
  value: string | null,
  label: string
): ConciergeAction => ({
  type: 'preference',
  value: { field, value },
  label,
});

const isTravelSourceKey = (value: string): value is keyof typeof travelSources =>
  Object.hasOwn(travelSources, value);

const isTravelProfileKey = (value: string): value is TravelProfileKey =>
  Object.hasOwn(travelProfiles, value);

const travelSource = (value: string): ConciergeAction => ({
  type: 'travel-source',
  value,
  label: isTravelSourceKey(value) ? travelSources[value].label : value,
});

export function visitTime(text: string): number | null {
  const exact = text.match(
    /(?:^|\s)(?:الساعه\s+|ابدا\s+|ابدء\s+|ابدأ\s+|الوقت\s+|من\s+)?(\d{1,2})(?::(\d{2})|\s*(صباحا|مساء|م|ص)(?=\s|$))/
  );
  if (exact && exact.index !== undefined) {
    let hour = Number(exact[1]);
    const minute = Number(exact[2] || 0);
    const marker = exact[3] || text.slice(exact.index + exact[0].length).trim().split(' ')[0] || '';
    if (hour <= 12 && (/^(مساء|م)$/.test(marker) || /بعد العصر|عصرا|بعد الظهر/.test(text))) {
      hour = (hour % 12) + 12;
    } else if (hour === 12 && /^(صباحا|ص)$/.test(marker)) {
      hour = 0;
    }
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
  }
  const hourOnly = text.match(/الساعه\s+(\d{1,2})(?=\s|$)/)?.[1];
  if (hourOnly != null && Number(hourOnly) < 24) return Number(hourOnly) * 60;
  if (/بعد العصر|عصرا/.test(text)) return 16 * 60 + 30;
  if (/قبل العصر|اول العصر/.test(text)) return 15 * 60;
  if (/بعد الظهر|ظهرا/.test(text)) return 13 * 60;
  if (/الصبح|صباحا|الصباح/.test(text)) return 9 * 60;
  if (/بالليل|مساء|بعد المغرب/.test(text)) return 18 * 60;
  return null;
}

export function timePreferences(question: string): {
  month: number | null;
  season: SeasonKey | undefined;
  budget: number | null;
  start: number | null;
} {
  const monthIndex = monthWords.findIndex((pattern) => pattern.test(question));
  const month =
    monthIndex >= 0
      ? monthIndex + 1
      : Number(question.match(/(?:في |خلال )?شهر *(1[0-2]|[1-9])(?= |$)/)?.[1]) || null;
  const season = month
    ? month >= 3 && month <= 5
      ? 'spring'
      : month >= 6 && month <= 8
        ? 'summer'
        : month >= 9 && month <= 11
          ? 'autumn'
          : 'winter'
    : (Object.keys(seasons) as SeasonKey[]).find((key) =>
        question.includes(normalizeAr(seasons[key].name))
      );
  const hours = question.match(/(?:^| )(\d{1,2}) *(?:ساع(?:ه|ات))(?= |$)/)?.[1];
  const minutes = question.match(/(?:^| )(\d{1,3}) *(?:دقيقه|دقائق)(?= |$)/)?.[1];
  const budget = hours
    ? Number(hours) * 60 + (/ونص|ونصف/.test(question) ? 30 : 0)
    : minutes
      ? Number(minutes)
      : /ساعتين|ساعتان/.test(question)
        ? /ونص|ونصف/.test(question)
          ? 150
          : 120
        : /ثلاث ساعات|3 ساعات/.test(question)
          ? 180
          : /اربع ساعات/.test(question)
            ? 240
            : /ساعه ونص|ساعه ونصف/.test(question)
              ? 90
              : /ساعه واحده|لمده ساعه|معايا ساعه|عندي ساعه|خليها ساعه|خلها ساعه/.test(question)
                ? 60
                : /نص ساعه|نصف ساعه/.test(question)
                  ? 30
                  : null;
  return { month, season, budget, start: visitTime(question) };
}

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

function seasonStopReason(stop: StopBase, season: SeasonKey, relaxed: boolean): string {
  if (relaxed && stop.id === 'raghdan') return 'جولة مختصرة قرب المدخل مع وقفة للجلوس داخل الغابة.';
  if (relaxed && stop.id === 'hussam') return 'وقفة قرب البحيرة مع خيار تقصير المشي.';
  if (season === 'summer' && stop.id === 'raghdan') {
    return 'بداية في المرتفعات لجولة عائلية بين الأشجار والإطلالات.';
  }
  if (season === 'summer' && stop.id === 'hussam') {
    return 'وقفة عائلية قصيرة حول البحيرة بعد جولة الغابة.';
  }
  if (season === 'winter' && stop.id === 'ain') {
    return 'جولة نهارية في تهامة بين الأزقة والإطلالات.';
  }
  return stopVisit[stop.id]?.best ?? stop.desc;
}

export function makeTimedPlan(
  context: ConciergeContextState,
  candidates: StopBase[],
  currentSeason: SeasonKey
): TripPlan | null {
  const key = context.season || currentSeason;
  const budget = context.budget ?? 240;
  const start = context.start ?? seasons[key].start;
  const limit = Math.min(start + budget, 1440);
  const prefer =
    context.locked || context.focus || (key === 'summer' ? 'raghdan' : key === 'winter' ? 'ain' : null);
  const ranked = [...candidates].sort((a, b) => Number(b.id === prefer) - Number(a.id === prefer));
  const dayCount = Number(context.days || 1);
  const lessWalking = context.lessWalking;
  const ordered = (dayCount > 1 ? nearbyOrder(ranked) : ranked).slice(
    0,
    dayCount * (lessWalking ? 1 : 2)
  );
  const rows: TimingStation[] = [];
  let day = 1;
  let time = start;
  for (const stop of ordered) {
    const plannedDay =
      Math.floor((rows.length * Math.min(dayCount, ordered.length)) / ordered.length) + 1;
    if (plannedDay > day) {
      day = plannedDay;
      time = start;
    }
    const visitCfg = stopVisit[stop.id];
    const duration = lessWalking ? Math.min(visitCfg.short, 35) : visitCfg.short;
    const hours = visitCfg.hours;
    let previous: TimingStation | null = rows.at(-1) ?? null;
    if (previous?.day !== day) previous = null;
    let leg = previous ? tripLeg(places.get(previous.id)!, stop) : null;
    let transfer = leg ? Math.ceil((leg.min + 10) / 5) * 5 : 0;
    let visit = Math.max(time + transfer, hours?.[0] ?? 0);
    if (
      (visit + duration > Math.min(limit, hours?.[1] ?? 1440) ||
        rows.filter((row) => row.day === day).length >= 2) &&
      previous &&
      day < Number(context.days || 1)
    ) {
      day += 1;
      time = start;
      leg = null;
      transfer = 0;
      visit = Math.max(time, hours?.[0] ?? 0);
    }
    if (visit + duration > Math.min(limit, hours?.[1] ?? 1440)) {
      if (stop.id === context.locked) return null;
      continue;
    }
    rows.push({
      id: stop.id,
      day,
      start: visit,
      end: visit + duration,
      drive_minutes: leg?.min ?? null,
      drive_estimated: Boolean(leg?.estimated),
      reason: seasonStopReason(stop, key, lessWalking),
    });
    time = visit + duration;
  }
  if (!rows.length) return null;
  return {
    ids: rows.map((row) => row.id),
    days: context.days || '1',
    style: context.style || 'all',
    region: context.region,
    timing: {
      season: key,
      month: context.month,
      start,
      limit,
      locked: context.locked || null,
      stations: rows,
    },
  };
}

function shortPlaceCity(stop: { region: string; operational?: { district?: string } }): string {
  return stop.operational?.district || conciergeRegions[stop.region] || 'الباحة';
}

function timedItems(timing: RouteTiming): ConciergeItem[] {
  return timing.stations
    .map((row) => {
      const stop = places.get(row.id);
      if (!stop) return null;
      return {
        id: row.id,
        title: stop.name,
        detail: `${shortPlaceCity(stop)} · ${stop.tag}`,
        time: `${clock(row.start)} – ${clock(row.end)}`,
        action: { type: 'place', value: stop.id },
      } as ConciergeItem;
    })
    .filter((item): item is ConciergeItem => Boolean(item));
}

function itineraryItems(stations: ScheduledStation[]): ConciergeItem[] {
  return stations.map((stop) => {
    const place = places.get(stop.id);
    return {
      id: stop.id,
      title: stop.name,
      detail: place ? `${shortPlaceCity(place)} · ${place.tag}` : 'الباحة · وجهة سياحية',
      time: `${clock(stop.start)} – ${clock(stop.end)}`,
      action: { type: 'place', value: stop.id },
    };
  });
}

export async function weatherPlanReply(
  input: ConciergeInput,
  context: ConciergeContextState,
  currentSeason: SeasonKey
): Promise<ConciergeReply> {
  const cityKey = input.city || 'baha';
  const city = climateCities[cityKey] || climateCities.baha;
  const stop = (input.id ? places.get(input.id) : undefined) || places.get(city.ids[0])!;
  const opening = stopVisit[stop.id].hours;
  const sample = input.intent === 'rain-demo';
  const next: ConciergeContextState = {
    ...context,
    region: city.region,
    focus: stop.id,
    mode: 'plan',
    style: 'all',
    days: '1',
  };
  const noPlan = (message: string): ConciergeReply => ({
    text: message,
    context: next,
    actions: [conciergeIntent('plan', 'رتّب زيارة بتوقيت تقديري')],
  });

  const data = sample ? null : await forecast(cityKey);
  if (!sample && !data) {
    return noPlan(
      `توقعات ${city.name} غير متاحة الآن. تقدر ترتّب زيارة حسب الوقت والموسم من دليلنا.`
    );
  }
  const local = localTime();
  const duration = stopVisit[stop.id].short;
  const start = sample
    ? 15 * 60 + 30
    : Math.max(opening?.[0] ?? 8 * 60, Math.ceil(local.minute / 60) * 60);
  const end = Math.min(opening?.[1] ?? 18 * 60, 18 * 60);
  let visit: number | null = null;
  let wetAt: number | null = null;
  const initial = sample ? 16 * 60 + 30 : start;
  if (sample) {
    visit = start;
    wetAt = 17 * 60;
  } else if (data) {
    const hours = data.hours.filter((hour) => hour.time.startsWith(local.date));
    const hourlyAt = new Map(hours.map((hour) => [Number(hour.time.slice(11, 13)) * 60, hour]));
    for (let time = start; time + duration <= end; time += 60) {
      const windowSlots = Array.from({ length: Math.ceil(duration / 60) }, (_, i) =>
        hourlyAt.get(time + i * 60)
      );
      if (windowSlots.every((hour) => hour && !isWet(hour))) {
        visit = time;
        break;
      }
      if (wetAt === null && windowSlots.some((hour) => hour && isWet(hour))) wetAt = time;
    }
  }
  if (visit === null) {
    return noPlan(
      `ما لقيت فترة مناسبة في توقعات اليوم ضمن الساعات المتاحة لـ${stop.name}. تقدر تختار موعدًا آخر وتراجع التوقعات قبله.`
    );
  }
  const plan = makeTimedPlan(
    { ...next, start: visit, budget: duration, season: currentSeason, lessWalking: false },
    [stop],
    currentSeason
  );
  if (!plan) return noPlan('اختَر وقتًا داخل نافذة الزيارة المنشورة.');
  plan.timing.stations[0].reason = sample
    ? 'الموعد البديل يسبق فترة المطر في سيناريو العرض.'
    : 'نافذة نهارية مقترحة وفق توقعات الهطول للساعات المختارة.';
  const comparison =
    visit !== initial
      ? `أقترح ${clock(visit)} بدل ${clock(initial)}.`
      : `أقترح بدء الزيارة ${clock(visit)}.`;
  const rain =
    wetAt === null ? '' : ` في ${clock(wetAt)} يظهر احتمال هطول في النافذة المراجَعة.`;
  return {
    text: `${sample ? 'سيناريو عرض ببيانات محاكاة. ' : `حسب توقعات ${city.name} اليوم، `}${comparison}${rain} مدة الزيارة ${formatNum(duration)} دقيقة.`,
    context: {
      ...next,
      start: visit,
      budget: duration,
      season: currentSeason,
      previousPlan: context.lastPlan,
      lastPlan: plan,
    },
    plan,
    items: timedItems(plan.timing),
    actions: [
      { type: 'preview-plan', value: plan, label: 'شاهد الموعد على الخريطة' },
      { type: 'review-plan', value: plan, label: 'أضف الموعد لرحلتي' },
    ],
  };
}

function travelChecklist(
  profile: string | null | undefined,
  trip: ConciergeTripSnapshot,
  next: ConciergeContextState
): ConciergeReply {
  const first = trip.stations[0] || next.lastPlan?.timing?.stations[0];
  const options = Object.entries(travelProfiles).map(([value, label]) =>
    conciergeIntent({ intent: 'travel-docs', profile: value }, label)
  );
  const steps: ConciergeItem[] = [
    {
      title: '1. ثبّت خطة الرحلة',
      detail: trip.approved
        ? 'خطتك معتمدة. نزّل ملف PDF واحفظه على جوالك عشان ترجع للصور والخريطة والمواعيد.'
        : first
          ? 'راجع المحطات ومواعيدها، وأضف المقترح إذا كنت لسه في المعاينة. بعدها اعتمد الرحلة من الملخص ونزّل ملف PDF.'
          : 'حدّد الأيام واهتماماتك، واختر محطاتك أو اطلب مني اقتراح مسار. راجع الخطة واعتمدها قبل تنزيلها.',
    },
    {
      title: '2. جهّز أوراقك قبل الحجز',
      detail:
        'اختَر حالتك تحت عشان تعرف إيه اللي تراجعه قبل السفر. راجع اشتراطات الدخول لو جاي من الخارج قبل أي حجز غير قابل للاسترداد.',
    },
    {
      title: '3. رتّب الوصول والإقامة',
      detail:
        'أكّد وسيلة الوصول للباحة ومواعيدها، واحجز مكان المبيت إذا الرحلة أكثر من يوم. احتفظ بتأكيدات الحجز على جوالك.',
    },
    {
      title: '4. تحرّك حسب ترتيب اليوم',
      detail: first
        ? `ابدأ بـ${places.get(first.id)!.name} الساعة ${clock(first.start)} بتوقيت السعودية. راجع ساعات العمل والأجواء وافتح اتجاهات القيادة قبل الانطلاق.`
        : 'احفظ مواقع المحطات، وراجع ساعات العمل والأجواء. افتح الاتجاهات لكل محطة واترك وقتًا للتنقّل بين المرتفعات وتهامة.',
    },
  ];
  const tripActions: ConciergeAction[] = trip.approved
    ? [{ type: 'trip-pdf', label: 'نزّل مخطط الرحلة PDF' }]
    : trip.stations.length
      ? [conciergeLink('summary')]
      : next.lastPlan
        ? [{ type: 'review-plan', value: next.lastPlan, label: 'أضف المقترح لرحلتي' }]
        : [conciergeIntent('plan')];

  if (!profile) {
    return {
      text: 'خطوات تنظيم الزيارة من اعتماد الخطة حتى الوصول إلى أول محطة؛ اختر فئة الزائر لاستعراض المستندات المطلوبة',
      actions: [
        ...options,
        ...tripActions,
        ...(first ? [{ type: 'route-stop' as const, value: first.id, label: 'افتح أول محطة على الخريطة' }] : []),
      ],
      items: steps,
      context: next,
    };
  }

  const domestic = profile === 'domestic';
  const gulf = profile === 'gulf';
  const documents: ConciergeItem[] = domestic
    ? [
        {
          title: 'الهوية أو وثيقة السفر',
          detail:
            'جهّز هوية سارية أو وثيقة سفر تقبلها شركة النقل لحالتك. لو مسافر بالطائرة، طابق الاسم في التذكرة مع الوثيقة وراجع الأوراق المقبولة للرحلة الداخلية والمرافقين.',
        },
        {
          title: 'تأكيدات الحجز',
          detail: 'احتفظ بتذكرة التنقّل وتأكيد السكن، ومعاك نسخة على الجوال للرجوع إليها وقت الحاجة.',
        },
      ]
    : [
        {
          title: 'تحقّق من مسار الدخول',
          detail: gulf
            ? 'فرّق بين مواطن دولة خليجية ومقيم فيها. حدّد الجنسية والإقامة في منصة تأشيرة السعودية للتحقق من وثيقة الدخول أو التأشيرة المطلوبة لحالتك.'
            : 'ابدأ من منصة تأشيرة السعودية واختر زيارة سياحية. أدخل الجنسية وبلد الإقامة وأي إقامة أو تأشيرة مؤهلة تطلبها المنصة. لو المسار الإلكتروني غير متاح، اتبع مسار مركز التأشيرات أو السفارة الذي تعرضه المنصة.',
        },
        {
          title: 'الجواز والتأشيرة',
          detail:
            'لو بتقدّم عبر بوابة التأشيرة السياحية الإلكترونية، لازم يبقى في جوازك ستة أشهر على الأقل من تاريخ دخول السعودية. احتفظ بنسخة من التأشيرة الصادرة واستخدم نفس الجواز وقت الوصول.',
        },
        {
          title: 'الأوراق الإضافية والمرافقون',
          detail:
            'اتبع قائمة المستندات التي تظهر لكل مسافر في قناة التقديم، وراجع ما تطلبه فئة الدخول من تأمين أو مستندات للمرافقين. أكّد متطلبات الصعود مع شركة الطيران قبل السفر.',
        },
      ];

  return {
    text: `${isTravelProfileKey(profile) ? travelProfiles[profile] : profile} - قائمة إرشادية للمتطلبات الرسمية قبل السفر`,
    actions: [
      ...(domestic ? [] : [travelSource('visa'), travelSource('evisa')]),
      travelSource('car'),
      conciergeIntent('travel', 'ارجع لخطوات الرحلة'),
    ],
    items: [
      ...documents,
      {
        title: 'تأجير المركبات',
        detail:
          'جهّز إثبات هوية ورخصة قيادة سارية طوال مدة العقد. اسأل شركة التأجير عن قبول رخصتك وهل تحتاج رخصة دولية، وراجع العقد والتغطية قبل التوقيع.',
      },
    ],
    context: next,
  };
}

const STOPWORDS = new Set([
  'في', 'من', 'عن', 'على', 'الى', 'او', 'و', 'مع', 'ابي', 'ابغى', 'اريد', 'ودي',
  'ممكن', 'عطني', 'اعطني', 'اقترح', 'افضل', 'احسن', 'اجمل', 'وش', 'ايش', 'ما',
  'هي', 'هو', 'هل', 'كم', 'وين', 'فين', 'اين', 'لي', 'لنا', 'فيه', 'فيها',
  'الباحه', 'منطقه', 'محافظه', 'يوجد', 'عنها', 'عنهم', 'كيف', 'متى', 'لو',
]);

const DISTRICT_MATCHERS: [string, RegExp][] = [
  ['بلجرشي', /بلجرشي|الابنو|بني كبير/],
  ['المندق', /المندق|خيره|الخلب/],
  ['المخواة', /المخواه|ذي عين|ذي العين|ذى عين|شدا/],
  ['الباحة', /مدينه الباحه|وسط الباحه|داخل الباحه|محافظه الباحه|رغدان|الحسام|الشكران|الشروق/],
  ['العقيق', /العقيق|مطار/],
  ['بني حسن', /بني حسن/],
  ['قلوة', /قلوه/],
  ['القرى', /الاطاوله|محافظه القري|في القري/],
  ['الحجرة', /الحجره/],
];

const CATEGORY_MATCHERS: Array<{
  categories: string[];
  filterCategory: string;
  label: string;
  pattern: RegExp;
}> = [
  {
    categories: ['cafes'],
    filterCategory: 'cafes',
    label: 'المقاهي والكافيهات',
    pattern: /كافيه|كوفي|مقهي|مقاهي|مقهى|قهوه مختصه|قهاوي|اسبريسو|لاتيه|موكا|حلي|حلويات/,
  },
  {
    categories: ['restaurants'],
    filterCategory: 'restaurants',
    label: 'المطاعم والأكلات',
    pattern: /مطعم|مطاعم|مطبخ|مندي|غدا|عشا|فطور|برجر|شوايه|ماكولات/,
  },
  {
    categories: ['restaurants', 'cafes'],
    filterCategory: 'restaurants',
    label: 'المطاعم والمقاهي',
    pattern: /اكل|الاكل|طعام|قهوه|كافي/,
  },
  {
    categories: ['hotels', 'chalets'],
    filterCategory: 'hotels',
    label: 'الفنادق والشاليهات',
    pattern: /فندق|فنادق|غرف فندقيه/,
  },
  {
    categories: ['chalets'],
    filterCategory: 'chalets',
    label: 'الشاليهات والمنتجعات',
    pattern: /شاليه|شاليهات|منتجع|منتجعات|فيلا|فلل|كوخ|اكواخ|تخييم|مخيم|استراح/,
  },
  {
    categories: ['hotels', 'chalets'],
    filterCategory: 'hotels',
    label: 'أماكن الإقامة والمبيت',
    pattern: /اقامه|مبيت|سكن|نوم|نزل|نبات|انام/,
  },
  {
    categories: ['parks'],
    filterCategory: 'parks',
    label: 'المنتزهات والغابات',
    pattern: /منتزه|منتزهات|متنزه|متنزهات|حديق|حدائق|غابه|غابات|نزه/,
  },
  {
    categories: ['water'],
    filterCategory: 'water',
    label: 'الشلالات والأودية',
    pattern: /شلال|شلالات|وادي|اوديه|سد|سدود|عيون ماء/,
  },
  {
    categories: ['farms'],
    filterCategory: 'farms',
    label: 'المزارع السياحية',
    pattern: /مزرع|مزارع|رمان|فواكه|لوز|عسل|ريف/,
  },
  {
    categories: ['heritage'],
    filterCategory: 'heritage',
    label: 'القرى التراثية والحصون',
    pattern: /قريه تراثيه|قري تراثيه|حصن|حصون|تاريخ|بيوت حجريه/,
  },
  {
    categories: ['museums'],
    filterCategory: 'museums',
    label: 'المتاحف',
    pattern: /متحف|متاحف|اثار|مقتنيات/,
  },
  {
    categories: ['malls'],
    filterCategory: 'malls',
    label: 'المولات والأسواق',
    pattern: /مول|مولات|اسواق|تسوق|سوق|سنتر/,
  },
];

const FAQ_KEYWORD_RULES: Array<[string, RegExp]> = [
  ['faq-airport', /مطار|طيران|رحله جويه|المطار/],
  ['faq-roads', /عقب|عقبه|طريق|طرق|قياده|مسافه بين|التنقل بين/],
  ['faq-documents', /هويه|تاشيره|مستند|جواز/],
  ['faq-fog-rain', /ضباب|غيم|مطر|امطار|بديله وقت المطر/],
  ['faq-family-elderly', /كبار السن|كبير سن|كرسي متحرك|معبد|ممرات|مشي خفيف|عايل|اطفال/],
  ['faq-dhee-ain-hours', /ساعات ذي عين|تفتح ذي عين|دخول ذي عين|تغلق ذي عين/],
  ['faq-saturday-market', /سوق السبت|متى سوق/],
  ['faq-food', /خبز|مقناه|دغابيس|عصيده|عسل|بن شدوي|اكلات شعبيه|اطباق/],
  ['faq-official-numbers', /طوارئ|940|930|911|بلاغ|امانه|رقم المساعده|رقم البلاغات/],
  ['faq-how-planner', /pdf|ملف|اعتماد الرحله|كيف استخدم المخطط|كيف اخطط/],
  ['faq-guide-144', /144|الدليل السياحي|فئات الدليل/],
  ['faq-sources', /مصدر البيانات|مصادر البوابه|خريطه/],
];

function hashIndex(id: string, len: number): number {
  let acc = 0;
  for (let i = 0; i < id.length; i += 1) acc = (acc * 31 + id.charCodeAt(i)) >>> 0;
  return len ? acc % len : 0;
}

function guideThumbnailFor(place: IndexedGuideRecord): string {
  if (place.trip && places.has(place.trip)) {
    const imgKey = places.get(place.trip)!.image;
    if (images[imgKey]) return images[imgKey];
  }
  const pool = tourGuideCategoryMedia[place.category] || tourGuideCategoryMedia.parks;
  const key = pool[hashIndex(place.id, pool.length)];
  return tourGuideArtMap[key] || images[key] || '';
}

function detectDistrictInQuestion(question: string): string | null {
  for (const [district, pattern] of DISTRICT_MATCHERS) {
    if (pattern.test(question)) return district;
  }
  return null;
}

function detectCategoriesInQuestion(
  question: string,
  intent?: string
): { categories: string[]; filterCategory: string; label: string } | null {
  if (intent === 'dining') {
    return {
      categories: ['restaurants', 'cafes'],
      filterCategory: 'restaurants',
      label: 'المطاعم والمقاهي',
    };
  }
  if (intent === 'camping') {
    return {
      categories: ['hotels', 'chalets'],
      filterCategory: 'hotels',
      label: 'الإقامة والفنادق والشاليهات',
    };
  }
  for (const entry of CATEGORY_MATCHERS) {
    if (entry.pattern.test(question)) {
      return {
        categories: entry.categories,
        filterCategory: entry.filterCategory,
        label: entry.label,
      };
    }
  }
  return null;
}

function searchGuideRecords(
  question: string,
  records: IndexedGuideRecord[],
  cats: string[] | null,
  district: string | null
): { matches: IndexedGuideRecord[]; scope: 'exact' | 'cat-only' | 'dist-only' | 'soft' } {
  const tokens = question
    .split(/\s+/)
    .map((t) => normalizeAr(t))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

  const scoreRecord = (rec: IndexedGuideRecord): number => {
    const nameNorm = normalizeAr(rec.name);
    let score = rec.trip ? 2 : 0;
    if (cats && cats[0] === rec.category) score += 1;
    for (const token of tokens) {
      if (nameNorm.includes(token)) score += 4;
      else if (rec.searchBlob.includes(token)) score += 2;
    }
    return score;
  };

  const rank = (list: IndexedGuideRecord[]) =>
    [...list]
      .map((rec) => ({ rec, score: scoreRecord(rec) }))
      .sort((a, b) => b.score - a.score || (b.rec.trip ? 1 : 0) - (a.rec.trip ? 1 : 0))
      .map((entry) => entry.rec);

  const byFilter = (useCats: boolean, useDistrict: boolean) =>
    records.filter(
      (rec) =>
        (!useCats || !cats || cats.includes(rec.category)) &&
        (!useDistrict || !district || rec.district === district)
    );

  if (cats || district) {
    const exact = rank(byFilter(true, true));
    if (exact.length) return { matches: exact.slice(0, 4), scope: 'exact' };
    if (cats && district) {
      const catOnly = rank(byFilter(true, false));
      if (catOnly.length) return { matches: catOnly.slice(0, 4), scope: 'cat-only' };
      const distOnly = rank(byFilter(false, true));
      if (distOnly.length) return { matches: distOnly.slice(0, 4), scope: 'dist-only' };
    }
  }

  if (tokens.length) {
    const scored = records
      .map((rec) => ({ rec, score: scoreRecord(rec) - (rec.trip ? 2 : 0) }))
      .filter((entry) => entry.score >= 2)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.rec);
    if (scored.length) return { matches: scored.slice(0, 4), scope: 'soft' };
  }

  return { matches: [], scope: 'exact' };
}

function matchFaqItem(question: string) {
  for (const [faqId, pattern] of FAQ_KEYWORD_RULES) {
    if (pattern.test(question)) {
      const found = FAQ_ITEMS.find((item) => item.id === faqId);
      if (found) return found;
    }
  }
  const tokens = question
    .split(/\s+/)
    .map((t) => normalizeAr(t))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (tokens.length < 2) return null;
  let best: { item: (typeof FAQ_ITEMS)[number]; hits: number } | null = null;
  for (const item of FAQ_ITEMS) {
    const blob = normalizeAr(`${item.question} ${item.answer}`);
    const hits = tokens.filter((tok) => blob.includes(tok)).length;
    if (hits >= 2 && (!best || hits > best.hits)) {
      best = { item, hits };
    }
  }
  return best?.item || null;
}

function findGuidePlaceInQuestion(
  question: string,
  records: IndexedGuideRecord[]
): IndexedGuideRecord | null {
  const clean = normalizeAr(question || '')
    .replace(/[،؟.!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  const byId = new Map(records.map((r) => [r.id, r]));
  for (const [id, pattern] of guidePlaceAliases) {
    if (pattern.test(clean) && byId.has(id)) return byId.get(id)!;
  }
  const sorted = [...records].sort((a, b) => b.name.length - a.name.length);
  return (
    sorted.find((place) => {
      const nameNorm = normalizeAr(place.name);
      return nameNorm.length >= 4 && clean.includes(nameNorm);
    }) || null
  );
}

export function simulateConcierge(
  { input, context, trip }: ConciergeSimulationRequest,
  deps: ConciergeSimulationDeps
): ConciergeReply {
  const currentSeason = deps.getCurrentSeason();
  const next: ConciergeContextState = { ...context };
  const reply = (
    text: string,
    actions: ConciergeAction[] = [],
    items: ConciergeItem[] = []
  ): ConciergeReply => ({ text, actions, items, context: next });

  const question = normalizeAr(input.text || '')
    .replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) & 15))
    .replace(/[،؟.!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const intent = input.intent;

  if (intent === 'travel-docs' && input.profile && Object.hasOwn(travelProfiles, input.profile)) {
    return travelChecklist(input.profile, trip, next);
  }
  if (
    intent === 'travel' ||
    /تاشير|فيزا|جواز|الاوراق|مستندات|اجراءات السفر|متطلبات السفر|متطلبات الدخول|دليل السفر|خطوات (السفر|التحرك|الانطلاق)|بعد (اعتماد|تخطيط)/.test(
      question
    )
  ) {
    const profile = /خليج|مجلس التعاون/.test(question)
      ? 'gulf'
      : /داخل السعوديه|داخل المملكه|رحله داخليه/.test(question)
        ? 'domestic'
        : /خارج السعوديه|خارج المملكه|من مصر|جاي من بره|قادم من الخارج/.test(question)
          ? 'overseas'
          : null;
    return travelChecklist(profile, trip, next);
  }

  const visit = timePreferences(question);
  const count = question.match(/(?:^| )(\d+) *(?:يوم|ايام)/)?.[1];
  const duration =
    count ||
    (/اسبوعين|اسبوعان/.test(question)
      ? '14'
      : /اسبوع|سبع(?:ه)? ايام/.test(question)
        ? '7'
        : /ست(?:ه)? ايام/.test(question)
          ? '6'
          : /خمس(?:ه)? ايام/.test(question)
            ? '5'
            : /اربع(?:ه)? ايام/.test(question)
              ? '4'
              : /ثلاث(?:ه)? ايام/.test(question)
                ? '3'
                : /يومين|يومان/.test(question)
                  ? '2'
                  : /^يوم$|يوم واحد|نفس اليوم|ليوم واحد/.test(question)
                    ? '1'
                    : null);
  const interest: TripStyle | null = /عائل|عايل|عيل|اطفال|اولاد/.test(question)
    ? 'family'
    : /تراث|قريه حجريه|تاريخ/.test(question)
      ? 'heritage'
      : /طبيع|جبال|غابات|مشي|هايكن/.test(question)
        ? 'nature'
        : /متنوع|كل التجارب|اي شي/.test(question)
          ? 'all'
          : null;
  const area = /الباحه بالكامل|كل الباحه/.test(question)
    ? 'all'
    : /مدينه الباحه|داخل الباحه/.test(question)
      ? 'city'
      : /المخواه|جنوب الباحه/.test(question)
        ? 'south'
        : (destinationAreas.slice(2).find((item) => question.includes(normalizeAr(item.name)))
            ?.region ?? null);
  const pace: 'relaxed' | 'balanced' | null = /علي مهل|هادي|هادئ|خفيف/.test(question)
    ? 'relaxed'
    : /اكثر من محطه|نشط|مكثف/.test(question)
      ? 'balanced'
      : null;
  const named = Object.keys(conciergeNames).find((id) => conciergeNames[id].test(question));
  const remove = /احذف|شيل|ازل|احذفها/.test(question);
  const add = /اضف|ضيف|حطها|حط المكان/.test(question);
  const wantsPlan =
    intent === 'plan' ||
    (!add &&
      !remove &&
      Boolean(
        /خطط|خطه|خط سير|مسار|برنامج|رتب|جوله/.test(question) ||
          (next.mode === 'plan' && (duration || interest || area || pace)) ||
          duration
      ));
  const climateQuestion = /طقس|اجواء|مناخ|افضل موسم|افضل فصل/.test(question);
  const adjust = /ثبت|قلل المشي|المشي اقل|خل.*مشي.*اقل|مشي اخف|بدون مشي/.test(question);
  const timingInput = visit.budget !== null || visit.start !== null;
  const seasonInput = Boolean(visit.season && (!named || wantsPlan || timingInput));
  const timedRequest =
    !add &&
    !remove &&
    (timingInput ||
      seasonInput ||
      adjust ||
      intent === 'timed-plan' ||
      intent === 'adjust-time' ||
      intent === 'previous-plan');
  const followUp = /فين|وين|اين|مكانها|مدتها|وقتها|كم ساعه|كم دقيقه|كم وقت|مناسب|تصلح|عنها|موقعها/.test(
    question
  );
  const section =
    intent && ['dining', 'camping', 'attractions'].includes(intent)
      ? intent
      : /مطعم|مطاعم|قهوه|قهاوي|اكل|غدا|عشا/.test(question)
        ? 'dining'
        : /اقامه|مبيت|تخييم|مخيم|فندق|منتجع|نبات|انام/.test(question) && !named
          ? 'camping'
          : /مزارات|سوق السبت|بلجرشي|المتحف|خيره|الشلال/.test(question)
            ? 'attractions'
            : /الباحه اب|تطبيق الباحه|حمل التطبيق/.test(question)
              ? 'app'
              : null;

  const records = deps.getGuideRecords();
  const guideMatch = !intent || intent === 'guide-place' ? findGuidePlaceInQuestion(question, records) : null;

  const districtMatch = detectDistrictInQuestion(question);
  const categoryMatch = detectCategoriesInQuestion(question, intent);
  const faqMatch = !intent || intent === 'faq' ? matchFaqItem(question) : null;
  const greetingOnly =
    !intent &&
    question.length > 0 &&
    question.length <= 28 &&
    /^(السلام عليكم|وعليكم السلام|مرحبا|هلا|اهلا|اهلين|صباح الخير|مساء الخير|شكرا|يعطيك العافيه|يسلمو)/.test(
      question
    );
  const liveWeatherAsk =
    intent === 'weather-now' ||
    /الطقس اليوم|الطقس الان|جو اليوم|الجو الان|درجه الحراره|حاله الطقس|ملابس|لبس|جاكيت|بردان/.test(
      question
    );
  const culinaryAsk = /خبزه|مقناه|دغابيس|عصيده|بن شدوي|عسل|اكلات شعبيه|ماكولات شعبيه/.test(
    question
  );

  function faqSummaryReply(specific?: (typeof FAQ_ITEMS)[number]): ConciergeReply {
    if (specific) {
      const actions: ConciergeAction[] = [
        { type: 'faq', value: specific.id, label: 'افتح الإجابة في الأسئلة الشائعة' },
      ];
      if (specific.actionHref?.startsWith('#guide/place/')) {
        actions.push({
          type: 'guide-place',
          value: specific.actionHref.slice(13),
          label: specific.actionLabel || 'افتح الصفحة',
        });
      } else if (specific.actionHref === '#guide') {
        actions.push({
          type: 'guide-filter',
          value: {},
          label: specific.actionLabel || 'تصفح الدليل',
        });
      }
      actions.push(conciergeIntent('plan', 'خطّط لرحلتي'));
      const items: ConciergeItem[] = (specific.highlights || []).map((hl, i) => ({
        id: `${specific.id}-hl-${i}`,
        title: 'نقطة مهمة',
        detail: hl,
        action: { type: 'faq', value: specific.id },
      }));
      return reply(`${specific.question}\n${specific.answer}`, actions, items);
    }
    const featured = FAQ_ITEMS.slice(0, 4);
    return reply(
      'أبرز الأسئلة الشائعة حول الوصول والمطار والطقس والمخطط متوفرة الآن في صفحة الأسئلة الشائعة المتخصصة:',
      [
        { type: 'faq', value: '', label: 'انتقل لصفحة الأسئلة الشائعة' },
        conciergeIntent('travel', 'أوراق السفر والوصول'),
        conciergeIntent('weather-now', 'الطقس والملابس الآن'),
        conciergeIntent('plan', 'رتّب لي رحلة'),
      ],
      featured.map((item) => ({
        id: item.id,
        title: item.question,
        detail: item.highlights?.[0] || 'انقر لقراءة الإجابة الكاملة',
        action: { type: 'faq', value: item.id },
      }))
    );
  }

  function liveWeatherReply(): ConciergeReply {
    const bahaTip = climateCities.baha.tips?.[currentSeason] || 'أجواء المرتفعات معتدلة نهارًا وتبرد مساءً.';
    const makhwahTip = climateCities.makhwah.tips?.[currentSeason] || 'قطاع تهامة أدفأ نهارًا ومناسب للزيارات الصباحية.';
    return reply(
      `إرشاد الأجواء واللباس في الباحة (${seasons[currentSeason].name}): ${bahaTip} وفي تهامة: ${makhwahTip}`,
      [
        { type: 'intent', value: { intent: 'weather-plan', city: 'baha' }, label: 'جدول اليوم حسب الطقس' },
        { type: 'city', value: 'baha', label: 'توقعات مدينة الباحة' },
        { type: 'city', value: 'makhwah', label: 'توقعات المخواة وتهامة' },
        conciergeLink('visit-season'),
        { type: 'faq', value: 'faq-clothing', label: 'نصائح الملابس' },
      ],
      [
        {
          id: 'baha-city-weather',
          image: images[climateCities.baha.image] || images.raghdan,
          title: 'مرتفعات السراة (الباحة وبلجرشي والمندق)',
          detail: bahaTip,
          action: { type: 'city', value: 'baha' },
        },
        {
          id: 'tihama-weather',
          image: images[climateCities.makhwah.image] || images.ain,
          title: 'تهامة وقرية ذي عين (المخواة)',
          detail: makhwahTip,
          action: { type: 'city', value: 'makhwah' },
        },
      ]
    );
  }

  function guideSearchReply(
    matches: IndexedGuideRecord[],
    scope: 'exact' | 'cat-only' | 'dist-only' | 'soft',
    heading: string,
    filterCat?: string,
    filterDist?: string
  ): ConciergeReply {
    const uniqueCats = new Set(matches.map((rec) => rec.category));
    const resolvedCat =
      scope === 'dist-only'
        ? ''
        : uniqueCats.size === 1
          ? matches[0].category
          : filterCat || matches[0]?.category || '';
    const resolvedDist = scope === 'cat-only' || scope === 'soft' ? '' : filterDist || '';
    const actions: ConciergeAction[] = [
      {
        type: 'guide-filter',
        value: {
          category: resolvedCat,
          district: resolvedDist,
        },
        label: 'افتح النتائج في الدليل الكامل',
      },
      conciergeIntent('plan', 'رتّبها في رحلة'),
      conciergeIntent('weather-now', 'طقس اليوم'),
    ];
    const items: ConciergeItem[] = matches.map((rec) => ({
      id: rec.id,
      guideId: rec.id,
      image: guideThumbnailFor(rec),
      title: rec.name,
      detail: `${rec.district || 'الباحة'} · ${rec.categoryLabel}`,
      action: { type: 'guide-place', value: rec.id },
    }));
    const prefix =
      scope === 'cat-only' || scope === 'dist-only'
        ? `أقرب الخيارات المتاحة في دليل الباحة:`
        : heading;
    return reply(prefix, actions, items);
  }

  function guidePlaceReply(place: IndexedGuideRecord): ConciergeReply {
    if (place.trip && places.has(place.trip)) next.place = place.trip;
    const catLabel = place.categoryLabel || '';
    const summary = `${place.name} في ${place.district || 'الباحة'}. اضغط على البطاقة للتفاصيل الكاملة.`;
    const actions: ConciergeAction[] = [
      { type: 'guide-place', value: place.id, label: 'اعرض التفاصيل' },
    ];
    if (place.trip && places.has(place.trip)) {
      const selected = trip.choices.includes(place.trip);
      actions.push({
        type: 'stop',
        value: { id: place.trip, add: !selected },
        label: selected ? 'أزل من رحلتي' : 'أضف إلى رحلتي',
      });
    }
    const items: ConciergeItem[] = [
      {
        id: place.id,
        guideId: place.id,
        image: guideThumbnailFor(place),
        title: place.name,
        detail: `${place.district || 'الباحة'} · ${catLabel}`,
        action: { type: 'guide-place', value: place.id },
      },
    ];
    return reply(summary, actions, items);
  }

  function placeReply(id: string): ConciergeReply {
    const stop = places.get(id)!;
    const guideRec = records.find((r) => r.trip === id);
    next.place = id;
    const selected = trip.choices.includes(id);
    const actions: ConciergeAction[] = [
      guideRec
        ? { type: 'guide-place', value: guideRec.id, label: 'افتح صفحة الوجهة' }
        : { type: 'place', value: id, label: 'افتح صفحة الوجهة' },
    ];
    const change: ConciergeAction = {
      type: 'stop',
      value: { id, add: !selected },
      label: selected ? 'أزلها من محطاتي' : 'أضفها إلى رحلتي',
    };
    if (remove || add) {
      const desired = !remove;
      if (selected === desired) {
        return reply(
          selected ? `${stop.name} موجودة بالفعل في محطاتك.` : `${stop.name} خارج قائمة محطاتك حاليًا.`,
          [conciergeIntent('saved'), ...actions]
        );
      }
      return reply(
        desired ? `تقدر تضيف ${stop.name} إلى محطاتك من هنا.` : `تقدر تزيل ${stop.name} من محطاتك من هنا.`,
        [change, ...actions]
      );
    }
    const suitability = /عائل|عايل|عيل|اطفال/.test(question)
      ? stop.types.includes('family')
        ? ' من الخيارات العائلية في دليلنا.'
        : ' لو تفضّل نزهة عائلية، أقترح منتزه الأمير حسام أو غابة رغدان.'
      : '';
    const facts = (guideRec?.facts || []).slice(0, 3);
    const summary = guideRec?.description || stop.desc;
    const items: ConciergeItem[] = facts.length
      ? facts.map(([title, detail], i) => ({ id: `${id}-fact-${i}`, title, detail }))
      : [{ id, title: stop.name, detail: stop.tag }];
    return reply(
      `${stop.name} في ${placeNotes[id].area}. ${summary} خصص قرابة ${durationLabel(stop.min)} للزيارة.${suitability}`,
      [...actions, change, conciergeIntent('plan', 'خطّط لزيارتي')],
      items
    );
  }

  function planReply(): ConciergeReply {
    next.mode = 'plan';
    if (!next.days) {
      return reply(
        'كم يوم عندك في الباحة؟ أقدر أرتّب لك برنامج من يوم إلى سبعة أيام.',
        Object.entries(conciergeDays).map(([key, label]) => conciergePreference('days', key, label))
      );
    }
    if (!next.style) {
      return reply(
        'وش أقرب لك؟ اختَر طابع الرحلة، أو اكتب لي تفضيلاتك مثل «طبيعة داخل مدينة الباحة».',
        Object.entries(typeLabels).map(([key, label]) => conciergePreference('style', key, label))
      );
    }
    const matching = stops.filter(
      (stop) =>
        (next.region === 'all' || stop.region === next.region) &&
        (next.style === 'all' || (next.style ? stop.types.includes(next.style) : true))
    );
    if (!matching.length) {
      return reply(
        'ما لقيت محطات تناسب هالطابع في المنطقة المختارة. نوسّع البحث للباحة كلها أو نستكشف كل التجارب في نفس المنطقة؟',
        [
          conciergePreference('region', 'all', 'وسّع البحث للباحة كلها'),
          conciergePreference('style', 'all', 'استكشف كل التجارب هنا'),
        ]
      );
    }
    const candidates = nearbyOrder(matching).slice(
      0,
      Number(next.days) * (next.pace === 'relaxed' ? 1 : 2)
    );
    const proposed = deps.scheduleTrip(new Set(candidates.map((stop) => stop.id)), next.days);
    const plan: TripPlan = {
      days: next.days,
      region: next.region,
      style: next.style,
      ids: proposed.stations.map((stop) => stop.id),
      timing: {
        season: next.season || currentSeason,
        month: next.month,
        start: 540,
        limit: 1260,
        locked: null,
        stations: proposed.stations.map((row) => ({ ...row, reason: stopVisit[row.id].best })),
      },
    };
    const remaining = Number(plan.days) - new Set(proposed.stations.map((stop) => stop.day)).size;
    const free = remaining > 0 ? ' الأيام المتبقية مفتوحة للراحة أو جولة تختارها من الدليل.' : '';
    return {
      ...reply(
        `هذا برنامجك المقترح في ${conciergeRegions[plan.region]} (${conciergeDays[plan.days]}). المواعيد تقديرية.${free}`,
        [
          { type: 'preview-plan', value: plan, label: 'شاهد المسار على الخريطة' },
          { type: 'review-plan', value: plan, label: 'أضف المسار لرحلتي' },
          conciergePreference('days', null, 'عدّل المدة'),
          conciergePreference('style', null, 'غيّر طابع الرحلة'),
          conciergeIntent('pick-region', 'غيّر المنطقة'),
          conciergeIntent('travel', 'خطوات السفر والأوراق'),
        ],
        timedItems(plan.timing)
      ),
      plan,
    };
  }

  function timedReply(plan: TripPlan): ConciergeReply {
    const rows = plan.timing.stations;
    const lastRow = rows.at(-1);
    const free = lastRow ? plan.timing.limit - lastRow.end : 0;
    const name = plan.timing.month ? monthName(plan.timing.month) : seasons[plan.timing.season].name;
    const description = plan.timing.locked
      ? `ثبّتّ ${places.get(plan.timing.locked)!.name} في المسار.`
      : `هذا اقتراحي لزيارتك في ${name}.`;
    const reserve = free > 0 ? ` باقي ${formatNum(free)} دقيقة في آخر الفترة، تقدر تسيبها للراحة.` : '';
    return {
      ...reply(
        `${description} البداية ${clock(rows[0].start)} بتوقيت السعودية.${reserve}`,
        [
          { type: 'preview-plan', value: plan, label: 'شاهد المسار على الخريطة' },
          { type: 'review-plan', value: plan, label: 'أضف المسار لرحلتي' },
          conciergeIntent('adjust-time', 'عدّل الوقت'),
          ...(next.previousPlan ? [conciergeIntent('previous-plan', 'ارجع للمسار الأول')] : []),
          conciergeIntent('travel', 'خطوات السفر والأوراق'),
        ],
        timedItems(plan.timing)
      ),
      plan,
    };
  }

  function planByTime(): ConciergeReply {
    next.mode = 'plan';
    if (intent === 'adjust-time') {
      return reply('قل لي الوقت الجديد، مثل «ابدأ 15:30»، أو المدة مثل «خلّها ساعة». أحتفظ بباقي تفضيلاتك.');
    }
    if (intent === 'previous-plan' && next.previousPlan) {
      const current = next.lastPlan;
      const plan = next.previousPlan;
      next.lastPlan = plan;
      next.previousPlan = current;
      Object.assign(next, {
        season: plan.timing.season,
        month: plan.timing.month,
        start: plan.timing.start,
        budget: plan.timing.limit - plan.timing.start,
        locked: plan.timing.locked,
        lessWalking: Boolean(plan.timing.lessWalking),
      });
      return timedReply(plan);
    }
    if (next.budget !== null && (next.budget < 25 || next.budget > 720)) {
      return reply('اختَر مدة يومية بين 25 دقيقة و12 ساعة، أو اذكر عدد الأيام لو زيارتك أطول.');
    }
    const matching = stops.filter(
      (stop) =>
        (next.region === 'all' || next.region === stop.region) &&
        (!next.style ||
          next.style === 'all' ||
          stop.types.includes(next.style) ||
          stop.id === next.locked ||
          stop.id === next.focus)
    );
    const plan = makeTimedPlan(next, matching, currentSeason);
    if (!plan) {
      return reply(
        'الوقت ده ضيّق على المحطات المختارة أو خارج نافذة زيارتها المنشورة. جرّب بداية أبكر أو مدة أطول.',
        [conciergeIntent('adjust-time', 'عدّل الوقت'), conciergeLink('visit-season')]
      );
    }
    plan.timing.lessWalking = Boolean(next.lessWalking);
    next.previousPlan = next.lastPlan;
    next.lastPlan = plan;
    return timedReply(plan);
  }

  function discoverReply(): ConciergeReply {
    next.mode = 'discover';
    const matches = stops.filter(
      (stop) =>
        (next.region === 'all' || stop.region === next.region) &&
        (!next.style || next.style === 'all' || stop.types.includes(next.style))
    );
    if (!matches.length) {
      return reply('الاختيارات الحالية محدودة. خلّنا نوسّع المنطقة أو نعرض كل التجارب هنا.', [
        conciergePreference('region', 'all', 'كل الباحة'),
        conciergePreference('style', 'all', 'كل التجارب'),
      ]);
    }
    const suggestions = matches.slice(0, 3);
    next.place = suggestions.length === 1 ? suggestions[0].id : null;
    return reply(
      next.style && next.style !== 'all'
        ? 'هذه أقرب الوجهات لاهتمامك. اختَر واحدة ونشوف تفاصيلها سوا.'
        : 'تقدر تبدأ بهالوجهات، أو تخصّص الاقتراحات حسب نوع التجربة اللي تحبها.',
      [
        ...suggestions.map(
          (stop): ConciergeAction => ({
            type: 'intent',
            value: { intent: 'place', id: stop.id },
            label: stop.name,
          })
        ),
        ...(!next.style
          ? Object.entries(typeLabels)
              .filter(([key]) => key !== 'all')
              .map(([key, label]) => conciergePreference('style', key, label))
          : []),
        conciergeLink('destination-directory'),
      ],
      suggestions.map((stop) => ({ id: stop.id, title: stop.name, detail: stop.tag }))
    );
  }

  if (intent === 'pick-region') {
    return reply(
      'أي منطقة تبي تزور؟',
      Object.entries(conciergeRegions).map(([key, label]) =>
        conciergePreference('region', key, label)
      )
    );
  }
  if (
    intent === 'preference' &&
    input.field &&
    Object.hasOwn(conciergePreferenceValues, input.field) &&
    ((typeof input.value === 'string' &&
      Object.hasOwn(conciergePreferenceValues[input.field], input.value)) ||
      (input.value === null && ['days', 'style'].includes(input.field)))
  ) {
    (next as unknown as Record<string, unknown>)[input.field] = input.value;
    return next.mode === 'plan' ? (next.lastPlan ? planByTime() : planReply()) : discoverReply();
  }
  if (duration && !Object.hasOwn(conciergeDays, duration)) {
    next.mode = 'plan';
    return reply(
      'البرامج المتاحة هنا من يوم إلى سبعة أيام. اختَر المدة المناسبة.',
      Object.entries(conciergeDays).map(([key, label]) => conciergePreference('days', key, label))
    );
  }
  if (duration) next.days = duration;
  if (interest) next.style = interest;
  if (area && (!categoryMatch || wantsPlan || timedRequest)) next.region = area;
  if (pace) next.pace = pace;
  if (intent === 'help') {
    return reply(
      'أهلاً بك! أنا مرشدك السياحي الذكي في بوابة منطقة الباحة. أقدر أبحث في الـ 144 معلمًا حسب المحافظة والفئة، وأبني لك خطة ساعة بساعة على الخريطة، وأفحص الطقس والأسواق الأسبوعية:',
      [
        conciergeIntent('plan', 'رتّب لي رحلة'),
        conciergeIntent('weather-now', 'طقس اليوم'),
        conciergeIntent('discover', 'اقترح لي وجهات'),
        conciergeIntent('dining', 'المطاعم والمقاهي'),
        conciergeIntent('faq', 'الأسئلة الشائعة'),
      ],
      [
        {
          id: 'cap-guide',
          title: 'بحث ذكي في 144 موقعًا',
          detail: 'جرّب: «مقاهي بلجرشي» أو «فنادق العقيق» أو «متاحف المندق»',
          action: { type: 'intent', value: { intent: 'discover' } },
        },
        {
          id: 'cap-plan',
          title: 'تخطيط مسار وساعات الزيارة',
          detail: 'جرّب: «رحلة 3 أيام» أو «ساعتان عائلي بعد العصر في يوليو»',
          action: { type: 'intent', value: { intent: 'plan' } },
        },
        {
          id: 'cap-faq',
          title: 'الوصول والأسئلة الشائعة',
          detail: 'أجوبة جاهزة للمطار والعقبات وأرقام 940 و930 و911',
          action: { type: 'faq', value: '' },
        },
      ]
    );
  }
  if (intent === 'faq') {
    return faqSummaryReply(typeof input.id === 'string' ? FAQ_ITEMS.find((f) => f.id === input.id) : undefined);
  }
  if (greetingOnly) {
    return reply(
      APPROVED_GUIDE_GREETING,
      [
        conciergeIntent('plan', 'رتّب لي رحلة'),
        conciergeIntent('weather-now', 'الطقس اليوم'),
        conciergeIntent('discover', 'اكتشف المعالم'),
        conciergeIntent('dining', 'مطاعم ومقاهي'),
        conciergeIntent('faq', 'الأسئلة الشائعة'),
      ]
    );
  }
  if (liveWeatherAsk && !timedRequest && !wantsPlan) {
    return liveWeatherReply();
  }
  if (climateQuestion && !timedRequest && !wantsPlan) {
    const cityKey = named
      ? stopVisit[named].city
      : destinationAreas.find((item) => item.region === next.region)?.id || 'baha';
    const city = climateCities[cityKey] || climateCities.baha;
    const season = visit.season || currentSeason;
    return reply(
      `${city.tips?.[season] || 'راجع الأجواء قبل الانطلاق.'} توقعات الساعات القادمة وأجواء الموسم في صفحة ${city.name}.`,
      [
        { type: 'city', value: cityKey, label: `أجواء ${city.name}` },
        conciergeIntent('weather-now', 'مقارنة السراة وتهامة الآن'),
        conciergeLink('visit-season'),
      ]
    );
  }
  if (timedRequest || (wantsPlan && next.lastPlan)) {
    if (visit.season) {
      next.season = visit.season;
      next.month = visit.month;
    }
    if (visit.start !== null) next.start = visit.start;
    if (visit.budget !== null) next.budget = visit.budget;
    if (visit.budget !== null && !duration) next.days = '1';
    if (named) {
      next.focus = named;
      if (!area) next.region = places.get(named)!.region;
    }
    if (/ثبت/.test(question)) {
      next.locked = named || next.lastPlan?.ids[0] || null;
      const prior = next.lastPlan?.timing.stations.find((row) => row.id === next.locked);
      if (prior && visit.start === null) next.start = prior.start;
    }
    if (adjust) {
      next.lessWalking =
        /قلل المشي|المشي اقل|خل.*مشي.*اقل|مشي اخف|بدون مشي/.test(question) || next.lessWalking;
    }
    return planByTime();
  }
  if (intent === 'place' && input.id && places.has(input.id)) return placeReply(input.id);

  if (
    intent === 'saved' ||
    (/محطاتي|محطات رحلتي|ملخص|رحلتي المحفوظه|الرحله المحفوظه/.test(question) && !add && !remove)
  ) {
    if (!trip.stations.length) {
      return reply('لسه ما اخترت محطات. تقدر تختار وجهة أو تطلب مني أرتّب لك برنامج.', [
        conciergeIntent('discover'),
        conciergeIntent('plan'),
      ]);
    }
    return reply(
      trip.approved
        ? 'هذا ملخص رحلتك المعتمدة. تقدر تراجعها من المخطط.'
        : 'هذه محطاتك المختارة حاليًا مع توقيتاتها التقديرية. تقدر تراجعها وتعتمد رحلتك في الملخص.',
      [
        conciergeLink('summary'),
        conciergeIntent('travel', 'خطوات السفر والأوراق'),
        ...trip.stations.map(
          (stop): ConciergeAction => ({
            type: 'intent',
            value: { intent: 'place', id: stop.id },
            label: stop.name,
          })
        ),
      ],
      itineraryItems(trip.stations)
    );
  }
  if (intent === 'guide') {
    return reply('وش تبي تستكشف في دليل الباحة؟ اختر الفئة أو اكتب اسم المحافظة:', [
      conciergeIntent('dining', 'المطاعم والمقاهي'),
      conciergeIntent('camping', 'الفنادق والشاليهات'),
      { type: 'guide-filter', value: { category: 'parks' }, label: 'المنتزهات والغابات' },
      { type: 'guide-filter', value: { category: 'heritage' }, label: 'القرى التراثية' },
    ]);
  }
  if (guideMatch && !wantsPlan && !add && !remove && !timedRequest && !climateQuestion) {
    return guidePlaceReply(guideMatch);
  }
  if (
    culinaryAsk &&
    !wantsPlan &&
    !add &&
    !remove &&
    !timedRequest
  ) {
    const foodPlaces = searchGuideRecords(question, records, ['restaurants', 'cafes'], districtMatch).matches;
    return reply(
      'من أشهر مأكولات الباحة التراثية: «الخبزة المقنّاة» على الحجر الساخن، و«الدغابيس»، و«العصيدة بالعسل الباحي»، إلى جانب «البُن الشدوي» المزروع في شدا. وهذه أقرب المطاعم والمقاهي من الدليل:',
      [
        {
          type: 'guide-filter',
          value: { category: 'restaurants', district: districtMatch || '' },
          label: 'افتح دليل المطاعم',
        },
        {
          type: 'guide-filter',
          value: { category: 'cafes', district: districtMatch || '' },
          label: 'تصفح المقاهي المختصة',
        },
        { type: 'faq', value: 'faq-food', label: 'المزيد في الأسئلة الشائعة' },
      ],
      foodPlaces.map((rec) => ({
        id: rec.id,
        guideId: rec.id,
        image: guideThumbnailFor(rec),
        title: rec.name,
        detail: `${rec.district || 'الباحة'} · ${rec.categoryLabel}`,
        action: { type: 'guide-place', value: rec.id },
      }))
    );
  }
  if (
    (categoryMatch || (districtMatch && !wantsPlan && !timedRequest && !named && !faqMatch)) &&
    !wantsPlan &&
    !add &&
    !remove &&
    !timedRequest
  ) {
    const searchRes = searchGuideRecords(
      question,
      records,
      categoryMatch?.categories || null,
      districtMatch
    );
    if (searchRes.matches.length) {
      const scopeLabel = [categoryMatch?.label || 'معالم الدليل', districtMatch ? `في ${districtMatch}` : 'في الباحة']
        .filter(Boolean)
        .join(' ');
      return guideSearchReply(
        searchRes.matches,
        searchRes.scope,
        `إليك أبرز خيارات ${scopeLabel} من دليل الباحة:`,
        categoryMatch?.filterCategory,
        districtMatch || ''
      );
    }
  }
  if (faqMatch && !wantsPlan && !add && !remove) {
    return faqSummaryReply(faqMatch);
  }
  if (section && !wantsPlan && !add && !remove) {
    return reply(conciergeSections[section].text || 'تلاقي روابط متاجر التطبيق في قسم الباحة آب.', [
      conciergeLink(section),
      conciergeIntent('plan'),
    ]);
  }
  if (wantsPlan) return planReply();
  if (named || ((add || remove || followUp) && next.place)) {
    return placeReply((named || next.place)!);
  }
  if (add || remove) {
    return reply('أي وجهة تقصد؟ اكتب اسمها مثل «غابة رغدان» أو «قرية ذي عين»، أو اخترها من محطاتك.', [
      conciergeIntent('discover'),
      conciergeIntent('saved'),
    ]);
  }
  if (!intent && question.length >= 2) {
    const softSearch = searchGuideRecords(question, records, null, null);
    if (softSearch.matches.length) {
      return guideSearchReply(
        softSearch.matches,
        'soft',
        `هذه أقرب النتائج المطابقة من دليل الباحة (${formatNum(tourGuide.records.length)} موقعًا):`
      );
    }
  }
  if (intent === 'discover' || interest || area || /اقترح|وجهات|استكشف|اروح|اماكن/.test(question)) {
    return discoverReply();
  }
  return reply(
    'ما زلت أقدر أساعدك فورًا! جرّب أن تكتب مثل: «مقاهي بلجرشي»، «فنادق العقيق»، «الطقس اليوم»، «رتّب لي 3 أيام»، أو اختر من الأسئلة الشائعة:',
    [
      conciergeIntent('weather-now', 'طقس اليوم'),
      conciergeIntent('plan', 'رتّب لي رحلة'),
      conciergeIntent('dining', 'مطاعم ومقاهي'),
      conciergeIntent('camping', 'فنادق وشاليهات'),
      conciergeIntent('faq', 'الأسئلة الشائعة'),
    ]
  );
}

function miniRoute(plan: TripPlan): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'seraj-mini';
  const ids = plan.ids;
  const pins = ids.map((id) => geo.stations[id]);
  const legs = ids.slice(1).map((id, i) => getSegment(places.get(ids[i])!, places.get(id)!));
  const points = [...pins, ...legs.flatMap((leg) => leg.points)];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(215, Math.max(...xs) - left + 85);
  const height = Math.max(120, Math.max(...ys) - top + 65);
  const cx = (left + Math.max(...xs)) / 2;
  const cy = (top + Math.max(...ys)) / 2;
  const path = routePath(legs);
  const terrainSource = byId('terrainRelief');
  figure.innerHTML = `<svg viewBox="${cx - width / 2} ${cy - height / 2} ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="معاينة مسار المحطات على خريطة الباحة">
      <path d="${path}" class="map-route-outline"/><path d="${path}" class="map-route-line"/>
      ${pins.map(([x, y], i) => `<g class="map-pin ${ids[i] === plan.timing.locked ? 'is-locked' : ''}" transform="translate(${x} ${y})"><circle r="11"/><text>${i + 1}</text></g>`).join('')}
      </svg><figcaption>مسار تجريبي | ${plan.timing.locked ? `محطة مثبّتة | ${places.get(plan.timing.locked)!.name}` : 'توقيت السعودية'}</figcaption>`;
  const svg = figure.querySelector('svg');
  if (svg && terrainSource) {
    const terrain = terrainSource.cloneNode() as Element;
    terrain.removeAttribute('id');
    svg.prepend(terrain);
  }
  return figure;
}

export function createConciergeController(deps: ConciergeControllerDeps): {
  askConcierge: (input: ConciergeInput, label: string) => Promise<void>;
  reset: () => void;
  setActiveStopContext: (stopId: string | null, guideId?: string | null) => void;
  bumpRequestSeq: () => void;
  getContext: () => ConciergeContextState;
  refreshContextUi: () => void;
} {
  const { signal } = deps;
  const conciergePanel = byId('agentPanel') as HTMLDialogElement | null;
  const conciergeThread = byId('conciergeThread');
  const conciergeScroll = byId('conciergeScroll');
  const conciergeInput = byId('conciergeInput') as HTMLInputElement | null;
  const conciergeForm = byId('conciergeForm') as HTMLFormElement | null;
  const conciergeSend = conciergeForm?.querySelector<HTMLButtonElement>('.concierge-send') || null;
  const conciergeReset = byId('conciergeReset') as HTMLButtonElement | null;
  const conciergeContextList = byId('conciergeContext');
  const conciergeWelcome = byId('conciergeWelcome');
  const conciergeStatus = byId('conciergeStatus');

  let conciergeContext: ConciergeContextState = createInitialConciergeContext(
    deps.getCurrentSeason()
  );
  let conciergePending = false;
  let latestRequestSeq = 0;
  let conciergeButtons: HTMLButtonElement[] = [];

  function matchesSavedPlan(plan: TripPlan): boolean {
    const state = deps.getState();
    return (
      state.choices.size === plan.ids.length &&
      plan.ids.every((id) => state.choices.has(id)) &&
      state.region === plan.region &&
      state.days === plan.days &&
      state.style === plan.style &&
      JSON.stringify(plan.timing ?? null) === JSON.stringify(state.savedTiming)
    );
  }

  function changeDraft(plan: TripPlan | null): void {
    conciergeContext.hasUnsavedPreview = Boolean(plan);
    if (deps.getState().routeDraft === plan) return;
    deps.setRouteDraft(plan);
  }

  function updateConciergeContext(): void {
    if (!conciergeContextList) return;
    conciergeContextList.replaceChildren();
    conciergeContextList.hidden = true;
  }

  function addConciergeMessage(text: string, fromVisitor = false): HTMLElement {
    if (conciergeWelcome) conciergeWelcome.hidden = true;
    const message = document.createElement('article');
    message.className = `concierge-message${fromVisitor ? ' is-visitor' : ''}`;
    if (fromVisitor) message.setAttribute('aria-label', 'رسالتك');
    else {
      const title = document.createElement('h4');
      title.textContent = 'المرشد السياحي الذكي';
      message.append(title);
    }
    const body = document.createElement('p');
    body.textContent = text;
    message.append(body);
    return message;
  }

  function clearConciergeActions(): void {
    for (const button of conciergeButtons) button.disabled = true;
    conciergeButtons = [];
  }

  function scrollConciergeTo(message: HTMLElement): void {
    if (!conciergeScroll) return;
    const rect = message.getBoundingClientRect();
    const viewport = conciergeScroll.getBoundingClientRect();
    conciergeScroll.scrollTop +=
      rect.height > conciergeScroll.clientHeight - 24
        ? rect.top - viewport.top - 12
        : Math.max(0, rect.bottom - viewport.bottom + 14);
  }

  function runConciergeAction({ type, value, label }: ConciergeAction): void {
    if (conciergePending) return;
    switch (type) {
      case 'intent':
        void askConcierge(
          typeof value === 'string' ? { intent: value } : (value as ConciergeInput),
          label || ''
        );
        break;
      case 'preference':
        void askConcierge(
          { intent: 'preference', ...(value as { field: string; value: unknown }) },
          label || ''
        );
        break;
      case 'retry':
        void askConcierge(value as ConciergeInput, label || '');
        break;
      case 'section': {
        const secId = String(value || '');
        if (!Object.hasOwn(conciergeSections, secId) || !byId(secId)) return;
        conciergePanel?.close();
        deps.goToSection(secId);
        break;
      }
      case 'travel-source': {
        const srcKey = String(value || '');
        if (isTravelSourceKey(srcKey)) {
          window.open(travelSources[srcKey].url, '_blank', 'noopener,noreferrer');
        }
        break;
      }
      case 'trip-pdf':
        if (deps.getState().approved) deps.downloadTripPdf();
        break;
      case 'route-stop':
      case 'dock-map-stop': {
        const stopId = String(value || '');
        if (!places.has(stopId)) return;
        const state = deps.getState();
        const isExploration = !state.choices.has(stopId);
        conciergeContext.activeStopId = stopId;
        conciergeContext.place = stopId;
        updateConciergeContext();
        if (deps.focusStopFromConcierge) {
          void deps.focusStopFromConcierge(stopId, { isExploration, message: label });
        } else {
          conciergePanel?.close();
          deps.selectDestination(stopId);
        }
        break;
      }
      case 'dock-guide-place': {
        const guideId = String(value || '');
        if (!deps.hasTourGuidePlace(guideId)) return;
        conciergeContext.activeGuideId = guideId;
        if (deps.dockAtGuidePlace) {
          deps.dockAtGuidePlace(guideId, { message: label });
        } else {
          conciergePanel?.close();
          window.location.hash = `guide/place/${guideId}`;
        }
        break;
      }
      case 'lock-stop': {
        const stopId = String(value || '');
        if (!places.has(stopId)) return;
        deps.toggleLockStop?.(stopId);
        if (!conciergeContext.lockedIds.includes(stopId)) {
          conciergeContext.lockedIds.push(stopId);
        }
        updateConciergeContext();
        break;
      }
      case 'mark-visited': {
        const stopId = String(value || '');
        if (!places.has(stopId)) return;
        deps.markStopVisited?.(stopId);
        if (!conciergeContext.completedIds.includes(stopId)) {
          conciergeContext.completedIds.push(stopId);
        }
        updateConciergeContext();
        break;
      }
      case 'replan-remaining': {
        void askConcierge({ intent: 'replan-remaining' }, label || 'أعد ترتيب المتبقي');
        break;
      }
      case 'city': {
        const cityKey = String(value || '');
        if (!Object.hasOwn(climateCities, cityKey)) return;
        conciergePanel?.close();
        window.location.hash = `city/${cityKey}`;
        break;
      }
      case 'preview-plan': {
        const plan = value as TripPlan;
        if (!routeTimingValid(plan?.timing, plan?.ids)) return;
        changeDraft(plan);
        conciergePanel?.close();
        deps.goToSection('tripDraft');
        break;
      }
      case 'place': {
        const placeId = String(value || '');
        if (!places.has(placeId)) return;
        conciergePanel?.close();
        window.location.hash = `place/${placeId}`;
        break;
      }
      case 'guide-place': {
        const guideId = String(value || '');
        if (!deps.hasTourGuidePlace(guideId)) return;
        conciergePanel?.close();
        window.location.hash = `guide/place/${guideId}`;
        break;
      }
      case 'guide-filter': {
        const opts = (value || {}) as { category?: string; district?: string; query?: string };
        conciergePanel?.close();
        if (deps.openGuideFilter) {
          deps.openGuideFilter(opts);
        } else {
          window.location.hash = 'guide';
        }
        break;
      }
      case 'faq': {
        const faqId = typeof value === 'string' && value ? value : undefined;
        conciergePanel?.close();
        if (deps.openFaq) {
          deps.openFaq(faqId);
        } else {
          window.location.hash = faqId ? `faq/${faqId}` : 'faq';
        }
        break;
      }
      case 'stop': {
        const payload = value as { id: string; add: boolean };
        const stop = payload ? places.get(payload.id) : undefined;
        if (!stop || typeof payload.add !== 'boolean') return;
        if (deps.getState().choices.has(stop.id) !== payload.add) deps.toggleStop(stop);
        showConciergeReply({
          text: payload.add ? `أضفت ${stop.name} إلى رحلتك.` : `أزلت ${stop.name} من رحلتك.`,
          actions: [conciergeIntent('saved'), conciergeIntent('discover')],
        });
        break;
      }
      case 'review-plan':
      case 'apply-plan': {
        const plan = value as TripPlan;
        if (
          !plan ||
          !Object.hasOwn(conciergeDays, plan.days) ||
          !Object.hasOwn(conciergeRegions, plan.region) ||
          !Object.hasOwn(typeLabels, plan.style) ||
          !Array.isArray(plan.ids) ||
          !plan.ids.length ||
          !plan.ids.every((id) => places.has(id))
        ) {
          return;
        }
        if (plan.timing && !routeTimingValid(plan.timing, plan.ids)) return;
        const samePlan = matchesSavedPlan(plan);
        if (type === 'review-plan' && deps.getState().choices.size && !samePlan) {
          showConciergeReply({
            text: 'عندك محطات مختارة بالفعل. تحميل المقترح يستبدل المحطات الحالية ويحدّث إعدادات الرحلة.',
            actions: [
              { type: 'apply-plan', value: plan, label: 'استبدل المحطات بالمقترح' },
              conciergeIntent('saved', 'احتفظ بمحطاتي واعرضها'),
            ],
          });
          break;
        }
        if (!samePlan) {
          deps.applySavedPlan(plan);
        } else {
          changeDraft(null);
        }
        showConciergeReply({
          text: 'المقترح جاهز الآن في مخطط رحلتك. تقدر تراجع المحطات والمواعيد وتعدّلها أو تعتمد الرحلة.',
          actions: [
            conciergeLink('summary'),
            conciergeIntent('travel', 'خطوات السفر والأوراق'),
            conciergeLink('planner'),
          ],
        });
        break;
      }
    }
  }

  function showConciergeReply({
    text,
    speechText,
    actions = [],
    items = [],
    context = conciergeContext,
    plan = null,
    sourceMode,
    dockTarget,
  }: ConciergeReply): void {
    if (!conciergeThread) return;
    if (sourceMode) deps.onModeBadgeChange?.(sourceMode);
    clearConciergeActions();
    conciergeContext = context;
    updateConciergeContext();
    const message = addConciergeMessage(text);
    if (plan && routeTimingValid(plan.timing, plan.ids)) {
      changeDraft(plan);
    }
    if (items.length) {
      const list = document.createElement('ul');
      list.className = 'concierge-items';
      for (const item of items) {
        const row = document.createElement('li');
        row.className = 'concierge-item';
        const stop = item.id ? places.get(item.id) : undefined;
        const itemAction: ConciergeAction | undefined =
          item.action ||
          (stop
            ? { type: 'place', value: stop.id }
            : item.guideId
              ? { type: 'guide-place', value: item.guideId }
              : undefined);
        const container = document.createElement(itemAction ? 'button' : 'div');
        container.className = itemAction ? 'concierge-item-card is-interactive' : 'concierge-item-card';
        if (itemAction && container instanceof HTMLButtonElement) {
          container.type = 'button';
          container.addEventListener('click', () => runConciergeAction(itemAction), { signal });
        }
        const thumbSrc = item.image || (stop ? images[stop.image] || '' : '');
        if (thumbSrc) {
          const photo = document.createElement('img');
          photo.src = thumbSrc;
          photo.alt = '';
          photo.loading = 'lazy';
          photo.decoding = 'async';
          container.append(photo);
        }
        const copy = document.createElement('div');
        copy.className = 'concierge-item-copy';
        const title = document.createElement('strong');
        title.textContent = item.title;
        const detail = document.createElement('span');
        detail.textContent = item.detail;
        copy.append(title, detail);
        if (item.time) {
          const schedule = document.createElement('span');
          schedule.className = 'concierge-item-meta';
          const time = document.createElement('bdi');
          time.dir = 'ltr';
          time.textContent = item.time;
          schedule.append(time);
          copy.append(schedule);
        }
        container.append(copy);
        row.append(container);
        list.append(row);
      }
      if (actions.length && plan) {
        const buttons = document.createElement('div');
        buttons.className = 'concierge-actions concierge-actions-top';
        conciergeButtons = actions.map((action, i) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `concierge-choice${i === 0 ? ' is-primary' : ''}`;
          button.textContent = action.label || '';
          button.addEventListener('click', () => runConciergeAction(action), { signal });
          return button;
        });
        buttons.append(...conciergeButtons);
        message.append(buttons);
      }
      message.append(list);
    }
    if (actions.length && !(plan && items.length)) {
      const buttons = document.createElement('div');
      buttons.className = 'concierge-actions';
      conciergeButtons = actions.map((action, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `concierge-choice${i === 0 ? ' is-primary' : ''}`;
        button.textContent = action.label || '';
        button.addEventListener('click', () => runConciergeAction(action), { signal });
        return button;
      });
      buttons.append(...conciergeButtons);
      message.append(buttons);
    }
    conciergeThread.append(message);
    scrollConciergeTo(message);

    deps.onSpeakReply?.(speechText || text);

    if (dockTarget) {
      if (dockTarget.kind === 'map-stop' && dockTarget.stopId && deps.focusStopFromConcierge) {
        void deps.focusStopFromConcierge(dockTarget.stopId, {
          isExploration: dockTarget.isExploration,
          message: dockTarget.message,
        });
      } else if (
        dockTarget.kind === 'guide-place' &&
        dockTarget.guideId &&
        deps.dockAtGuidePlace
      ) {
        deps.dockAtGuidePlace(dockTarget.guideId, {
          missingCoordinates: dockTarget.missingCoordinates,
          message: dockTarget.message,
        });
      }
    }
  }

  async function requestConciergeReply(
    request: ConciergeSimulationRequest,
    requestSeq: number
  ): Promise<ConciergeReply> {
    const { input, context } = request;
    const state = deps.getState();
    const pageCtx = deps.getActivePageContext?.() || {
      placeId: null,
      guidePlaceId: null,
      activeStopId: state.activeStopId || null,
      lockedIds: state.lockedIds || [],
      completedIds: state.completedIds || [],
    };

    const cleanText = normalizeAr(input.text || '');
    const needsWeatherLookup =
      input.intent === 'weather-now' ||
      input.intent === 'weather-plan' ||
      /طقس|جو|مطر|امطار|ضباب/.test(cleanText);

    let weatherSnap: ServerConciergeRequestPayload['weather'] = null;
    if (needsWeatherLookup) {
      const cityKey = input.city && Object.hasOwn(climateCities, input.city) ? input.city : 'baha';
      const deadline = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1100));
      const data = await Promise.race([forecast(cityKey), deadline]);
      if (data) {
        const wetNow = data.hours.slice(0, 5).some(isWet);
        weatherSnap = {
          city: cityKey,
          tempC: data.current.temperature_2m,
          conditionLabel: weatherNames(data.current.weather_code),
          isWet: Boolean(wetNow),
          source: 'Open-Meteo',
          observedAt: data.current.time,
        };
      }
    }

    const payload: ServerConciergeRequestPayload = {
      question: input.text,
      intent: input.intent,
      preference: input.field ? { field: input.field, value: input.value } : undefined,
      city: input.city,
      placeId: pageCtx.placeId || input.id || null,
      guidePlaceId: pageCtx.guidePlaceId || null,
      context: {
        ...context,
        activeStopId: context.activeStopId || pageCtx.activeStopId || null,
        activeGuideId: context.activeGuideId || pageCtx.guidePlaceId || null,
        lockedIds: [...new Set([...(context.lockedIds || []), ...pageCtx.lockedIds])],
        completedIds: [...new Set([...(context.completedIds || []), ...pageCtx.completedIds])],
      },
      savedState: {
        days: state.days,
        region: state.region,
        style: state.style,
        ids: [...state.choices],
        timing: state.savedTiming,
        completedIds: pageCtx.completedIds,
        lockedIds: pageCtx.lockedIds,
      },
      weather: weatherSnap,
      demoRain: input.intent === 'rain-demo',
      requestSeq,
    };

    const response = await fetch('/api/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Concierge API error ${response.status}`);
    }

    const result = (await response.json()) as {
      ok?: boolean;
      mode?: 'live' | 'demo';
      reply?: ConciergeReply;
    };

    if (!result.ok || !result.reply) {
      throw new Error('Concierge malformed reply');
    }

    const mode = result.mode || 'demo';
    deps.onModeBadgeChange?.(mode);

    if (signal.aborted) {
      return { text: '', context: request.context };
    }

    if (!result.reply.delegateToDirectory) {
      return {
        ...result.reply,
        sourceMode: mode,
        requestSeq,
      };
    }

    if (
      input.intent &&
      ['weather-plan', 'rain-demo'].includes(input.intent) &&
      input.city &&
      Object.hasOwn(climateCities, input.city)
    ) {
      return {
        ...weatherPlanReply(input, context, deps.getCurrentSeason()),
        sourceMode: mode,
        requestSeq,
      };
    }

    const asksLiveWeather =
      input.intent === 'weather-now' ||
      (!input.intent &&
        /الطقس اليوم|الطقس الان|جو اليوم|الجو الان|درجه الحراره|حاله الطقس|ملابس|لبس|جاكيت|بردان/.test(
          cleanText
        ));

    if (asksLiveWeather) {
      const deadline = new Promise<[null, null]>((resolve) =>
        window.setTimeout(() => resolve([null, null]), 1500)
      );
      const [bahaData, tihaData] = await Promise.race([
        Promise.all([forecast('baha'), forecast('makhwah')]),
        deadline,
      ]);
      const base = simulateConcierge(request, deps);
      if (bahaData || tihaData) {
        const bahaTemp = bahaData ? `${Math.round(bahaData.current.temperature_2m)}°` : 'معتدلة';
        const tihaTemp = tihaData ? `${Math.round(tihaData.current.temperature_2m)}°` : 'دافئة';
        const bahaCond = bahaData ? weatherNames(bahaData.current.weather_code) : 'أجواء جبلية';
        const tihaCond = tihaData ? weatherNames(tihaData.current.weather_code) : 'أجواء تهامية';
        const bahaWet = bahaData?.hours.slice(0, 5).some(isWet);
        const advice = bahaWet
          ? 'تظهر فرصة أمطار خفيفة على المرتفعات خلال الساعات القادمة؛ يُفضّل اصطحاب جاكيت مطري وزيارة الغابات صباحًا.'
          : 'السراة معتدلة نهارًا وتميل للبرودة مساءً (احمل سترة خفيفة)، وتهامة أدفأ نهارًا ومناسبة صباحًا أو قبل العصر.';
        return {
          ...base,
          sourceMode: mode,
          requestSeq,
          text: `الطقس المتوقع في الباحة الآن — السراة ${bahaTemp} (${bahaCond})، وتهامة ${tihaTemp} (${tihaCond}). ${advice}`,
          items: [
            {
              id: 'baha-city-weather',
              image: images[climateCities.baha.image] || images.raghdan,
              title: `مرتفعات السراة · ${bahaTemp} (${bahaCond})`,
              detail: 'مناسبة لغابة رغدان ومنتزه الأمير حسام وغابة خيرة',
              action: { type: 'city', value: 'baha' },
            },
            {
              id: 'tihama-weather',
              image: images[climateCities.makhwah.image] || images.ain,
              title: `تهامة والمخواة · ${tihaTemp} (${tihaCond})`,
              detail: 'مناسبة لقرية ذي عين التراثية وجبل شدا',
              action: { type: 'city', value: 'makhwah' },
            },
          ],
        };
      }
      return { ...base, sourceMode: mode, requestSeq };
    }

    return {
      ...simulateConcierge(request, deps),
      sourceMode: mode,
      requestSeq,
    };
  }

  async function askConcierge(input: ConciergeInput, label: string): Promise<void> {
    if (conciergePending || signal.aborted) return;
    conciergePending = true;
    const mySeq = ++latestRequestSeq;
    if (document.activeElement?.closest('.concierge-shortcuts, .concierge-actions')) {
      conciergeScroll?.focus({ preventScroll: true });
    }
    if (conciergeSend) conciergeSend.disabled = true;
    if (conciergeReset) conciergeReset.disabled = true;
    clearConciergeActions();
    const visitorMsg = addConciergeMessage(label, true);
    conciergeThread?.append(visitorMsg);
    scrollConciergeTo(visitorMsg);
    if (conciergeStatus) conciergeStatus.textContent = 'جارٍ ترتيب محطاتك على الخريطة…';
    try {
      const state = deps.getState();
      const answer = await requestConciergeReply(
        {
          input,
          context: { ...conciergeContext },
          trip: {
            choices: [...state.choices],
            approved: Boolean(state.approved),
            stations: deps.scheduleTrip().stations,
          },
        },
        mySeq
      );
      if (signal.aborted || mySeq !== latestRequestSeq) return;
      if (conciergeStatus) conciergeStatus.textContent = '';
      showConciergeReply(answer);
    } catch {
      if (signal.aborted || mySeq !== latestRequestSeq) return;
      if (conciergeStatus) conciergeStatus.textContent = '';
      showConciergeReply({
        text: CONCIERGE_FAILURE_NOTICE,
        actions: [
          { type: 'retry', value: input, label: 'إعادة المحاولة' },
          { type: 'section', value: 'summary', label: 'العودة إلى رحلتي المحفوظة' },
          { type: 'guide-filter', value: {}, label: 'تصفّح الدليل السياحي' },
        ],
      });
    } finally {
      conciergePending = false;
      if (!signal.aborted) {
        if (conciergeSend) conciergeSend.disabled = false;
        if (conciergeReset) conciergeReset.disabled = false;
      }
    }
  }

  function reset(): void {
    if (conciergePending) return;
    latestRequestSeq += 1;
    conciergeThread?.replaceChildren();
    clearConciergeActions();
    conciergeContext = createInitialConciergeContext(deps.getCurrentSeason());
    changeDraft(null);
    updateConciergeContext();
    if (conciergeInput) conciergeInput.value = '';
    if (conciergeWelcome) conciergeWelcome.hidden = false;
    if (conciergeScroll) {
      conciergeScroll.scrollTop = 0;
      conciergeScroll.focus({ preventScroll: true });
    }
  }

  qsAll<HTMLElement>('[data-concierge-intent]').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        const intent = button.dataset.conciergeIntent;
        if (intent) void askConcierge({ intent }, conciergePrompts[intent] || '');
      },
      { signal }
    )
  );

  qsAll<HTMLElement>('[data-concierge-prompt]').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        const prompt = button.dataset.conciergePrompt?.trim();
        if (prompt) void askConcierge({ text: prompt }, prompt);
      },
      { signal }
    )
  );

  conciergeForm?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      const text = conciergeInput?.value.trim() || '';
      if (!text || conciergePending || !conciergeInput) return;
      conciergeInput.value = '';
      void askConcierge({ text }, text);
    },
    { signal }
  );

  byId('conciergeHelp')?.addEventListener(
    'click',
    () => void askConcierge({ intent: 'help' }, conciergePrompts.help),
    { signal }
  );

  qsAll<HTMLElement>('[data-concierge-reset]').forEach((button) =>
    button.addEventListener('click', reset, { signal })
  );
  if (conciergeReset && !conciergeReset.hasAttribute('data-concierge-reset')) {
    conciergeReset.addEventListener('click', reset, { signal });
  }

  byId('draftCancel')?.addEventListener(
    'click',
    () => {
      changeDraft(null);
      byId('routeDots')?.querySelector('button')?.focus({ preventScroll: true });
    },
    { signal }
  );

  byId('draftApply')?.addEventListener(
    'click',
    () => {
      const draft = deps.getState().routeDraft;
      if (!draft) return;
      deps.applySavedPlan(draft);
    },
    { signal }
  );

  signal.addEventListener(
    'abort',
    () => {
      conciergeThread?.replaceChildren();
      conciergeButtons = [];
      if (conciergeWelcome) conciergeWelcome.hidden = false;
      if (conciergeContextList) {
        conciergeContextList.replaceChildren();
        conciergeContextList.hidden = true;
      }
      if (conciergeStatus) conciergeStatus.textContent = '';
    },
    { once: true }
  );

  return {
    askConcierge,
    reset,
    setActiveStopContext: (stopId: string | null, guideId?: string | null) => {
      conciergeContext.activeStopId = stopId;
      if (stopId) conciergeContext.place = stopId;
      if (guideId !== undefined) conciergeContext.activeGuideId = guideId;
      updateConciergeContext();
    },
    bumpRequestSeq: () => {
      latestRequestSeq += 1;
    },
    getContext: () => ({ ...conciergeContext }),
    refreshContextUi: updateConciergeContext,
  };
}
