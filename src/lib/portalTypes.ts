export type TripStyle = 'all' | 'family' | 'nature' | 'heritage';
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';
export type TravelProfileKey = 'domestic' | 'overseas' | 'gulf';
export type WalkingLevel = 'light' | 'moderate' | 'steep';
export type SupportRequestKind = 'reports' | 'feedback';
export type PortalInitialView = 'home' | 'faq' | 'invest' | SupportRequestKind;

export interface HoursVerification {
  openStartMin: number;
  openEndMin: number;
  label: string;
  source: string;
  verifiedAt: string;
}

export interface StopOperationalMeta {
  district: string;
  accessPoint: string;
  accessSource: string;
  walkingLevel: WalkingLevel;
  walkingLabel: string;
  familyFriendly: boolean;
  indoorOrCovered: boolean;
  facilities: string[];
  facilitiesSource: string;
  hoursVerified: HoursVerification | null;
  activeDays?: number[]; // JS getDay(): 0=Sun..6=Sat in Asia/Riyadh
  guideId?: string;
  qualifiedPlannable?: boolean;
}

export interface StopBase {
  id: string;
  name: string;
  region: string;
  tag: string;
  desc: string;
  types: Exclude<TripStyle, 'all'>[];
  min: number;
  lat: number;
  lng: number;
  image: string;
  photoAlt?: string;
  aliases?: string;
  operational?: StopOperationalMeta;
}

export interface ExpandedStop {
  id: string;
  region: string;
  county: string;
  name: string;
  tag: string;
  types: Exclude<TripStyle, 'all'>[];
  min: number;
  lat: number;
  lng: number;
  desc: string;
  aliases: string;
  best: string;
  source: string;
  mapSource: string;
}

export interface DestinationArea {
  id: string;
  region: string;
  name: string;
  ids: string[];
  image: string;
  tag: string;
}

export interface StationPhotoMeta {
  context?: boolean;
  caption: string;
  credit?: string;
  source?: string;
}

export interface MapRouteLeg {
  points: [number, number][];
  min: number;
  km: number;
}

export interface MapGeoData {
  width: number;
  height: number;
  stations: Record<string, [number, number]>;
  routes: Record<string, MapRouteLeg>;
}

export interface GuideCategory {
  id: string;
  label: string;
  icon: string;
  source?: string;
}

export interface GuideRecord {
  id: string;
  name: string;
  category: string;
  district: string;
  address: string;
  description?: string;
  lat?: number;
  lng?: number;
  coordinates?: [number, number];
  facts?: [string, string][];
  hours?: string;
  phone?: string;
  url?: string;
  source?: string;
  sourceLabel?: string;
  photo?: string;
  map?: string;
  accessMap?: string;
  trip?: string;
}

export interface IndexedGuideRecord extends GuideRecord {
  categoryLabel: string;
  searchBlob: string;
}

export interface TourGuideDataset {
  source: string;
  categories: GuideCategory[];
  records: GuideRecord[];
}

export interface PlaceNote {
  area: string;
  about: string;
  ideas: string[];
}

export interface ClimateCity {
  name: string;
  area: string;
  region: string;
  lat: number;
  lng: number;
  image: string;
  photo?: StationPhotoMeta;
  intro: string;
  climate?: string;
  tips?: Record<SeasonKey, string>;
  ids: string[];
  source: string;
}

export interface SeasonConfig {
  name: string;
  months: string;
  city: string;
  image: string;
  start: number;
}

export interface StopVisitConfig {
  city: string;
  walking: string;
  best: string;
  short: number;
  hours?: [number, number];
  hoursSource?: string;
  gallery: [string, string][];
}

export interface CityStory {
  id: string;
  kind: 'event' | 'archive';
  tag: string;
  title: string;
  date: string;
  dateLabel: string;
  dateContext: string;
  location: string;
  summary: string;
  details: string;
  alt: string;
  photoCaption: string;
  credit: string;
  source: string;
  reference?: string;
  stop?: string;
}

export interface ForecastHour {
  time: string;
  temp: number;
  code: number;
  rain: number;
}

export interface ForecastData {
  current: {
    time: string;
    temperature_2m: number;
    weather_code: number;
  };
  hours: ForecastHour[];
}

export interface TimingStation {
  id: string;
  day: number;
  start: number;
  end: number;
  drive_minutes?: number | null;
  drive_estimated?: boolean;
  drive_mode?: 'computed' | 'estimated' | 'unavailable';
  locked?: boolean;
  completed?: boolean;
  reason?: string;
}

export interface RouteTiming {
  season: SeasonKey;
  month: number | null;
  start: number;
  limit: number;
  locked: string | null;
  lockedIds?: string[];
  completedIds?: string[];
  visitDay?: number | null;
  visitDate?: string | null;
  startPoint?: string | null;
  returnByEnd?: number | null;
  returnDriveMinutes?: number | null;
  lessWalking?: boolean;
  stations: TimingStation[];
}

export interface TripPlan {
  days: string;
  region: string;
  style: TripStyle;
  ids: string[];
  timing: RouteTiming;
  assumptions?: string[];
  warnings?: string[];
}

export interface ScheduledStation {
  id: string;
  name: string;
  day: number;
  start: number;
  end: number;
  drive_minutes: number | null;
  drive_estimated: boolean;
  visit_minutes: number;
  latitude: number;
  longitude: number;
}

