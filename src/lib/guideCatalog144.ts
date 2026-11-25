import rawGuide144 from '@/data/albaha_guide_144.json';
import {
  heroPhotos,
  images,
  places,
  tourGuide,
  tourGuideArtMap,
  tourGuideCategoryMedia,
} from './portalStaticData';
import type { GuideRecord } from './portalTypes';

export const NEUTRAL_PLACEHOLDER_IMAGE = '/media/guide-neutral.svg';

export type Guide144CategoryKey =
  | 'hotels_resorts'
  | 'restaurants_cafes'
  | 'forests_parks_waterfalls'
  | 'heritage_villages_museums'
  | 'souqs_shopping_entertainment'
  | 'farms_local_products'
  | 'travel_car_rentals';

export interface RawGuide144Link {
  label?: string | null;
  url?: string | null;
}

export interface RawGuide144Item {
  id: number;
  category_key: Guide144CategoryKey | string;
  category_ar: string;
  name: string;
  governorate: string;
  type?: string;
  rating?: number | null;
  reviews_count?: number | null;
  rating_raw?: string | null;
  price_range?: string | null;
  address?: string;
  description?: string;
  contact_and_booking?: string;
  links?: {
    official_website?: RawGuide144Link | null;
    booking_and_photos?: RawGuide144Link | null;
    official_or_social?: RawGuide144Link | null;
    social_or_source?: RawGuide144Link | null;
    source?: RawGuide144Link | null;
  };
}

export interface RawGuide144Dataset {
  metadata: {
    title: string;
    region?: string;
    total_entries?: number;
    generated_at?: string;
    source_spreadsheet_url?: string;
    categories_summary?: Array<{
      category_key: string;
      category_ar: string;
      count: number;
    }>;
  };
  items: RawGuide144Item[];
}

export interface GuidePhoneContact {
  display: string;
  telHref: string;
  digits: string;
  isMobile: boolean;
}

export interface GuideExternalLink {
  label: string;
  url: string;
}

export interface EnrichedGuide144Item {
  id: number;
  categoryKey: Guide144CategoryKey;
  categoryAr: string;
  name: string;
  governorate: string;
  governoratesNormalized: string[];
  type: string;
  rating: number | null;
  reviewsCount: number | null;
  ratingRaw: string | null;
  priceRange: string | null;
  address: string;
  description: string;
  shortDescription: string;
  contactAndBooking: string;
  phones: GuidePhoneContact[];
  whatsappUrl: string | null;
  officialWebsite: GuideExternalLink | null;
  bookingLink: GuideExternalLink | null;
  sourceLink: GuideExternalLink | null;
  stopId: string | null;
  tourGuideId: string | null;
  internalHref: string;
  hasDedicatedSitePage: boolean;
  image: string;
  imageIsFallback: boolean;
  coordinates: [number, number] | null;
  duplicateOf: number | null;
  searchNormName: string;
  searchBlob: string;
}

export interface GuideValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  itemId?: number;
  message: string;
}

export interface GuideValidationReport {
  valid: boolean;
  totalItems: number;
  errors: GuideValidationIssue[];
  warnings: GuideValidationIssue[];
  duplicatePairs: Array<{ primaryId: number; duplicateId: number; reason: string }>;
}

const VALID_CATEGORY_KEYS = new Set<string>([
  'hotels_resorts',
  'restaurants_cafes',
  'forests_parks_waterfalls',
  'heritage_villages_museums',
  'souqs_shopping_entertainment',
  'farms_local_products',
  'travel_car_rentals',
]);

/**
 * Normalizes Arabic and English text for tolerant search:
 * - Strips Arabic diacritics and tatweel
 * - Unifies alef, yaa, taa marbuta, hamza forms, Persian/Arabic numerals, and ڤ/پ
 * - Keeps Latin letters/digits lowercased so English names & abbreviations match
 */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[\u0640\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ڤ/g, 'ف')
    .replace(/پ/g, 'ب')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSafeHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isWhatsAppUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'wa.me' || host.endsWith('.whatsapp.com') || host === 'whatsapp.com';
  } catch {
    return false;
  }
}

const BOOKING_HOST_PATTERN =
  /(?:booking\.com|almosafer\.com|trip\.com|bookmystay\.io|iqamaplus\.com\.sa|iqamti\.com|gathern\.co|trivago\.com|all\.accor\.com|warwickhotels\.com|cloudcityhotels\.com|sakuracityhotel\.com|nationalparkgroup\.com|makamaya\.com|bestplacehotel\.com|rehabarkanalmajd\.com|abyat-stay-gold\.base44\.app)/i;

const NON_BOOKING_HOST_PATTERN =
  /(?:baha\.gov\.sa|visitsaudi\.com|youtube\.com|youtu\.be|bayut\.sa\/blog|rahhal\.wego\.com\/blog|saudipedia\.com|maps\.google\.com|goo\.gl\/maps)/i;

export function extractPhones(contactText: string): GuidePhoneContact[] {
  if (!contactText) return [];
  const matches = contactText.match(/(?:\+?966[-\s]?(?:5\d|1\d|9200|800)[-\s\d]{5,12})/g) || [];
  const seen = new Set<string>();
  const out: GuidePhoneContact[] = [];
  for (const raw of matches) {
    const cleanedDisplay = raw.trim().replace(/\s+/g, '-').replace(/-+$/, '');
    const digits = cleanedDisplay.replace(/\D/g, '');
    if (digits.length < 10 || seen.has(digits)) continue;
    seen.add(digits);
    const isUnifiedOrTollFree = digits.startsWith('9669200') || digits.startsWith('966800');
    const localDial = isUnifiedOrTollFree ? digits.slice(3) : `+${digits}`;
    out.push({
      display: cleanedDisplay,
      telHref: `tel:${localDial}`,
      digits,
      isMobile: digits.startsWith('9665'),
    });
  }
  return out;
}

/**
 * Extracts WhatsApp URL strictly when the source explicitly designates WhatsApp
 * either via a WhatsApp link or explicit "واتساب" text paired with an actual phone number.
 */
export function extractExplicitWhatsApp(
  item: RawGuide144Item,
  phones: GuidePhoneContact[]
): string | null {
  const linkCandidates = [
    item.links?.official_website?.url,
    item.links?.booking_and_photos?.url,
    item.links?.official_or_social?.url,
    item.links?.social_or_source?.url,
    item.links?.source?.url,
  ];
  for (const candidate of linkCandidates) {
    if (isSafeHttpUrl(candidate) && isWhatsAppUrl(candidate)) {
      return candidate.trim();
    }
  }

  const contactNorm = normalizeSearchText(item.contact_and_booking || '');
  const explicitlyMentionsWhatsApp = /واتساب|واتس اب|whatsapp/.test(contactNorm);
  if (!explicitlyMentionsWhatsApp || phones.length === 0) {
    return null;
  }

  const preferred = phones.find((p) => p.isMobile) || phones[0];
  return `https://wa.me/${preferred.digits}`;
}

