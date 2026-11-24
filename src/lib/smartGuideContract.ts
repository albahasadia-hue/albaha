import { SMART_GUIDE_NAME } from './smartGuideName';
import type {
  ConciergeContextState,
  IndexedGuideRecord,
  RouteTiming,
  ScheduledStation,
  SeasonKey,
  StopBase,
  TravelProfileKey,
  TripPlan,
  TripStyle,
} from './portalTypes';

export interface ConciergeInput {
  intent?: string;
  text?: string;
  profile?: TravelProfileKey | string;
  field?: string;
  value?: unknown;
  id?: string;
  city?: string;
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
import {
  climateCities,
  conciergeDays,
  conciergeRegions,
  maxTripDays,
  places,
  tourGuide,
  typeLabels,
} from './portalStaticData';
import {
  getGuide144ById,
  isSafeHttpUrl,
  type EnrichedGuide144Item,
  type GuideExternalLink,
  type GuidePhoneContact,
} from './guideCatalog144';

export const APPROVED_ACTION_TYPES = [
  'navigate_map',
  'navigate_place',
  'navigate_guide_place',
  'navigate_section',
  'navigate_city',
  'navigate_faq',
  'focus_map_stop',
  'open_directions',
  'add_to_trip',
  'preview_plan',
  'apply_plan',
  'quick_prompt',
  'retry',
] as const;

export type ApprovedGuideActionType = (typeof APPROVED_ACTION_TYPES)[number];

const APPROVED_ACTION_SET = new Set<string>(APPROVED_ACTION_TYPES);

export const APPROVED_SECTIONS = new Set<string>([
  'home',
  'planner',
  'mapPanel',
  'summary',
  'tripDraft',
  'destination-directory',
  'visit-season',
  'experiences',
  'destinations',
  'guide',
  'faq',
  'invest',
]);

const EXISTING_TOUR_GUIDE_IDS = new Set<string>(tourGuide.records.map((r) => r.id));

export interface SmartGuidePlaceCard {
  id: number;
  stopId: string | null;
  tourGuideId: string | null;
  name: string;
  governorate: string;
  categoryLabel: string;
  type: string;
  shortDescription: string;
  reason?: string;
  address: string;
  ratingText: string | null;
  priceRange: string | null;
  image: string;
  imageIsFallback: boolean;
  internalHref: string;
  hasDedicatedSitePage: boolean;
  coordinates: [number, number] | null;
  distanceKm: number | null;
  phones: GuidePhoneContact[];
  whatsappUrl: string | null;
  officialWebsite: GuideExternalLink | null;
  bookingLink: GuideExternalLink | null;
  sourceLink: GuideExternalLink | null;
  canAddToTrip: boolean;
  canShowOnMap: boolean;
}

export interface SmartGuideItineraryStop {
  day: number;
  startTime: string;
  endTime: string;
  stopId: string;
  guideItemId: number | null;
  name: string;
  governorate: string;
  shortDescription: string;
  reason?: string;
  driveMinutes: number | null;
  image: string;
  internalHref: string;
  canShowOnMap: boolean;
  canAddToTrip: boolean;
}

export interface SmartGuideItineraryDay {
  day: number;
  label: string;
  stops: SmartGuideItineraryStop[];
}

export interface SmartGuideItinerary {
  days: number;
  title: string;
  startTime: string;
  region: string;
  plan: TripPlan;
  groupedDays: SmartGuideItineraryDay[];
  weatherNote?: string | null;
}

export interface SmartGuideAction {
  type: ApprovedGuideActionType;
  label: string;
  primary?: boolean;
  autoExecute?: boolean;
  stopId?: string;
  guideId?: string;
  guideItemId?: number;
  sectionId?: string;
  cityKey?: string;
  faqId?: string;
  promptText?: string;
  plan?: TripPlan;
}

export interface SmartGuideConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface SmartGuideRequestPayload {
  question?: string;
  intent?: string;
  preference?: { field: string; value: unknown };
  city?: string;
  placeId?: string | null;
  guidePlaceId?: string | null;
  context: ConciergeContextState;
  history?: SmartGuideConversationTurn[];
  userLocation?: { lat: number; lng: number } | null;
  savedState?: {
    days: string;
    region: string;
    style: 'all' | 'family' | 'nature' | 'heritage';
    ids: string[];
    timing: RouteTiming | null;
    completedIds: string[];
    lockedIds: string[];
  };
  weather?: {
    city: string;
    cityName?: string;
    tempC?: number;
    conditionLabel?: string;
    isWet?: boolean;
    forecastSummary?: string;
    forecastDaysAvailable?: number;
    source?: string;
    observedAt?: string;
  } | null;
  demoRain?: boolean;
  requestSeq?: number;
  /** Internal test hook: simulate missing key or upstream failure only in non-prod test verification */
  skipLlm?: boolean;
}

export interface SmartGuideResponseContract {
  replyText: string;
  placeIds: number[];
  places: SmartGuidePlaceCard[];
  itinerary: SmartGuideItinerary | null;
  actions: SmartGuideAction[];
  context: ConciergeContextState;
  retryable?: boolean;
  requestSeq?: number;
}

export function isValidGuideId(guideId: unknown): guideId is string {
  if (typeof guideId !== 'string' || !guideId.trim()) return false;
  if (EXISTING_TOUR_GUIDE_IDS.has(guideId)) return true;
  const dynMatch = guideId.match(/^g-(\d+)$/);
  if (dynMatch) {
    const numId = Number(dynMatch[1]);
    return Number.isInteger(numId) && Boolean(getGuide144ById(numId));
  }
  return false;
}

export function isValidTimingPlan(plan: unknown): plan is TripPlan {
  if (!plan || typeof plan !== 'object') return false;
  const p = plan as TripPlan;
  if (!Object.hasOwn(conciergeDays, p.days)) return false;
  if (!Object.hasOwn(conciergeRegions, p.region)) return false;
  if (!Object.hasOwn(typeLabels, p.style)) return false;
  if (!Array.isArray(p.ids) || p.ids.length === 0) return false;
  if (!p.ids.every((id) => typeof id === 'string' && places.has(id))) return false;
  if (!p.timing || !Array.isArray(p.timing.stations) || p.timing.stations.length !== p.ids.length) {
    return false;
  }
  const seen = new Set<string>();
  for (let i = 0; i < p.timing.stations.length; i += 1) {
    const row = p.timing.stations[i];
    if (row.id !== p.ids[i] || !places.has(row.id) || seen.has(row.id)) return false;
    seen.add(row.id);
    if (!Number.isInteger(row.day) || row.day < 1 || row.day > maxTripDays) return false;
    if (!Number.isInteger(row.start) || !Number.isInteger(row.end)) return false;
    if (row.start < 0 || row.end > 1440 || row.start >= row.end) return false;
    if (i > 0) {
      const prev = p.timing.stations[i - 1];
      if (row.day < prev.day) return false;
      if (row.day === prev.day && row.start < prev.end) return false;
    }
  }
  return true;
}

/**
 * Validates numeric place IDs against the active `albaha_guide_144.json` catalog.
 * Rejects any unknown, non-integer, or out-of-range ID.
 */
export function validatePlaceIds(rawIds: unknown): {
  validIds: number[];
  rejectedIds: unknown[];
} {
  if (!Array.isArray(rawIds)) return { validIds: [], rejectedIds: [] };
  const validIds: number[] = [];
  const rejectedIds: unknown[] = [];
  const seen = new Set<number>();

  for (const raw of rawIds) {
    const num = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
    if (!Number.isInteger(num) || !getGuide144ById(num)) {
      rejectedIds.push(raw);
      continue;
    }
    if (!seen.has(num)) {
      seen.add(num);
      validIds.push(num);
    }
  }

  return { validIds, rejectedIds };
}

/**
 * Hydrates a visitor-facing place card strictly from the verified catalog item.
 * Never trusts URLs, images, or phone numbers generated outside the verified catalog.
 */
export function hydratePlaceCard(
  item: EnrichedGuide144Item,
  opts?: { reason?: string; distanceKm?: number | null }
): SmartGuidePlaceCard {
  const safeOfficial =
    item.officialWebsite && isSafeHttpUrl(item.officialWebsite.url) ? item.officialWebsite : null;
  const safeBooking =
    item.bookingLink && isSafeHttpUrl(item.bookingLink.url) ? item.bookingLink : null;
  const safeSource =
    item.sourceLink && isSafeHttpUrl(item.sourceLink.url) ? item.sourceLink : null;
  const safeWhatsApp =
    item.whatsappUrl && isSafeHttpUrl(item.whatsappUrl) ? item.whatsappUrl : null;

  return {
    id: item.id,
    stopId: item.stopId,
    tourGuideId: item.tourGuideId,
    name: item.name,
    governorate: item.governorate,
    categoryLabel: item.categoryAr,
    type: item.type,
    shortDescription: item.shortDescription,
    reason: opts?.reason,
    address: item.address,
    ratingText: item.ratingRaw,
    priceRange: item.priceRange,
    image: item.image,
    imageIsFallback: item.imageIsFallback,
    internalHref: item.internalHref,
    hasDedicatedSitePage: item.hasDedicatedSitePage,
    coordinates: item.coordinates,
    distanceKm: opts?.distanceKm ?? null,
    phones: item.phones,
    whatsappUrl: safeWhatsApp,
    officialWebsite: safeOfficial,
    bookingLink: safeBooking,
    sourceLink: safeSource,
    canAddToTrip: Boolean(item.stopId && places.has(item.stopId)),
    canShowOnMap: Boolean((item.stopId && places.has(item.stopId)) || item.coordinates),
  };
}

/**
 * Validates a single action against the strict internal allowlist and verified resource IDs.
 * Rejects any unauthorized action type, external URL hijacking, or invalid destination ID.
 */
export function validateGuideAction(raw: unknown): SmartGuideAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const type = candidate.type;
  if (typeof type !== 'string' || !APPROVED_ACTION_SET.has(type)) return null;

