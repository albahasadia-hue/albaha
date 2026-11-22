import type {
  ConciergeContextState,
  SeasonKey,
  StopBase,
  TripPlan,
  TripStyle,
} from './portalTypes';
import {
  climateCities,
  conciergeDays,
  conciergeRegions,
  images,
  places,
  seasons,
  stops,
} from './portalStaticData';
import { clock, formatNum } from './portalHelpers';
import { FAQ_ITEMS } from '@/data/faqData';
import {
  buildConstraintPlan,
  createInitialConciergeContext,
  getRiyadhNowInfo,
  parseStartPointAr,
  parseTimeWindowAndReturnAr,
  parseVisitDayAr,
  WEEKDAY_NAMES_AR,
} from './plannerTools';
import {
  detectCategoryIntent,
  detectGovernorate,
  getGuide144ById,
  getGuide144ByStopId,
  getGuide144Items,
  NEUTRAL_PLACEHOLDER_IMAGE,
  normalizeSearchText,
  searchGuide144,
  type EnrichedGuide144Item,
} from './guideCatalog144';
import {
  hydratePlaceCard,
  type SmartGuideAction,
  type SmartGuideItinerary,
  type SmartGuideItineraryDay,
  type SmartGuideItineraryStop,
  type SmartGuidePlaceCard,
  type SmartGuideRequestPayload,
  type SmartGuideResponseContract,
} from './smartGuideContract';

export interface SmartGuideTurnComputation {
  response: SmartGuideResponseContract;
  retrievedItems: EnrichedGuide144Item[];
  intentKind:
    | 'greeting'
    | 'navigation'
    | 'place_detail'
    | 'place_ambiguous'
    | 'price_or_availability'
    | 'area_recommendation'
    | 'trip_plan'
    | 'trip_modify_time'
    | 'trip_swap_stop'
    | 'weather_plan'
    | 'discovery_or_prep'
    | 'missing_info'
    | 'general';
  usePreauthoredOnly: boolean;
  unconfirmedTopic?: string | null;
  referenceFact?: string | null;
}

function mergeUniqueGuideItems(
  primary: EnrichedGuide144Item[],
  secondary: EnrichedGuide144Item[],
  max = 8
): EnrichedGuide144Item[] {
  const out: EnrichedGuide144Item[] = [];
  const seen = new Set<number>();
  for (const list of [primary, secondary]) {
    for (const item of list) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

const DAY_LABELS_AR = [
  'اليوم الأول',
  'اليوم الثاني',
  'اليوم الثالث',
  'اليوم الرابع',
  'اليوم الخامس',
  'اليوم السادس',
  'اليوم السابع',
];

const GOVERNORATE_TO_CITY_KEY: Record<string, string> = {
  'مدينة الباحة': 'baha',
  'بلجرشي': 'baljurashi',
  'المندق': 'mandaq',
  'العقيق': 'aqiq',
  'المخواة': 'makhwah',
  'القرى': 'qura',
  'بني حسن': 'bani-hassan',
  'قلوة': 'qilwah',
  'غامد الزناد': 'ghamid',
  'الحجرة': 'hajrah',
};

const REGION_TO_CITY_KEY: Record<string, string> = {
  all: 'baha',
  city: 'baha',
  baljurashi: 'baljurashi',
  mandaq: 'mandaq',
  aqiq: 'aqiq',
  south: 'makhwah',
  qura: 'qura',
  'bani-hassan': 'bani-hassan',
  qilwah: 'qilwah',
  ghamid: 'ghamid',
  hajrah: 'hajrah',
};

function buildItineraryFromPlan(
  plan: TripPlan,
  opts?: { title?: string; weatherNote?: string | null }
): SmartGuideItinerary {
  const byDay = new Map<number, SmartGuideItineraryStop[]>();

  for (const row of plan.timing.stations) {
    const stop = places.get(row.id);
    if (!stop) continue;
    const linkedGuide = getGuide144ByStopId(stop.id);
    const gov =
      linkedGuide?.governorate ||
      stop.operational?.district ||
      conciergeRegions[stop.region] ||
      'منطقة الباحة';
    const item: SmartGuideItineraryStop = {
      day: row.day,
      startTime: clock(row.start),
      endTime: clock(row.end),
      stopId: stop.id,
      guideItemId: linkedGuide?.id ?? null,
      name: stop.name,
      governorate: gov,
      shortDescription:
        row.reason ||
        linkedGuide?.shortDescription ||
        stop.desc ||
        `${gov} · ${stop.tag}`,
      reason: row.reason,
      driveMinutes: row.drive_minutes ?? null,
      image: images[stop.image] || linkedGuide?.image || NEUTRAL_PLACEHOLDER_IMAGE,
      internalHref: `#place/${stop.id}`,
      canShowOnMap: true,
      canAddToTrip: true,
    };
    const bucket = byDay.get(row.day) || [];
    bucket.push(item);
    byDay.set(row.day, bucket);
  }

  const groupedDays: SmartGuideItineraryDay[] = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayNum, dayStops]) => ({
      day: dayNum,
      label: DAY_LABELS_AR[dayNum - 1] || `اليوم ${formatNum(dayNum)}`,
      stops: dayStops,
    }));

  const daysCount = Math.max(Number(plan.days || 1), groupedDays.length || 1);
  return {
    days: daysCount,
    title:
      opts?.title ||
      `برنامج ${conciergeDays[String(daysCount)] || `${formatNum(daysCount)} أيام`} في ${conciergeRegions[plan.region] || 'الباحة'}`,
    startTime: clock(plan.timing.stations[0]?.start ?? plan.timing.start),
    region: plan.region,
    plan,
    groupedDays,
    weatherNote: opts?.weatherNote ?? null,
  };
}

function buildShortRecommendationReason(item: EnrichedGuide144Item, contextHint?: string): string {
  const parts: string[] = [];
  if (item.governorate) parts.push(item.governorate);
  if (item.type && !item.shortDescription.includes(item.type)) parts.push(item.type);
  if (item.ratingRaw && item.rating) parts.push(`تقييم ${item.rating}`);

  // Pick a concise natural highlight from description
  const desc = item.description;
  let perk = '';
  if (/مطار/.test(desc)) perk = 'قريب من المطار';
  else if (/مسبح/.test(desc)) perk = 'يضم مسبحاً';
  else if (/كهف|كهوف/.test(desc)) perk = 'تجربة كهوف طبيعية فريدة';
  else if (/شلال/.test(desc)) perk = 'شلالات وأجواء باردة';
  else if (/عائل|عوائل/.test(desc)) perk = 'مناسب للعائلات';
  else if (/قهوه مختصه|قهوة مختصة/.test(desc)) perk = 'قهوة مختصة وجلسات هادئة';
  else if (/شعبي|الدغابيس|الحنيذ|المندي/.test(desc)) perk = 'أكلات شعبية باحية';
  else if (/تراثي|حجرية/.test(desc)) perk = 'عمارة حجرية وتراث أصيل';
  else if (contextHint) perk = contextHint;

  if (perk) parts.push(perk);
  return parts.slice(0, 3).join(' · ');
}