function classifyLinks(item: RawGuide144Item): {
  officialWebsite: GuideExternalLink | null;
  bookingLink: GuideExternalLink | null;
  sourceLink: GuideExternalLink | null;
} {
  let officialWebsite: GuideExternalLink | null = null;
  let bookingLink: GuideExternalLink | null = null;
  let sourceLink: GuideExternalLink | null = null;

  const links = item.links || {};

  if (links.official_website && isSafeHttpUrl(links.official_website.url)) {
    const url = links.official_website.url.trim();
    if (!isWhatsAppUrl(url)) {
      officialWebsite = {
        label: links.official_website.label?.trim() || 'الموقع الرسمي',
        url,
      };
    }
  } else if (links.official_or_social && isSafeHttpUrl(links.official_or_social.url)) {
    const url = links.official_or_social.url.trim();
    if (!isWhatsAppUrl(url)) {
      officialWebsite = {
        label: links.official_or_social.label?.trim() || 'الصفحة الرسمية',
        url,
      };
    }
  }

  if (links.booking_and_photos && isSafeHttpUrl(links.booking_and_photos.url)) {
    const url = links.booking_and_photos.url.trim();
    const label = links.booking_and_photos.label?.trim() || 'رابط الحجز';
    if (!isWhatsAppUrl(url)) {
      const isBookingDomain = BOOKING_HOST_PATTERN.test(url) && !NON_BOOKING_HOST_PATTERN.test(url);
      const isBookingLabel =
        /حجز|الحجز|بوكينج|المسافر|جاذر|اقامه بلس|تريفاجو|bookmystay/i.test(label) &&
        !NON_BOOKING_HOST_PATTERN.test(url);
      if (isBookingDomain || isBookingLabel) {
        bookingLink = { label, url };
      } else if (!sourceLink) {
        sourceLink = { label, url };
      }
    }
  }

  const extraSources = [links.social_or_source, links.source];
  for (const src of extraSources) {
    if (!src || !isSafeHttpUrl(src.url)) continue;
    const url = src.url.trim();
    if (isWhatsAppUrl(url)) continue;
    const label = src.label?.trim() || 'المصدر';

    // For stores / car rentals / Dar Awdah official site stored under `source`, expose as official website when appropriate
    if (
      !officialWebsite &&
      !NON_BOOKING_HOST_PATTERN.test(url) &&
      !/(?:instagram\.com|maps\.google|goo\.gl)/i.test(url) &&
      (item.category_key === 'travel_car_rentals' ||
        item.category_key === 'farms_local_products' ||
        /الموقع الرسمي|الرابط الرسمي|متجر/i.test(label))
    ) {
      officialWebsite = { label, url };
      continue;
    }

    if (!sourceLink && url !== officialWebsite?.url && url !== bookingLink?.url) {
      sourceLink = { label, url };
    }
  }

  return { officialWebsite, bookingLink, sourceLink };
}

/**
 * Curated ID-based cross-references from `albaha_guide_144.json` numeric `id`
 * to actual website stops (`/place/<stopId>`), directory records (`/guide/place/<tourGuideId>`),
 * verified real destination photos, and verified coordinates.
 */
interface SiteAssetBinding {
  stopId?: string;
  tourGuideId?: string;
  realPhoto?: string;
  coordinates?: [number, number];
  aliases?: string[];
}