export interface ApprovedStation {
  id: string;
  name: string;
  day: number;
  starts_at: string;
  ends_at: string;
  drive_minutes: number | null;
  drive_estimated: boolean;
  visit_minutes: number;
  latitude: number;
  longitude: number;
}

export interface ApprovedTrip {
  schema_version: number;
  status: 'approved';
  approved_at: string;
  region: string;
  region_name: string;
  days: number;
  style: TripStyle;
  style_name: string;
  season: SeasonKey | null;
  timezone: string;
  stations: ApprovedStation[];
  unscheduled?: string[];
  visit_minutes: number;
  drive_minutes: number;
}

export interface MediaShowcaseItem {
  src: string;
  caption: string;
  alt: string;
}

export interface ConciergeContextState {
  days: string | null;
  style: TripStyle | null;
  region: string;
  pace: 'balanced' | 'relaxed';
  mode: 'plan' | 'discover' | null;
  place: string | null;
  activeStopId: string | null;
  activeGuideId: string | null;
  season: SeasonKey | null;
  month: number | null;
  visitDay: number | null;
  visitDateLabel: string | null;
  startPoint: string | null;
  start: number | null;
  budget: number | null;
  returnByEnd: number | null;
  focus: string | null;
  locked: string | null;
  lockedIds: string[];
  completedIds: string[];
  excludedIds?: string[];
  lastGuideItemId?: number | null;
  recentPlaceIds?: number[];
  pendingTrip?: {
    days: number | null;
    style: TripStyle | null;
    weather: boolean;
    wet: boolean;
    city: string | null;
    region: string | null;
    startPoint: string | null;
    visitDay: number | null;
    visitDateLabel: string | null;
    start: number | null;
    budget: number | null;
    returnByEnd: number | null;
    lessWalking: boolean;
  } | null;
  interests: string[];
  withChildren: boolean;
  lessWalking: boolean;
  hasUnsavedPreview: boolean;
  pendingClarification: 'day' | 'start' | null;
  pendingTopic: string | null;
  lastPlan: TripPlan | null;
  previousPlan: TripPlan | null;
}

export interface ConciergeAction {
  type:
    | 'intent'
    | 'preference'
    | 'retry'
    | 'section'
    | 'travel-source'
    | 'trip-pdf'
    | 'route-stop'
    | 'dock-map-stop'
    | 'dock-guide-place'
    | 'city'
    | 'preview-plan'
    | 'place'
    | 'guide-place'
    | 'guide-filter'
    | 'faq'
    | 'stop'
    | 'review-plan'
    | 'apply-plan'
    | 'lock-stop'
    | 'mark-visited'
    | 'replan-remaining';
  value?: unknown;
  label?: string;
}

export interface ConciergeItem {
  id?: string;
  guideId?: string;
  image?: string;
  action?: ConciergeAction;
  title: string;
  detail: string;
  time?: string;
  transfer?: string;
  reason?: string;
}

export interface ConciergeDockTarget {
  kind: 'map-stop' | 'guide-place' | 'preview-plan';
  stopId?: string;
  guideId?: string;
  isExploration?: boolean;
  missingCoordinates?: boolean;
  message?: string;
}

export interface ConciergeReply {
  text: string;
  speechText?: string;
  actions?: ConciergeAction[];
  items?: ConciergeItem[];
  context?: ConciergeContextState;
  plan?: TripPlan | null;
  sourceMode?: 'live' | 'demo';
  dockTarget?: ConciergeDockTarget;
  requestSeq?: number;
  delegateToDirectory?: boolean;
}

export interface HeroCue {
  start: number;
  title: string;
  lead: string;
}

export interface MapLibreMarkerInstance {
  setLngLat(lngLat: [number, number]): MapLibreMarkerInstance;
  addTo(map: MapLibreMapInstance): MapLibreMarkerInstance;
  remove(): void;
}

export interface MapLibreBoundsInstance {
  extend(lngLat: [number, number]): MapLibreBoundsInstance;
}

export interface MapLibreGeoJsonSource {
  setData(data: unknown): void;
}

export interface MapLibreMapInstance {
  touchZoomRotate: { disableRotation(): void };
  once(event: string, listener: () => void): void;
  on(event: string, listener: () => void): void;
  off(event: string, listener: () => void): void;
  addSource(id: string, source: unknown): void;
  addLayer(layer: unknown): void;
  getSource(id: string): MapLibreGeoJsonSource | undefined;
  queryRenderedFeatures(): Array<{ source?: string }>;
  areTilesLoaded(): boolean;
  getCanvas(): HTMLCanvasElement;
  getBounds(): { contains(lngLat: [number, number]): boolean };
  panTo(lngLat: [number, number], opts?: unknown): void;
  easeTo(opts: unknown): void;
  jumpTo(opts: unknown): void;
  fitBounds(bounds: MapLibreBoundsInstance, opts?: unknown): void;
  zoomIn(opts?: unknown): void;
  zoomOut(opts?: unknown): void;
  getZoom(): number;
  getMaxZoom(): number;
  getMinZoom(): number;
  project(lngLat: [number, number]): { x: number; y: number };
  resize(): void;
  remove(): void;
}

export interface MapLibreNamespace {
  Map: new (options: unknown) => MapLibreMapInstance;
  Marker: new (options: unknown) => MapLibreMarkerInstance;
  LngLatBounds: new () => MapLibreBoundsInstance;
}
