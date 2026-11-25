import { FAQ_CATEGORIES, FAQ_ITEMS } from '@/data/faqData';
import { INVEST_PROJECTS, INVEST_SECTORS } from '@/data/investData';
import { getGuide144ByTourGuideId, normalizeSearchText } from './guideCatalog144';
import {
  cityStories,
  climateCities,
  createGuideRecordIndex,
  images,
  regionalStops,
  stops,
  tourGuideCategoryMedia,
} from './portalStaticData';

export type SearchScopeId = 'all' | 'destinations' | 'dining' | 'stays' | 'pages';

export interface SearchScopeOption {
  id: SearchScopeId;
  label: string;
  icon: string;
}

export const SEARCH_SCOPES: SearchScopeOption[] = [
  { id: 'all', label: 'الكل', icon: '#i-search' },
  { id: 'destinations', label: 'الوجهات والمعالم', icon: '#i-nav-destination' },
  { id: 'dining', label: 'المطاعم والمقاهي', icon: '#i-guide-dining' },
  { id: 'stays', label: 'الفنادق والإقامة', icon: '#i-directory-hotel' },
  { id: 'pages', label: 'الأسئلة والصفحات', icon: '#i-nav-guide' },
];

export const SEARCH_GOVERNORATES: string[] = [
  'كل المحافظات',
  'الباحة',
  'بلجرشي',
  'المخواة',
  'المندق',
  'العقيق',
  'بني حسن',
  'قلوة',
  'القرى',
];

export interface PortalSearchEntry {
  id: string;
  title: string;
  subtitle: string;
  snippet: string;
  href: string;
  scope: Exclude<SearchScopeId, 'all'>;
  badge: string;
  governorate: string;
  image?: string;
  icon: string;
  rating?: number | null;
  priority: number;
  normTitle: string;
  normSubtitle: string;
  normKeywords: string;
  normBody: string;
  normGov: string;
}

export interface PortalSearchHit {
  entry: PortalSearchEntry;
  score: number;
}

export interface PortalSearchResultBundle {
  hits: PortalSearchHit[];
  totalMatched: number;
  scopeCounts: Record<SearchScopeId, number>;
}

const REGION_TO_GOV: Record<string, string> = {
  city: 'الباحة',
  baha: 'الباحة',
  south: 'المخواة',
  makhwah: 'المخواة',
  baljurashi: 'بلجرشي',
  mandaq: 'المندق',
  aqiq: 'العقيق',
  qilwah: 'قلوة',
  hasan: 'بني حسن',
  'bani-hassan': 'بني حسن',
  qura: 'القرى',
  hajrah: 'الحجرة',
  ghamid: 'غامد الزناد',
};

function stripArabicArticle(token: string): string {
  return token.length >= 4 && token.startsWith('ال') ? token.slice(2) : token;
}

function resolveGuideImage(category: string, photoKey?: string, g144Image?: string): string | undefined {
  if (g144Image && !g144Image.endsWith('guide-neutral.svg')) return g144Image;
  if (photoKey && images[photoKey]) return images[photoKey];
  const fallbackKey = tourGuideCategoryMedia[category]?.[0];
  if (fallbackKey && images[fallbackKey]) return images[fallbackKey];
  return undefined;
}

function guideCategoryIcon(category: string): string {
  switch (category) {
    case 'restaurants':
      return '#i-guide-dining';
    case 'cafes':
      return '#i-directory-coffee';
    case 'hotels':
      return '#i-directory-hotel';
    case 'chalets':
      return '#i-guide-tent';
    case 'heritage':
    case 'museums':
      return '#i-heritage';
    case 'water':
      return '#i-weather';
    case 'farms':
      return '#i-leaf';
    case 'malls':
      return '#i-directory-shopping';
    default:
      return '#i-mountain';
  }
}

function guideCategoryScope(category: string): Exclude<SearchScopeId, 'all'> {
  if (category === 'restaurants' || category === 'cafes') return 'dining';
  if (category === 'hotels' || category === 'chalets') return 'stays';
  return 'destinations';
}

let cachedCatalog: PortalSearchEntry[] | null = null;