const SITE_ASSET_BINDINGS: Record<number, SiteAssetBinding> = {
  1: { tourGuideId: 'hotels-02', aliases: ['cloud city', 'كلاود سيتي', 'مدينة السحاب', 'مدينه السحاب'] },
  2: { tourGuideId: 'hotels-05', aliases: ['sakura', 'ساكورا', 'ساكورا سيتي'] },
  3: { aliases: ['high view', 'هاي فيو', 'ذا هاي فيو', 'هاي ڤيو'] },
  4: { aliases: ['qimam', '7 qimam', 'قمم بارك', 'قمم 7'] },
  5: { aliases: ['makamaya', 'ماكامايا', 'مكامايا'] },
  7: { aliases: ['abyat', 'ابيات', 'أبيات'] },
  8: { tourGuideId: 'hotels-01', aliases: ['الفاضل', 'شقق الفاضل'] },
  10: {
    tourGuideId: 'hotels-06',
    coordinates: [19.86, 41.56],
    aliases: ['national park', 'المنتزه الوطني', 'ناشونال بارك', 'سويس انترناشونال'],
  },
  11: { aliases: ['warwick', 'ورويك', 'وارويك'] },
  12: { tourGuideId: 'hotels-08', aliases: ['غيوم', 'فلل غيوم'] },
  13: { aliases: ['diyar home', 'ديار هوم'] },
  14: { aliases: ['mera', 'ميرا', 'مساكن ميرا'] },
  15: { aliases: ['best place', 'المكان الافضل', 'المكان الأفضل', 'بيست بليس', 'فندق العقيق'] },
  16: { aliases: ['دار عوضة', 'دار عوضه', 'الاطاولة', 'الأطاولة'] },
  17: {
    tourGuideId: 'gamra-resort',
    stopId: 'gamra-resort',
    coordinates: [20.0555526, 41.3967222],
    aliases: ['gamra', 'mantis', 'قمرة', 'قمره', 'منتجع قمرة', 'مانتس'],
  },
  19: { aliases: ['domes', 'دومز', 'الباحة دومز', 'قباب المندق'] },
  21: {
    stopId: 'shada',
    realPhoto: images.shada,
    aliases: ['كهوف شدا', 'منتجع الكهوف', 'شدا الاسفل', 'جبل شدا'],
  },
  27: { tourGuideId: 'farms-17', aliases: ['ريف الازهر', 'ريف الأزهر'] },
  28: { tourGuideId: 'chalets-13', aliases: ['blue sky', 'بلو سكاي', 'فلل العقيق'] },
  29: { aliases: ['ميرو', 'شاليهات ميرو', 'شاليه ميرو'] },
  30: { aliases: ['منتجع الريف', 'الريف بلجرشي'] },
  31: { tourGuideId: 'chalets-11', aliases: ['garden city', 'قاردن سيتي', 'جاردن سيتي', 'مدينة الحدائق'] },
  35: { tourGuideId: 'chalets-07', aliases: ['اكواخ سار', 'أكواخ سار'] },
  36: { aliases: ['the hills', 'ذا هيلز', 'هيلز الباحة'] },
  38: { aliases: ['jiblah', 'جبلة', 'جبله'] },
  41: { tourGuideId: 'restaurants-01', aliases: ['fifth season', 'فيفث سيزون', 'فيفت سيزون'] },
  42: { tourGuideId: 'restaurants-11', aliases: ['latino', 'لاتينو'] },
  45: { aliases: ['location', 'لوكيشن'] },
  46: { aliases: ['shrimp', 'crab', 'شرمب', 'كراب'] },
  47: { tourGuideId: 'cafes-17', aliases: ['culture', 'كولتشر', 'كالتشر'] },
  48: { tourGuideId: 'cafes-12', aliases: ['bocca', 'بوكا', 'بوكا دي كافيه'] },
  49: { aliases: ['bauru', 'باورو', 'باورو الغابة'] },
  50: { aliases: ['koon', 'كون', 'كون ارت'] },
  51: { aliases: ['calma', 'كالما'] },
  52: { aliases: ['labella', 'لابيلا'] },
  53: { aliases: ['hills', 'ذي هيلز', 'هيلز المندق'] },
  54: { aliases: ['soul', 'سول'] },
  57: { aliases: ['kaila', 'كيلة', 'كيله'] },
  58: { aliases: ['one bite', 'ون بايت'] },
  61: { tourGuideId: 'restaurants-02', aliases: ['البستان'] },
  62: { aliases: ['sixty', 'سكستي'] },
  63: { aliases: ['backyard', 'باك يارد'] },
  65: {
    tourGuideId: 'raghdan',
    stopId: 'raghdan',
    realPhoto: images.raghdan,
    coordinates: [20.0206063, 41.4327877],
    aliases: ['raghdan', 'رغدان', 'غابة رغدان', 'منتزه رغدان'],
  },
  66: {
    tourGuideId: 'khairah-forest-park',
    stopId: 'khairah-forest-park',
    realPhoto: heroPhotos.khairah?.wide || images.khair,
    coordinates: [20.0522376, 41.3977182],
    aliases: ['خيرة', 'خيره', 'شلال جدر', 'قرية جدر', 'غابة خيرة'],
  },
  67: {
    realPhoto: images.khair,
    aliases: ['وادي جدر', 'شلال جدر', 'خيرة'],
  },
  68: {
    tourGuideId: 'khairah-forest-park',
    stopId: 'khairah-forest-park',
    realPhoto: images.khair,
    coordinates: [20.0522376, 41.3977182],
    aliases: ['شلال جدر', 'غابة خيرة', 'خيرة', 'خيره'],
  },
  69: {
    tourGuideId: 'shahbah',
    stopId: 'shahbah',
    coordinates: [20.050882, 41.4740586],
    aliases: ['شهبة', 'شهبه', 'غابة شهبة'],
  },
  72: {
    stopId: 'shada',
    realPhoto: images.shada,
    aliases: ['shada', 'شدا', 'شدى', 'جبل شدا', 'شدا الاعلى'],
  },
  73: {
    tourGuideId: 'hussam',
    stopId: 'hussam',
    realPhoto: images.hussam,
    coordinates: [20.012892, 41.450364],
    aliases: ['hussam', 'الامير حسام', 'الأمير حسام', 'منتزه حسام', 'حديقة حسام'],
  },
  74: {
    tourGuideId: 'shahbah',
    stopId: 'shahbah',
    coordinates: [20.050882, 41.4740586],
    aliases: ['حديقة الحسام', 'حديقة شهبة'],
  },
  75: {
    tourGuideId: 'mohammed-bin-saud-park',
    stopId: 'mohammed-bin-saud-park',
    coordinates: [20.0189178, 41.4427019],
    aliases: ['الامير محمد بن سعود', 'محمد بن سعود'],
  },
  76: {
    stopId: 'mishari',
    realPhoto: images.mishari,
    coordinates: [20.0535, 41.40019],
    aliases: ['mishari', 'مشاري', 'الامير مشاري', 'الأمير مشاري'],
  },
  77: {
    tourGuideId: 'khulb',
    stopId: 'khulb',
    realPhoto: images.khulb,
    coordinates: [20.17887, 41.26408],
    aliases: ['khulb', 'الخلب', 'منتزه الخلب', 'متنزه الخلب'],
  },
  78: {
    stopId: 'tharwa',
    realPhoto: images.tharwa,
    coordinates: [20.16806, 41.38806],
    aliases: ['tharwa', 'الثروة', 'الثروه', 'منتزه الثروة'],
  },
  85: { tourGuideId: 'water-07' },
  87: { tourGuideId: 'parks-08' },
  91: { tourGuideId: 'water-12' },
  92: { tourGuideId: 'water-03' },
  95: {
    tourGuideId: 'habashi',
    stopId: 'habashi',
    coordinates: [20.0432294, 41.4571911],
    aliases: ['الحبشي', 'منتزه الحبشي', 'حديقة الحبشي'],
  },
  96: { tourGuideId: 'parks-07' },
  99: {
    tourGuideId: 'mohammed-bin-saud-park',
    stopId: 'mohammed-bin-saud-park',
    coordinates: [20.0189178, 41.4427019],
  },
  100: {
    tourGuideId: 'dhee-ain',
    stopId: 'ain',
    realPhoto: images.ain,
    coordinates: [19.9311047, 41.4424626],
    aliases: ['dhee ain', 'thee ain', 'ذي عين', 'ذى عين', 'ذي العين', 'قرية ذي عين', 'القرية الرخامية'],
  },
  101: { tourGuideId: 'g-101', aliases: ['قلعة الملد', 'حصنا التوأمين', 'حصنا الملد'] },
  103: { aliases: ['الاطاولة', 'الأطاولة', 'الاطاوله'] },
  104: { aliases: ['دار عوضة', 'دار عوضه', 'الاطاولة', 'الأطاولة'] },
  105: { tourGuideId: 'farms-11', aliases: ['الاطلال', 'الأطلال'] },
  108: {
    stopId: 'khalif',
    realPhoto: images.khalif,
    coordinates: [19.96935, 41.2261],
    aliases: ['الخليف', 'قرية الخليف'],
  },
  109: {
    stopId: 'khalif',
    realPhoto: images.khalif,
    coordinates: [19.96935, 41.2261],
    aliases: ['الخلف', 'قرية الخلف'],
  },
  111: { tourGuideId: 'museums-08', aliases: ['متحف العمدة', 'متحف العمده'] },
  112: { tourGuideId: 'heritage-02', aliases: ['بخروش', 'قلعة بخروش'] },
  113: { tourGuideId: 'museums-05', aliases: ['ابن مصبح', 'محمد بن مصبح'] },
  114: { tourGuideId: 'museums-10', aliases: ['بني جرة', 'بني جره'] },
  118: {
    tourGuideId: 'saturday-market',
    stopId: 'baljurashi-center',
    realPhoto: images['baljurashi-center'],
    coordinates: [19.85944, 41.55722],
    aliases: ['سوق السبت', 'بلجرشي'],
  },
  121: { tourGuideId: 'malls-01', aliases: ['الباحة مول', 'مول الباحة'] },
  122: { tourGuideId: 'malls-02', aliases: ['الغنيم', 'الغنيم مول'] },
  123: { aliases: ['baha sky', 'باحة سكاي'] },
  126: { tourGuideId: 'farms-14', aliases: ['فال العز', 'فروسية', 'خيل'] },
  127: { tourGuideId: 'almond-farm', aliases: ['بساتين اللوز', 'مزرعة اللوز'] },
  131: { tourGuideId: 'farms-02', aliases: ['مزرعة العمر'] },
  132: { tourGuideId: 'farms-12', aliases: ['مزرعة أرياف', 'مزرعة ارياف'] },
  135: { tourGuideId: 'farms-07', aliases: ['مزرعة الوالدين'] },
  140: {
    realPhoto: images['aqiq-center'],
    aliases: ['abt', 'airport', 'مطار الباحة', 'مطار العقيق', 'مطار الملك سعود'],
  },
  141: { aliases: ['theeb', 'ذيب', 'تأجير سيارات'] },
  142: { aliases: ['yelo', 'يلو', 'الوفاق', 'تأجير سيارات'] },
  143: { aliases: ['lumi', 'لومي', 'تأجير سيارات'] },
  144: { aliases: ['budget', 'بدجت', 'تأجير سيارات'] },
};