function parseDaysCount(q: string): number | null {
  const digit = q.match(/(?:^|\s)([1-7])\s*(?:يوم|ايام)(?:\s|$)/)?.[1];
  if (digit) return Number(digit);
  if (/اسبوع|سبع(?:ه)?\s*ايام/.test(q)) return 7;
  if (/ست(?:ه)?\s*ايام/.test(q)) return 6;
  if (/خمس(?:ه)?\s*ايام/.test(q)) return 5;
  if (/اربع(?:ه)?\s*ايام/.test(q)) return 4;
  if (/ثلاث(?:ه)?\s*ايام/.test(q)) return 3;
  if (/يومين|يومان/.test(q)) return 2;
  if (/يوم واحد|نفس اليوم|ليوم واحد|رحله يوم(?:\s|$)/.test(q)) return 1;
  return null;
}

function parseExplicitClockTime(q: string): number | null {
  // Handle Saudi colloquial expressions like "خلها من 8 الصبح", "من 8 الصباح", "الساعة 4 العصر", "10:30 ص", "ابدأ 9"
  const m = q.match(
    /(?:من|ابدا|نبدا|خليها|خلها|الساعه|ساعه|بدايه)?\s*(\d{1,2})(?::(\d{2}))?\s*(الصبح|الصباح|صباحا|صباح|ص|الظهر|ظهرا|العصر|عصرا|المساء|المسا|مساء|مسا|م|الليل|ليل)?/
  );
  if (m && m[1]) {
    const rawH = Number(m[1]);
    const min = Number(m[2] || 0);
    const period = m[3] || '';
    const hasTimeContext =
      Boolean(period) ||
      /(?:من|ابدا|نبدا|خليها|خلها|الساعه|ساعه|بدايه)\s*\d{1,2}/.test(q) ||
      q.includes(':');
    if (hasTimeContext && rawH >= 1 && rawH <= 23 && min < 60) {
      let h = rawH;
      if (/العصر|عصرا|المساء|المسا|مساء|مسا|م|الليل|ليل/.test(period)) {
        h = h < 12 ? h + 12 : h;
      } else if (/الصبح|الصباح|صباحا|صباح|ص/.test(period)) {
        h = h === 12 ? 0 : h;
      } else if (/الظهر|ظهرا/.test(period)) {
        h = h < 11 ? h + 12 : h;
      } else if (h >= 1 && h <= 5) {
        h += 12;
      }
      if (h >= 5 && h <= 22) return h * 60 + min;
    }
  }
  const fallback = parseTimeWindowAndReturnAr(q);
  return fallback.start;
}

function parseSwapTarget(
  q: string,
  activePlan: TripPlan
): { stationIndex: number; stop: StopBase } | null {
  const stations = activePlan.timing.stations;
  if (!stations.length) return null;

  // Check if visitor named a specific stop in the plan
  for (let i = 0; i < stations.length; i += 1) {
    const stop = places.get(stations[i].id);
    if (stop && q.includes(normalizeSearchText(stop.name))) {
      return { stationIndex: i, stop };
    }
    const shortKey = stop ? normalizeSearchText(stop.name).replace(/^(?:منتزه|متنزه|حديقه|غابه|قريه)\s+/, '') : '';
    if (stop && shortKey.length >= 4 && q.includes(shortKey)) {
      return { stationIndex: i, stop };
    }
  }

  // Optional day filter: "في اليوم الثاني" / "اليوم 2"
  const dayFilter = /اليوم الثاني|اليوم 2|ثاني يوم/.test(q)
    ? 2
    : /اليوم الثالث|اليوم 3|ثالث يوم/.test(q)
      ? 3
      : /اليوم الاول|اليوم 1|اول يوم/.test(q)
        ? 1
        : null;

  const candidateIndices = stations
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => dayFilter === null || row.day === dayFilter);
  const scope = candidateIndices.length ? candidateIndices : stations.map((row, idx) => ({ row, idx }));

  let localIdx = 0;
  if (/اخير|اخر محط|المحطه الاخيره/.test(q)) localIdx = scope.length - 1;
  else if (/رابع|الرابعه|محطه 4|رقم 4/.test(q)) localIdx = Math.min(3, scope.length - 1);
  else if (/ثالث|الثالثه|محطه 3|رقم 3/.test(q)) localIdx = Math.min(2, scope.length - 1);
  else if (/ثاني|الثانيه|محطه 2|رقم 2/.test(q)) localIdx = Math.min(1, scope.length - 1);
  else localIdx = 0; // "أول محطة" / "المحطة الأولى" / default first

  const chosenEntry = scope[localIdx];
  const stop = places.get(chosenEntry.row.id);
  return stop ? { stationIndex: chosenEntry.idx, stop } : null;
}

function findStopForNavCommand(q: string): StopBase | null {
  for (const s of stops) {
    const full = normalizeSearchText(s.name);
    const short = full.replace(/^(?:منتزه|متنزه|حديقه|غابه|قريه)\s+/, '');
    if (q.includes(full) || (short.length >= 4 && q.includes(short))) {
      return s;
    }
  }
  if (/ذي عين|ذي العين/.test(q)) return places.get('ain') || null;
  if (/رغدان/.test(q)) return places.get('raghdan') || null;
  if (/حسام/.test(q)) return places.get('hussam') || null;
  if (/شدا/.test(q)) return places.get('shada') || null;
  if (/الخلب/.test(q)) return places.get('khulb') || null;
  if (/خيره|جدر/.test(q)) return places.get('khairah-forest-park') || null;
  if (/مشاري/.test(q)) return places.get('mishari') || null;
  if (/الثروه/.test(q)) return places.get('tharwa') || null;
  return null;
}

function buildCompactContactSummary(item: EnrichedGuide144Item): string {
  const bits: string[] = [];
  if (item.phones.length) bits.push(`الهاتف: ${item.phones[0].display}`);
  if (item.whatsappUrl) bits.push('متوفر تواصل واتساب');
  if (item.bookingLink) bits.push(`متاح عبر ${item.bookingLink.label}`);
  if (item.officialWebsite && item.officialWebsite.url !== item.bookingLink?.url) {
    bits.push('وله موقع رسمي');
  }
  return bits.join('، ');
}

function detectUnconfirmedAttributeQuestion(
  q: string,
  item: EnrichedGuide144Item
): string | null {
  const blob = normalizeSearchText(`${item.description} ${item.contactAndBooking} ${item.priceRange || ''}`);
  const checks: Array<{ pattern: RegExp; inDesc: RegExp; topic: string }> = [
    { pattern: /مسبح|حوض سباحه/, inDesc: /مسبح|مسابح/, topic: 'وجود مسبح' },
    { pattern: /واي فاي|انترنت|نت/, inDesc: /واي فاي|انترنت/, topic: 'توفر الواي فاي' },
    { pattern: /فطور|افطار/, inDesc: /افطار|فطور/, topic: 'توفر الإفطار' },
    { pattern: /حيوانات|قطط|كلاب/, inDesc: /حيوانات/, topic: 'سياسة الحيوانات الأليفة' },
    { pattern: /موقف|مواقف|باركنج/, inDesc: /موقف|مواقف/, topic: 'المواقف' },
    { pattern: /ذوي الاحتياجات|ذوي الاعاقه|كرسي متحرك/, inDesc: /ذوي الاحتياجات|ذوي الاعاقه/, topic: 'تجهيزات ذوي الإعاقة' },
    { pattern: /ساعات العمل|متي يفتح|متي يقفل|اوقات العمل|الدوام/, inDesc: /24 ساعه|تسجيل الوصول|صباحا|مساء|\d{1,2}:\d{2}|\d+\s*(?:ص|م)/, topic: 'ساعات العمل المحددة' },
    { pattern: /تذكره|رسوم الدخول|بكم الدخول|سعر التذكره/, inDesc: /مجاني|رسوم|تذاكر|\d+\s*ر\.?س/, topic: 'رسوم الدخول أو التذاكر' },
  ];

  for (const check of checks) {
    if (check.pattern.test(q) && !check.inDesc.test(blob)) {
      return check.topic;
    }
  }
  return null;
}