export function getPortalSearchCatalog(): PortalSearchEntry[] {
  if (cachedCatalog) return cachedCatalog;

  const entries: PortalSearchEntry[] = [];
  const seenHrefs = new Set<string>();

  const addEntry = (raw: Omit<PortalSearchEntry, 'normTitle' | 'normSubtitle' | 'normKeywords' | 'normBody' | 'normGov'> & { keywords?: string }) => {
    const dedupeKey = `${raw.href}::${raw.title}`;
    if (seenHrefs.has(dedupeKey)) return;
    seenHrefs.add(dedupeKey);
    entries.push({
      id: raw.id,
      title: raw.title,
      subtitle: raw.subtitle,
      snippet: raw.snippet,
      href: raw.href,
      scope: raw.scope,
      badge: raw.badge,
      governorate: raw.governorate,
      image: raw.image,
      icon: raw.icon,
      rating: raw.rating ?? null,
      priority: raw.priority,
      normTitle: normalizeSearchText(raw.title),
      normSubtitle: normalizeSearchText(`${raw.subtitle} ${raw.badge}`),
      normKeywords: normalizeSearchText(raw.keywords || ''),
      normBody: normalizeSearchText(raw.snippet),
      normGov: normalizeSearchText(raw.governorate),
    });
  };

  // 1. Featured Portal Destinations (/place/:id)
  for (const stop of stops) {
    const exp = regionalStops.get(stop.id);
    const gov = exp?.county || REGION_TO_GOV[stop.region] || 'الباحة';
    addEntry({
      id: `stop-${stop.id}`,
      title: stop.name,
      subtitle: `${gov} · ${stop.tag}`,
      snippet: stop.desc,
      href: `/place/${stop.id}`,
      scope: 'destinations',
      badge: 'وجهة رئيسية',
      governorate: gov,
      image: images[stop.image],
      icon: '#i-nav-destination',
      priority: 38,
      keywords: `${stop.aliases || ''} ${exp?.aliases || ''} ${stop.tag} ${gov} وجهة معلم سياحي`,
    });
  }

  // 2. Governorates & Climate Cities (/city/:key)
  const majorCityKeys = ['baha', 'makhwah', 'baljurashi', 'mandaq', 'aqiq', 'qilwah', 'hasan', 'qura', 'hajrah', 'ghamid'];
  for (const key of majorCityKeys) {
    const city = climateCities[key];
    if (!city) continue;
    const gov = REGION_TO_GOV[key] || city.name;
    addEntry({
      id: `city-${key}`,
      title: city.name.startsWith('مدينة') || city.name.startsWith('محافظة') ? city.name : `محافظة ${city.name}`,
      subtitle: city.area,
      snippet: city.climate || city.intro,
      href: `/city/${key}`,
      scope: 'destinations',
      badge: 'محافظة ونطاق',
      governorate: gov,
      image: images[city.image],
      icon: '#i-pin',
      priority: 18,
      keywords: `${city.name} ${city.area} محافظة مدينة طقس اجواء مناخ`,
    });
  }

  // 3. All 147 Official Tour Guide Places (/guide/place/:id)
  const guideRecords = createGuideRecordIndex(normalizeSearchText);
  for (const rec of guideRecords) {
    const g144 = getGuide144ByTourGuideId(rec.id);
    const gov = rec.district || g144?.governorate || 'الباحة';
    const factsText = (rec.facts || []).map(([k, v]) => `${k}: ${v}`).join(' · ');
    const desc = rec.description || g144?.shortDescription || rec.address || factsText || `${rec.categoryLabel} في ${gov}`;
    addEntry({
      id: `guide-${rec.id}`,
      title: rec.name,
      subtitle: `${gov} · ${rec.categoryLabel || 'دليل الباحة'}`,
      snippet: desc,
      href: `/guide/place/${rec.id}`,
      scope: guideCategoryScope(rec.category),
      badge: rec.categoryLabel || 'الدليل السياحي',
      governorate: gov,
      image: resolveGuideImage(rec.category, rec.photo, g144?.image),
      icon: guideCategoryIcon(rec.category),
      rating: g144?.rating ?? null,
      priority: 20,
      keywords: `${rec.address || ''} ${factsText} ${g144?.type || ''} ${g144?.categoryAr || ''} ${rec.categoryLabel}`,
    });
  }

  // 4. Events & Heritage Archive Stories (/city/baha/stories/:id)
  for (const story of cityStories) {
    addEntry({
      id: `story-${story.id}`,
      title: story.title,
      subtitle: `${story.location} · ${story.dateLabel}`,
      snippet: story.summary,
      href: `/city/baha/stories/${story.id}`,
      scope: 'pages',
      badge: story.kind === 'event' ? 'فعالية وموسم' : 'أرشيف الباحة',
      governorate: story.location || 'الباحة',
      image: images[story.id],
      icon: '#i-heritage',
      priority: 13,
      keywords: `${story.tag} ${story.details} مهرجان فعاليات اخبار تراث`,
    });
  }

  // 5. Official FAQs (/faq/:id)
  const faqCatMap = new Map(FAQ_CATEGORIES.map((c) => [c.id, c.label]));
  for (const faq of FAQ_ITEMS) {
    const catLabel = faqCatMap.get(faq.category) || 'الأسئلة الشائعة';
    addEntry({
      id: `faq-${faq.id}`,
      title: faq.question,
      subtitle: `الأسئلة الشائعة · ${catLabel}`,
      snippet: faq.answer,
      href: `/faq/${faq.id}`,
      scope: 'pages',
      badge: 'سؤال شائع',
      governorate: 'منطقة الباحة',
      icon: '#i-info',
      priority: 12,
      keywords: `${(faq.highlights || []).join(' ')} سؤال اجابه استفسار`,
    });
  }

  // 6. Investment Opportunities (/invest)
  const investSectorMap = new Map(INVEST_SECTORS.map((s) => [s.id, s.label]));
  for (const proj of INVEST_PROJECTS) {
    const sectorLabel = investSectorMap.get(proj.sector) || 'الاستثمار';
    addEntry({
      id: `invest-${proj.id}`,
      title: proj.title,
      subtitle: `${proj.location} · ${sectorLabel}`,
      snippet: `${proj.summary} — ${proj.highlights.map((h) => h.label).join(' · ')}`,
      href: '/invest',
      scope: 'pages',
      badge: 'فرصة استثمارية',
      governorate: 'الباحة',
      icon: '#i-nav-invest',
      priority: 12,
      keywords: `استثمار فرص مشاريع رخص تجاريه بلديه ${sectorLabel} ${proj.location}`,
    });
  }

  // 7. Core Portal Pages, Culinary Heritage & Services
  const corePages: Array<{
    id: string;
    title: string;
    subtitle: string;
    snippet: string;
    href: string;
    scope: Exclude<SearchScopeId, 'all'>;
    badge: string;
    icon: string;
    keywords: string;
  }> = [
    {
      id: 'page-guide',
      title: 'الدليل السياحي الشامل لمنطقة الباحة',
      subtitle: '147 معلماً وخدمة سياحية موثقة',
      snippet: 'تصفّح المنتزهات والشلالات والقرى التراثية والمتاحف والفنادق والشاليهات والمطاعم والمقاهي مع الخريطة التفاعلية.',
      href: '/guide',
      scope: 'pages',
      badge: 'صفحة رئيسية',
      icon: '#i-nav-guide',
      keywords: 'دليل شامل كل الاماكن خريطه تصنيفات سياحه',
    },
    {
      id: 'page-planner',
      title: 'مخطط الرحلة التفاعلي',
      subtitle: 'بناء مسار مخصص من يوم إلى 7 أيام',
      snippet: 'اختر مدة الرحلة والنطاق الجغرافي ونوع التجربة واعتمد جدول رحلتك وشاركه بسهولة.',
      href: '/planner',
      scope: 'pages',
      badge: 'أداة تفاعلية',
      icon: '#i-route',
      keywords: 'خطط رحلتك جدول سياحي مسار خريطه مشاركه واتساب',
    },
    {
      id: 'page-season',
      title: 'المناخ والفصول وأجواء الزيارة',
      subtitle: 'مقارنة السراة وتهامة عبر الفصول الأربعة',
      snippet: 'تعرف على درجات الحرارة وحالة الطقس الحية واللباس المقترح وأفضل أوقات الزيارة في الربيع والصيف والخريف والشتاء.',
      href: '/visit-season',
      scope: 'pages',
      badge: 'أجواء ومناخ',
      icon: '#i-weather',
      keywords: 'طقس مناخ فصول شتاء صيف ربيع خريف حراره ضباب امطار سراة تهامه',
    },
    {
      id: 'page-dining-heritage',
      title: 'الموروث الغذائي والأكلات الشعبية في الباحة',
      subtitle: 'الخبزة المقنّاة · الدغابيس · البُن الشدوي',
      snippet: 'استكشف أشهر أطباق الضيافة الجبلية والقهوة الشدوية والعسل المحلي والمطاعم المختارة.',
      href: '/dining',
      scope: 'dining',
      badge: 'مائدة الباحة',
      icon: '#i-guide-dining',
      keywords: 'اكلات شعبيه الخبزه المقناه الدغابيس البن الشدوي عسل سمن طعام مطاعم قهوه',
    },
    {
      id: 'page-camping',
      title: 'المخيمات والإقامة الجبلية البيئية',
      subtitle: 'تصاريح التخييم ومنتجعات السراة وشدا',
      snippet: 'دليل التخييم الموسمي المصرّح به وخيارات النزل الريفية والمنتجعات الجبلية في منطقة الباحة.',
      href: '/camping',
      scope: 'stays',
      badge: 'إقامة وتخييم',
      icon: '#i-guide-tent',
      keywords: 'تخييم مخيمات خيمه تصريح مبيت منتجع الكهف ماكامايا اقامه',
    },
    {
      id: 'page-daily-programs',
      title: 'برامج الزيارة اليومية المقترحة',
      subtitle: 'مسارات جاهزة ليوم واحد في بلجرشي وخيرة وذي عين',
      snippet: 'ثلاثة مسارات يومية متوازنة تجمع بين الأسواق التاريخية والغابات والقرى التراثية والضيافة.',
      href: '/guideDaySection',
      scope: 'pages',
      badge: 'برامج مقترحة',
      icon: '#i-clock',
      keywords: 'برامج يوميه جدول يوم واحد سوق السبت خيره ذي عين شدا',
    },
    {
      id: 'page-invest',
      title: 'الاستثمار والفرص البلدية في منطقة الباحة',
      subtitle: 'بوابة المستثمرين ومنصة «فرص» والمشاريع النوعية',
      snippet: 'استعرض مؤشرات الرخص والقطاعات الواعدة والمشاريع الاستثمارية الكبرى وقنوات التواصل مع أمانة الباحة.',
      href: '/invest',
      scope: 'pages',
      badge: 'صفحة رسمية',
      icon: '#i-nav-invest',
      keywords: 'استثمار فرص امانه الباحه رخص مشاريع فندق روتانا الباحه سكاي',
    },
    {
      id: 'page-faq',
      title: 'الأسئلة الشائعة ودليل الزائر',
      subtitle: 'إجابات موثقة حول الوصول والطقس والطوارئ 940 / 930 / 911',
      snippet: 'كل ما تحتاجه قبل وأثناء زيارتك لمنطقة الباحة من طرق الوصول والمطار والخدمات الرسمية.',
      href: '/faq',
      scope: 'pages',
      badge: 'صفحة رسمية',
      icon: '#i-info',
      keywords: 'اسئله شائعه مساعده طوارئ 940 930 911 مطار وصول طرق',
    },
    {
      id: 'page-official',
      title: 'التنمية والاستدامة ورؤية السعودية 2030',
      subtitle: 'مؤشرات الأداء البلدي والهوية العمرانية والخدمات الرقمية',
      snippet: 'اطلع على مؤشرات جودة الحياة والتشجير والمشاريع التنموية والخدمات الإلكترونية في أمانة منطقة الباحة.',
      href: '/official-portal',
      scope: 'pages',
      badge: 'التنمية البلديّة',
      icon: '#i-heritage',
      keywords: 'رؤيه 2030 استدامه تنميه امانه بلديه مؤشرات خدمات الكترونيه بلدي',
    },
    {
      id: 'page-app',
      title: 'حمّل تطبيق الباحة الرسمي',
      subtitle: 'متوفر على App Store و Google Play',
      snippet: 'الخدمات البلدية والسياحية ومخطط الرحلة والمساعد الذكي في منصة رقمية موحدة على جوالك.',
      href: '/app',
      scope: 'pages',
      badge: 'تطبيق الجوال',
      icon: '#i-section-app',
      keywords: 'تطبيق جوال تحميل ابل ستور قوقل بلاي باحتي',
    },
    {
      id: 'page-feedback',
      title: 'تقديم الملاحظات والمقترحات التطويرية',
      subtitle: 'نموذج تواصل مباشر لتحسين تجربة الزائر',
      snippet: 'شاركنا رأيك ومقترحاتك حول الخدمات السياحية والبلدية وتجربة البوابة الرقمية.',
      href: '/feedback',
      scope: 'pages',
      badge: 'خدمة إلكترونية',
      icon: '#i-foot-mail',
      keywords: 'ملاحظات مقترحات تواصل راي استبيان',
    },
    {
      id: 'page-reports',
      title: 'البلاغات والطلبات الخدمية (940)',
      subtitle: 'رفع بلاغ بلدي أو متابعة ملاحظة ميدانية',
      snippet: 'تقديم بلاغ خدمي أو ميداني في مدينة الباحة ومحافظاتها والتواصل مع مركز البلاغات الموحد 940.',
      href: '/reports',
      scope: 'pages',
      badge: 'خدمة إلكترونية',
      icon: '#i-foot-headset',
      keywords: 'بلاغات شكاوي طلب خدمه 940 طوارئ صيانه نظافه',
    },
  ];

  for (const p of corePages) {
    addEntry({
      ...p,
      governorate: 'منطقة الباحة',
      priority: 16,
    });
  }

  cachedCatalog = entries;
  return entries;
}