const tourGuideById = new Map<string, GuideRecord>(
  tourGuide.records.map((rec) => [rec.id, rec])
);

function resolveSiteThumbnail(
  item: RawGuide144Item,
  binding: SiteAssetBinding | undefined,
  tgRec: GuideRecord | undefined
): { image: string; isFallback: boolean } {
  if (binding?.realPhoto) {
    return { image: binding.realPhoto, isFallback: false };
  }
  if (binding?.stopId && places.has(binding.stopId)) {
    const stop = places.get(binding.stopId)!;
    const stopImg = images[stop.image];
    if (stopImg) return { image: stopImg, isFallback: false };
  }
  if (tgRec?.photo && images[tgRec.photo]) {
    return { image: images[tgRec.photo], isFallback: false };
  }
  // If linked to an existing website tourGuide record, reuse its existing site thumbnail art
  if (tgRec) {
    const pool = tourGuideCategoryMedia[tgRec.category] || tourGuideCategoryMedia.parks;
    const idx = Number(tgRec.id.match(/-(\d+)$/)?.[1] || item.id);
    const key = pool[pool.length ? idx % pool.length : 0];
    const art = tourGuideArtMap[key] || images[key];
    if (art) return { image: art, isFallback: true };
  }
  // Neutral fallback image when destination has no dedicated site photo
  return { image: NEUTRAL_PLACEHOLDER_IMAGE, isFallback: true };
}

function makeShortDescription(item: RawGuide144Item): string {
  const raw = (item.description || item.type || '').trim();
  if (!raw) return `${item.governorate} · ${item.type || item.category_ar}`;
  const firstSentence = raw.split(/[.؛\n]/)[0].trim();
  if (firstSentence.length <= 92) return firstSentence;
  return `${firstSentence.slice(0, 89).replace(/\s+\S*$/, '')}…`;
}

function parseGovernorates(gov: string): string[] {
  const parts = gov
    .split(/[/،,()]+/)
    .map((p) => normalizeSearchText(p))
    .filter((p) => p.length >= 2);
  const expanded = new Set(parts);
  for (const p of parts) {
    if (p.includes('مدينه الباحه') || p === 'الباحه') {
      expanded.add('مدينه الباحه');
      expanded.add('الباحه');
    }
    if (p.includes('شدا')) expanded.add('المخواه');
    if (p.includes('بني عمر')) expanded.add('المندق');
  }
  return [...expanded];
}

/**
 * Validates any raw JSON dataset before activation.
 * Hard errors prevent activation (caller keeps last valid version).
 * Warnings flag missing optional fields, unverified links, and potential duplicates.
 */
export function validateGuide144Dataset(raw: unknown): GuideValidationReport {
  const errors: GuideValidationIssue[] = [];
  const warnings: GuideValidationIssue[] = [];
  const duplicatePairs: Array<{ primaryId: number; duplicateId: number; reason: string }> = [];

  if (!raw || typeof raw !== 'object') {
    errors.push({ severity: 'error', code: 'INVALID_ROOT', message: 'ملف البيانات ليس كائن JSON صالحاً.' });
    return { valid: false, totalItems: 0, errors, warnings, duplicatePairs };
  }

  const ds = raw as Partial<RawGuide144Dataset>;
  if (!Array.isArray(ds.items) || ds.items.length === 0) {
    errors.push({ severity: 'error', code: 'EMPTY_ITEMS', message: 'قائمة العناصر (items) فارغة أو مفقودة.' });
    return { valid: false, totalItems: 0, errors, warnings, duplicatePairs };
  }

  const seenIds = new Set<number>();
  const byNameGov = new Map<string, number>();
  const byPhone = new Map<string, number>();

  for (const item of ds.items) {
    if (!item || typeof item !== 'object') {
      errors.push({ severity: 'error', code: 'INVALID_ITEM', message: 'عنصر غير صالح داخل القائمة.' });
      continue;
    }
    if (!Number.isInteger(item.id) || item.id <= 0) {
      errors.push({
        severity: 'error',
        code: 'INVALID_ID',
        message: `معرّف غير صالح للعنصر: ${String(item.name || 'غير معروف')}`,
      });
      continue;
    }
    if (seenIds.has(item.id)) {
      errors.push({
        severity: 'error',
        code: 'DUPLICATE_ID',
        itemId: item.id,
        message: `تكرار في المعرّف id=${item.id}`,
      });
      continue;
    }
    seenIds.add(item.id);

    if (!item.name || !String(item.name).trim()) {
      errors.push({ severity: 'error', code: 'MISSING_NAME', itemId: item.id, message: `الاسم مفقود للسجل ${item.id}` });
    }
    if (!item.category_key || !VALID_CATEGORY_KEYS.has(item.category_key)) {
      errors.push({
        severity: 'error',
        code: 'INVALID_CATEGORY',
        itemId: item.id,
        message: `تصنيف غير معتمد (${String(item.category_key)}) للسجل ${item.id}`,
      });
    }
    if (!item.governorate || !String(item.governorate).trim()) {
      errors.push({
        severity: 'error',
        code: 'MISSING_GOVERNORATE',
        itemId: item.id,
        message: `المحافظة مفقودة للسجل ${item.id}`,
      });
    }
    if (!item.description || !String(item.description).trim()) {
      warnings.push({ severity: 'warning', code: 'MISSING_DESCRIPTION', itemId: item.id, message: `الوصف ناقص للسجل ${item.id}` });
    }
    if (!item.address || !String(item.address).trim()) {
      warnings.push({ severity: 'warning', code: 'MISSING_ADDRESS', itemId: item.id, message: `العنوان ناقص للسجل ${item.id}` });
    }

    // Check URLs
    const allLinks = Object.entries(item.links || {});
    for (const [linkKey, linkObj] of allLinks) {
      if (linkObj && linkObj.url !== null && linkObj.url !== undefined && linkObj.url !== '') {
        if (!isSafeHttpUrl(linkObj.url)) {
          warnings.push({
            severity: 'warning',
            code: 'INVALID_URL',
            itemId: item.id,
            message: `رابط غير صالح في ${linkKey} للسجل ${item.id}: ${String(linkObj.url)}`,
          });
        }
      }
    }

    // Check potential duplicates by normalized name + governorate
    const baseName = normalizeSearchText(String(item.name || '').replace(/\([^)]*\)/g, ''));
    const govNorm = normalizeSearchText(item.governorate || '');
    const nameGovKey = `${baseName}::${govNorm}`;
    if (baseName.length >= 4 && byNameGov.has(nameGovKey)) {
      const primaryId = byNameGov.get(nameGovKey)!;
      duplicatePairs.push({
        primaryId,
        duplicateId: item.id,
        reason: `تطابق الاسم والمحافظة (${item.name} — ${item.governorate})`,
      });
      warnings.push({
        severity: 'warning',
        code: 'POTENTIAL_DUPLICATE_NAME',
        itemId: item.id,
        message: `سجل محتمل تكراره مع id=${primaryId}: ${item.name} (${item.governorate})`,
      });
    } else if (baseName.length >= 4) {
      byNameGov.set(nameGovKey, item.id);
    }

    // Check shared phone numbers across records
    const phones = extractPhones(item.contact_and_booking || '');
    for (const ph of phones) {
      if (byPhone.has(ph.digits)) {
        const primaryId = byPhone.get(ph.digits)!;
        if (!duplicatePairs.some((p) => p.primaryId === primaryId && p.duplicateId === item.id)) {
          duplicatePairs.push({
            primaryId,
            duplicateId: item.id,
            reason: `نفس رقم الهاتف (${ph.display})`,
          });
          warnings.push({
            severity: 'warning',
            code: 'SHARED_PHONE',
            itemId: item.id,
            message: `رقم هاتف مشترك (${ph.display}) بين السجل ${primaryId} والسجل ${item.id}`,
          });
        }
      } else {
        byPhone.set(ph.digits, item.id);
      }
    }
  }

  return {
    valid: errors.length === 0,
    totalItems: ds.items.length,
    errors,
    warnings,
    duplicatePairs,
  };
}