/**
 * Pure deterministic grounded turn engine built on `albaha_guide_144.json` + existing website
 * trip planner (`plannerTools.ts`), stops, coordinates, and weather snapshot.
 */
export function runSmartGuideTurn(payload: SmartGuideRequestPayload): SmartGuideTurnComputation {
  const nowRiyadh = getRiyadhNowInfo();
  const baseCtx = payload.context || createInitialConciergeContext(nowRiyadh.season);
  const nextCtx: ConciergeContextState = {
    ...baseCtx,
    lockedIds: [...(baseCtx.lockedIds || payload.savedState?.lockedIds || [])],
    completedIds: [...(baseCtx.completedIds || payload.savedState?.completedIds || [])],
    excludedIds: [...(baseCtx.excludedIds || [])],
    recentPlaceIds: [...(baseCtx.recentPlaceIds || [])],
    interests: [...(baseCtx.interests || [])],
  };

  const recentIds = [
    ...new Set([
      ...(nextCtx.recentPlaceIds || []),
      ...(nextCtx.lastGuideItemId ? [nextCtx.lastGuideItemId] : []),
    ]),
  ].filter((id) => Number.isInteger(id));
  const recentItems = recentIds
    .map((id) => getGuide144ById(id))
    .filter((x): x is EnrichedGuide144Item => Boolean(x))
    .slice(0, 6);

  if (payload.placeId && places.has(payload.placeId)) {
    nextCtx.place = payload.placeId;
    nextCtx.activeStopId = payload.placeId;
  }

  const rawText = (payload.question || '').trim();
  const q = normalizeSearchText(rawText);
  const intent = (payload.intent || '').trim();

  const activePlan: TripPlan | null =
    nextCtx.lastPlan ||
    (payload.savedState?.timing
      ? {
          days: payload.savedState.days,
          region: payload.savedState.region,
          style: payload.savedState.style,
          ids: payload.savedState.ids,
          timing: payload.savedState.timing,
        }
      : null);

  // ---------------------------------------------------------------------------
  // 0) Simple Greeting / Thanks — Always let Gemini converse naturally!
  // ---------------------------------------------------------------------------
  const isThanksOnly =
    !intent &&
    q.length > 0 &&
    q.length <= 42 &&
    /^(?:شكرا|شكراً|الف شكر|يعطيك العافيه|الله يعطيك العافيه|تسلم|يسلمو|مشكور|ما قصرت|ممتاز|تمام|رائع|جميل)(?:\s+.*)?$/.test(
      q
    ) &&
    !/فندق|مطعم|شاليه|رحله|خطه|خريطه|افتح|ودني|العقيق|بلجرشي|المندق|المخواه/.test(q);

  const isGreetingOnly =
    !intent &&
    q.length > 0 &&
    q.length <= 36 &&
    /^(?:السلام عليكم|وعليكم السلام|مرحبا|هلا|اهلا|اهلين|يا هلا|حياك|صباح الخير|مساء الخير|كيف حالك|وش اخبارك|ازيك|عامل ايه|اخبارك|هاي|hi|hello)(?:\s+.*)?$/.test(
      q
    ) &&
    !/فندق|مطعم|شاليه|رحله|خطه|خريطه|افتح|ودني|العقيق|بلجرشي|المندق|المخواه|وين|ابيت/.test(q);

  if (isThanksOnly || isGreetingOnly) {
    return {
      intentKind: 'greeting',
      usePreauthoredOnly: false,
      retrievedItems: recentItems,
      response: {
        replyText: isThanksOnly
          ? 'العفو، تحت أمرك بأي وقت! لو احتجت أي مساعدة ثانية في الباحة أنا حاضر.'
          : 'يا هلا وغلا! حيّاك في الباحة، سمّ وش ودّك تستكشف اليوم أو أساعدك فيه؟',
        placeIds: [],
        places: [],
        itinerary: null,
        actions: [],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 1) Explicit In-Site Navigation Commands ONLY
  //    ("ودّني للخريطة", "افتح الخريطة", "افتح قرية ذي عين", "ودّني لمخطط الرحلة", ...)
  // ---------------------------------------------------------------------------
  const isExplicitNavCommand =
    !intent &&
    /^(?:ودني|وديني|افتح|خذني|خدني|انقلني|روح|ورني|وريني|اعرض لي|انتقل|ابي اروح لصفحه|ابغي افتح)/.test(
      q
    );

  if (isExplicitNavCommand) {
    // a) Map navigation ("ودّني للخريطة" / "افتح الخريطة" / "ورّني ذي عين على الخريطة")
    if (/خريط/.test(q)) {
      const namedStop = findStopForNavCommand(q);
      if (namedStop) {
        nextCtx.activeStopId = namedStop.id;
        nextCtx.place = namedStop.id;
        const linked = getGuide144ByStopId(namedStop.id);
        return {
          intentKind: 'navigation',
          usePreauthoredOnly: true,
          retrievedItems: linked ? [linked] : [],
          response: {
            replyText: `أبشر، فتحت لك موقع «${namedStop.name}» على الخريطة.`,
            placeIds: linked ? [linked.id] : [],
            places: linked ? [hydratePlaceCard(linked)] : [],
            itinerary: null,
            actions: [
              {
                type: 'focus_map_stop',
                stopId: namedStop.id,
                label: `اعرض ${namedStop.name} على الخريطة`,
                autoExecute: true,
              },
            ],
            context: nextCtx,
            requestSeq: payload.requestSeq,
          },
        };
      }
      return {
        intentKind: 'navigation',
        usePreauthoredOnly: true,
        retrievedItems: [],
        response: {
          replyText: 'أبشر، ودّيتك لخريطة الباحة التفاعلية الحين. تقدر تكمل سؤالك هنا وأنا معك.',
          placeIds: [],
          places: [],
          itinerary: null,
          actions: [
            {
              type: 'navigate_map',
              label: 'افتح الخريطة التفاعلية',
              autoExecute: true,
            },
          ],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }

    // b) Planner / Directory / FAQ / Invest sections
    if (/مخطط الرحل|المخطط|رحلتي/.test(q)) {
      return {
        intentKind: 'navigation',
        usePreauthoredOnly: true,
        retrievedItems: [],
        response: {
          replyText: 'أبشر، فتحت لك مخطط الرحلة.',
          placeIds: [],
          places: [],
          itinerary: null,
          actions: [{ type: 'navigate_section', sectionId: 'planner', label: 'مخطط الرحلة', autoExecute: true }],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }
    if (/الاسئله الشائعه|اسئله شائعه/.test(q)) {
      return {
        intentKind: 'navigation',
        usePreauthoredOnly: true,
        retrievedItems: [],
        response: {
          replyText: 'أبشر، فتحت لك صفحة الأسئلة الشائعة.',
          placeIds: [],
          places: [],
          itinerary: null,
          actions: [{ type: 'navigate_faq', label: 'الأسئلة الشائعة', autoExecute: true }],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }
    if (/^(?:ودني|وديني|افتح|خذني|انقلني)\s+(?:ل)?(?:الدليل|دليل الباحه|دليل الوجهات)/.test(q)) {
      return {
        intentKind: 'navigation',
        usePreauthoredOnly: true,
        retrievedItems: [],
        response: {
          replyText: 'أبشر، فتحت لك الدليل السياحي لمنطقة الباحة.',
          placeIds: [],
          places: [],
          itinerary: null,
          actions: [{ type: 'navigate_section', sectionId: 'guide', label: 'الدليل السياحي', autoExecute: true }],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }

    // c) Specific destination page ("افتح قرية ذي عين" / "افتح فندق مدينة السحاب")
    const navStop = findStopForNavCommand(q);
    if (navStop) {
      nextCtx.activeStopId = navStop.id;
      nextCtx.place = navStop.id;
      const linked = getGuide144ByStopId(navStop.id);
      if (linked) nextCtx.lastGuideItemId = linked.id;
      return {
        intentKind: 'navigation',
        usePreauthoredOnly: true,
        retrievedItems: linked ? [linked] : [],
        response: {
          replyText: `أبشر، فتحت لك صفحة «${navStop.name}» داخل الموقع.`,
          placeIds: linked ? [linked.id] : [],
          places: linked ? [hydratePlaceCard(linked)] : [],
          itinerary: null,
          actions: [
            {
              type: 'navigate_place',
              stopId: navStop.id,
              label: `افتح ${navStop.name}`,
              autoExecute: true,
            },
          ],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }

    const navSearch = searchGuide144({ query: rawText, limit: 3 });
    if (navSearch.exactMatch) {
      const target = navSearch.exactMatch;
      nextCtx.lastGuideItemId = target.id;
      if (target.stopId) nextCtx.activeStopId = target.stopId;
      const navAction: SmartGuideAction = target.stopId
        ? { type: 'navigate_place', stopId: target.stopId, label: `افتح ${target.name}`, autoExecute: true }
        : {
            type: 'navigate_guide_place',
            guideId: target.tourGuideId || `g-${target.id}`,
            guideItemId: target.id,
            label: `افتح ${target.name}`,
            autoExecute: true,
          };
      return {
        intentKind: 'navigation',
        usePreauthoredOnly: true,
        retrievedItems: [target],
        response: {
          replyText: `أبشر، فتحت لك صفحة «${target.name}» (${target.governorate}).`,
          placeIds: [target.id],
          places: [hydratePlaceCard(target)],
          itinerary: null,
          actions: [navAction],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2) Multi-turn Trip Plan Modifications (Time Shift OR Stop Swap)
  // ---------------------------------------------------------------------------
  const isSwapRequest =
    Boolean(activePlan) &&
    /(?:بدل|استبدل|غير)\s*(?:لي\s*)?(?:اول|ثاني|ثالث|رابع|اخر|المحط|محط|وجه|الوجهه)/.test(q) ||
    (Boolean(activePlan) &&
      /(?:بدل|استبدل|غير)/.test(q) &&
      Boolean(activePlan && activePlan.ids.some((id) => {
        const st = places.get(id);
        return st && q.includes(normalizeSearchText(st.name).replace(/^(?:منتزه|متنزه|حديقه|غابه|قريه)\s+/, ''));
      })));

  if (isSwapRequest && activePlan) {
    const target = parseSwapTarget(q, activePlan);
    if (target) {
      const updatedExcluded = [...new Set([...(nextCtx.excludedIds || []), target.stop.id])];
      nextCtx.excludedIds = updatedExcluded;
      const inPlanSet = new Set(activePlan.ids);

      const preferPool = stops.filter(
        (s) =>
          !inPlanSet.has(s.id) &&
          !updatedExcluded.includes(s.id) &&
          (nextCtx.region === 'all' || s.region === nextCtx.region) &&
          (!nextCtx.lessWalking || s.operational?.walkingLevel !== 'steep') &&
          (!nextCtx.withChildren || s.operational?.familyFriendly || s.types.includes('family'))
      );
      const fallbackPool = stops.filter(
        (s) =>
          !inPlanSet.has(s.id) &&
          !updatedExcluded.includes(s.id) &&
          (!nextCtx.lessWalking || s.operational?.walkingLevel !== 'steep')
      );
      const replacement =
        preferPool.find((s) => s.operational?.qualifiedPlannable) ||
        preferPool[0] ||
        fallbackPool.find((s) => s.operational?.qualifiedPlannable) ||
        fallbackPool[0] ||
        null;

      if (replacement) {
        const newIds = activePlan.ids.map((id, idx) => (idx === target.stationIndex ? replacement.id : id));
        const daysCount = Number(activePlan.days || nextCtx.days || 1);
        const startMin = activePlan.timing.start ?? nextCtx.start ?? 9 * 60;
        const budgetMin = nextCtx.budget || 480;

        const rebuilt = buildConstraintPlan({
          days: daysCount,
          region: 'all',
          style: activePlan.style,
          season: nextCtx.season || nowRiyadh.season,
          month: nextCtx.month,
          start: startMin,
          budget: budgetMin,
          returnByEnd: nextCtx.returnByEnd,
          startPointLabel: nextCtx.startPoint || 'مدينة الباحة',
          visitDay: nextCtx.visitDay ?? nowRiyadh.dayOfWeek,
          withChildren: nextCtx.withChildren,
          lessWalking: nextCtx.lessWalking,
          indoorOnly: false,
          includeIds: newIds,
          excludeIds: updatedExcluded,
          lockedIds: nextCtx.lockedIds,
          completedIds: nextCtx.completedIds,
          preserveOrder: true,
        });
        rebuilt.plan.days = String(daysCount);
        rebuilt.plan.region = nextCtx.region || activePlan.region;

        nextCtx.lastPlan = rebuilt.plan;
        nextCtx.days = String(daysCount);
        nextCtx.hasUnsavedPreview = true;

        const itinerary = buildItineraryFromPlan(rebuilt.plan);
        const linkedItems = rebuilt.plan.ids
          .map((id) => getGuide144ByStopId(id))
          .filter((x): x is EnrichedGuide144Item => Boolean(x));

        return {
          intentKind: 'trip_swap_stop',
          usePreauthoredOnly: false,
          retrievedItems: linkedItems,
          response: {
            replyText: `تم، بدّلت «${target.stop.name}» بـ«${replacement.name}» مع الحفاظ على باقي محطات خطتك وتوقيت البداية (${clock(startMin)}).`,
            placeIds: linkedItems.map((x) => x.id),
            places: [],
            itinerary,
            actions: [
              { type: 'apply_plan', plan: rebuilt.plan, label: 'أضف الخطة لرحلتي', primary: true },
              { type: 'preview_plan', plan: rebuilt.plan, label: 'اعرض المسار على الخريطة' },
            ],
            context: nextCtx,
            requestSeq: payload.requestSeq,
          },
        };
      }
    }
  }

  // Follow-up time modification ("خلّها من 8 الصبح", "ابدأ الساعة 10", "غيّر الوقت إلى 4 العصر")
  const explicitNewStart = parseExplicitClockTime(q);
  const explicitDaysInTurn = parseDaysCount(q);
  const isTimeModification =
    Boolean(activePlan) &&
    explicitNewStart !== null &&
    explicitDaysInTurn === null &&
    !/فندق|مطعم|مقهي|كافيه|ابيت|اسكن|مبيت/.test(q) &&
    (/خلها|خليها|ابدا|نبدا|غير الوقت|عدل الوقت|من \d|الساعه \d|الصبح|الصباح|العصر|المساء|بكر/.test(q) ||
      q.length <= 30);

  if (isTimeModification && activePlan && explicitNewStart !== null) {
    const daysCount = Number(activePlan.days || nextCtx.days || 1);
    const budgetMin = nextCtx.budget || 480;
    nextCtx.start = explicitNewStart;
    nextCtx.days = String(daysCount);

    const rebuilt = buildConstraintPlan({
      days: daysCount,
      region: 'all',
      style: activePlan.style,
      season: nextCtx.season || nowRiyadh.season,
      month: nextCtx.month,
      start: explicitNewStart,
      budget: budgetMin,
      returnByEnd: nextCtx.returnByEnd,
      startPointLabel: nextCtx.startPoint || 'مدينة الباحة',
      visitDay: nextCtx.visitDay ?? nowRiyadh.dayOfWeek,
      withChildren: nextCtx.withChildren,
      lessWalking: nextCtx.lessWalking,
      indoorOnly: false,
      includeIds: activePlan.ids,
      excludeIds: nextCtx.excludedIds || [],
      lockedIds: nextCtx.lockedIds,
      completedIds: nextCtx.completedIds,
      preserveOrder: true,
    });
    rebuilt.plan.days = String(daysCount);
    rebuilt.plan.region = nextCtx.region || activePlan.region;

    nextCtx.lastPlan = rebuilt.plan;
    nextCtx.hasUnsavedPreview = true;
    const itinerary = buildItineraryFromPlan(rebuilt.plan);
    const linkedItems = rebuilt.plan.ids
      .map((id) => getGuide144ByStopId(id))
      .filter((x): x is EnrichedGuide144Item => Boolean(x));

    return {
      intentKind: 'trip_modify_time',
      usePreauthoredOnly: false,
      retrievedItems: linkedItems,
      response: {
        replyText: `أبشر، عدّلت بداية الجولة لتبدأ الساعة ${clock(explicitNewStart)} مع الحفاظ على خطتك (${conciergeDays[String(daysCount)] || `${daysCount} أيام`}${nextCtx.withChildren ? ' · مناسبة للعائلة والعيال' : ''}) وبقية المحطات كما هي.`,
        placeIds: linkedItems.map((x) => x.id),
        places: [],
        itinerary,
        actions: [
          { type: 'apply_plan', plan: rebuilt.plan, label: 'أضف الخطة لرحلتي', primary: true },
          { type: 'preview_plan', plan: rebuilt.plan, label: 'اعرض المسار على الخريطة' },
        ],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 3) Weather-Based Plan ("رتّب لي اليوم حسب الجو" / "خطة حسب الطقس في المخواة")
  // ---------------------------------------------------------------------------
  const govDetected = detectGovernorate(q);
  const asksWeatherPlan =
    intent === 'weather-plan' ||
    intent === 'rain-demo' ||
    Boolean(payload.demoRain) ||
    (/طقس|الجو|اجواء|مطر|امطار|ضباب/.test(q) && /خطه|خطط|رتب|رحله|برنامج|جوله|جدول|اليوم|بكره|غدا/.test(q));

  if (asksWeatherPlan) {
    const targetCityKey =
      payload.city && Object.hasOwn(climateCities, payload.city)
        ? payload.city
        : govDetected
          ? GOVERNORATE_TO_CITY_KEY[govDetected.canonical] || 'baha'
          : REGION_TO_CITY_KEY[nextCtx.region] || 'baha';
    const cityInfo = climateCities[targetCityKey] || climateCities.baha;
    const dayMatch = parseVisitDayAr(q, nowRiyadh.dayOfWeek);
    const visitDay = dayMatch?.dayOfWeek ?? nowRiyadh.dayOfWeek;
    const dayLabel = dayMatch?.label || `اليوم (${WEEKDAY_NAMES_AR[visitDay]})`;
    const isWetForecast = Boolean(payload.demoRain || payload.weather?.isWet || /مطر|امطار|ضباب/.test(q));
    const startMin = explicitNewStart ?? (isWetForecast ? 10 * 60 : 9 * 60);

    nextCtx.region = cityInfo.region;
    nextCtx.visitDay = visitDay;
    nextCtx.visitDateLabel = dayLabel;
    nextCtx.start = startMin;
    nextCtx.days = '1';
    nextCtx.mode = 'plan';

    const built = buildConstraintPlan({
      days: 1,
      region: cityInfo.region === 'city' ? 'all' : cityInfo.region,
      style: nextCtx.withChildren ? 'family' : 'all',
      season: nextCtx.season || nowRiyadh.season,
      month: nextCtx.month,
      start: startMin,
      budget: 420,
      returnByEnd: 18 * 60,
      startPointLabel: cityInfo.name,
      visitDay,
      withChildren: nextCtx.withChildren,
      lessWalking: isWetForecast || nextCtx.lessWalking,
      indoorOnly: isWetForecast,
      lockedIds: nextCtx.lockedIds,
      completedIds: nextCtx.completedIds,
    });
    nextCtx.lastPlan = built.plan;
    nextCtx.hasUnsavedPreview = true;

    let weatherNote: string;
    if (payload.demoRain) {
      weatherNote = 'هذا سيناريو تجريبي لأجواء ماطرة؛ عند الرحلة الفعلية راجع التوقعات الحية قبل الانطلاق.';
    } else if (payload.weather && typeof payload.weather.tempC === 'number') {
      const tempTxt = `${formatNum(Math.round(payload.weather.tempC))}°م`;
      const condTxt = payload.weather.conditionLabel || 'معتدلة';
      weatherNote = `وفق توقعات ${cityInfo.name} المتاحة (${tempTxt} · ${condTxt}). التوقعات تغطي الساعات والأيام القريبة فقط وقد تتغير مع أجواء المرتفعات؛ يُفضّل التأكد قبل الانطلاق.`;
    } else {
      weatherNote = `توقعات الطقس الحية لـ${cityInfo.name} غير متاحة حالياً، فرتّبت الجولة وفق الأجواء المعتادة في فصل ${seasons[nowRiyadh.season].name}؛ يُنصح بمراجعة الطقس قبل التحرك.`;
    }

    const itinerary = buildItineraryFromPlan(built.plan, {
      title: `خطة ${dayLabel} حسب الجو — ${cityInfo.name}`,
      weatherNote,
    });
    const linkedItems = built.plan.ids
      .map((id) => getGuide144ByStopId(id))
      .filter((x): x is EnrichedGuide144Item => Boolean(x));

    return {
      intentKind: 'weather_plan',
      usePreauthoredOnly: false,
      retrievedItems: linkedItems,
      response: {
        replyText: `${isWetForecast ? `بناءً على احتمال الأمطار أو الضباب في ${cityInfo.name} ${dayLabel}، ركّزت لك على خيارات مناسبة وأقل تعرضاً للانحدارات:` : `رتّبت لك جولة ${dayLabel} في ${cityInfo.name} بما يناسب الأجواء المتاحة:`} ${weatherNote}`,
        placeIds: linkedItems.map((x) => x.id),
        places: [],
        itinerary,
        actions: [
          { type: 'apply_plan', plan: built.plan, label: 'أضف الخطة لرحلتي', primary: true },
          { type: 'preview_plan', plan: built.plan, label: 'اعرض المسار على الخريطة' },
        ],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 4) Full Trip Planning Request ("رتّب لي يومين مع العيال" / "خطط لي 3 أيام")
  // ---------------------------------------------------------------------------
  const withFamilyOrKids = /العيال|عيال|عايل|عائليه|عائله|عائلي|اطفال|اولاد|اسره|اسريه/.test(q);
  const lessWalkingReq = /مشي خفيف|مشي اقل|بدون مشي|كبار السن|مريحه|سهله/.test(q) || withFamilyOrKids;
  const requestedDays = explicitDaysInTurn;
  const isPlanningAsk =
    intent === 'plan' ||
    intent === 'timed-plan' ||
    /(?:رتب|ترتب|خطط|خطه|برنامج|مسار|جوله|نظم)\s/.test(`${q} `) ||
    (requestedDays !== null && !/فندق|شاليه|حجز|ليله|ليالي/.test(q));

  if (isPlanningAsk) {
    const daysCount = requestedDays ?? Number(nextCtx.days || 1);
    const startInfo = parseStartPointAr(q);
    const dayMatch = parseVisitDayAr(q, nowRiyadh.dayOfWeek);
    const timeWin = parseTimeWindowAndReturnAr(q);
    const startMin = explicitNewStart ?? timeWin.start ?? nextCtx.start ?? 9 * 60;
    const regionKey = govDetected?.regionKey || startInfo?.region || (requestedDays ? 'all' : nextCtx.region || 'all');
    const style: TripStyle = withFamilyOrKids
      ? 'family'
      : /تراث|قري|متاحف|تاريخ/.test(q)
        ? 'heritage'
        : /طبيع|غابات|شلالات|جبال|هايكن/.test(q)
          ? 'nature'
          : nextCtx.style || 'all';
    const startPoint = startInfo?.label || govDetected?.canonical || nextCtx.startPoint || 'مدينة الباحة';
    const visitDay = dayMatch?.dayOfWeek ?? nextCtx.visitDay ?? nowRiyadh.dayOfWeek;
    const budgetMin = timeWin.budget ?? 480;

    nextCtx.days = String(daysCount);
    nextCtx.region = regionKey;
    nextCtx.style = style;
    nextCtx.withChildren = withFamilyOrKids || nextCtx.withChildren;
    nextCtx.lessWalking = lessWalkingReq || nextCtx.lessWalking;
    nextCtx.startPoint = startPoint;
    nextCtx.visitDay = visitDay;
    nextCtx.visitDateLabel = dayMatch?.label || WEEKDAY_NAMES_AR[visitDay];
    nextCtx.start = startMin;
    nextCtx.budget = budgetMin;
    nextCtx.returnByEnd = timeWin.returnByEnd ?? nextCtx.returnByEnd;
    nextCtx.mode = 'plan';

    const built = buildConstraintPlan({
      days: daysCount,
      region: regionKey,
      style,
      season: nextCtx.season || nowRiyadh.season,
      month: nextCtx.month,
      start: startMin,
      budget: budgetMin,
      returnByEnd: nextCtx.returnByEnd,
      startPointLabel: startPoint,
      visitDay,
      withChildren: nextCtx.withChildren,
      lessWalking: nextCtx.lessWalking,
      indoorOnly: false,
      excludeIds: nextCtx.excludedIds || [],
      lockedIds: nextCtx.lockedIds,
      completedIds: nextCtx.completedIds,
    });
    built.plan.days = String(daysCount);
    built.plan.region = regionKey;

    nextCtx.lastPlan = built.plan;
    nextCtx.hasUnsavedPreview = true;
    const itinerary = buildItineraryFromPlan(built.plan);
    const linkedItems = built.plan.ids
      .map((id) => getGuide144ByStopId(id))
      .filter((x): x is EnrichedGuide144Item => Boolean(x));

    const daysPhrase = conciergeDays[String(daysCount)] || `${formatNum(daysCount)} أيام`;
    const familyPhrase = nextCtx.withChildren ? ' مناسبة لك وللعيال بمشي مريح' : '';
    const areaPhrase = regionKey === 'all' ? 'في الباحة' : `في ${conciergeRegions[regionKey] || startPoint}`;

    return {
      intentKind: 'trip_plan',
      usePreauthoredOnly: false,
      retrievedItems: linkedItems,
      response: {
        replyText: `أبشر، رتّبت لك خطة ${daysPhrase}${familyPhrase} ${areaPhrase} تبدأ الساعة ${clock(startMin)} بتوقيت السعودية. تقدر تعدّل الوقت مثل «خلّها من 8 الصبح» أو تقول «بدّل أول محطة».`,
        placeIds: linkedItems.map((x) => x.id),
        places: [],
        itinerary,
        actions: [
          { type: 'apply_plan', plan: built.plan, label: 'أضف الخطة لرحلتي', primary: true },
          { type: 'preview_plan', plan: built.plan, label: 'اعرض المسار على الخريطة' },
        ],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 5) Live Price / Availability Question (New Place or Follow-up on Last Place)
  // ---------------------------------------------------------------------------
  const asksPriceOrAvailability =
    /كم السعر|كم الليله|بكم الليله|بكم الحجز|بكم الغرفه|اسعار|سعر الغرفه|سعر الليله|توفر|غرف متاحه|متاح بكرة|متاح بكره|فيه حجز|متوفر حجز|كم التكلفه/.test(
      q
    );

  const catIntent = detectCategoryIntent(q);
  const searchRes = searchGuide144({
    query: rawText,
    governorate: govDetected?.canonical || null,
    categoryKey: catIntent?.categoryKey || null,
    subType: catIntent?.subType,
    limit: 4,
    userLocation: payload.userLocation || null,
  });

  if (asksPriceOrAvailability) {
    const targetItem =
      searchRes.exactMatch ||
      (nextCtx.lastGuideItemId ? getGuide144ById(nextCtx.lastGuideItemId) : undefined) ||
      searchRes.matches[0]?.item ||
      null;

    if (targetItem) {
      nextCtx.lastGuideItemId = targetItem.id;
      nextCtx.recentPlaceIds = [targetItem.id];
      const card = hydratePlaceCard(targetItem);
      const priceNote = targetItem.priceRange
        ? `النطاق التقريبي المذكور في الدليل هو (${targetItem.priceRange})، `
        : '';
      const channels = buildCompactContactSummary(targetItem);
      return {
        intentKind: 'price_or_availability',
        usePreauthoredOnly: false,
        retrievedItems: [targetItem],
        referenceFact: `السؤال عن السعر الحالي أو التوفر اللحظي لـ«${targetItem.name}». ${priceNote}وسائل التأكد المتاحة: ${channels || 'الروابط المرفقة'}.`,
        response: {
          replyText: `${priceNote}الأسعار اليومية والتوفّر الحالي لـ«${targetItem.name}» (${targetItem.governorate}) تتغير باستمرار وما فيها تأكيد لحظي داخل الدليل. أنصحك تتأكد مباشرة عبر ${channels || 'وسائل التواصل المتاحة تحت'}:`,
          placeIds: [targetItem.id],
          places: [card],
          itinerary: null,
          actions: [],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 6) Specific Place by Name OR Ambiguous Similar Names
  // ---------------------------------------------------------------------------
  // Ambiguity check: multiple distinct places match the queried name fragment
  const looksLikeSpecificNameAsk =
    !catIntent ||
    /وش عندك عن|علمني عن|معلومات عن|تفاصيل|رقم|هاتف|عنوان|وين مكان/.test(q) ||
    searchRes.exactMatch !== null;

  if (searchRes.ambiguousMatches.length >= 2 && !searchRes.exactMatch && looksLikeSpecificNameAsk) {
    const cards = searchRes.ambiguousMatches.map((it) =>
      hydratePlaceCard(it, { reason: `${it.governorate} · ${it.type}` })
    );
    nextCtx.recentPlaceIds = cards.map((c) => c.id);
    const listNames = searchRes.ambiguousMatches
      .map((it) => `«${it.name}» في ${it.governorate}`)
      .join('، و');
    return {
      intentKind: 'place_ambiguous',
      usePreauthoredOnly: false,
      retrievedItems: searchRes.ambiguousMatches,
      referenceFact: `يوجد أكثر من مكان متشابه في الاسم: ${listNames}. اطلب من الزائر تحديد المكان أو المنطقة بوضوح.`,
      response: {
        replyText: `فيه أكثر من مكان بنفس الاسم أو قريب منه في الدليل: ${listNames}. أي واحد فيهم تقصد؟ اختَر من القائمة أو اذكر لي المنطقة:`,
        placeIds: cards.map((c) => c.id),
        places: cards,
        itinerary: null,
        actions: [],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  if (searchRes.exactMatch && (!govDetected || searchRes.exactMatch.governorate.includes(govDetected.canonical) || searchRes.matches[0]?.nameMatchStrength === 'exact')) {
    const item = searchRes.exactMatch;
    nextCtx.lastGuideItemId = item.id;
    nextCtx.recentPlaceIds = [item.id];
    if (item.stopId) {
      nextCtx.activeStopId = item.stopId;
      nextCtx.place = item.stopId;
    }

    const unconfirmedTopic = detectUnconfirmedAttributeQuestion(q, item);
    const card = hydratePlaceCard(item, {
      reason: `${item.governorate} · ${item.type}`,
      distanceKm: searchRes.matches.find((m) => m.item.id === item.id)?.distanceKm ?? null,
    });

    const ratingBit = item.ratingRaw ? ` تقييمه في الدليل ${item.ratingRaw}.` : '';
    const priceBit = item.priceRange ? ` النطاق السعري التقريبي: ${item.priceRange}.` : '';
    const unconfirmedPrefix = unconfirmedTopic
      ? `الدليل ما فيه تأكيد حالياً عن ${unconfirmedTopic} في «${item.name}»، لكن تقدر تتأكد منهم مباشرة. `
      : '';

    const replyText = `${unconfirmedPrefix}«${item.name}» في ${item.governorate} (${item.address}). ${item.description}${ratingBit}${priceBit}`;

    return {
      intentKind: unconfirmedTopic ? 'missing_info' : 'place_detail',
      usePreauthoredOnly: false,
      retrievedItems: [item],
      unconfirmedTopic,
      response: {
        replyText,
        placeIds: [item.id],
        places: [card],
        itinerary: null,
        actions: [],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // Conversational follow-up referencing previously discussed places ("أي واحد فيهم أقرب للمطار؟" / "قارن بينهم" / "الأول ولا الثاني؟")
  const refersToPreviousPlaces =
    recentItems.length > 0 &&
    !govDetected &&
    /فيهم|منهم|بينهم|الثلاثه|الاثنين|الاول|الثاني|التاني|الثالث|الاخير|قارن|مقارنه|الفرق بينهم|اي واحد|انهي واحد|مين الاحسن|مين الافضل|مين الارخص|غيرهم|خيارات ثانيه|خيارات تانيه|هل فيه|فيه مسبح|فيه فطور|يقبل حيوانات|متي يفتح|مواقف/.test(
      q
    );

  if (refersToPreviousPlaces) {
    // If asking about a specific single previously discussed item's unconfirmed attribute
    if (recentItems.length === 1) {
      const prevItem = recentItems[0];
      const unconfirmedTopic = detectUnconfirmedAttributeQuestion(q, prevItem);
      const card = hydratePlaceCard(prevItem);
      if (unconfirmedTopic) {
        return {
          intentKind: 'missing_info',
          usePreauthoredOnly: false,
          retrievedItems: [prevItem],
          unconfirmedTopic,
          response: {
            replyText: `الدليل ما فيه تأكيد حالياً عن ${unconfirmedTopic} في «${prevItem.name}» (${prevItem.governorate}). يفضّل تتواصل معهم مباشرة للتأكد عبر الوسائل المتاحة تحت:`,
            placeIds: [prevItem.id],
            places: [card],
            itinerary: null,
            actions: [],
            context: nextCtx,
            requestSeq: payload.requestSeq,
          },
        };
      }
      return {
        intentKind: 'place_detail',
        usePreauthoredOnly: false,
        retrievedItems: [prevItem],
        response: {
          replyText: `حسب المذكور في الدليل عن «${prevItem.name}» (${prevItem.governorate}): ${prevItem.description}`,
          placeIds: [prevItem.id],
          places: [card],
          itinerary: null,
          actions: [],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }

    // Multiple previously shown places: hand all of them + any fresh matches to Gemini for natural comparison/filtering
    const mergedFollowup = mergeUniqueGuideItems(
      recentItems,
      searchRes.matches.slice(0, 3).map((m) => m.item),
      8
    );
    const fallbackCards = recentItems.slice(0, 3).map((it) =>
      hydratePlaceCard(it, { reason: buildShortRecommendationReason(it) })
    );
    return {
      intentKind: 'general',
      usePreauthoredOnly: false,
      retrievedItems: mergedFollowup,
      referenceFact:
        'الزائر يتابع الحديث أو يقارن بين الأماكن التي عُرضت للتو في السجلات المسترجعة. أجب مباشرة وبشكل طبيعي من وصف ومعلومات هذه السجلات، وأرجع في placeIds فقط المكان أو الأماكن التي تنطبق على سؤاله الحالي.',
      response: {
        replyText: `من الخيارات اللي عرضتها لك قبل شوي، تقدر تقارن تفاصيلها من الدليل أدناه:`,
        placeIds: fallbackCards.map((c) => c.id),
        places: fallbackCards,
        itinerary: null,
        actions: [],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 7) Stay / Dining / Places Recommendation by Area (e.g. "أنا في العقيق، وين أقدر أبيت؟")
  // ---------------------------------------------------------------------------
  const asksNearest = /اقرب|قريب مني|حولي|جنبي/.test(q);
  if (catIntent || govDetected) {
    const topMatches = searchRes.matches.slice(0, 4);
    if (topMatches.length > 0) {
      const cards = topMatches.map((m) =>
        hydratePlaceCard(m.item, {
          reason: buildShortRecommendationReason(m.item),
          distanceKm: m.distanceKm,
        })
      );
      nextCtx.recentPlaceIds = cards.map((c) => c.id);
      if (cards.length === 1) nextCtx.lastGuideItemId = cards[0].id;

      const areaTxt = govDetected ? `في ${govDetected.canonical}` : 'في منطقة الباحة';
      const catTxt = catIntent?.labelAr || 'أبرز الوجهات';
      const distNote = searchRes.sortedByDistance
        ? ' مرتّبة حسب الأقرب لموقعك.'
        : asksNearest
          ? ' (مرتّبة حسب التقييم والملاءمة، لأن الترتيب بالمسافة يتطلب توفر موقعك وإحداثيات كل وجهة).'
          : '';

      return {
        intentKind: 'area_recommendation',
        usePreauthoredOnly: false,
        retrievedItems: topMatches.map((m) => m.item),
        referenceFact: distNote ? distNote.trim() : null,
        response: {
          replyText: `حياك! هذي أبرز خيارات ${catTxt} ${areaTxt} من دليل الباحة${distNote}`,
          placeIds: cards.map((c) => c.id),
          places: cards,
          itinerary: null,
          actions: [],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 8) Discovery, Preparation, Access, Weather Info & FAQ
  // ---------------------------------------------------------------------------
  const faqPatterns: Array<[string, RegExp]> = [
    ['faq-airport', /مطار|طيران|كيف اوصل|الوصول للباحه|كيف اروح الباحه/],
    ['faq-roads', /عقب|عقبه|طريق|طرق|قياده|تنقل|مسافه/],
    ['faq-documents', /تاشير|فيزا|جواز|اوراق|مستند|هويه/],
    ['faq-fog-rain', /ضباب|غيم|امطار|مطر|ملابس|لبس|جاكيت|تجهيز|استعداد|وش البس|الطقس|الجو/],
    ['faq-family-elderly', /كبار السن|كرسي متحرك|معبد|مشي خفيف/],
    ['faq-food', /دغابيس|عصيده|خبزه|مقناه|بن شدوي|اكلات شعبيه|عسل/],
    ['faq-official-numbers', /طوارئ|940|930|911|بلاغ|امانه/],
  ];

  for (const [faqId, pat] of faqPatterns) {
    if (pat.test(q)) {
      const faq = FAQ_ITEMS.find((f) => f.id === faqId);
      if (faq) {
        let relatedItems: EnrichedGuide144Item[] = [];
        if (faqId === 'faq-airport') {
          relatedItems = [140, 141, 142].map(getGuide144ById).filter((x): x is EnrichedGuide144Item => Boolean(x));
        } else if (faqId === 'faq-food') {
          relatedItems = [38, 39, 133].map(getGuide144ById).filter((x): x is EnrichedGuide144Item => Boolean(x));
        }
        if (relatedItems.length) {
          nextCtx.recentPlaceIds = relatedItems.map((it) => it.id);
        }
        const cards = relatedItems.map((it) =>
          hydratePlaceCard(it, { reason: buildShortRecommendationReason(it) })
        );
        return {
          intentKind: 'discovery_or_prep',
          usePreauthoredOnly: false,
          retrievedItems: mergeUniqueGuideItems(relatedItems, recentItems, 6),
          referenceFact: `معلومة موثّقة من دليل الباحة: ${faq.answer}`,
          response: {
            replyText: faq.answer,
            placeIds: cards.map((c) => c.id),
            places: cards,
            itinerary: null,
            actions: [{ type: 'navigate_faq', faqId: faq.id, label: 'عرض التفاصيل في الأسئلة الشائعة' }],
            context: nextCtx,
            requestSeq: payload.requestSeq,
          },
        };
      }
    }
  }

  // General discovery ask ("وش يميز الباحة؟" / "اقترح لي وجهات" / "اكتشف الباحة")
  if (intent === 'discover' || /وش يميز|يميز الباحه|اكتشف|وجهات|معالم|السياحه في الباحه|اماكن حلوه|اماكن سياحيه/.test(q)) {
    const featuredIds = [65, 100, 73, 72]; // رغدان، ذي عين، الأمير حسام، جبل شدا
    const featured = featuredIds
      .map(getGuide144ById)
      .filter((x): x is EnrichedGuide144Item => Boolean(x));
    nextCtx.recentPlaceIds = featured.map((it) => it.id);
    const cards = featured.map((it) =>
      hydratePlaceCard(it, { reason: buildShortRecommendationReason(it) })
    );
    return {
      intentKind: 'discovery_or_prep',
      usePreauthoredOnly: false,
      retrievedItems: featured,
      response: {
        replyText:
          'الباحة تجمع بين برودة غابات السراة ودفء تهامة وقرى الحجر التاريخية. هذي أبرز المعالم اللي أنصحك تبدأ فيها:',
        placeIds: cards.map((c) => c.id),
        places: cards,
        itinerary: null,
        actions: [],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // Soft search / Open conversational query — give Gemini matching records + recent context to converse freely!
  const softMatches = searchRes.matches.slice(0, 4).map((m) => m.item);
  const combinedForLlm = mergeUniqueGuideItems(softMatches, recentItems, 8);
  if (softMatches.length > 0) {
    nextCtx.recentPlaceIds = softMatches.map((it) => it.id);
    const cards = searchRes.matches.slice(0, 3).map((m) =>
      hydratePlaceCard(m.item, {
        reason: buildShortRecommendationReason(m.item),
        distanceKm: m.distanceKm,
      })
    );
    return {
      intentKind: 'general',
      usePreauthoredOnly: false,
      retrievedItems: combinedForLlm,
      response: {
        replyText: 'هذي أقرب النتائج اللي لقيتها في دليل الباحة لسؤالك:',
        placeIds: cards.map((c) => c.id),
        places: cards,
        itinerary: null,
        actions: [],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // Open conversational / general Al-Baha question (no forced canned buttons, Gemini converses naturally!)
  return {
    intentKind: 'general',
    usePreauthoredOnly: false,
    retrievedItems: recentItems,
    response: {
      replyText:
        'الدليل ما فيه تأكيد مباشر عن هالنقطة حالياً، لكن أقدر أساعدك بأي فندق أو مطعم أو معلم في الباحة، أو أرتّب لك خطة رحلة حسب الأيام والمنطقة. وش ودّك تبحث عنه؟',
      placeIds: [],
      places: [],
      itinerary: null,
      actions: [],
      context: nextCtx,
      requestSeq: payload.requestSeq,
    },
  };
}

/**
 * Formats retrieved records into a compact, token-efficient context payload for Gemini
 * (never sends the entire 144-item database).
 */
export function serializeRetrievedRecordsForLlm(items: EnrichedGuide144Item[]): string {
  if (!items.length) return 'لا توجد سجلات مطابقة مباشرة لهذا السؤال في الدليل.';
  return JSON.stringify(
    items.slice(0, 8).map((it) => ({
      id: it.id,
      name: it.name,
      governorate: it.governorate,
      category: it.categoryAr,
      type: it.type,
      rating: it.ratingRaw,
      priceRange: it.priceRange,
      address: it.address,
      description: it.description,
      phones: it.phones.map((p) => p.display),
      hasWhatsApp: Boolean(it.whatsappUrl),
      hasBookingLink: Boolean(it.bookingLink),
      bookingLabel: it.bookingLink?.label || null,
      hasOfficialWebsite: Boolean(it.officialWebsite),
    }))
  );
}
