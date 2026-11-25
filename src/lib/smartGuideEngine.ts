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
  maxTripDays,
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
  getGuide144ByTourGuideId,
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
    | 'directions'
    | 'place_detail'
    | 'place_ambiguous'
    | 'price_or_availability'
    | 'area_recommendation'
    | 'place_followup'
    | 'trip_clarification'
    | 'trip_plan'
    | 'trip_modify_plan'
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
      internalHref: `/place/${stop.id}`,
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

function parseDaysCount(
  q: string,
  expectingDuration = false,
  currentDays: number | null = null
): number | null {
  // Strip comparative suffix like "بدل يوم واحد" / "بدلاً من يومين" so the target duration wins
  const targetClause = q.replace(/\s+(?:بدل|بدلا من|عوض|مو|مش)\s+.*$/, '').trim();

  if (currentDays !== null) {
    if (/(?:زود|زيد|اضف|ضيف)\s+(?:كمان\s+)?يوم(?:\s|$)/.test(targetClause)) {
      return Math.min(maxTripDays, currentDays + 1);
    }
    if (/(?:نقص|قلل|احذف|شيل)\s+يوم(?:\s|$)/.test(targetClause)) {
      return Math.max(1, currentDays - 1);
    }
  }

  const digit =
    targetClause.match(/(?:^|\s)(\d+)\s*(?:يوم|يوما|ايام|أيام)(?:\s|$)/)?.[1] ||
    (expectingDuration ? targetClause.match(/^\d+$/)?.[0] : undefined);
  if (digit) return Number(digit);
  if (/(?:^|\s)(?:اسبوع|الاسبوع|سبع(?:ه)?\s*ايام)(?:\s|$)/.test(targetClause)) return 7;
  if (/ست(?:ه)?\s*ايام/.test(targetClause)) return 6;
  if (/خمس(?:ه)?\s*ايام/.test(targetClause)) return 5;
  if (/اربع(?:ه)?\s*ايام/.test(targetClause)) return 4;
  if (/(?:ثلاث|تلات|تلت)(?:ه)?\s*ايام/.test(targetClause)) return 3;
  if (/يومين|يومان/.test(targetClause)) return 2;
  if (
    /يوم واحد|نفس اليوم|(?:رحله|جوله|رتب لي|خطط لي|جدول|خلي الرحله|خل الرحله|خليها|خلها)\s*(?:لي\s*)?يوم(?:\s|$)/.test(
      targetClause
    ) ||
    /(?:^|\s)(?:اليوم|نهارده|النهارده|هاليوم|بكره|غدا)(?:\s|$)/.test(targetClause) ||
    (expectingDuration && /^(?:يوم|ليوم)(?:\s|$)/.test(targetClause))
  ) {
    return 1;
  }
  if (expectingDuration) {
    const numberWord = ['صفر', 'واحد', 'اثنين|اتنين', 'ثلاث|تلات|تلت', 'اربع', 'خمس', 'ست', 'سبع'];
    const parsed = numberWord.findIndex((word) =>
      new RegExp(`^(?:${word})(?:ه)?$`).test(targetClause)
    );
    if (parsed >= 0) return parsed;
  }
  return null;
}

function parseTripStyle(q: string): TripStyle | null {
  if (/عيال|عيلتي|عيله|عايل|عائلي|عائله|اطفال|اولاد|اسري|اسره|اسرتي/.test(q)) return 'family';
  const heritage = /تراث|متاحف|تاريخي|قري قديمه/.test(q);
  const nature = /طبيع|غابات|شلالات|جبال|هايكن|مغامر|استرخاء/.test(q);
  if (heritage && nature) return 'all';
  if (heritage) return 'heritage';
  if (nature) return 'nature';
  if (/متنوع|منوع|اي شي|اي حاجه|بدون تفضيل|ما عندي تفضيل|على ذوقك|اللي تشوفه|اللي يناسب|شباب|اصدقاء|لوحدي|لحالي|زوجتي|زوجي/.test(q)) {
    return 'all';
  }
  return null;
}