  const label = typeof candidate.label === 'string' ? candidate.label.trim().slice(0, 80) : '';
  const primary = Boolean(candidate.primary);
  const autoExecute = Boolean(candidate.autoExecute);

  switch (type as ApprovedGuideActionType) {
    case 'navigate_map': {
      const stopId = typeof candidate.stopId === 'string' && places.has(candidate.stopId)
        ? candidate.stopId
        : undefined;
      return {
        type: 'navigate_map',
        label: label || 'افتح الخريطة',
        primary,
        autoExecute,
        stopId,
      };
    }
    case 'navigate_place':
    case 'focus_map_stop':
    case 'add_to_trip': {
      const stopId = typeof candidate.stopId === 'string' ? candidate.stopId.trim() : '';
      if (!stopId || !places.has(stopId)) return null;
      return {
        type: type as 'navigate_place' | 'focus_map_stop' | 'add_to_trip',
        label: label || places.get(stopId)!.name,
        primary,
        autoExecute: type === 'add_to_trip' ? false : autoExecute,
        stopId,
      };
    }
    case 'open_directions': {
      const guideItemId = candidate.guideItemId;
      if (typeof guideItemId !== 'number' || !getGuide144ById(guideItemId)) return null;
      return { type: 'open_directions', guideItemId, label: label || 'افتح الاتجاهات' };
    }
    case 'navigate_guide_place': {
      const guideId = typeof candidate.guideId === 'string' ? candidate.guideId.trim() : '';
      const guideItemId = typeof candidate.guideItemId === 'number' ? candidate.guideItemId : undefined;
      if (guideId && isValidGuideId(guideId)) {
        return {
          type: 'navigate_guide_place',
          label: label || 'افتح الصفحة',
          primary,
          autoExecute,
          guideId,
          guideItemId: guideItemId && getGuide144ById(guideItemId) ? guideItemId : undefined,
        };
      }
      if (guideItemId && getGuide144ById(guideItemId)) {
        const rec = getGuide144ById(guideItemId)!;
        return {
          type: 'navigate_guide_place',
          label: label || rec.name,
          primary,
          autoExecute,
          guideId: rec.tourGuideId || `g-${rec.id}`,
          guideItemId: rec.id,
        };
      }
      return null;
    }
    case 'navigate_section': {
      const sectionId = typeof candidate.sectionId === 'string' ? candidate.sectionId.trim() : '';
      if (!APPROVED_SECTIONS.has(sectionId)) return null;
      return {
        type: 'navigate_section',
        label: label || 'انتقل للقسم',
        primary,
        autoExecute,
        sectionId,
      };
    }
    case 'navigate_city': {
      const cityKey = typeof candidate.cityKey === 'string' ? candidate.cityKey.trim() : '';
      if (!Object.hasOwn(climateCities, cityKey)) return null;
      return {
        type: 'navigate_city',
        label: label || climateCities[cityKey].name,
        primary,
        autoExecute,
        cityKey,
      };
    }
    case 'navigate_faq': {
      const faqId = typeof candidate.faqId === 'string' ? candidate.faqId.trim() : '';
      if (faqId && !/^[a-z0-9-]+$/i.test(faqId)) return null;
      return {
        type: 'navigate_faq',
        label: label || 'الأسئلة الشائعة',
        primary,
        autoExecute,
        faqId: faqId || undefined,
      };
    }
    case 'preview_plan':
    case 'apply_plan': {
      if (!isValidTimingPlan(candidate.plan)) return null;
      return {
        type: type as 'preview_plan' | 'apply_plan',
        label: label || (type === 'apply_plan' ? 'أضف الخطة لرحلتي' : 'عاين على الخريطة'),
        primary,
        autoExecute: false,
        plan: candidate.plan,
      };
    }
    case 'quick_prompt': {
      const promptText =
        typeof candidate.promptText === 'string' ? candidate.promptText.trim().slice(0, 180) : '';
      if (!promptText) return null;
      return {
        type: 'quick_prompt',
        label: label || promptText,
        primary,
        autoExecute: false,
        promptText,
      };
    }
    case 'retry': {
      return {
        type: 'retry',
        label: label || 'إعادة المحاولة',
        primary: true,
        autoExecute: false,
      };
    }
    default:
      return null;
  }
}

export function validateGuideActions(rawActions: unknown): {
  validActions: SmartGuideAction[];
  rejectedCount: number;
} {
  if (!Array.isArray(rawActions)) return { validActions: [], rejectedCount: 0 };
  const validActions: SmartGuideAction[] = [];
  let rejectedCount = 0;
  for (const item of rawActions) {
    const validated = validateGuideAction(item);
    if (validated) validActions.push(validated);
    else rejectedCount += 1;
  }
  return { validActions, rejectedCount };
}

/**
 * Strips any accidental provider/key leakage from visitor-facing text.
 * Provider name & credentials must remain strictly server-side.
 */
export function sanitizeVisitorFacingText(text: string): string {
  return String(text || '')
    .replace(/\b(?:gemini(?:[\s-]?[\d.]+[\s-]?(?:flash|pro|lite))?|google\s*ai|openai|gpt-4o?)\b/gi, SMART_GUIDE_NAME)
    .replace(/المرشد (?:السياحي )?الذكي|المساعد الذكي/g, SMART_GUIDE_NAME)
    .replace(/GEMINI_API_KEY|GOOGLE_API_KEY|OPENAI_API_KEY/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