export function searchPortal(options: {
  query: string;
  scope?: SearchScopeId;
  governorate?: string;
  limit?: number;
}): PortalSearchResultBundle {
  const catalog = getPortalSearchCatalog();
  const scope = options.scope || 'all';
  const govFilterRaw =
    options.governorate && options.governorate !== 'كل المحافظات' && options.governorate !== 'all'
      ? normalizeSearchText(options.governorate)
      : '';
  const normQuery = normalizeSearchText(options.query || '');
  const rawTokens = normQuery.split(/\s+/).filter(Boolean);
  const tokens = rawTokens.map((tok) => ({
    raw: tok,
    stem: stripArabicArticle(tok),
  }));

  const scopeCounts: Record<SearchScopeId, number> = {
    all: 0,
    destinations: 0,
    dining: 0,
    stays: 0,
    pages: 0,
  };

  // Do not return unsolicited suggestions when no query and no filters are active
  if (!tokens.length && scope === 'all' && !govFilterRaw) {
    return { hits: [], totalMatched: 0, scopeCounts };
  }

  const matchedAllScopes: PortalSearchHit[] = [];

  for (const entry of catalog) {
    if (govFilterRaw) {
      const govHay = `${entry.normGov} ${entry.normSubtitle} ${entry.normTitle}`;
      const govStem = stripArabicArticle(govFilterRaw);
      if (!govHay.includes(govFilterRaw) && (!govStem || !govHay.includes(govStem))) {
        continue;
      }
    }

    let score = entry.priority;

    if (tokens.length > 0) {
      if (entry.normTitle === normQuery) {
        score += 320;
      } else if (entry.normTitle.startsWith(normQuery)) {
        score += 210 + Math.max(0, 48 - entry.normTitle.length * 1.8);
      } else if (entry.normTitle.includes(normQuery)) {
        score += 140 + Math.max(0, 48 - entry.normTitle.length * 1.8);
      }
      if (entry.normTitle.includes(normQuery)) {
        if (entry.id.startsWith('stop-') || entry.id.startsWith('city-')) score += 110;
        else if (entry.id.startsWith('guide-')) score += 65;
      }

      const titleWords = entry.normTitle.split(/\s+/);
      let allTokensMatched = true;

      for (const { raw, stem } of tokens) {
        const matchWord = (text: string) =>
          text.includes(raw) || (stem.length >= 2 && text.includes(stem));

        const inTitleWordPrefix = titleWords.some(
          (w) =>
            w.startsWith(raw) ||
            stripArabicArticle(w).startsWith(stem)
        );
        const inTitle = matchWord(entry.normTitle);
        const inSubtitle = matchWord(entry.normSubtitle) || matchWord(entry.normGov);
        const inKeywords = matchWord(entry.normKeywords);
        const inBody = matchWord(entry.normBody);

        if (!inTitle && !inSubtitle && !inKeywords && !inBody) {
          allTokensMatched = false;
          break;
        }

        if (inTitleWordPrefix) score += 95;
        else if (inTitle) score += 68;
        if (inSubtitle) score += 38;
        if (inKeywords) score += 32;
        if (inBody) score += 18;
      }

      if (!allTokensMatched) continue;
    } else {
      // Filter-only browsing (e.g. mobile Advanced Search Bar category/governorate selection)
      score += entry.image ? 10 : 0;
    }

    if (entry.rating) {
      score += entry.rating * 2.2;
    }

    matchedAllScopes.push({ entry, score });
    scopeCounts.all += 1;
    scopeCounts[entry.scope] += 1;
  }

  matchedAllScopes.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'ar'));

  const filteredHits =
    scope === 'all'
      ? matchedAllScopes
      : matchedAllScopes.filter((h) => h.entry.scope === scope);

  const limit = options.limit ?? 36;
  return {
    hits: filteredHits.slice(0, limit),
    totalMatched: filteredHits.length,
    scopeCounts,
  };
}