const DIRECTIONS_QUESTION = /(?:^|\s)(?:كيف|ازاي|شلون|كيفيه)\s+(?:ا|ن)?(?:وصل|روح|اصل|اوصل|اروح|اذهب)|(?:^|\s)(?:وين|فين|اين|وش|ايه)\s+(?:موقع|عنوان|مكانه|مكانها|مكان (?:ال|فندق|مطعم|قريه|غابه))|(?:^|\s)(?:كيف الطريق|افتح الاتجاهات|عطني الاتجاهات|هات الاتجاهات|و?طريقه الوصول|وينه|فينه|ارسلي موقعه|ارسل موقعه)(?:\s|$)/;
const PLACE_REFERENCE = /(?:^|\s)(?:له|لها|ليه|ليها|اليه|اليها|عليه|عليها|هناك|لهذا|لهذي|للمكان|للفندق|للوجهه|للمطعم|للمقهي|المكان ده|المكان دا|نفس المكان|المكان هذا|موقعه|مكانه|عنوانه|موقعها|مكانها|عنوانها|اوصله|اوصلها|اصله|اصلها|اروحه|اروحها|اروحله|اروحلها)(?:\s|$)/;

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

  const recentIds = [...new Set(nextCtx.recentPlaceIds?.length
    ? nextCtx.recentPlaceIds
    : nextCtx.lastGuideItemId ? [nextCtx.lastGuideItemId] : [])];
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
  const govDetected = detectGovernorate(q);
  const isDirectionQuestion = !intent && DIRECTIONS_QUESTION.test(q);
  const pageItem = (payload.guidePlaceId ? getGuide144ByTourGuideId(payload.guidePlaceId) : undefined) ||
    (payload.placeId ? getGuide144ByStopId(payload.placeId) : undefined);

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
    !intent && !isDirectionQuestion &&
    q.length > 0 &&
    q.length <= 42 &&
    /^(?:شكرا|شكراً|الف شكر|يعطيك العافيه|الله يعطيك العافيه|تسلم|يسلمو|مشكور|ما قصرت|ممتاز|تمام|رائع|جميل)(?:\s+.*)?$/.test(
      q
    ) &&
    !/فندق|مطعم|شاليه|رحله|خطه|خريطه|افتح|ودني|العقيق|بلجرشي|المندق|المخواه/.test(q);

  const isGreetingOnly =
    !intent && !isDirectionQuestion &&
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

  if (isDirectionQuestion) {
    const namedDestination = q.match(/\sمن\s+.+?\s+(?:الي|الى)\s+(.+)$/)?.[1];
    const destinationQuery = namedDestination || q.split(' من ')[0];
    const refersToCurrentPlace = /^(?:وينه|فينه)$/.test(destinationQuery) ||
      PLACE_REFERENCE.test(destinationQuery) ||
      /^(?:(?:كيف|ازاي|شلون)\s+(?:ا|ن)?(?:اوصل|اصل|اروح|روح|وصل)|افتح الاتجاهات|عطني الاتجاهات|هات الاتجاهات)$/.test(destinationQuery);
    const regionalAccess = !refersToCurrentPlace &&
      /(?:\s|^)(?:ل|لل|الى )?(?:منطقه |مدينه )?الباحه(?:\s|$)/.test(destinationQuery) &&
      !/فندق|مطعم|متحف|مقهي|قريه|منتزه|غابه|شلال|جبل/.test(destinationQuery);
    const nameQuery = namedDestination || (refersToCurrentPlace ? destinationQuery : q);
    const named = searchGuide144({ query: nameQuery, limit: 4 });
    const priorLookup = refersToCurrentPlace && recentItems.length !== 1
      ? (payload.history || []).slice(-6).reverse().find((entry) =>
          entry.role === 'user' && !DIRECTIONS_QUESTION.test(normalizeSearchText(entry.text)))
      : undefined;
    const priorTarget = priorLookup
      ? searchGuide144({ query: priorLookup.text, limit: 1 }).exactMatch
      : null;
    const ordinal = ['الاول', 'الثاني|التاني', 'الثالث|التالت', 'الرابع'].findIndex((word) =>
      new RegExp(`(?:^|\\s)(?:ل|لل)?(?:${word})(?:\\s|$)`).test(destinationQuery));
    const target = named.exactMatch || recentItems[ordinal] ||
      (refersToCurrentPlace && !named.ambiguousMatches.length
        ? recentItems.length === 1 ? recentItems[0] : priorTarget || (recentItems.length === 0 ? pageItem : undefined)
        : undefined);
    const options = named.ambiguousMatches.length ? named.ambiguousMatches : refersToCurrentPlace ? recentItems : [];

    if (target) {
      nextCtx.lastGuideItemId = target.id;
      nextCtx.recentPlaceIds = [target.id];
      const actions: SmartGuideAction[] = [{
        type: 'open_directions',
        guideItemId: target.id,
        label: 'افتح الاتجاهات',
      }];
      if (target.stopId) {
        actions.push({ type: 'focus_map_stop', stopId: target.stopId, label: 'على خريطة الباحة' });
      }
      return {
        intentKind: 'directions',
        usePreauthoredOnly: true,
        retrievedItems: [target],
        response: {
          replyText: `أبشر، «${target.name}» ${target.address ? `عنوانه ${target.address}` : `في ${target.governorate}`}. افتح الاتجاهات عشان تحدد نقطة انطلاقك وتشوف المسار.`,
          placeIds: [],
          places: [],
          itinerary: null,
          actions,
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }

    if (!regionalAccess) {
      return {
        intentKind: 'directions',
        usePreauthoredOnly: true,
        retrievedItems: [],
        response: {
          replyText: options.length > 1
            ? `أي واحد تقصد من هالأماكن؟ ${options.map((item) => item.name).join('، ')}.`
            : 'وش اسم المكان اللي تبي توصل له؟ وإذا تعرف المحافظة اذكرها لي عشان أساعدك بالاتجاهات.',
          placeIds: [],
          places: [],
          itinerary: null,
          actions: [],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }
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
  const activeDaysNum = activePlan ? Number(activePlan.days || nextCtx.days || 1) : null;
  const explicitNewStart = parseExplicitClockTime(q);
  const explicitDaysInTurn = parseDaysCount(
    q,
    nextCtx.pendingTrip?.days === null,
    activeDaysNum
  );
  const isTimeModification =
    Boolean(activePlan) && !nextCtx.pendingTrip &&
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
        replyText: `أبشر، عدّلت بداية الجولة لتبدأ الساعة ${clock(explicitNewStart)} مع الحفاظ على خطتك (${conciergeDays[String(daysCount)] || `${daysCount} أيام`}${nextCtx.withChildren ? ' · مناسبة للعائلة والعيال' : ''}) وبقية المحطات كما هي. تحب نعدّل عدد الأيام أو نبدّل أي محطة؟`,
        placeIds: linkedItems.map((x) => x.id),
        places: [],
        itinerary,
        actions: [
          { type: 'apply_plan', plan: rebuilt.plan, label: 'أضف الخطة لرحلتي', primary: true },
          { type: 'preview_plan', plan: rebuilt.plan, label: 'اعرض المسار على الخريطة' },
        ],
        suggestions: [
          daysCount === 1 ? 'خلّ الرحلة يومين' : 'خلّ الرحلة 3 أيام',
          'بدّل أول محطة',
          'رشّح لي مطاعم على المسار',
        ],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // Keep the requested trip separate from any previously displayed or saved plan unless modifying it.
  const pendingTrip = nextCtx.pendingTrip;
  const askedStyle = parseTripStyle(q);
  const presetWeather = intent === 'weather-plan' || intent === 'rain-demo' || Boolean(payload.demoRain);
  const asksAboutDuration = /(?:^|\s)(?:كم يوم|كم المده|يكفي|يكفون|تكفي|كفايه)(?:\s|$)/.test(q);
  const asksFreshReset = /من جديد|خطه جديده|رحله جديده|ابدا من الصفر/.test(q);

  // Follow-up Active Plan Modification:
  // Handles "خلي الرحلة يومان", "عدل الرحلة لي يومين بدل يوم واحد", "خلي الرحلة لي ثلاثة ايام",
  // "زود يوم", "خليها عائلية", "خلي المشي خفيف", "أضف قرية ذي عين للخطة", "احذف متنزه الخلب", etc.
  const modVerb = /(?:^|\s)(?:خل|خلي|خليها|خلها|عدل|تعديل|غير|حدث|مدد|طول|قصر|زود|زيد|نقص|قلل|اضف|ضيف|احذف|شيل|الغ|انقل|حول)/.test(q);
  const mentionsPlanOrTrip = /(?:الرحل|الخط|الجدول|البرنامج|الجول|المسار)/.test(q);
  const asksAddStopToPlan = Boolean(activePlan) && /(?:اضف|ضيف|زيد|حط|ادخل)/.test(q) && !/يوم/.test(q);
  const asksRemoveStopFromPlan = Boolean(activePlan) && /(?:احذف|شيل|الغ|استبعد)/.test(q) && !/يوم/.test(q);
  const namedStopInTurn = activePlan ? findStopForNavCommand(q) : null;

  const isActivePlanModification =
    Boolean(activePlan) &&
    !pendingTrip &&
    !presetWeather &&
    !asksFreshReset &&
    !asksAboutDuration &&
    !/فندق|شاليه|مطعم|مقهي|كافيه|ابيت|اسكن|مبيت|حجز/.test(q) &&
    (
      (explicitDaysInTurn !== null && (modVerb || mentionsPlanOrTrip || q.split(/\s+/).length <= 5)) ||
      (askedStyle !== null && (modVerb || mentionsPlanOrTrip)) ||
      (/مشي خفيف|مشي اقل|بدون مشي|كبار السن/.test(q) && (modVerb || mentionsPlanOrTrip || q.split(/\s+/).length <= 5)) ||
      (Boolean(govDetected) && modVerb && mentionsPlanOrTrip) ||
      (asksAddStopToPlan && Boolean(namedStopInTurn)) ||
      (asksRemoveStopFromPlan && (Boolean(namedStopInTurn) || /اول محط|اخر محط|ثاني محط/.test(q)))
    );

  if (isActivePlanModification && activePlan) {
    if (explicitDaysInTurn !== null && (explicitDaysInTurn < 1 || explicitDaysInTurn > maxTripDays)) {
      return {
        intentKind: 'trip_clarification',
        usePreauthoredOnly: false,
        retrievedItems: [],
        response: {
          replyText: `أقدر أضبط خطتك من يوم واحد إلى ${formatNum(maxTripDays)} أيام كحد أقصى. كم يوم تحب نخليها؟`,
          placeIds: [],
          places: [],
          itinerary: null,
          actions: [],
          suggestions: ['يومان', '3 أيام', '4 أيام'],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }

    const prevDays = Number(activePlan.days || nextCtx.days || 1);
    const daysCount = explicitDaysInTurn ?? prevDays;
    const style: TripStyle = askedStyle ?? activePlan.style ?? nextCtx.style ?? 'all';
    const explicitRegion = govDetected?.regionKey || null;
    const baseRegion = explicitRegion || nextCtx.region || activePlan.region || 'all';
    // When expanding to multiple days without locking a single district, open region to 'all' so every day gets rich stops
    const queryRegion = explicitRegion ? explicitRegion : daysCount > 1 ? 'all' : baseRegion;
    const startMin = explicitNewStart ?? activePlan.timing.start ?? nextCtx.start ?? 9 * 60;
    const budgetMin = nextCtx.budget || 480;
    const withChildren = style === 'family' || Boolean(nextCtx.withChildren && !askedStyle);
    const lessWalking =
      Boolean(nextCtx.lessWalking) ||
      withChildren ||
      /مشي خفيف|مشي اقل|بدون مشي|كبار السن|مريحه/.test(q);

    let seedIds = [...activePlan.ids];
    let updatedExcluded = [...(nextCtx.excludedIds || [])];
    let changeNoteAr = '';

    if (asksRemoveStopFromPlan) {
      const targetToRemove = namedStopInTurn || parseSwapTarget(q, activePlan)?.stop || null;
      if (targetToRemove) {
        seedIds = seedIds.filter((id) => id !== targetToRemove.id);
        updatedExcluded = [...new Set([...updatedExcluded, targetToRemove.id])];
        nextCtx.excludedIds = updatedExcluded;
        changeNoteAr = `حذفت «${targetToRemove.name}» من جدولك `;
      }
    } else if (asksAddStopToPlan && namedStopInTurn) {
      updatedExcluded = updatedExcluded.filter((id) => id !== namedStopInTurn.id);
      nextCtx.excludedIds = updatedExcluded;
      if (!seedIds.includes(namedStopInTurn.id)) {
        seedIds.push(namedStopInTurn.id);
      }
      changeNoteAr = `أضفت «${namedStopInTurn.name}» لجدولك `;
    }

    const preserveOrderOnly =
      daysCount === prevDays &&
      !askedStyle &&
      !explicitRegion &&
      !asksAddStopToPlan &&
      !asksRemoveStopFromPlan &&
      seedIds.length >= daysCount * 2;

    const rebuilt = buildConstraintPlan({
      days: daysCount,
      region: queryRegion,
      style,
      season: nextCtx.season || nowRiyadh.season,
      month: nextCtx.month,
      start: startMin,
      budget: budgetMin,
      returnByEnd: daysCount === 1 ? nextCtx.returnByEnd : null,
      startPointLabel: govDetected?.canonical || nextCtx.startPoint || 'مدينة الباحة',
      visitDay: nextCtx.visitDay ?? nowRiyadh.dayOfWeek,
      withChildren,
      lessWalking,
      indoorOnly: false,
      includeIds: explicitRegion ? undefined : seedIds,
      excludeIds: updatedExcluded,
      lockedIds: nextCtx.lockedIds,
      completedIds: nextCtx.completedIds,
      preserveOrder: preserveOrderOnly,
    });
    rebuilt.plan.days = String(daysCount);
    rebuilt.plan.region = explicitRegion || (daysCount > 1 ? 'all' : baseRegion);

    Object.assign(nextCtx, {
      pendingTrip: null,
      lastPlan: rebuilt.plan,
      days: String(daysCount),
      style,
      region: rebuilt.plan.region,
      start: startMin,
      withChildren,
      lessWalking,
      hasUnsavedPreview: true,
      mode: 'plan',
    });

    const daysPhrase = conciergeDays[String(daysCount)] || `${formatNum(daysCount)} أيام`;
    const styleLabels: Record<TripStyle, string> = {
      family: 'عائلية مريحة',
      nature: 'طبيعة ومغامرة',
      heritage: 'تراثية وثقافية',
      all: 'متنوّعة',
    };
    const areaPhrase =
      rebuilt.plan.region === 'all'
        ? 'بين السراة وتهامة'
        : `في ${conciergeRegions[rebuilt.plan.region] || govDetected?.canonical || 'الباحة'}`;

    const itinerary = buildItineraryFromPlan(rebuilt.plan);
    const linkedItems = rebuilt.plan.ids
      .map((id) => getGuide144ByStopId(id))
      .filter((x): x is EnrichedGuide144Item => Boolean(x));

    const summaryLead = changeNoteAr
      ? `أبشر، ${changeNoteAr}وحدّثت خطتك لتكون ${daysPhrase} (${styleLabels[style]}) ${areaPhrase}.`
      : explicitDaysInTurn !== null && explicitDaysInTurn !== prevDays
        ? `أبشر، عدّلت خطتك من ${conciergeDays[String(prevDays)] || `${prevDays} أيام`} إلى ${daysPhrase} (${styleLabels[style]}) ${areaPhrase} مع توزيع مريح للمحطات.`
        : `تم، حدّثت خطتك لتكون ${daysPhrase} بطابع ${styleLabels[style]} ${areaPhrase}.`;

    const nextDaysSuggestion =
      daysCount < 3 ? `خلّ الرحلة ${daysCount + 1} أيام` : 'خلّ البداية 8 الصبح';

    return {
      intentKind: 'trip_modify_plan',
      usePreauthoredOnly: false,
      retrievedItems: linkedItems,
      referenceFact: `تم تحديث خطة الزائر الحالية مباشرة بناءً على طلبه لتصبح ${daysPhrase} (${styleLabels[style]}) ${areaPhrase}. اعرض التحديث بوضوح واختم بسؤال متابعة ودي لاستمرار النقاش.`,
      response: {
        replyText: `${summaryLead} شوف التوزيع الجديد تحت، وقول لي لو تحب نبدّل محطة أو نرشّح سكن ومطاعم قريبة من المسار!`,
        placeIds: linkedItems.map((x) => x.id),
        places: [],
        itinerary,
        actions: [
          { type: 'apply_plan', plan: rebuilt.plan, label: 'أضف الخطة لرحلتي', primary: true },
          { type: 'preview_plan', plan: rebuilt.plan, label: 'اعرض المسار على الخريطة' },
        ],
        suggestions: [
          nextDaysSuggestion,
          'بدّل أول محطة',
          'رشّح لي سكن ومطاعم قريبة',
        ],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  const planningRequest =
    intent === 'plan' || intent === 'timed-plan' || presetWeather ||
    /(?:^|\s)(?:و)?(?:ا?رتب(?:لي)?|ترتيب|ترتب|ا?خطط|تخطيط|خطه|برنامج|مسار|جوله|نظم|تنظيم|جدول|جهز\s?لي رحله)(?:\s|$)/.test(q) ||
    /(?:^|\s)(?:ابي|ابغي|ابغى|عايز|عاوز|حاب|اريد|نبي|نفسي)\s+(?:(?:اسوي|اعمل|اطلع|نروح|انظم)\s+)?رحله(?:\s|$)/.test(q) ||
    (explicitDaysInTurn !== null && askedStyle !== null && !asksAboutDuration &&
      !/فندق|شاليه|حجز|ليله|ليالي/.test(q));
  const timeWindow = parseTimeWindowAndReturnAr(q);
  const startInfo = parseStartPointAr(q);
  const tripDay = parseVisitDayAr(q, nowRiyadh.dayOfWeek);
  const continuesPlanning = pendingTrip && !asksAboutDuration &&
    !/فندق|شاليه|مطعم|مقهي|حجز|ليله|ليالي|(?:^|\s)(?:هل|كيف|وين|فين|وش|ايه|ليه|ازاي)(?:\s|$)/.test(q) &&
    (explicitDaysInTurn !== null || askedStyle !== null || explicitNewStart !== null ||
      Boolean(startInfo || tripDay || timeWindow.budget || timeWindow.returnByEnd || govDetected));

  if (planningRequest || continuesPlanning) {
    const weather = presetWeather || Boolean(pendingTrip?.weather) ||
      /طقس|الجو|اجواء|مطر|امطار|ضباب/.test(q);
    const wet = Boolean(payload.demoRain || pendingTrip?.wet || /مطر|امطار|ضباب/.test(q));
    const cityKey = payload.city && Object.hasOwn(climateCities, payload.city)
      ? payload.city
      : govDetected
        ? GOVERNORATE_TO_CITY_KEY[govDetected.canonical] || 'baha'
        : startInfo
          ? REGION_TO_CITY_KEY[startInfo.region] || 'baha'
          : pendingTrip?.city || 'baha';
    const cityInfo = climateCities[cityKey] || climateCities.baha;
    const invalidDays = explicitDaysInTurn !== null &&
      (explicitDaysInTurn < 1 || explicitDaysInTurn > maxTripDays);
    // If visitor already had an activePlan in this chat and didn't ask for a fresh reset, inherit known style/days when omitted
    const inheritedStyle = !asksFreshReset && activePlan && explicitDaysInTurn !== null ? activePlan.style : null;
    const inheritedDays = !asksFreshReset && activePlan && askedStyle !== null ? Number(activePlan.days || 1) : null;
    const trip: NonNullable<ConciergeContextState['pendingTrip']> = {
      days: invalidDays ? null : explicitDaysInTurn ?? pendingTrip?.days ?? inheritedDays ?? (presetWeather || weather ? 1 : null),
      style: askedStyle ?? pendingTrip?.style ?? inheritedStyle ?? (presetWeather || weather ? 'all' : null),
      weather,
      wet,
      city: cityKey,
      region: govDetected?.regionKey || startInfo?.region || pendingTrip?.region || null,
      startPoint: startInfo?.label || govDetected?.canonical || pendingTrip?.startPoint || null,
      visitDay: tripDay?.dayOfWeek ?? pendingTrip?.visitDay ?? null,
      visitDateLabel: tripDay?.label ?? pendingTrip?.visitDateLabel ?? null,
      start: explicitNewStart ?? timeWindow.start ?? pendingTrip?.start ?? null,
      budget: timeWindow.budget ?? pendingTrip?.budget ?? null,
      returnByEnd: timeWindow.returnByEnd ?? pendingTrip?.returnByEnd ?? null,
      lessWalking: Boolean(pendingTrip?.lessWalking || /مشي خفيف|مشي اقل|بدون مشي|كبار السن|مريحه|سهله/.test(q)),
    };

    if (trip.days === null || trip.style === null) {
      nextCtx.pendingTrip = trip;
      const daysQuestion = invalidDays
        ? 'أقدر أرتّب لك من يوم إلى سبعة أيام. كم يوم يناسبك؟'
        : 'كم يوم بتقضي في الباحة؟';
      const styleQuestion = 'وش نوع الرحلة اللي تفضّله؟ عائلية، طبيعة ومغامرة، تراثية، أو منوّعة؟';
      const replyText = [trip.days === null ? daysQuestion : '', trip.style === null ? styleQuestion : '']
        .filter(Boolean).join(' ');
      const clarificationSuggestions =
        trip.days === null && trip.style === null
          ? ['يومان مع العائلة', '3 أيام طبيعة ومغامرة', 'يوم واحد منوّعة']
          : trip.days === null
            ? ['يوم واحد', 'يومان', '3 أيام']
            : ['عائلية', 'طبيعة ومغامرة', 'تراثية', 'منوّعة'].slice(0, 3);
      return {
        intentKind: 'trip_clarification',
        usePreauthoredOnly: true,
        retrievedItems: [],
        response: {
          replyText,
          placeIds: [],
          places: [],
          itinerary: null,
          actions: [],
          suggestions: clarificationSuggestions,
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }

    const daysCount = trip.days;
    const style = trip.style;
    const forecast = payload.weather?.city === cityKey ? payload.weather : null;
    const isWetForecast = trip.weather && (trip.wet || Boolean(forecast?.isWet));
    const startMin = trip.start ?? (isWetForecast ? 10 * 60 : 9 * 60);
    const regionKey = trip.region || (trip.weather && daysCount === 1 ? cityInfo.region : 'all');
    const startPoint = trip.startPoint || (trip.weather ? cityInfo.name : 'مدينة الباحة');
    const visitDay = trip.visitDay ?? nowRiyadh.dayOfWeek;
    const dayLabel = trip.visitDateLabel || (trip.weather ? `اليوم (${WEEKDAY_NAMES_AR[visitDay]})` : WEEKDAY_NAMES_AR[visitDay]);
    const budgetMin = trip.budget ?? (trip.weather ? 420 : 480);
    const returnByEnd = trip.returnByEnd ?? (trip.weather && daysCount === 1 ? 18 * 60 : null);
    const withChildren = style === 'family';
    const lessWalking = trip.lessWalking || withChildren || isWetForecast;

    Object.assign(nextCtx, {
      pendingTrip: null,
      days: String(daysCount),
      region: regionKey,
      style,
      withChildren,
      lessWalking,
      startPoint,
      visitDay,
      visitDateLabel: dayLabel,
      start: startMin,
      budget: budgetMin,
      returnByEnd,
      mode: 'plan',
    });

    const built = buildConstraintPlan({
      days: daysCount,
      region: trip.weather && regionKey === 'city' ? 'all' : regionKey,
      style,
      season: nextCtx.season || nowRiyadh.season,
      month: nextCtx.month,
      start: startMin,
      budget: budgetMin,
      returnByEnd,
      startPointLabel: startPoint,
      visitDay,
      withChildren,
      lessWalking,
      indoorOnly: isWetForecast,
      excludeIds: nextCtx.excludedIds || [],
      lockedIds: nextCtx.lockedIds,
      completedIds: nextCtx.completedIds,
    });
    built.plan.days = String(daysCount);
    built.plan.region = regionKey;

    nextCtx.lastPlan = built.plan;
    nextCtx.hasUnsavedPreview = true;
    const daysPhrase = conciergeDays[String(daysCount)] || `${formatNum(daysCount)} أيام`;
    let weatherNote: string | null = null;
    if (trip.weather) {
      if (payload.demoRain) {
        weatherNote = 'هذا سيناريو تجريبي لأجواء ماطرة. راجع التوقعات الحية قبل الانطلاق.';
      } else if (forecast && typeof forecast.tempC === 'number') {
        const tempTxt = `${formatNum(Math.round(forecast.tempC))}°م`;
        weatherNote = `حسب التوقعات المتاحة في ${cityInfo.name} (${tempTxt} · ${forecast.conditionLabel || 'معتدلة'}). الطقس يتغيّر، فشيّك على توقع كل يوم قبل الانطلاق.`;
      } else if (trip.wet) {
        weatherNote = 'راعيت احتمال المطر أو الضباب اللي ذكرتَه. شيّك على التوقعات قبل الانطلاق.';
      } else {
        weatherNote = `توقعات ${cityInfo.name} الحية ما هي متاحة حالياً. رتّبت الجولة على أجواء فصل ${seasons[nowRiyadh.season].name} المعتادة.`;
      }
    }

    const itinerary = buildItineraryFromPlan(built.plan, {
      title: trip.weather ? `خطة ${daysCount === 1 ? dayLabel : daysPhrase} حسب الجو — ${cityInfo.name}` : undefined,
      weatherNote,
    });
    const linkedItems = built.plan.ids
      .map((id) => getGuide144ByStopId(id))
      .filter((x): x is EnrichedGuide144Item => Boolean(x));
    const familyPhrase = withChildren ? ' مناسبة للعائلة وبمشي مريح' : '';
    const areaPhrase = regionKey === 'all' ? 'في الباحة' : `في ${conciergeRegions[regionKey] || startPoint}`;

    return {
      intentKind: trip.weather ? 'weather_plan' : 'trip_plan',
      usePreauthoredOnly: false,
      retrievedItems: linkedItems,
      response: {
        replyText: `أبشر، رتّبت لك خطة ${daysPhrase}${familyPhrase} ${areaPhrase} تبدأ الساعة ${clock(startMin)} بتوقيت السعودية.${weatherNote ? ` ${weatherNote}` : ''} إيش رأيك في المحطات؟ نقدر نعدّل عدد الأيام أو وقت البداية أو نبدّل أي وجهة مع بعض.`,
        placeIds: linkedItems.map((x) => x.id),
        places: [],
        itinerary,
        actions: [
          { type: 'apply_plan', plan: built.plan, label: 'أضف الخطة لرحلتي', primary: true },
          { type: 'preview_plan', plan: built.plan, label: 'اعرض المسار على الخريطة' },
        ],
        suggestions: [
          daysCount === 1 ? 'خلّ الرحلة يومين' : 'خلّ الرحلة 3 أيام',
          'خلّ البداية 8 الصبح',
          'بدّل أول محطة',
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
  const asksForRecommendations =
    /(?:^|\s)(?:رشح|اقترح|دلني|انصحني|تنصحني|ترشح|اعطني|عطني|ابغي|ابي|ابغا|ابغى|عايز|عاوز|اريد|محتاج|اقرب|افضل|احسن)(?:\s|$)/.test(q) ||
    /(?:وين|فين|اين)\s+(?:اقدر\s+|ممكن\s+)?(?:ابيت|نبيت|اسكن|ننام|انام|اكل|اتغدي|اتعشي|افطر|اتقهوى|القي|الاقي|احصل|اقضي|نروح)/.test(q);
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
      (!govDetected && recentItems.length === 1 && !searchRes.ambiguousMatches.length ? recentItems[0] : undefined);

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
  const refersToPreviousPlaces = recentItems.length > 0 &&
    (/فيهم|منهم|بينهم|الثلاثه|الاثنين|الاول|الثاني|التاني|الثالث|الاخير|قارن|مقارنه|اي واحد|انهي واحد|مين الاحسن|مين الافضل|مين الارخص/.test(q) ||
      (!asksForRecommendations && !govDetected && /مسبح|فطور|افطار|حيوانات|متي يفتح|مواقف|واي فاي|رقمه|رقمهم/.test(q)));
  const looksLikeSpecificNameAsk =
    /وش عندك عن|علمني عن|معلومات عن|تفاصيل|رقم|هاتف|عنوان|تعرف/.test(q) ||
    (!govDetected && !asksForRecommendations && q.split(' ').length <= 3);

  if (searchRes.ambiguousMatches.length >= 2 && !searchRes.exactMatch && looksLikeSpecificNameAsk && !refersToPreviousPlaces) {
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
    nextCtx.lastGovernorate = item.governorate;
    nextCtx.lastCategoryKey = item.categoryKey;
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

    const isStayItem = /hotels|furnished|rural/.test(item.categoryKey);
    const followUpAsk = isStayItem
      ? ` تحب أشوف لك خيارات سكن ثانية في ${item.governorate} أو أعطيك اتجاهات الوصول له؟`
      : ` تحب ندخله في خطة رحلتك أو أرشّح لك مطاعم وسكن قريب منه في ${item.governorate}؟`;

    const replyText = `${unconfirmedPrefix}«${item.name}» في ${item.governorate} (${item.address}). ${item.description}${ratingBit}${priceBit}${followUpAsk}`;

    const placeSuggestions = isStayItem
      ? ['كيف أوصل له؟', `سكن ثاني في ${item.governorate}`, `مطاعم في ${item.governorate}`]
      : ['كيف أوصل له؟', `مطاعم في ${item.governorate}`, 'رتّب لي جولة تشمله'];

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
        suggestions: placeSuggestions,
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

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
            replyText: `الدليل ما فيه تأكيد حالياً عن ${unconfirmedTopic} في «${prevItem.name}» (${prevItem.governorate}). يفضّل تتواصل معهم مباشرة للتأكد عبر الوسائل المتاحة تحت، أو لو حاب أشوف لك بدائل ثانية في ${prevItem.governorate} أنا حاضر:`,
            placeIds: [prevItem.id],
            places: [card],
            itinerary: null,
            actions: [],
            suggestions: [`بدائل في ${prevItem.governorate}`, 'كيف أوصل له؟'],
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
          replyText: `حسب المذكور في الدليل عن «${prevItem.name}» (${prevItem.governorate}): ${prevItem.description} وش ودّك تعرف عنه بعد؟`,
          placeIds: [prevItem.id],
          places: [card],
          itinerary: null,
          actions: [],
          suggestions: ['كيف أوصل له؟', `أماكن قريبة في ${prevItem.governorate}`],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }

    // Build a smart local comparison across recentItems so even offline/without LLM it answers directly!
    const topRated = [...recentItems].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || recentItems[0];
    const comparisonBits = recentItems
      .slice(0, 3)
      .map(
        (it) =>
          `«${it.name}» (${it.governorate}${it.ratingRaw ? ` · تقييم ${it.ratingRaw}` : ''}${it.priceRange ? ` · ${it.priceRange}` : ''})`
      )
      .join('، ');
    const bestCard = hydratePlaceCard(topRated, {
      reason: buildShortRecommendationReason(topRated, 'الأعلى تقييماً بين الخيارات'),
    });

    return {
      intentKind: 'place_followup',
      usePreauthoredOnly: false,
      retrievedItems: recentItems,
      referenceFact:
        'الزائر يتابع الحديث أو يقارن بين الأماكن التي عُرضت للتو في السجلات المسترجعة. أجب مباشرة وبشكل طبيعي من وصف ومعلومات هذه السجلات، وأرجع في placeIds فقط المكان أو الأماكن التي تنطبق على سؤاله الحالي، واختم بسؤال متابعة ودي.',
      response: {
        replyText: `مقارنة سريعة بين الخيارات اللي استعرضناها: ${comparisonBits}. من ناحية التقييم والمواصفات يبرز «${topRated.name}» كخيار مميز. تحب نعتمد عليه أو أشوف لك خيارات إضافية؟`,
        placeIds: [bestCard.id],
        places: [bestCard],
        itinerary: null,
        actions: [],
        suggestions: ['كيف أوصل له؟', 'عطني خيارات ثانية', 'رتّب لي خطة رحلة'],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 6b) Conversational Follow-up: "More Options / Alternatives" ("غيره؟", "خيارات ثانية", "زيد خيارات")
  // ---------------------------------------------------------------------------
  const asksMoreOptions =
    !catIntent &&
    /(?:^|\s)(?:غيره|غيرها|غيرهم|شي ثاني|شئ ثاني|خيارات ثانيه|خيارات اخري|اماكن ثانيه|بدائل|زيد|كمان خيارات|فيه غيرهم|عندك غيره)(?:\s|$)/.test(
      q
    );
  const inferredGov =
    govDetected?.canonical ||
    nextCtx.lastGovernorate ||
    recentItems[0]?.governorate ||
    (activePlan && activePlan.region !== 'all' ? conciergeRegions[activePlan.region] : null) ||
    null;
  const inferredCat = catIntent?.categoryKey || nextCtx.lastCategoryKey || recentItems[0]?.categoryKey || null;

  if (asksMoreOptions && inferredCat) {
    const moreSearch = searchGuide144({
      query: '',
      governorate: inferredGov,
      categoryKey: inferredCat as never,
      limit: 10,
      userLocation: payload.userLocation || null,
    });
    const unseen = moreSearch.matches
      .map((m) => m.item)
      .filter((it) => !recentIds.includes(it.id))
      .slice(0, 4);
    const fallbackPool = unseen.length ? unseen : moreSearch.matches.slice(0, 4).map((m) => m.item);
    if (fallbackPool.length > 0) {
      const cards = fallbackPool.map((it) =>
        hydratePlaceCard(it, { reason: buildShortRecommendationReason(it) })
      );
      nextCtx.recentPlaceIds = [...new Set([...recentIds, ...cards.map((c) => c.id)])].slice(-10);
      return {
        intentKind: 'area_recommendation',
        usePreauthoredOnly: false,
        retrievedItems: fallbackPool,
        response: {
          replyText: unseen.length
            ? `أبشر! هذي دفعة ثانية من الخيارات${inferredGov ? ` في ${inferredGov}` : ' في الباحة'} غير اللي عرضناها قبل شوي. أي واحد يناسبك أكثر؟`
            : `هذي أبرز الخيارات المتوفرة حالياً${inferredGov ? ` في ${inferredGov}` : ''}. تحب نوسّع البحث لمحافظة قريبة مثل مدينة الباحة أو بلجرشي؟`,
          placeIds: cards.map((c) => c.id),
          places: cards,
          itinerary: null,
          actions: [],
          suggestions: ['قارن لي بينهم', 'خيارات في مدينة الباحة', 'رتّب لي خطة رحلة'],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 7) Stay / Dining / Places Recommendation by Area OR Contextual Nearby Follow-up
  //    (e.g. "أنا في العقيق، وين أقدر أبيت؟" OR "طيب وين ناكل قريب منها؟" after Dhee Ain!)
  // ---------------------------------------------------------------------------
  const asksNearest = /اقرب|قريب مني|حولي|جنبي/.test(q);
  const contextualNearby =
    !govDetected &&
    Boolean(inferredGov) &&
    Boolean(catIntent) &&
    (/قريب|حول|جنب|هناك|نفس المنطقه|على المسار|فيها|عندها/.test(q) || recentItems.length > 0 || Boolean(activePlan));

  if (catIntent && (asksForRecommendations || contextualNearby)) {
    const effectiveGov = govDetected?.canonical || (contextualNearby ? inferredGov : null);
    const effectiveSearch =
      effectiveGov && effectiveGov !== govDetected?.canonical
        ? searchGuide144({
            query: rawText,
            governorate: effectiveGov,
            categoryKey: catIntent.categoryKey,
            subType: catIntent.subType,
            limit: 4,
            userLocation: payload.userLocation || null,
          })
        : searchRes;
    const topMatches = effectiveSearch.matches.length
      ? effectiveSearch.matches.slice(0, 4)
      : searchRes.matches.slice(0, 4);
    if (topMatches.length > 0) {
      const matchedGov =
        effectiveGov && effectiveSearch.matches.length ? effectiveGov : govDetected?.canonical || null;
      const cards = topMatches.map((m) =>
        hydratePlaceCard(m.item, {
          reason: buildShortRecommendationReason(m.item),
          distanceKm: m.distanceKm,
        })
      );
      nextCtx.recentPlaceIds = cards.map((c) => c.id);
      nextCtx.lastCategoryKey = catIntent.categoryKey;
      if (matchedGov) nextCtx.lastGovernorate = matchedGov;
      if (cards.length === 1) nextCtx.lastGuideItemId = cards[0].id;

      const areaTxt = matchedGov ? `في ${matchedGov}` : 'في منطقة الباحة';
      const catTxt = catIntent.labelAr;
      const distNote = effectiveSearch.sortedByDistance
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
          replyText: `حياك! هذي أبرز خيارات ${catTxt} ${areaTxt} من دليل الباحة${distNote} تحب أقارن لك بينهم أو أشوف لك خيارات ثانية؟`,
          placeIds: cards.map((c) => c.id),
          places: cards,
          itinerary: null,
          actions: [],
          suggestions: ['أيهم الأفضل برأيك؟', 'عطني خيارات ثانية', 'رتّب لي خطة رحلة'],
          context: nextCtx,
          requestSeq: payload.requestSeq,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 8) Discovery, Preparation, Duration Advice, Regional Comparison & FAQ
  // ---------------------------------------------------------------------------
  if (asksAboutDuration) {
    const requestedD = parseDaysCount(q, false) || 2;
    const styleTxt = askedStyle === 'family' ? 'عائلية ' : '';
    return {
      intentKind: 'discovery_or_prep',
      usePreauthoredOnly: false,
      retrievedItems: recentItems,
      referenceFact: `الزائر يسأل عن كفاية المدة (${requestedD} أيام) لزيارة الباحة دون طلب إنشاء جدول فوري.`,
      response: {
        replyText:
          requestedD === 1
            ? `يوم واحد يكفي لجولة مركّزة تشمل غابة رغدان ومنتزه الأمير حسام وقرية ذي عين التراثية، لكن لو معك يومين أو 3 أيام بتاخذ راحتك أكثر بين السراة وتهامة. تحب أرتّب لك خطة تناسب وقتك؟`
            : `${conciergeDays[String(requestedD)] || `${requestedD} أيام`} مدة ممتازة جداً لرحلة ${styleTxt}في الباحة! تقدر تخصّص يوم لمرتفعات السراة وغاباتها (رغدان والأمير حسام)، ويوم لقطاع تهامة وقرية ذي عين وجبل شدا. تحب أجهّز لك الجدول التفصيلي الحين؟`,
        placeIds: [],
        places: [],
        itinerary: null,
        actions: [],
        suggestions: [
          `رتّب لي ${conciergeDays[String(requestedD)] || 'يومين'} ${askedStyle === 'family' ? 'مع العائلة' : 'منوّعة'}`,
          'وين أفضل سكن في الباحة؟',
          'إيه الفرق بين السراة وتهامة؟',
        ],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  if (/السراه.*تهامه|تهامه.*السراه|الفرق بين/.test(q)) {
    return {
      intentKind: 'discovery_or_prep',
      usePreauthoredOnly: false,
      retrievedItems: recentItems,
      referenceFact: 'اشرح الفرق بين قطاع السراة الجبلي المرتفع وقطاع تهامة الدافئ في منطقة الباحة بأسلوب حواري شيّق واختم بسؤال متابعة.',
      response: {
        replyText:
          'منطقة الباحة تجمع بيئتين مختلفتين في مكان واحد: «السراة» على قمم الجبال (مثل مدينة الباحة وبلجرشي والمندق) أجواؤها باردة ومنعشة صيفاً وتشتهر بالغابات والضباب، و«تهامة» أسفل العقبة (مثل المخواة وقلوة وقرية ذي عين وجبل شدا) أجواؤها دافئة ومثالية في الشتاء والربيع. متى ناوي تزورنا عشان أنصحك بأنسب جهة تبدأ منها؟',
        placeIds: [],
        places: [],
        itinerary: null,
        actions: [],
        suggestions: ['رتّب لي يومين بين السراة وتهامة', 'أبرز معالم السراة', 'اكتشف قرية ذي عين'],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  const faqPatterns: Array<[string, RegExp]> = [
    ['faq-airport', /مطار|طيران|كيف اوصل|الوصول للباحه|كيف اروح الباحه/],
    ['faq-roads', /عقب|عقبه|طريق|طرق|قياده|تنقل|مسافه/],
    ['faq-documents', /تاشير|فيزا|جواز|اوراق|مستند|هويه/],
    ['faq-seasons', /افضل وقت|احسن وقت|متي ازور|موسم الزياره|صيف ولا شتاء/],
    ['faq-fog-rain', /ضباب|غيم|امطار|مطر|ملابس|لبس|جاكيت|تجهيز|استعداد|وش البس|الطقس|الجو/],
    ['faq-family-elderly', /كبار السن|كرسي متحرك|معبد|مشي خفيف/],
    ['faq-food', /دغابيس|عصيده|خبزه|مقناه|بن شدوي|اكلات شعبيه|عسل/],
    ['faq-official-numbers', /طوارئ|940|930|911|بلاغ|امانه/],
  ];

  for (const [faqId, pat] of faqPatterns) {
    if (pat.test(q)) {
      const faq = FAQ_ITEMS.find((f) => f.id === faqId);
      if (faq) {
        return {
          intentKind: 'discovery_or_prep',
          usePreauthoredOnly: false,
          retrievedItems: recentItems,
          referenceFact: `معلومة موثّقة من دليل الباحة: ${faq.answer}`,
          response: {
            replyText: `${faq.answer} تحب نرتّب خطة رحلتك بناءً على هالمعلومة أو تسألني عن شيء ثاني؟`,
            placeIds: [],
            places: [],
            itinerary: null,
            actions: [{ type: 'navigate_faq', faqId: faq.id, label: 'عرض التفاصيل في الأسئلة الشائعة' }],
            suggestions: ['رتّب لي خطة حسب الأجواء', 'وين أقدر أسكن؟', 'مطاعم أكلات شعبية'],
            context: nextCtx,
            requestSeq: payload.requestSeq,
          },
        };
      }
    }
  }

  // General discovery ask ("وش يميز الباحة؟" / "اقترح لي وجهات" / "اكتشف الباحة")
  if (intent === 'discover' || /^(?:اكتشف|استكشف) الباحه$/.test(q) ||
      (asksForRecommendations && !catIntent && /وجهات|معالم|اماكن حلوه|اماكن سياحيه/.test(q))) {
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
          'الباحة تجمع بين برودة غابات السراة ودفء تهامة وقرى الحجر التاريخية. هذي أبرز المعالم اللي أنصحك تبدأ فيها — أي وجهة تشدّك أكثر عشان نرتّب حولها جولتك؟',
        placeIds: cards.map((c) => c.id),
        places: cards,
        itinerary: null,
        actions: [],
        suggestions: ['رتّب لي يومين مع العائلة', 'فنادق ومنتجعات في الباحة', 'مطاعم ومقاهي مميزة'],
        context: nextCtx,
        requestSeq: payload.requestSeq,
      },
    };
  }

  // Context-aware general fallback: stay connected to activePlan or recentItems instead of resetting!
  const contextualGeneralReply = activePlan
    ? `أنا معك على خطتك الحالية (${conciergeDays[String(activePlan.days)] || `${activePlan.days} أيام`}). تقدر تقول لي مثلاً «خلّ الرحلة يومين»، «غيّر وقت البداية»، «بدّل أول محطة»، أو تسألني عن السكن والمطاعم القريبة من مسارك!`
    : recentItems.length > 0
      ? `أنا متابع معك بخصوص «${recentItems[0].name}»${recentItems.length > 1 ? ' والخيارات اللي استعرضناها' : ''}. تحب تعرف طريقة الوصول، تقارن مع بدائل ثانية في ${recentItems[0].governorate}، أو ندخلها في خطة رحلة؟`
      : 'حياك الله! أنا مرافقك في منطقة الباحة — قولي كم يوم ناوي تقضي ومع مين مسافر، أو اسألني عن أي معلم أو فندق أو مطعم ونكمل التخطيط خطوة بخطوة.';

  const contextualGeneralSuggestions = activePlan
    ? [
        Number(activePlan.days) === 1 ? 'خلّ الرحلة يومين' : 'خلّ الرحلة 3 أيام',
        'بدّل أول محطة',
        'رشّح لي مطاعم قريبة',
      ]
    : recentItems.length > 0
      ? ['كيف أوصل له؟', `بدائل في ${recentItems[0].governorate}`, 'رتّب لي خطة رحلة']
      : ['رتّب لي يومين مع العيال', 'أبرز معالم الباحة', 'وين أبيت في الباحة؟'];

  return {
    intentKind: 'general',
    usePreauthoredOnly: false,
    retrievedItems: recentItems,
    referenceFact: nextCtx.pendingTrip
      ? `الزائر بدأ تخطيط رحلة وقد يسأل سؤالاً جانبياً. جاوب على رسالته أولاً. إذا كان يكمل التخطيط، اطلب فقط البيانات الناقصة: ${[
        nextCtx.pendingTrip.days === null ? 'مدة الرحلة' : '',
        nextCtx.pendingTrip.style === null ? 'نوع الرحلة' : '',
      ].filter(Boolean).join('، ')}.`
      : activePlan
        ? `للزائر خطة رحلة نشطة حالياً (${activePlan.days} أيام، الطابع: ${activePlan.style}). حافظ على ترابط الحوار مع خطته الحالية.`
        : null,
    response: {
      replyText: contextualGeneralReply,
      placeIds: [],
      places: [],
      itinerary: null,
      actions: [],
      suggestions: contextualGeneralSuggestions,
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