function buildEnrichedCatalog(dataset: RawGuide144Dataset): {
  items: EnrichedGuide144Item[];
  byId: Map<number, EnrichedGuide144Item>;
  byStopId: Map<string, EnrichedGuide144Item>;
  byTourGuideId: Map<string, EnrichedGuide144Item>;
  report: GuideValidationReport;
} {
  const report = validateGuide144Dataset(dataset);
  const exactDuplicateMap = new Map<number, number>();
  for (const pair of report.duplicatePairs) {
    if (pair.reason.startsWith('تطابق الاسم والمحافظة')) {
      exactDuplicateMap.set(pair.duplicateId, pair.primaryId);
    }
  }

  const items: EnrichedGuide144Item[] = dataset.items.map((item) => {
    const binding = SITE_ASSET_BINDINGS[item.id];
    const tgRec = binding?.tourGuideId ? tourGuideById.get(binding.tourGuideId) : undefined;
    const stopRec = binding?.stopId ? places.get(binding.stopId) : undefined;

    const phones = extractPhones(item.contact_and_booking || '');
    const whatsappUrl = extractExplicitWhatsApp(item, phones);
    const { officialWebsite, bookingLink, sourceLink } = classifyLinks(item);
    const { image, isFallback } = resolveSiteThumbnail(item, binding, tgRec);

    const coordinates: [number, number] | null =
      binding?.coordinates ||
      (stopRec ? [stopRec.lat, stopRec.lng] : null) ||
      (tgRec?.coordinates ? [tgRec.coordinates[0], tgRec.coordinates[1]] : null);

    const internalHref = stopRec
      ? `/place/${stopRec.id}`
      : tgRec
        ? `/guide/place/${tgRec.id}`
        : `/guide/place/g-${item.id}`;

    const searchNormName = normalizeSearchText(item.name);
    const aliasText = (binding?.aliases || []).join(' ');
    const searchBlob = normalizeSearchText(
      [
        item.name,
        aliasText,
        item.governorate,
        item.type || '',
        item.category_ar,
        item.address || '',
        item.description || '',
      ].join(' ')
    );

    return {
      id: item.id,
      categoryKey: (VALID_CATEGORY_KEYS.has(item.category_key)
        ? item.category_key
        : 'forests_parks_waterfalls') as Guide144CategoryKey,
      categoryAr: item.category_ar || '',
      name: item.name,
      governorate: item.governorate,
      governoratesNormalized: parseGovernorates(item.governorate),
      type: item.type || item.category_ar || '',
      rating: typeof item.rating === 'number' ? item.rating : null,
      reviewsCount: typeof item.reviews_count === 'number' ? item.reviews_count : null,
      ratingRaw: item.rating_raw || null,
      priceRange: item.price_range || null,
      address: item.address || '',
      description: item.description || '',
      shortDescription: makeShortDescription(item),
      contactAndBooking: item.contact_and_booking || '',
      phones,
      whatsappUrl,
      officialWebsite,
      bookingLink,
      sourceLink,
      stopId: stopRec?.id || null,
      tourGuideId: tgRec?.id || null,
      internalHref,
      hasDedicatedSitePage: Boolean(stopRec || tgRec),
      image,
      imageIsFallback: isFallback,
      coordinates,
      duplicateOf: exactDuplicateMap.get(item.id) ?? null,
      searchNormName,
      searchBlob,
    };
  });

  const byId = new Map<number, EnrichedGuide144Item>();
  const byStopId = new Map<string, EnrichedGuide144Item>();
  const byTourGuideId = new Map<string, EnrichedGuide144Item>();
  for (const item of items) {
    byId.set(item.id, item);
    if (item.stopId && !byStopId.has(item.stopId)) byStopId.set(item.stopId, item);
    if (item.tourGuideId && !byTourGuideId.has(item.tourGuideId)) byTourGuideId.set(item.tourGuideId, item);
  }

  return { items, byId, byStopId, byTourGuideId, report };
}

let activeCatalog = buildEnrichedCatalog(rawGuide144 as RawGuide144Dataset);

/**
 * Safely activates an updated JSON dataset in memory; if validation fails,
 * preserves the last valid active catalog without disruption.
 */
export function tryActivateGuideDataset(candidate: unknown): {
  activated: boolean;
  report: GuideValidationReport;
} {
  const report = validateGuide144Dataset(candidate);
  if (!report.valid) {
    return { activated: false, report };
  }
  activeCatalog = buildEnrichedCatalog(candidate as RawGuide144Dataset);
  return { activated: true, report };
}

export function getGuide144Items(): EnrichedGuide144Item[] {
  return activeCatalog.items;
}

export function getGuide144ById(id: number): EnrichedGuide144Item | undefined {
  return activeCatalog.byId.get(id);
}

export function getGuide144ByStopId(stopId: string): EnrichedGuide144Item | undefined {
  return activeCatalog.byStopId.get(stopId);
}

export function getGuide144ByTourGuideId(tourGuideId: string): EnrichedGuide144Item | undefined {
  return activeCatalog.byTourGuideId.get(tourGuideId);
}

export function getGuide144ValidationReport(): GuideValidationReport {
  return activeCatalog.report;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export const GOVERNORATE_PATTERNS: Array<{ canonical: string; regionKey: string; pattern: RegExp }> = [
  { canonical: 'العقيق', regionKey: 'aqiq', pattern: /(?:^|\s)(?:ال)?عقيق(?:\s|$)|مطار الملك سعود|مطار الباحه|المطار/ },
  { canonical: 'بلجرشي', regionKey: 'baljurashi', pattern: /(?:^|\s)(?:بلجرشي|بالجرشي|بلقرشي)(?:\s|$)|بني كبير|بالشهم/ },
  { canonical: 'المندق', regionKey: 'mandaq', pattern: /(?:^|\s)(?:ال)?مندق(?:\s|$)|الخلب|وادي ضرك/ },
  { canonical: 'المخواة', regionKey: 'south', pattern: /(?:^|\s)(?:ال)?مخواه(?:\s|$)|ذي عين|ذي العين|جبل شدا|شدا الاسفل|شدا الاعلي/ },
  { canonical: 'القرى', regionKey: 'qura', pattern: /(?:^|\s)محافظه القري|في القري|الاطاوله|وادي بيده|بيده|بخروش/ },
  { canonical: 'بني حسن', regionKey: 'bani-hassan', pattern: /بني حسن|غابه خيره|قرن ظبي|شلال جدر|قريه جدر/ },
  { canonical: 'قلوة', regionKey: 'qilwah', pattern: /(?:^|\s)قلوه(?:\s|$)|الخليف|الخلف/ },
  { canonical: 'غامد الزناد', regionKey: 'ghamid', pattern: /غامد الزناد|قريه الدهنه/ },
  { canonical: 'مدينة الباحة', regionKey: 'city', pattern: /مدينه الباحه|وسط الباحه|قلب الباحه|داخل الباحه|حي الباهر|حي شهبه|بني سار|رغدان|الامير حسام|الملد|الظفير|حي النزهه/ },
];

export function detectGovernorate(normalizedQuery: string): { canonical: string; regionKey: string } | null {
  for (const entry of GOVERNORATE_PATTERNS) {
    if (entry.pattern.test(normalizedQuery)) {
      return { canonical: entry.canonical, regionKey: entry.regionKey };
    }
  }
  return null;
}

export interface DetectedCategoryIntent {
  categoryKey: Guide144CategoryKey;
  subType?: 'cafe' | 'restaurant' | 'hotel' | 'chalet' | 'museum' | 'village' | 'car_rental' | 'honey' | 'farm';
  labelAr: string;
}

export function detectCategoryIntent(normalizedQuery: string): DetectedCategoryIntent | null {
  if (/تا?جير سيار|سياره|سيارات|ذيب|يلو|لومي|بدجت|مطار/.test(normalizedQuery)) {
    return {
      categoryKey: 'travel_car_rentals',
      subType: /سيار|ذيب|يلو|لومي|بدجت/.test(normalizedQuery) ? 'car_rental' : undefined,
      labelAr: 'السفر وتأجير السيارات',
    };
  }
  if (/كافيه|كوفي|مقهي|مقاهي|قهوه مختصه|قهاوي|لاتيه|اسبريسو/.test(normalizedQuery)) {
    return { categoryKey: 'restaurants_cafes', subType: 'cafe', labelAr: 'المقاهي' };
  }
  if (/مطعم|مطاعم|اكل|غدا|عشا|فطور|مندي|حنيذ|شعبي|مشويات|برجر|بحري|اسماك|دغابيس|عصيده|عريكه/.test(normalizedQuery)) {
    return { categoryKey: 'restaurants_cafes', subType: 'restaurant', labelAr: 'المطاعم' };
  }
  if (/شاليه|شاليهات|كوخ|اكواخ|فيلا|فلل|منتجع|منتجعات|كهف|كهوف|تخييم|كرفان|قباب/.test(normalizedQuery)) {
    return { categoryKey: 'hotels_resorts', subType: 'chalet', labelAr: 'المنتجعات والشاليهات والأكواخ' };
  }
  if (/ابيت|نبيت|مبيت|اسكن|سكن|فندق|فنادق|اقامه|نزل|شقق|انام|بات|نوم/.test(normalizedQuery)) {
    return { categoryKey: 'hotels_resorts', subType: 'hotel', labelAr: 'الفنادق وأماكن المبيت' };
  }
  if (/متحف|متاحف|اثار|مقتنيات/.test(normalizedQuery)) {
    return { categoryKey: 'heritage_villages_museums', subType: 'museum', labelAr: 'المتاحف' };
  }
  if (/قريه تراثيه|قري تراثيه|تراث|قلعه|حصن|اثريه|تاريخ/.test(normalizedQuery)) {
    return { categoryKey: 'heritage_villages_museums', subType: 'village', labelAr: 'القرى التراثية والقلاع' };
  }
  if (/غابه|غابات|منتزه|منتزهات|متنزه|متنزهات|حديقه|حدائق|شلال|شلالات|وادي|اوديه|سد|سدود|جبل|طبيع/.test(normalizedQuery)) {
    return { categoryKey: 'forests_parks_waterfalls', labelAr: 'الغابات والمنتزهات والشلالات' };
  }
  if (/عسل|مناحل|نحل/.test(normalizedQuery)) {
    return { categoryKey: 'farms_local_products', subType: 'honey', labelAr: 'العسل والمناحل المحلية' };
  }
  if (/مزرع|مزارع|رمان|فواكه|عنب|لوز|بن شدوي|ريف/.test(normalizedQuery)) {
    return { categoryKey: 'farms_local_products', subType: 'farm', labelAr: 'المزارع والمنتجات المحلية' };
  }
  if (/سوق|اسواق|مول|مولات|تسوق|ترفيه|العاب|تزلج|ترامبولين|فروسيه|خيل|بوليفارد/.test(normalizedQuery)) {
    return { categoryKey: 'souqs_shopping_entertainment', labelAr: 'الأسواق والتسوق والترفيه' };
  }
  return null;
}

const QUERY_STOPWORDS = new Set([
  'وش', 'ايش', 'شو', 'ما', 'من', 'في', 'عن', 'علي', 'الي', 'او', 'و', 'مع', 'لي', 'لنا', 'لك',
  'ابي', 'ابغي', 'ابغا', 'اريد', 'ودي', 'عايز', 'عاوز', 'محتاج', 'ممكن', 'عطني', 'اعطني',
  'اقترح', 'رشح', 'افضل', 'احسن', 'اجمل', 'كويس', 'زين', 'حلو', 'جميل', 'قريب', 'اقرب',
  'وين', 'فين', 'اين', 'كيف', 'متي', 'كم', 'هل', 'انا', 'نحن', 'عندك', 'عندكم', 'فيه', 'فيها',
  'اقدر', 'يمديني', 'معلومات', 'تفاصيل', 'عنها', 'عنه', 'سعر', 'اسعار', 'بكم', 'توفر', 'متاح',
  'حجز', 'احجز', 'رقم', 'هاتف', 'جوال', 'واتساب', 'موقع', 'عنوان', 'الباحه', 'منطقه', 'محافظه',
  'افتح', 'ودني', 'خذني', 'انقلني', 'ورني', 'اعرض', 'صفحه', 'مكان', 'اماكن',
  'ابيت', 'نبيت', 'مبيت', 'اسكن', 'سكن', 'انام', 'نوم', 'اقامه', 'اتعشى', 'اتغدى', 'افطر', 'اتقهوى',
]);

function stripArabicAl(token: string): string {
  return token.length >= 4 && token.startsWith('ال') ? token.slice(2) : token;
}

const GENERIC_NAME_STEMS = new Set(
  [
    'فندق', 'فنادق', 'منتجع', 'منتجعات', 'شاليه', 'شاليهات', 'شقق', 'مطعم', 'مطاعم',
    'مقهي', 'مقاهي', 'كافيه', 'كوفي', 'حديقه', 'حدائق', 'منتزه', 'منتزهات', 'متنزه', 'متنزهات',
    'قريه', 'قري', 'متحف', 'متاحف', 'مزرعه', 'مزارع', 'سوق', 'اسواق', 'مول', 'مطار',
    'الباحه', 'بلجرشي', 'المندق', 'العقيق', 'المخواه', 'القري', 'قلوه', 'الحجره', 'غامد', 'الزناد',
    'بني', 'حسن', 'شركه', 'للخدمات', 'الفندقيه', 'المخدومه', 'المفروشه', 'التراثيه',
    'السياحيه', 'الوطني', 'الريفيه', 'لتاجير', 'السيارات', 'الامير', 'الشيخ',
    'وادي', 'سد', 'غابه', 'شلال', 'محافظه', 'مدينه', 'تراثي', 'اقليمي', 'نزل', 'فلل', 'اكواخ',
  ].map(stripArabicAl)
);

export interface Guide144SearchOptions {
  query: string;
  governorate?: string | null;
  categoryKey?: Guide144CategoryKey | null;
  subType?: DetectedCategoryIntent['subType'];
  limit?: number;
  userLocation?: { lat: number; lng: number } | null;
  includeDuplicates?: boolean;
}

export interface Guide144SearchMatch {
  item: EnrichedGuide144Item;
  score: number;
  nameMatchStrength: 'exact' | 'strong' | 'partial' | 'category';
  distanceKm: number | null;
}

export interface Guide144SearchResult {
  matches: Guide144SearchMatch[];
  exactMatch: EnrichedGuide144Item | null;
  ambiguousMatches: EnrichedGuide144Item[];
  sortedByDistance: boolean;
}

function matchesGovernorate(item: EnrichedGuide144Item, canonicalGov: string): boolean {
  const target = normalizeSearchText(canonicalGov);
  if (item.governoratesNormalized.includes(target)) return true;
  if (target === 'مدينه الباحه' && item.governoratesNormalized.includes('الباحه')) return true;
  return normalizeSearchText(item.governorate).includes(target);
}

function matchesSubType(item: EnrichedGuide144Item, subType: DetectedCategoryIntent['subType']): boolean {
  if (!subType) return true;
  const typeNorm = normalizeSearchText(`${item.type} ${item.name}`);
  switch (subType) {
    case 'cafe':
      return /مقهي|كافيه|كوفي|قهوه|cafe|coffee|دكه/.test(typeNorm);
    case 'restaurant':
      return /مطعم|مطبخ|برجر|بشاميلا|مشويات|مندي|حنيذ|اسماك|restaurant|burger/.test(typeNorm);
    case 'chalet':
      return /شاليه|منتجع|فيلا|فلل|كوخ|اكواخ|كهف|كهوف|قباب|كرفان|مزرعه|نزل/.test(typeNorm);
    case 'hotel':
      return true; // Any stay in hotels_resorts works when asking where to stay/sleep
    case 'museum':
      return /متحف|قلعه/.test(typeNorm);
    case 'village':
      return /قريه|قلعه|دار/.test(typeNorm);
    case 'car_rental':
      return /سيار|ذيب|يلو|لومي|بدجت/.test(typeNorm);
    case 'honey':
      return /عسل|مناحل/.test(typeNorm);
    case 'farm':
      return /مزرع|بساتين|رمان|عنب|بن/.test(typeNorm);
    default:
      return true;
  }
}

export function searchGuide144(options: Guide144SearchOptions): Guide144SearchResult {
  const normQ = normalizeSearchText(options.query);
  const rawTokens = normQ.split(' ').filter((t) => t.length >= 2 && !QUERY_STOPWORDS.has(t));
  const stemTokens = rawTokens.map(stripArabicAl).filter((t) => t.length >= 2);
  const govFilter = options.governorate || null;
  const catFilter = options.categoryKey || null;
  const limit = options.limit ?? 5;

  const baseItems = getGuide144Items().filter(
    (item) => options.includeDuplicates || item.duplicateOf === null
  );

  // 1) Check direct / strong name match across the whole catalog first
  const nameScored: Array<{ item: EnrichedGuide144Item; score: number; strength: 'exact' | 'strong' | 'partial' }> = [];

  for (const item of baseItems) {
    const cleanArName = normalizeSearchText(item.name.replace(/\([^)]*\)/g, ''));
    const engMatch = item.name.match(/\(([^)]+)\)/);
    const cleanEngName = engMatch ? normalizeSearchText(engMatch[1]) : '';
    const binding = SITE_ASSET_BINDINGS[item.id];
    const aliases = (binding?.aliases || []).map(normalizeSearchText).filter(Boolean);

    let score = 0;
    let strength: 'exact' | 'strong' | 'partial' = 'partial';

    if (cleanArName.length >= 4 && normQ.includes(cleanArName)) {
      score += 120 + cleanArName.length;
      strength = 'exact';
    } else if (cleanEngName.length >= 4 && normQ.includes(cleanEngName)) {
      score += 115 + cleanEngName.length;
      strength = 'exact';
    } else if (aliases.some((al) => al.length >= 4 && normQ.includes(al))) {
      const hitAlias = aliases.find((al) => al.length >= 4 && normQ.includes(al))!;
      score += 100 + hitAlias.length;
      strength = hitAlias.length >= 6 ? 'exact' : 'strong';
    } else if (stemTokens.length > 0) {
      const nameWords = normalizeSearchText(`${cleanArName} ${cleanEngName} ${aliases.join(' ')}`)
        .split(' ')
        .map(stripArabicAl)
        .filter((w) => w.length >= 2);
      const distinctiveNameWords = nameWords.filter((w) => !GENERIC_NAME_STEMS.has(w));
      const distinctiveQueryTokens = stemTokens.filter((t) => !GENERIC_NAME_STEMS.has(t));

      let distinctiveHits = 0;
      let totalNameHits = 0;
      for (const tok of distinctiveQueryTokens) {
        if (distinctiveNameWords.some((w) => w === tok || (tok.length >= 4 && w.includes(tok)))) {
          distinctiveHits += 1;
          totalNameHits += 1;
        } else if (nameWords.some((w) => w === tok)) {
          totalNameHits += 1;
        }
      }

      if (distinctiveHits > 0) {
        score += distinctiveHits * 35 + totalNameHits * 8;
        if (distinctiveHits >= Math.max(1, distinctiveNameWords.length)) {
          score += 25;
          strength = distinctiveHits >= 2 ? 'exact' : 'strong';
        } else {
          strength = 'strong';
        }
      }
    }

    if (score > 0) {
      if (govFilter && matchesGovernorate(item, govFilter)) score += 18;
      if (catFilter && item.categoryKey === catFilter) score += 12;
      nameScored.push({ item, score, strength });
    }
  }

  nameScored.sort((a, b) => b.score - a.score || (b.item.reviewsCount || 0) - (a.item.reviewsCount || 0));

  // Detect exact match vs ambiguous multi-place match (e.g. "هيلز", "الأخوين", "الجوري", "الريف", "شلال جدر")
  const top = nameScored[0];
  const closePeers = top
    ? nameScored
        .slice(0, 5)
        .filter((entry) => entry.score >= top.score - 12 && entry.score >= 35)
    : [];

  let exactMatch: EnrichedGuide144Item | null = null;
  let ambiguousMatches: EnrichedGuide144Item[] = [];

  if (top && top.strength === 'exact' && (closePeers.length === 1 || top.score - (nameScored[1]?.score || 0) >= 20)) {
    exactMatch = top.item;
  } else if (closePeers.length >= 2) {
    // Check if peers are actually distinct places (different governorates or categories/names)
    const distinctGovs = new Set(closePeers.map((p) => p.item.governorate));
    const distinctCats = new Set(closePeers.map((p) => p.item.categoryKey));
    if (distinctGovs.size >= 2 || distinctCats.size >= 2 || closePeers.length >= 2) {
      ambiguousMatches = closePeers.slice(0, 4).map((p) => p.item);
    }
  } else if (top && top.strength === 'strong' && top.score >= 55) {
    exactMatch = top.item;
  }

  // 2) Category / Governorate filtered browsing + general scoring
  let pool = baseItems;
  if (catFilter) {
    const catPool = pool.filter((item) => item.categoryKey === catFilter);
    pool = options.subType
      ? catPool.filter((item) => matchesSubType(item, options.subType))
      : catPool;
  }
  if (govFilter) {
    pool = pool.filter((item) => matchesGovernorate(item, govFilter));
  }

  const nameScoreById = new Map(nameScored.map((n) => [n.item.id, n]));
  const hasUserLoc = Boolean(
    options.userLocation &&
      Number.isFinite(options.userLocation.lat) &&
      Number.isFinite(options.userLocation.lng)
  );

  const scoredPool: Guide144SearchMatch[] = pool.map((item) => {
    const nHit = nameScoreById.get(item.id);
    let score = nHit ? nHit.score : 0;
    for (const tok of stemTokens) {
      if (item.searchBlob.includes(tok)) score += 6;
    }
    if (govFilter && matchesGovernorate(item, govFilter)) score += 20;
    if (catFilter && item.categoryKey === catFilter) score += 15;
    if (item.rating) score += item.rating * 1.8;
    if (item.reviewsCount) score += Math.min(6, Math.log10(item.reviewsCount + 1) * 1.5);

    const distanceKm =
      hasUserLoc && item.coordinates
        ? Number(
            haversineKm(options.userLocation!, {
              lat: item.coordinates[0],
              lng: item.coordinates[1],
            }).toFixed(1)
          )
        : null;

    return {
      item,
      score,
      nameMatchStrength: nHit?.strength || 'category',
      distanceKm,
    };
  });

  // Sort by distance ONLY when BOTH userLocation AND coordinates exist for candidates
  const canSortByDistance =
    hasUserLoc &&
    scoredPool.length > 0 &&
    scoredPool.filter((m) => m.distanceKm !== null).length >= Math.min(2, scoredPool.length);

  if (canSortByDistance && !exactMatch) {
    scoredPool.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return b.score - a.score;
    });
  } else {
    scoredPool.sort(
      (a, b) =>
        b.score - a.score ||
        (b.item.rating || 0) - (a.item.rating || 0) ||
        (b.item.reviewsCount || 0) - (a.item.reviewsCount || 0)
    );
  }

  // If there was an exact/strong name match outside category/gov filters, ensure it leads
  let finalMatches = scoredPool;
  if (exactMatch && !finalMatches.some((m) => m.item.id === exactMatch!.id)) {
    finalMatches = [
      {
        item: exactMatch,
        score: top?.score || 120,
        nameMatchStrength: 'exact',
        distanceKm:
          hasUserLoc && exactMatch.coordinates
            ? Number(
                haversineKm(options.userLocation!, {
                  lat: exactMatch.coordinates[0],
                  lng: exactMatch.coordinates[1],
                }).toFixed(1)
              )
            : null,
      },
      ...finalMatches,
    ];
  } else if (!catFilter && !govFilter) {
    finalMatches = finalMatches.filter((m) => m.score >= 12);
  }

  return {
    matches: finalMatches.slice(0, limit),
    exactMatch,
    ambiguousMatches,
    sortedByDistance: Boolean(canSortByDistance && !exactMatch),
  };
}
