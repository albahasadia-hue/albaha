import rawDomMedia from '@/data/domMedia.json';
import rawHeroPhotoData from '@/data/heroPhotoData.json';
import rawMapData from '@/data/mapData.json';
import rawPhotoData from '@/data/photoData.json';
import rawStationPhotoInfo from '@/data/stationPhotoInfo.json';
import rawTourGuideArt from '@/data/tourGuideArt.json';
import rawTourGuideData from '@/data/tourGuideData.json';
import type {
  CityStory,
  ClimateCity,
  DestinationArea,
  ExpandedStop,
  GuideRecord,
  HeroCue,
  IndexedGuideRecord,
  MapGeoData,
  PlaceNote,
  SeasonConfig,
  SeasonKey,
  StationPhotoMeta,
  StopBase,
  StopOperationalMeta,
  StopVisitConfig,
  TourGuideDataset,
  TravelProfileKey,
  TripStyle,
} from './portalTypes';

export const regionalGuideUrl =
  'https://bso.gov.sa/assets/tourist_guide_albaha_arabic_241f20cb54/tourist_guide_albaha_arabic_241f20cb54.pdf';

export const domMedia = rawDomMedia as Record<string, string>;
export const photoData = rawPhotoData as Record<string, string>;
export const tourGuideArtMap = rawTourGuideArt as Record<string, string>;
export const geo = rawMapData as unknown as MapGeoData;
export const stationPhotoInfo = rawStationPhotoInfo as Record<string, StationPhotoMeta>;
export const tourGuide = rawTourGuideData as unknown as TourGuideDataset;

export function buildImagesRegistry(): Record<string, string> {
  return {
    ...photoData,
    ...tourGuideArtMap,
    cityCover: domMedia.cityCover,
    'royal-visit': domMedia['royal-visit'],
    khair: domMedia.khair,
    'raghdan-market': domMedia['raghdan-market'],
    'honey-festival': domMedia['honey-festival'],
    raghdan: domMedia.raghdan,
    ain: domMedia.ain,
    shada: domMedia.shada,
    hussam: domMedia.hussam,
  };
}

export const images: Record<string, string> = buildImagesRegistry();

export const heroPhotos: Record<string, { wide: string; mobile?: string }> = {
  ...(rawHeroPhotoData as Record<string, { wide: string; mobile?: string }>),
  raghdan: {
    wide: domMedia.heroOpeningWide,
    mobile: domMedia.heroOpeningPortrait,
  },
};

export const typeIcons: Record<Exclude<TripStyle, 'all'>, string> = {
  nature: 'mountain',
  heritage: 'heritage',
  family: 'family',
};

export const typeLabels: Record<TripStyle, string> = {
  all: 'كل التجارب',
  family: 'عائلية',
  nature: 'طبيعة',
  heritage: 'تراث',
};

export const maxTripDays = 7;

export const expandedStops: ExpandedStop[] = [
  {
    id: 'baljurashi-center',
    region: 'baljurashi',
    county: 'بلجرشي',
    name: 'وسط بلجرشي',
    tag: 'أسواق وتراث',
    types: ['heritage', 'family'],
    min: 75,
    lat: 19.85944,
    lng: 41.55722,
    desc: 'ابدأ من وسط بلجرشي، واستكشف محيط السوق الشعبي. ينعقد سوق السبت في صباح السبت',
    aliases: 'بلجرشي سوق السبت',
    best: 'صباحاً خلال السوق الأسبوعي يوم السبت',
    source: 'https://saudipedia.com/أين-يقع-سوق-السبت-التاريخي؟',
    mapSource: 'https://ashabakah.com/gis/web/ar/arab22/almmlkt-alrbyt-alswdyt/107692',
  },
  {
    id: 'khulb',
    region: 'mandaq',
    county: 'المندق',
    name: 'متنزه الخلب',
    tag: 'متنزهات السراة',
    types: ['nature', 'family'],
    min: 65,
    lat: 20.17887,
    lng: 41.26408,
    desc: 'توقف في متنزه الخلب بالمندق وخذ جولة قصيرة وسط المرتفعات، مع وقت للجلوس والتصوير',
    aliases: 'المندق منتزه الخلب غابة الخلب',
    best: 'نهارًا وفق الأجواء',
    source: regionalGuideUrl,
    mapSource: 'https://mapcarta.com/N4975923962',
  },
  {
    id: 'aqiq-center',
    region: 'aqiq',
    county: 'العقيق',
    name: 'وسط العقيق',
    tag: 'جولة في المدينة',
    types: ['family'],
    min: 55,
    lat: 20.26405,
    lng: 41.6654,
    desc: 'وقفة في وسط العقيق، شمال شرق الباحة. يضم دليل المنطقة سد وادي العقيق ضمن المعالم القريبة',
    aliases: 'العقيق وسط العقيق',
    best: 'نهارًا',
    source: regionalGuideUrl,
    mapSource: 'https://www.longitude-latitude-maps.com/city/185_16%2Cal-Aqiq%2Cal-Bahah%2CSaudi%2BArabia',
  },
  {
    id: 'khalif',
    region: 'qilwah',
    county: 'قلوة',
    name: 'الخلف والخليف',
    tag: 'عمارة حجرية وآثار',
    types: ['heritage'],
    min: 65,
    lat: 19.96935,
    lng: 41.2261,
    desc: 'محطة تراثية قرب قلوة، تُعرف بالمباني والحصون الحجرية. تحقّق من إمكانية الوصول قبل الزيارة',
    aliases: 'قلوة قلوه الخلف الخليف قرية الخليف',
    best: 'نهاراً مع التحقق من إمكانية الوصول',
    source: 'https://www.spa.gov.sa/w1850465',
    mapSource: 'https://mapcarta.com/N9520420336',
  },
  {
    id: 'tharwa',
    region: 'qura',
    county: 'القرى',
    name: 'متنزه الثروة الوطني',
    tag: 'نزهة عائلية',
    types: ['nature', 'family'],
    min: 70,
    lat: 20.16806,
    lng: 41.38806,
    desc: 'مسطحات خضراء وجلسات في متنزه بمحافظة القرى. العلامة تشير إلى نطاق طريق الدخول الجنوبي',
    aliases: 'القرى الثروة منتزه الثروه',
    best: 'نهارًا أو بعد العصر',
    source: 'https://www.spa.gov.sa/N2363008',
    mapSource: 'https://baha.gov.sa/ar/Departments/NewsDetail/654?deptId=114',
  },
  {
    id: 'mishari',
    region: 'bani-hassan',
    county: 'بني حسن',
    name: 'متنزه الأمير مشاري',
    tag: 'غابات وجلسات',
    types: ['nature', 'family'],
    min: 70,
    lat: 20.0535,
    lng: 41.40019,
    desc: 'وقفة للنزهة في متنزه الأمير مشاري بن سعود بمحافظة بني حسن، قرب غابة جدر',
    aliases: 'بني حسن مشاري غابة جدر منتزه الأمير مشاري',
    best: 'نهارًا وفق الأجواء',
    source: regionalGuideUrl,
    mapSource: 'https://mapcarta.com/W369721960',
  },
  {
    id: 'hajrah-center',
    region: 'hajrah',
    county: 'الحجرة',
    name: 'وسط الحجرة',
    tag: 'بلدات وأسواق تهامة',
    types: ['heritage', 'family'],
    min: 50,
    lat: 20.23333,
    lng: 41.05,
    desc: 'محطة في بلدة الحجرة بتهامة. يذكر دليل المنطقة سوق الأحد الشعبي ضمن معالم المحافظة',
    aliases: 'الحجرة الحجره سوق الأحد',
    best: 'نهاراً وفق مواعيد السوق الأسبوعي',
    source: regionalGuideUrl,
    mapSource: 'https://mapcarta.com/12558186',
  },
  {
    id: 'ghamid-center',
    region: 'ghamid',
    county: 'غامد الزناد',
    name: 'وسط غامد الزناد',
    tag: 'بلدات وأسواق تهامة',
    types: ['heritage', 'family'],
    min: 50,
    lat: 19.59444,
    lng: 41.52011,
    desc: 'وقفة في بلدة غامد الزناد جنوب المنطقة. يذكر الدليل المحلي سوق السبت ضمن أسواق المحافظة',
    aliases: 'غامد الزناد غامد',
    best: 'نهاراً وفق مواعيد السوق الأسبوعي',
    source: regionalGuideUrl,
    mapSource: 'https://mapcarta.com/N6770793665',
  },
];

export const terrainProjection = {
  x: 659.3,
  y: 229.1,
  lng: 41.44972,
  lat: 20.01047,
  xScale: 2276.7,
  yScale: 2420,
};

export const stopOperationalCatalog: Record<string, StopOperationalMeta> = {
  hussam: {
    district: 'الباحة',
    accessPoint: 'قلب مدينة الباحة — طريق الملك عبدالعزيز',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'مشي خفيف وممرات ممهّدة (600 م)',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['600 موقف سيارات', 'منطقتا ألعاب أطفال', 'جلسات حول البحيرة', 'مسطحات خضراء'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'hussam',
    qualifiedPlannable: true,
  },
  raghdan: {
    district: 'الباحة',
    accessPoint: 'غابة رغدان — شمال غرب مدينة الباحة',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'ممشى متنزه مهيأ وإطلالات',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['مسطحات خضراء', 'مصلى ودورات مياه', 'الجسر المعلّق وحديقة اللافندر'],
    facilitiesSource: 'أمانة منطقة الباحة · دليل صيف السعودية',
    hoursVerified: null,
    guideId: 'raghdan',
    qualifiedPlannable: true,
  },
  ain: {
    district: 'المخواة',
    accessPoint: 'وادي ذي عين التراثي — أسفل عقبة الباحة',
    accessSource: 'دليل صيف السعودية',
    walkingLevel: 'steep',
    walkingLabel: 'سلالم وممرات حجرية متدرجة',
    familyFriendly: false,
    indoorOrCovered: false,
    facilities: ['عين ماء طبيعية', 'ممرات أثرية ومطلات'],
    facilitiesSource: 'دليل صيف السعودية',
    hoursVerified: {
      openStartMin: 540,
      openEndMin: 1020,
      label: '9:00 ص – 5:00 م',
      source: 'دليل صيف السعودية',
      verifiedAt: '2026-04-01',
    },
    guideId: 'dhee-ain',
    qualifiedPlannable: true,
  },
  shada: {
    district: 'المخواة',
    accessPoint: 'طريق جبل شدا الأعلى — المخواة',
    accessSource: 'مرجع بوابة الباحة',
    walkingLevel: 'steep',
    walkingLabel: 'طريق جبلي متعرّج ومرتفعات صخرية',
    familyFriendly: false,
    indoorOrCovered: false,
    facilities: ['نقاط إطلالة وتكوينات جرانيتية'],
    facilitiesSource: 'مرجع بوابة الباحة',
    hoursVerified: null,
    qualifiedPlannable: false,
  },
  'baljurashi-center': {
    district: 'بلجرشي',
    accessPoint: 'وسط بلجرشي ومحيط سوق السبت التاريخي',
    accessSource: 'دليل أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'مسارات وسط البلدة وساحة السوق',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['السوق الشعبي الأسبوعي (السبت صباحًا)', 'جلسات وخدمات بلدية'],
    facilitiesSource: 'دليل أمانة منطقة الباحة',
    hoursVerified: {
      openStartMin: 360,
      openEndMin: 750,
      label: 'السوق الأسبوعي: السبت 6:00 ص – 12:30 م (وسط المدينة متاح يوميًا)',
      source: 'أمانة منطقة الباحة',
      verifiedAt: '2026-04-01',
    },
    activeDays: [6],
    guideId: 'saturday-market',
    qualifiedPlannable: false,
  },
  khulb: {
    district: 'المندق',
    accessPoint: 'مرتفعات المندق — مدخل متنزه الخلب',
    accessSource: 'دليل صيف السعودية · Mapcarta',
    walkingLevel: 'moderate',
    walkingLabel: 'مسارات متنزه وإطلالات أودية',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['جلسات عائلية', 'نقاط تصوير على الأودية'],
    facilitiesSource: 'مرجع بوابة الباحة',
    hoursVerified: null,
    guideId: 'khulb',
    qualifiedPlannable: true,
  },
  'khairah-forest-park': {
    district: 'بني حسن',
    accessPoint: 'متنزه غابة خيرة — نقطة الوصول المنشورة لزوار شلال خيرة',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'مسار غابة خفيف عند نقطة الوصول',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['نقطة الوصول الرسمية لشلال خيرة', 'مساحات تنزّه ظليلة'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'khairah-forest-park',
    qualifiedPlannable: true,
  },
  'museums-09': {
    district: 'بلجرشي',
    accessPoint: 'بلجرشي — موقع المتحف الأبنوي المنشور',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'مسارات داخلية مستوية (وجهة مغطاة)',
    familyFriendly: true,
    indoorOrCovered: true,
    facilities: ['قاعات عرض داخلية مكيفة', 'أدوات زراعية وتقليدية تاريخية'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'museums-09',
    qualifiedPlannable: true,
  },
  'khazim-farm': {
    district: 'بلجرشي',
    accessPoint: 'بلجرشي — بجوار بحيرة سد الطلقية',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'moderate',
    walkingLabel: 'ممشى زراعي وسط أشجار الفاكهة',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['تجربة الفاكهة الموسمية', 'محيط بحيرة سد الطلقية'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'khazim-farm',
    qualifiedPlannable: true,
  },
  'farms-13': {
    district: 'العقيق',
    accessPoint: 'محافظة العقيق — طريق مزرعة الزيتونة',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'ممرات ريفية سهلة بين مدرجات الزيتون',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['مدرجات الزيتون', 'زراعة الفراولة مائيًا', 'حديقة للطيور'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'farms-13',
    qualifiedPlannable: true,
  },
  'park-shorouq': {
    district: 'الباحة',
    accessPoint: 'شرق الباحة — مدخل منتزه الشروق',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'ممشى مستوٍ ومناسب للعائلات وكبار السن',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['بحيرة ونوافير', 'ألعاب أطفال', 'مطعم ومقاهٍ'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'park-shorouq',
    qualifiedPlannable: true,
  },
  shahbah: {
    district: 'الباحة',
    accessPoint: 'مدينة الباحة — مدخل حديقة شهبة',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'مشي خفيف داخل الحديقة',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['مسطحات خضراء (43,000 م²)', 'منطقة ألعاب أطفال'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'shahbah',
    qualifiedPlannable: true,
  },
  'mohammed-bin-saud-park': {
    district: 'الباحة',
    accessPoint: 'وسط الباحة — مقابل منتزه رغدان',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'ممرات قصيرة مستوية',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['مسطحات خضراء (21,623 م²)', 'مصلى', 'دورات مياه'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'mohammed-bin-saud-park',
    qualifiedPlannable: true,
  },
  habashi: {
    district: 'الباحة',
    accessPoint: 'مدينة الباحة — حديقة الحبشي',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'مساحات مفتوحة ومستوية للعائلات',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['ألعاب أطفال', 'ملاعب كرة قدم', 'مسطحات خضراء'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'habashi',
    qualifiedPlannable: true,
  },
  'north-park': {
    district: 'الباحة',
    accessPoint: 'شمال مدينة الباحة — حديقة الشمال',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'مساحات خضراء وممرات مفتوحة',
    familyFriendly: true,
    indoorOrCovered: false,
    facilities: ['مسطحات خضراء (28,770 م²)', 'ملاعب كرة قدم'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'north-park',
    qualifiedPlannable: true,
  },
  'hala-restaurant': {
    district: 'بني حسن',
    accessPoint: 'جبل خيرة (بني حسن) — داخل منتجع قمرة الجبلي',
    accessSource: 'المشغّل المنشور في دليل الباحة',
    walkingLevel: 'light',
    walkingLabel: 'وصول مباشر بالسيارة وجلسات داخلية',
    familyFriendly: true,
    indoorOrCovered: true,
    facilities: ['صالة طعام داخلية وإطلالات', 'فطور وغداء وعشاء بمكونات محلية'],
    facilitiesSource: 'المشغّل المنشور في الدليل',
    hoursVerified: {
      openStartMin: 420,
      openEndMin: 1380,
      label: '7:00 ص – 11:00 م (فطور 7–10 ص · غداء 12–4 م · عشاء 5–11 م)',
      source: 'المشغّل المنشور في الدليل',
      verifiedAt: '2026-04-01',
    },
    guideId: 'hala-restaurant',
    qualifiedPlannable: true,
  },
  'gamra-resort': {
    district: 'بني حسن',
    accessPoint: 'جبل خيرة (بني حسن) — منتجع قمرة الجبلي',
    accessSource: 'أمانة منطقة الباحة',
    walkingLevel: 'light',
    walkingLabel: 'مرافق جبلية داخلية وسهلة الوصول',
    familyFriendly: true,
    indoorOrCovered: true,
    facilities: ['أجنحة جبلية مطلة', 'استفسار النقل من وإلى المطار'],
    facilitiesSource: 'أمانة منطقة الباحة',
    hoursVerified: null,
    guideId: 'gamra-resort',
    qualifiedPlannable: true,
  },
};

export const promotedGuideStops: StopBase[] = [
  {
    id: 'khairah-forest-park',
    name: 'متنزه غابة خيرة',
    region: 'bani-hasan',
    tag: 'نقطة الوصول لشلال خيرة',
    desc: 'متنزه غابة خيرة في بني حسن، وهو نقطة الوصول الرسمية المنشورة لزوار شلال خيرة بين الأشجار والهواء الجبلي.',
    types: ['nature', 'family'],
    min: 70,
    lat: 20.0522376,
    lng: 41.3977182,
    image: 'khair',
    photoAlt: 'متنزه غابة خيرة ونقطة الوصول للشلال',
    aliases: 'خيرة شلال خيرة غابة خيرة بني حسن',
  },
  {
    id: 'museums-09',
    name: 'المتحف الأبنوي',
    region: 'baljurashi',
    tag: 'متاحف وتراث داخلي',
    desc: 'يعرض المتحف الأبنوي في بلجرشي مقتنيات من الحياة اليومية قديمًا، مع أدوات الزراعة والملابس التقليدية في قاعات مغطاة.',
    types: ['heritage', 'family'],
    min: 60,
    lat: 19.8201044,
    lng: 41.6111074,
    image: 'guide-museum',
    photoAlt: 'المتحف الأبنوي في بلجرشي',
    aliases: 'الأبنوي الابنو متحف بلجرشي التراثي',
  },
  {
    id: 'khazim-farm',
    name: 'مزرعة الخازم',
    region: 'baljurashi',
    tag: 'مزارع سياحية',
    desc: 'مزرعة ريفية في بلجرشي بجوار بحيرة سد الطلقية، وتشتهر بتنوع أشجار الفاكهة الموسمية وإطلالاتها الهادئة.',
    types: ['nature', 'family'],
    min: 65,
    lat: 19.8544859,
    lng: 41.602385,
    image: 'terraces',
    photoAlt: 'مزرعة الخازم بجوار سد الطلقية',
    aliases: 'مزرعة الخازم سد الطلقية بلجرشي',
  },
  {
    id: 'farms-13',
    name: 'مزرعة الزيتونة',
    region: 'aqiq',
    tag: 'مزارع ومدرجات',
    desc: 'مزرعة سياحية في العقيق تجمع مدرجات الزيتون والزراعة المائية للفراولة مع حديقة للطيور تناسب العائلات.',
    types: ['nature', 'family'],
    min: 70,
    lat: 20.0763061,
    lng: 41.5692638,
    image: 'mishari',
    photoAlt: 'مزرعة الزيتونة في العقيق',
    aliases: 'الزيتونة مزرعة الزيتونة العقيق',
  },
  {
    id: 'park-shorouq',
    name: 'منتزه الشروق',
    region: 'city',
    tag: 'حدائق وبحيرة وعائلات',
    desc: 'متنزه عائلي واسع في الباحة يضم مسطحات خضراء وبحيرة ونوافير ومناطق لعب أطفال ومقاهي بممرات مستوية.',
    types: ['family', 'nature'],
    min: 70,
    lat: 20.0679289,
    lng: 41.5719682,
    image: 'parks',
    photoAlt: 'منتزه الشروق في مدينة الباحة',
    aliases: 'منتزه الشروق الشروق حديقة الشروق',
  },
  {
    id: 'shahbah',
    name: 'حديقة شهبة',
    region: 'city',
    tag: 'حدائق وعائلات',
    desc: 'مساحة خضراء هادئة في شهبة تضم أشجارًا وممرات خفيفة وألعابًا مخصصة للأطفال.',
    types: ['family', 'nature'],
    min: 55,
    lat: 20.050882,
    lng: 41.4740586,
    image: 'city',
    photoAlt: 'حديقة شهبة في الباحة',
    aliases: 'شهبة حديقة شهبة',
  },
  {
    id: 'mohammed-bin-saud-park',
    name: 'حديقة الأمير محمد بن سعود',
    region: 'city',
    tag: 'حدائق ومرافق متكاملة',
    desc: 'حديقة داخل مدينة الباحة بممرات مهيأة ومصلى ودورات مياه، مثالية لوقفة عائلية مريحة دون مشي شاق.',
    types: ['family'],
    min: 50,
    lat: 20.0189178,
    lng: 41.4427019,
    image: 'hussamCover',
    photoAlt: 'حديقة الأمير محمد بن سعود في الباحة',
    aliases: 'محمد بن سعود حديقة الأمير محمد بن سعود',
  },
  {
    id: 'habashi',
    name: 'حديقة الحبشي',
    region: 'city',
    tag: 'حدائق وألعاب أطفال',
    desc: 'حديقة عائلية بممرات سهلة وألعاب أطفال وملاعب كرة قدم داخل نطاق مدينة الباحة.',
    types: ['family'],
    min: 50,
    lat: 20.0432294,
    lng: 41.4571911,
    image: 'parks',
    photoAlt: 'حديقة الحبشي في الباحة',
    aliases: 'الحبشي حديقة الحبشي',
  },
  {
    id: 'north-park',
    name: 'حديقة الشمال',
    region: 'city',
    tag: 'حدائق ومسطحات خضراء',
    desc: 'مساحات خضراء واسعة شمال مدينة الباحة مع ملاعب وممرات خفيفة للمشي والاستراحة.',
    types: ['family'],
    min: 50,
    lat: 20.1294271,
    lng: 41.4333574,
    image: 'tharwa',
    photoAlt: 'حديقة الشمال في الباحة',
    aliases: 'الشمال حديقة الشمال',
  },
  {
    id: 'hala-restaurant',
    name: 'مطعم هالة',
    region: 'bani-hasan',
    tag: 'مطعم جبلي داخلي',
    desc: 'مطعم داخل منتجع قمرة الجبلي يقدّم الفطور والغداء والعشاء بمكونات محلية وجلسات داخلية تقي من المطر أو الضباب.',
    types: ['family', 'heritage'],
    min: 60,
    lat: 20.0555526,
    lng: 41.3967222,
    image: 'guide-dining',
    photoAlt: 'مطعم هالة في جبل خيرة',
    aliases: 'هالة مطعم هالة غداء عشاء فطور',
  },
  {
    id: 'gamra-resort',
    name: 'منتجع قمرة الجبلي',
    region: 'bani-hasan',
    tag: 'استراحة وإطلالات مغطاة',
    desc: 'وجهة إقامة واستراحة على جبل خيرة تضم أجنحة مطلة وجلسات داخلية مناسبة في تقلبات الطقس.',
    types: ['family', 'nature'],
    min: 60,
    lat: 20.0555526,
    lng: 41.3967222,
    image: 'guide-chalet',
    photoAlt: 'منتجع قمرة الجبلي في بني حسن',
    aliases: 'قمرة منتجع قمرة جبل خيرة',
  },
];

for (const stop of [...expandedStops, ...promotedGuideStops]) {
  const x = terrainProjection.x + (stop.lng - terrainProjection.lng) * terrainProjection.xScale;
  const y = terrainProjection.y - (stop.lat - terrainProjection.lat) * terrainProjection.yScale;
  geo.stations[stop.id] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

export const toLngLat = ([x, y]: [number, number]): [number, number] => [
  terrainProjection.lng + (x - terrainProjection.x) / terrainProjection.xScale,
  terrainProjection.lat - (y - terrainProjection.y) / terrainProjection.yScale,
];

export const destinationAreas: DestinationArea[] = [
  { id: 'baha', region: 'city', name: 'مدينة الباحة', ids: ['raghdan', 'hussam'], image: 'cityCover', tag: 'غابات وإطلالات' },
  { id: 'makhwah', region: 'south', name: 'المخواة', ids: ['ain', 'shada'], image: 'ain', tag: 'قرى حجرية ومرتفعات' },
  ...expandedStops.map((stop) => ({
    id: stop.region,
    region: stop.region,
    name: stop.county,
    ids: [stop.id],
    image: stop.id,
    tag: stop.tag,
  })),
];

export const regionalStops = new Map<string, ExpandedStop>(
  expandedStops.map((stop) => [stop.id, stop])
);

export const stops: StopBase[] = [
  {
    id: 'hussam',
    name: 'منتزه الأمير حسام',
    region: 'city',
    tag: 'حدائق وعائلات',
    desc: 'ممرات للمشي ومساحات خضراء حول البحيرة، في محطة قريبة من قلب مدينة الباحة',
    types: ['family'],
    min: 65,
    lat: 20.01047,
    lng: 41.44972,
    image: images.hussam ? 'hussam' : 'city',
    photoAlt: images.hussam ? 'منتزه الأمير حسام' : 'إطلالة على مدينة الباحة',
  },
  {
    id: 'raghdan',
    name: 'غابة رغدان',
    region: 'city',
    tag: 'غابات وإطلالات',
    desc: 'أشجار العرعر وإطلالات على جبال السروات، في غابة تناسب نزهة هادئة وسط المرتفعات',
    types: ['nature', 'family'],
    min: 90,
    lat: 20.02298,
    lng: 41.43581,
    image: 'raghdan',
  },
  {
    id: 'ain',
    name: 'قرية ذي عين',
    region: 'south',
    tag: 'قرى حجرية وتراث',
    desc: 'بيوت حجرية تتدرج فوق سفح الجبل. خصص وقتًا للتجول بين أزقة القرية وتأمل تفاصيل عمارتها',
    types: ['heritage'],
    min: 100,
    lat: 19.93057,
    lng: 41.4428,
    image: 'ain',
    aliases: 'ذي العين ذي عين الأثرية المخواة',
  },
  {
    id: 'shada',
    name: 'جبل شدا الأعلى',
    region: 'south',
    tag: 'جبال ومغامرات',
    desc: 'طريق جبلي يمر بين تكوينات الجرانيت وقرى شدا. المحطة تشير إلى موقع في نطاق الجبل',
    types: ['nature'],
    min: 120,
    lat: 19.83882,
    lng: 41.31178,
    image: 'shada',
    aliases: 'شدى شدا المخواة تهامة',
  },
  ...expandedStops.map((stop) => ({
    ...stop,
    image: stop.id,
    photoAlt: stationPhotoInfo[stop.id]?.caption,
    operational: stopOperationalCatalog[stop.id] || {
      district: stop.county,
      accessPoint: stop.desc,
      accessSource: 'مرجع بوابة الباحة',
      walkingLevel: 'moderate' as const,
      walkingLabel: 'مشي متوسط حسب طبيعة الموقع',
      familyFriendly: stop.types.includes('family'),
      indoorOrCovered: false,
      facilities: [stop.tag],
      facilitiesSource: 'مرجع بوابة الباحة',
      hoursVerified: null,
      qualifiedPlannable: false,
    },
  })),
  ...promotedGuideStops.map((stop) => ({
    ...stop,
    operational: stopOperationalCatalog[stop.id],
  })),
];

for (const stop of stops) {
  if (!stop.operational && stopOperationalCatalog[stop.id]) {
    stop.operational = stopOperationalCatalog[stop.id];
  }
}

export const plannableDestinations = stops.filter((s) => s.operational?.qualifiedPlannable);

export const places = new Map<string, StopBase>(stops.map((stop) => [stop.id, stop]));

export const guideTopics = [
  { id: 'attractions', name: 'المزارات السياحية', aliases: 'سوق السبت بلجرشي المتحف الأبنوي غابة خيرة شلال' },
  { id: 'dining', name: 'المطاعم والأكلات', aliases: 'هالة البستان الخبزة المقناة الدغابيس البن الشدوي قهوة طعام' },
  { id: 'camping', name: 'المخيمات والإقامة', aliases: 'تخييم مخيم خيمة تصريح مبيت منتجع ماكامايا الكهف الشفا شدا الأسفل' },
];

export const HERO_VIDEO_PLAYBACK_RATE = 0.55;

export const heroVideoCues: HeroCue[] = [
  { start: 0.0, title: 'غابة رغدان', lead: 'إطلالات شاهقة من مرتفعات الباحة بين أشجار العرعر وأجواء الضباب' },
  { start: 1.5, title: 'شلال غابة خيرة', lead: 'مياه متدفقة تنساب بين الصخور وسط الغطاء النباتي الكثيف' },
  { start: 3.0, title: 'قرية ذي عين', lead: 'قرية حجرية تاريخية تتلألأ عند الغروب بين حدائق النخيل والجبال' },
  { start: 4.5, title: 'الممشى المعلّق بالسروات', lead: 'جسر مشاة يطل على أودية السروات والضباب فوق قمم الجبال' },
  { start: 6.0, title: 'جبل شدا الأعلى', lead: 'قمم جرانيتية مهيبة تعانق السحاب وتضاريس جبلية ساحرة' },
  { start: 7.5, title: 'مزارع وادي ذي عين', lead: 'مدرّجات خضراء وارفة ترويها العيون الطبيعية بين بساتين الموز والنخيل' },
  { start: 9.0, title: 'منتزه الأمير حسام', lead: 'بحيرات وممرات خضراء مصممة لأجمل الأوقات العائلية في قلب الباحة' },
  { start: 10.5, title: 'مدرّجات السحاب', lead: 'مدرّجات جبلية غائمة يلفّها الضباب وتكسوها الطبيعة الخضراء' },
  { start: 12.0, title: 'مطلّات الغروب بالباحة', lead: 'ممرات جبلية مشمسة ومطلّات ذهبية تطل على أعماق الأودية وقت الغروب' },
  { start: 13.5, title: 'الحصون والقرى الحجرية', lead: 'تراث عمراني أصيل تشهد عليه الحصون الصخرية والقرى العريقة بالمنطقة' },
];

export const stationDescriptions: Record<string, string> = {
  hussam: 'بحيرة هادئة وممرات مشي خضراء وجلسات عائلية بقلب الباحة',
  raghdan: 'غابة عرعر كثيفة وممشى معلّق بإطلالات ساحرة على السروات',
  ain: 'قرية حجرية أثرية بين بساتين الموز وعين الماء الجارية',
  shada: 'قمم جرانيتية وكهوف طبيعية ومدرجات البن الشدوي الأصيل',
  'baljurashi-center': 'وسط بلجرشي التراثي ومحيط سوق السبت والحرف التقليدية',
  khulb: 'جلسات جبلية ظليلة وإطلالات مفتوحة على مرتفعات المندق',
  'aqiq-center': 'جولة هادئة بوسط العقيق قرب سد الوادي والمعالم الريفية',
  khalif: 'قريتان أثريتان بالحصون والعمارة الحجرية قرب قلوة',
  tharwa: 'مسطحات خضراء ممتدة وممرات نزهة عائلية بمحافظة القرى',
  mishari: 'نزهة هادئة بين الأشجار المعمرة قرب غابة جدر ببني حسن',
  'hajrah-center': 'بلدة تهامية دافئة بتراث أصيل وسوق الأحد الشعبي',
  'ghamid-center': 'بلدة ريفية هادئة جنوب الباحة تحتضن سوق السبت التراثي',
  'khairah-forest-park': 'مدخل شلال خيرة بين أشجار العرعر والهواء الجبلي العليل',
  'museums-09': 'مقتنيات تراثية وأدوات زراعة تقليدية في قاعات مغطاة',
  'khazim-farm': 'مزرعة ريفية بجوار سد الطلقية بأشجار الفاكهة الموسمية',
  'farms-13': 'مدرجات زيتون وزراعة فراولة وحديقة طيور عائلية بالعقيق',
  'park-shorouq': 'متنزه عائلي ببحيرة ونوافير ومقاهي وممرات مشي مستوية',
  shahbah: 'حديقة هادئة بأشجار ظليلة وممرات خفيفة وألعاب للأطفال',
  'mohammed-bin-saud-park': 'حديقة متكاملة بممرات مهيّأة وجلسات مريحة وسط الباحة',
  habashi: 'حديقة عائلية بممرات سهلة وألعاب أطفال وملاعب بالباحة',
  'north-park': 'مسطحات خضراء واسعة وملاعب وممرات مشي شمال الباحة',
  'hala-restaurant': 'ضيافة جبلية بأطباق محلية وجلسات داخلية على جبل خيرة',
  'gamra-resort': 'أجنحة جبلية مطلة وجلسات داخلية هادئة فوق جبل خيرة',
};

export const placeNotes: Record<string, PlaceNote> = {
  hussam: {
    area: 'مدينة الباحة',
    about:
      'واحة حضرية متكاملة في قلب مدينة الباحة تجمع بين البحيرة الهادئة والمسطحات الخضراء والممرات الممهّدة المصممة لتجربة عائلية مريحة.',
    ideas: [
      'استمتع بجولة مشي هادئة حول البحيرة الصناعية مع توقفات مريحة عند الجلسات المطلة على الماء.',
      'خصّص وقتاً للعائلة في مناطق ألعاب الأطفال والمسطحات الخضراء الواسعة خلال فترة العصر.',
      'يمكن دمج الزيارة بسلاسة مع غابة رغدان القريبة لقضاء يوم متكامل بين الطبيعة والخدمات.',
    ],
  },
  raghdan: {
    area: 'مدينة الباحة',
    about:
      'أبرز الغابات الجبلية في منطقة الباحة، تشتهر بأشجار العرعر الكثيفة والممشى المعلّق وإطلالاتها البانورامية الخلابة على منحدرات السروات.',
    ideas: [
      'ابدأ بنزهة هادئة بين أشجار العرعر واستكشف الممشى المعلّق لالتقاط صور بانورامية للضباب والوادي.',
      'استرح في الجلسات العائلية الظليلة واستمتع بالأجواء المعتدلة ونسائم السراة خاصة قبيل الغروب.',
      'تفقّد حديقة اللافندر والمطلات الجانبية القريبة لإثراء جولتك بتجربة بصرية متكاملة.',
    ],
  },
  ain: {
    area: 'محافظة المخواة',
    about:
      'تحفة معمارية حجرية تاريخية تتربع فوق جبل من الرخام الأبيض وسط بساتين الموز والنخيل بجوار عين الماء الدائمة.',
    ideas: [
      'تأمّل التكوين المعماري المتدرّج للقرية من المطلّ الخارجي قبل صعود أزقتها وممراتها الحجرية.',
      'تجول بهدوء بين المباني التراثية والحصون القديمة والتقط صوراً لتفاصيل البناء الحجري الأصيل.',
      'اختم جولتك باستراحة قصيرة قرب عين الماء وبساتين الموز والكادي التي تشتهر بها القرية.',
    ],
  },
  shada: {
    area: 'المخواة وجبال شدا',
    about:
      'محمية جبلية فريدة تتألق بتكويناتها الجرانيتية النادرة وكهوفها الطبيعية ومدرجات البُن الشدوي، حيث يشكّل الطريق الجبلي نفسه جزءاً من متعة الرحلة.',
    ideas: [
      'توقّف عند المطلات الجبلية لتأمل التشكيلات الصخرية الجرانيتية وتصوير مشاهد القمم والضباب.',
      'استكشف مدرجات زراعة البُن الشدوي العريق وتعرّف على الكهوف الصخرية الطبيعية المنتشرة بالجبل.',
      'نسّق الزيارة مع قرية ذي عين التراثية في المسار ذاته للجمع بين سحر الطبيعة وعمق التاريخ.',
    ],
  },
  'baljurashi-center': {
    area: 'محافظة بلجرشي',
    about:
      'مركز تراثي نابض بالحياة يجمع عراقة الأسواق الشعبية وجمال العمارة المحلية في أجواء السراة الجبلية المعتدلة.',
    ideas: [
      'زُر سوق السبت الشعبي صباحاً لاستكشاف المنتجات المحلية من العسل والفواكه الموسمية والحرف اليدوية.',
      'تجول في أرجاء الحي القديم وتعرّف على ملامح البناء التقليدي والضيافة الأصيلة لأهالي بلجرشي.',
      'يمكن استكمال البرنامج بزيارة المتحف الأبنوي أو مزرعة الخازم القريبة لإثراء التجربة الريفية.',
    ],
  },
  khulb: {
    area: 'محافظة المندق',
    about:
      'متنزه جبلي رحب في مرتفعات المندق يتميز بمسطحاته الخضراء وجلساته الظليلة وإطلالاته المفتوحة على الأودية المحيطة.',
    ideas: [
      'اختر إحدى الجلسات المرتفعة المطلة على الأودية للاستمتاع بالهواء العليل والمشاهد الطبيعية الهادئة.',
      'خصّص جولة مشي خفيفة بين الممرات الخضراء لالتقاط صور تذكارية لطبيعة مرتفعات المندق.',
      'استمتع بأجواء ما بعد العصر التي تمنح المتنزه طابعاً عائلياً مريحاً وإضاءة طبيعية مميزة.',
    ],
  },
  'aqiq-center': {
    area: 'محافظة العقيق',
    about:
      'بوابة منطقة الباحة الشرقية ومقر مطارها الإقليمي، وتجمع بين سهولة التنقل والقرب من الأودية والوجهات الريفية الهادئة.',
    ideas: [
      'ابدأ بجولة منظمة في وسط المحافظة واستفد من خدماتها ومقاهيها كنقطة انطلاق مريحة لرحلتك.',
      'أضف زيارة سد وادي العقيق ضمن جولتك لمشاهدة التضاريس المفتوحة والمناظر الطبيعية الهادئة.',
      'نسّق التوقف في مزرعة الزيتونة القريبة للاستمتاع بالتجربة الزراعية الريفية وحديقة الطيور.',
    ],
  },
  khalif: {
    area: 'محافظة قلوة',
    about:
      'قريتان أثريتان عريقتان تشتهران بالحصون والمباني الحجرية التاريخية التي توثّق الإرث المعماري الأصيل في تهامة الباحة.',
    ideas: [
      'تعرّف على هندسة الحصون الحجرية المترابطة والنقوش التقليدية التي تميّز عمارة القريتين.',
      'استفد من إضاءة الصباح أو أواخر العصر لالتقاط صور معمارية واضحة للتفاصيل الصخرية.',
      'خطّط للزيارة خلال فصلي الخريف أو الشتاء للاستمتاع باعتدال الأجواء في قطاع تهامة.',
    ],
  },
  tharwa: {
    area: 'محافظة القرى',
    about:
      'متنزه وطني واسع يجمع المسطحات الخضراء الممتدة والغطاء النباتي المتنوع في بيئة طبيعية مثالية للاسترخاء والنزهات العائلية.',
    ideas: [
      'استمتع بجلسة عائلية وسط المساحات الخضراء الواسعة والهواء الجبلي المنعش بعيداً عن صخب المدينة.',
      'مارس المشي الخفيف على الممرات الطبيعية المفتوحة وتأمل الغطاء النباتي الكثيف بالمتنزه.',
      'احرص على الزيارة خلال ساعات النهار أو قبيل الغروب للاستفادة من الأجواء المعتدلة.',
    ],
  },
  mishari: {
    area: 'محافظة بني حسن',
    about:
      'وجهة طبيعية هادئة تحيط بها الأشجار المعمرة وتجاور غابة جدر، ما يجعلها خياراً مثالياً للنزهات الهادئة والاستجمام.',
    ideas: [
      'اقضِ وقتاً مريحاً في الجلسات الظليلة بين الأشجار المعمرة واستمتع بالهدوء ونسائم الجبال.',
      'اربط الزيارة بمتنزه غابة خيرة والشلال القريبين لقضاء يوم طبيعي حافل في بني حسن.',
      'التقط صوراً للمساحات الخضراء وتدرّج الضباب الجبلي خلال الأوقات المعتدلة من اليوم.',
    ],
  },
  'hajrah-center': {
    area: 'محافظة الحجرة',
    about:
      'بلدة تهامية دافئة شتاءً تجمع بين الأصالة الريفية وتنوّع الأودية المحيطة والأسواق الشعبية الأسبوعية.',
    ideas: [
      'تفقّد سوق الأحد الشعبي عند توافق زيارتك معه للتعرّف على المنتجات الريفية والموروث المحلي.',
      'استمتع بجولة استكشافية هادئة بين الأودية والطبيعة التهامية الدافئة خلال فصل الشتاء.',
      'تذوّق الضيافة المحلية والمنتجات الزراعية الطازجة التي تشتهر بها مزارع المحافظة.',
    ],
  },
  'ghamid-center': {
    area: 'محافظة غامد الزناد',
    about:
      'بلدة هادئة جنوب المنطقة تتميز بطابعها الريفي الأصيل وأسواقها التقليدية وأجوائها الدافئة خلال الأشهر الباردة.',
    ideas: [
      'تجول في محيط سوق السبت الشعبي للتعرّف على الحرف اليدوية والمنتجات المحلية الأصيلة.',
      'استمتع بمشهد الجبال والأودية الهادئة التي تمنح الزائر تجربة ريفية بعيدة عن الازدحام.',
      'اجعل الزيارة نهارية في الشتاء أو الربيع للاستفادة من الأجواء الدافئة والمعتدلة.',
    ],
  },
  'khairah-forest-park': {
    area: 'محافظة بني حسن',
    about:
      'متنزه غابة خيرة هو البوابة الطبيعية لشلال خيرة، حيث تلتقي أشجار العرعر الكثيفة بتدفّق المياه الجبلية في مشهد ساحر.',
    ideas: [
      'ابدأ بجولة صباحية منعشة بين أشجار العرعر والممرات المظلّلة وصولاً إلى إطلالة شلال خيرة.',
      'التقط صوراً بانورامية لتدفق المياه بين الصخور خاصة بعد هطول الأمطار الموسمية.',
      'يمكن استكمال الزيارة بغداء جبلي في مطعم هالة أو استراحة هادئة بمنتجع قمرة القريب.',
    ],
  },
  'museums-09': {
    area: 'محافظة بلجرشي',
    about:
      'متحف تراثي متكامل يوثّق ملامح الحياة اليومية قديماً عبر مقتنيات نادرة وأدوات زراعية وأزياء تقليدية داخل قاعات مغطاة.',
    ideas: [
      'استكشف أقسام الأدوات الزراعية والمقتنيات المنزلية القديمة التي تروي تاريخ المنطقة.',
      'يُعد المتحف خياراً مثالياً للزيارة في أوقات المطر أو الضباب الكثيف بفضل قاعاته المغطاة.',
      'نسّق الزيارة مع جولة صباحية في سوق السبت الشعبي ببلجرشي لتجربة ثقافية متكاملة.',
    ],
  },
  'khazim-farm': {
    area: 'محافظة بلجرشي',
    about:
      'مزرعة ريفية سياحية مطلة على بحيرة سد الطلقية تشتهر بمدرجات الفاكهة الموسمية وأجوائها الهادئة المناسبة للعائلات.',
    ideas: [
      'تجول بين أشجار الفاكهة الموسمية وتعرّف على أساليب الزراعة الجبلية التقليدية بالمنطقة.',
      'استمتع بإطلالة المزرعة على بحيرة سد الطلقية والتقط صوراً للمشهد الريفي الهادئ.',
      'اسأل القائمين على المزرعة عن المنتجات الطازجة وتجارب القطف المتاحة خلال الموسم.',
    ],
  },
  'farms-13': {
    area: 'محافظة العقيق',
    about:
      'وجهة زراعية سياحية تجمع بين مدرجات الزيتون والزراعة المائية للفراولة وحديقة الطيور في تجربة عائلية وتعليمية ممتعة.',
    ideas: [
      'اصطحب العائلة في جولة بين مدرجات الزيتون وبيوت الزراعة المائية للفراولة.',
      'خصص وقتاً لزيارة حديقة الطيور التي تضيف متعة خاصة للأطفال خلال الجولة.',
      'تذوّق منتجات المزرعة الطبيعية الطازجة واختر أوقات الصباح أو العصر لجولة مريحة.',
    ],
  },
  'park-shorouq': {
    area: 'مدينة الباحة',
    about:
      'متنزه عائلي رحب يضم بحيرة ونوافير ومسطحات خضراء ومقاهي ومناطق ألعاب بممرات مستوية وسهلة الحركة.',
    ideas: [
      'استمتع بجولة مشي مريحة على الممرات المستوية المحيطة بالبحيرة والنوافير المائية.',
      'توقف في إحدى المقاهي أو الجلسات العائلية للاستمتاع بالأجواء المعتدلة وقت العصر.',
      'توفّر مناطق الألعاب المخصصة للأطفال تجربة آمنة وممتعة لكافة أفراد الأسرة.',
    ],
  },
  shahbah: {
    area: 'مدينة الباحة',
    about:
      'حديقة جبلية هادئة تكسوها الأشجار الظليلة وتوفّر ممرات خفيفة ومناطق ألعاب للأطفال في أجواء مريحة قريبة من المدينة.',
    ideas: [
      'اقضِ استراحة هادئة بين الأشجار الظليلة والمسطحات الخضراء بعيداً عن الزحام.',
      'استفد من الممرات الخفيفة المناسبة للمشي القصير ومناطق اللعب المهيّأة للأطفال.',
      'يُفضّل اختيار ساعات ما بعد العصر للاستمتاع ببرودة النسيم وجمال الإضاءة الطبيعية.',
    ],
  },
  'mohammed-bin-saud-park': {
    area: 'مدينة الباحة',
    about:
      'حديقة حضرية متكاملة المرافق داخل مدينة الباحة تتميز بممرات مهيّأة وجلسات عائلية مريحة تناسب جميع الأعمار.',
    ideas: [
      'مثالية لاستراحة عائلية هادئة دون مشي شاق بفضل ممراتها المستوية وتكامل مرافقها.',
      'استمتع بالمسطحات الخضراء والجلسات المنظمة المناسبة لكبار السن والعائلات.',
      'يمكن إدراجها كمحطة استراحة مريحة بين جولات غابة رغدان ووسط المدينة.',
    ],
  },
  habashi: {
    area: 'مدينة الباحة',
    about:
      'حديقة عائلية حيوية تضم ممرات مشي سهلة وألعاب أطفال وملاعب رياضية ضمن نطاق مدينة الباحة.',
    ideas: [
      'استفد من الملاعب الرياضية ومناطق ألعاب الأطفال لإضفاء نشاط ترفيهي ممتع للعائلة.',
      'مارس المشي الخفيف على الممرات الواسعة والمستوية وسط المسطحات الخضراء.',
      'خيار مناسب لوقفة عائلية مسائية أو بعد العصر بفضل سهولة الوصول وتوفر المواقف.',
    ],
  },
  'north-park': {
    area: 'مدينة الباحة',
    about:
      'مساحات خضراء ممتدة شمال مدينة الباحة تجمع بين الملاعب الرياضية وممرات المشي المفتوحة في أجواء هادئة.',
    ideas: [
      'استمتع بمساحات الجلوس المفتوحة والأجواء الهادئة المناسبة للاسترخاء العائلي.',
      'مارس المشي أو الأنشطة الرياضية الخفيفة في الملاعب والممرات المهيّأة بالحديقة.',
      'اختر فترة العصر للاستمتاع بالهواء المعتدل وإطلالة الأفق المفتوح شمال المدينة.',
    ],
  },
  'hala-restaurant': {
    area: 'محافظة بني حسن',
    about:
      'تجربة ضيافة جبلية راقية داخل منتجع قمرة على جبل خيرة، تقدّم أطباقاً مستوحاة من مكونات المنطقة وجلسات داخلية مريحة.',
    ideas: [
      'تذوّق الأطباق المحلية المحضّرة بالعسل وزيت الزيتون والمنتجات الطازجة من مزارع الباحة.',
      'استمتع بالجلسات الداخلية الدافئة والمطلة التي تمنحك تجربة مريحة في أجواء الضباب والمطر.',
      'محطة مثالية للغداء أو القهوة بعد استكشاف غابة خيرة وشلالها القريب.',
    ],
  },
  'gamra-resort': {
    area: 'محافظة بني حسن',
    about:
      'وجهة إقامة واستجمام جبلية على قمة جبل خيرة تضم أجنحة مطلة وجلسات داخلية فسيحة وسط الطبيعة الهادئة.',
    ideas: [
      'استرخِ في الأجنحة والجلسات المطلة على الغابات والأودية في أجواء خصوصية وهدوء تام.',
      'مثالية للاستراحة الداخلية الأنيقة عند تغيّر الأحوال الجوية أو هطول الأمطار الجبلية.',
      'اجعل المنتجع قاعدة إقامة مريحة لاستكشاف معالم بني حسن وغابة خيرة بسهولة.',
    ],
  },
};

for (const stop of expandedStops) {
  if (!placeNotes[stop.id]) {
    placeNotes[stop.id] = {
      area: `محافظة ${stop.county}`,
      about: stop.desc,
      ideas: [
        'استكشف أبرز المعالم والمشاهد الطبيعية المحيطة بالمحطة على مهل.',
        'تعرّف على الطابع المحلي والمنتجات الموسمية التي تشتهر بها المحافظة.',
        'نسّق وقت الزيارة وفق الأجواء اليومية للاستمتاع بتجربة مريحة.',
      ],
    };
  }
}

export const climateCities: Record<string, ClimateCity> = {
  baha: {
    name: 'مدينة الباحة',
    area: 'مرتفعات السراة',
    region: 'city',
    lat: 20.0129,
    lng: 41.4677,
    image: 'cityCover',
    intro: 'خلّ المدينة نقطة بداية لنزهة بين أشجار رغدان، أو جولة قصيرة حول بحيرة منتزه الأمير حسام',
    climate: 'ترتبط مرتفعات السراة بالصيف المعتدل مقارنة بالمناطق المنخفضة. خذ اختلاف الارتفاع بين المدينة والوجهات المحيطة في الحسبان عند اختيار وقتك',
    tips: {
      spring: 'ابدأ بالممرات الخضراء في رغدان واترك وقتًا لإطلالة على السراة.',
      summer: 'خطّط لنزهة في رغدان أو حول بحيرة الأمير حسام بعد العصر.',
      autumn: 'اختر جولة تصوير قصيرة في الغابة أو حول البحيرة.',
      winter: 'اختر وقتًا نهاريًا لجولة قصيرة في المنتزه عند ملاءمة الأجواء.',
    },
    ids: ['raghdan', 'hussam'],
    source: 'https://spa.gov.sa/en/N2631660',
  },
  makhwah: {
    name: 'المخواة',
    area: 'تهامة الباحة',
    region: 'south',
    lat: 19.776,
    lng: 41.438,
    image: 'ain',
    intro: 'من المخواة تبدأ جولة ذي عين بين البيوت الحجرية والسلالم والإطلالات. جبل شدا له أجواء مختلفة عن المدينة بسبب الارتفاع',
    climate: 'المخواة من وجهات الباحة الشتوية بفضل اعتدال أجواء تهامة في هذا الفصل. تختلف الأجواء بين قاع الوادي والطرق الجبلية',
    tips: {
      spring: 'خصّص فترة صباحية لزيارة ذي عين وتأمل عمارة القرية.',
      summer: 'اختَر جولة قصيرة في الصباح وراجع التوقعات قبل موعدها.',
      autumn: 'ابدأ من أسفل ذي عين وخصّص وقتًا للتصوير في الأزقة.',
      winter: 'استكشف قرية ذي عين نهارًا واترك وقتًا للتوقف عند الإطلالات.',
    },
    ids: ['ain', 'shada'],
    source: 'https://www.alriyadh.com/274500',
  },
};

for (const stop of expandedStops) {
  climateCities[stop.region] = {
    name: stop.county,
    area: 'وجهات منطقة الباحة',
    region: stop.region,
    lat: stop.lat,
    lng: stop.lng,
    image: stop.id,
    photo: stationPhotoInfo[stop.id],
    ids: [stop.id],
    intro: stop.desc,
    source: stop.source,
  };
}

export const seasons: Record<SeasonKey, SeasonConfig> = {
  spring: { name: 'الربيع', months: 'مارس إلى مايو', city: 'baha', image: 'terraces', start: 9 * 60 },
  summer: { name: 'الصيف', months: 'يونيو إلى أغسطس', city: 'baha', image: 'parks', start: 16 * 60 + 30 },
  autumn: { name: 'الخريف', months: 'سبتمبر إلى نوفمبر', city: 'baha', image: 'mountainCover', start: 15 * 60 + 30 },
  winter: { name: 'الشتاء', months: 'ديسمبر إلى فبراير', city: 'makhwah', image: 'ain', start: 10 * 60 },
};

export const stopVisit: Record<string, StopVisitConfig> = {
  raghdan: {
    city: 'baha',
    walking: 'مشي خفيف ومريح بين الممرات الممهّدة مع نقاط إطلالة متدرجة على المرتفعات.',
    best: 'بعد العصر في الصيف',
    short: 60,
    gallery: [
      ['hero-raghdan', 'مشهد بانورامي لرغدان والسراة'],
      ['raghdan', 'الطريق بين أشجار رغدان'],
    ],
  },
  hussam: {
    city: 'baha',
    walking: 'ممرات مستوية وممهّدة حول البحيرة مناسبة للعائلات وكبار السن وعربات الأطفال.',
    best: 'بعد العصر في الصيف',
    short: 30,
    gallery: [
      ['hussamCover', 'إطلالة واسعة على المنتزه'],
      ['hussam', 'البحيرة وممرات منتزه الأمير حسام'],
    ],
  },
  ain: {
    city: 'makhwah',
    walking: 'سلالم وممرات حجرية متدرّجة بين مستويات القرية، مع إمكانية الاكتفاء بالساحة السفلية والمطلّ.',
    best: 'صباحًا أو أول العصر',
    short: 60,
    hours: [540, 1020],
    hoursSource: 'https://www.visitsaudi.com/content/dam/documents/saudi-summer-guide.pdf',
    gallery: [
      ['ain', 'أزقة ذي عين وسلالمها الحجرية'],
      ['hero-ain', 'القرية مضاءة فوق سفح الجبل'],
    ],
  },
  shada: {
    city: 'makhwah',
    walking: 'طريق جبلي متعرّج ومرتفعات صخرية توفّر نقاط توقف وإطلالات بانورامية مهيّأة للتصوير.',
    best: 'في ضوء النهار',
    short: 60,
    gallery: [
      ['shada', 'تكوينات الجرانيت في جبل شدا'],
      ['hero-shada', 'مشهد بانورامي لقمم جبل شدا'],
    ],
  },
};

for (const stop of expandedStops) {
  stopVisit[stop.id] = {
    city: stop.region,
    best: stop.best,
    short: Math.min(stop.min, 55),
    walking: 'مسارات مريحة ومناسبة لجولة استكشافية منظمة مع توفر نقاط توقف قريبة.',
    gallery: [[stop.id, stationPhotoInfo[stop.id].caption]],
  };
}

for (const stop of promotedGuideStops) {
  const ops = stopOperationalCatalog[stop.id];
  if (!stationDescriptions[stop.id]) stationDescriptions[stop.id] = stop.desc;
  if (!placeNotes[stop.id]) {
    placeNotes[stop.id] = {
      area: `محافظة ${ops?.district || 'الباحة'}`,
      about: stop.desc,
      ideas: [
        'استمتع بجولة هادئة داخل الوجهة وتعرّف على أبرز مرافقها وإطلالاتها.',
        'اختر الأوقات المعتدلة للاستفادة من الأجواء الجبلية المميزة بالمنطقة.',
        'يمكن تنسيق الزيارة ضمن مسارك اليومي مع المحطات القريبة بالمحافظة.',
      ],
    };
  }
  const visitCity =
    stop.region === 'baljurashi'
      ? 'baljurashi'
      : stop.region === 'aqiq'
        ? 'aqiq'
        : stop.region === 'bani-hasan' || stop.region === 'bani-hassan'
          ? 'bani-hassan'
          : 'baha';
  stopVisit[stop.id] = {
    city: visitCity,
    best: ops?.hoursVerified ? ops.hoursVerified.label : 'وفق الأجواء اليومية',
    short: Math.min(stop.min, 45),
    walking: ops?.walkingLabel || 'مشي خفيف',
    ...(ops?.hoursVerified
      ? {
          hours: [ops.hoursVerified.openStartMin, ops.hoursVerified.openEndMin] as [number, number],
          hoursSource: ops.hoursVerified.source,
        }
      : {}),
    gallery: [[stop.image, stop.photoAlt || stop.name]],
  };
}

export const monthWords: RegExp[] = [
  /يناير|كانون الثاني/,
  /فبراير|شباط/,
  /مارس|اذار/,
  /ابريل|نيسان/,
  /مايو|ايار/,
  /يونيو|حزيران/,
  /يوليو|تموز/,
  /اغسطس|اب[\s،.]|اب$/,
  /سبتمبر|ايلول/,
  /اكتوبر|تشرين الاول/,
  /نوفمبر|تشرين الثاني/,
  /ديسمبر|كانون الاول/,
];

export const conciergeRegions: Record<string, string> = {
  all: 'الباحة بالكامل',
  city: 'مدينة الباحة',
  south: 'المخواة وجبال شدا',
  ...Object.fromEntries(destinationAreas.slice(2).map((area) => [area.region, area.name])),
};

export const conciergeDays: Record<string, string> = {
  1: 'يوم واحد',
  2: 'يومان',
  3: '3 أيام',
  4: '4 أيام',
  5: '5 أيام',
  6: '6 أيام',
  7: 'أسبوع كامل (7 أيام)',
};

export const conciergeSections: Record<string, { label: string; text?: string }> = {
  destinations: { label: 'استعرض كل الوجهات' },
  'destination-directory': { label: 'افتح دليل الوجهات العشر' },
  attractions: {
    label: 'افتح دليل المزارات',
    text: 'تقدر تبدأ بسوق السبت والمتحف الأبنوي في بلجرشي أو تختار غابة خيرة وشلالها، والدليل يعرض 144 معلمًا مع روابط الخرائط والتفاصيل.',
  },
  dining: {
    label: 'افتح دليل المطاعم والمقاهي',
    text: 'جرّب الخبزة المقنّاة والبُن الشدوي والمأكولات الشعبية، أو اختر من المطاعم والمقاهي الموزعة في مدينة الباحة وبلجرشي والمخواة والمندق.',
  },
  camping: {
    label: 'افتح دليل الإقامة والمخيمات',
    text: 'نوفر خيارات للفنادق والمنتجعات والشاليهات والمخيمات البيئية مثل ماكامايا قرب رغدان ومنتجع الكهف في جبل شدا الأسفل.',
  },
  'visit-guide': { label: 'افتح دليل الباحة' },
  'visit-season': { label: 'استكشف أجواء الفصول' },
  planner: { label: 'افتح مخطط الرحلة' },
  summary: { label: 'افتح ملخص الرحلة' },
  app: { label: 'افتح صفحة الباحة آب' },
  faq: { label: 'صفحة الأسئلة الشائعة' },
};

export const conciergePrompts: Record<string, string> = {
  plan: 'رتّب لي رحلة مخصصة',
  'weather-now': 'أجواء اليوم والطقس في الباحة',
  discover: 'اقترح لي وجهات الباحة',
  guide: 'الأكل والمبيت',
  dining: 'اقترح لي مطاعم وكافيهات',
  camping: 'اقترح لي إقامة أو مخيمات',
  saved: 'اعرض محطات رحلتي',
  travel: 'دليل السفر والمطار والوصول',
  faq: 'الأسئلة الشائعة وخدمة الزوار',
  help: 'وش تقدر تساعدني فيه؟',
};

export const travelSources: Record<'visa' | 'evisa' | 'car', { label: string; url: string }> = {
  visa: { label: 'تحقّق من الأهلية في تأشيرة السعودية', url: 'https://ksavisa.sa/visa/tourism/details' },
  evisa: { label: 'شروط التأشيرة السياحية الإلكترونية', url: 'https://visa.visitsaudi.com/Home/TermsConditions' },
  car: { label: 'دليل تأجير السيارات الرسمي', url: 'https://www.tga.gov.sa/ar/WebSiteFile/bd07e77a-640e-4dd7-a24d-23ca361e8ea4' },
};

export const travelProfiles: Record<TravelProfileKey, string> = {
  domestic: 'رحلتي من داخل السعودية',
  overseas: 'قادم من خارج السعودية',
  gulf: 'مواطن أو مقيم في دولة خليجية',
};

export const guidePlaceAliases: [string, RegExp][] = [
  ['tuesday-market', /سوق الثلاثاء|سوق الثلاثا/],
  ['saturday-market', /سوق السبت/],
  ['museums-09', /الابنو/],
  ['farms-13', /مزرعه الزيتون|الزيتونه/],
  ['khazim-farm', /مزرعه الخازم|الخازم/],
  ['park-shorouq', /منتزه الشروق|حديقه الشروق|الشروق/],
  ['shahbah', /حديقه شهبه|(?:^| )شهبه(?:$| )/],
  ['habashi', /حديقه الحبشي|(?:^| )الحبشي(?:$| )/],
  ['north-park', /حديقه الشمال/],
  ['mohammed-bin-saud-park', /محمد بن سعود/],
  ['almond-farm', /بساتين اللوز|مزرعه اللوز/],
  ['hotels-06', /المنتزه الوطني/],
  ['gamra-resort', /منتجع قمره|جبل قمره|قمره الجبلي|(?:^| )قمره(?:$| )/],
  ['hala-restaurant', /مطعم هاله|(?:^| )هاله(?:$| )/],
  ['restaurants-02', /مطعم البستان|(?:^| )البستان(?:$| )/],
  ['khairah-waterfall', /شلال خيره/],
  ['khairah-forest-park', /غابه خيره|متنزه خيره/],
  ['khulb', /متنزه الخلب|(?:^| )الخلب(?:$| )/],
  ['raghdan', /غابه رغدان|متنزه رغدان|رغدان/],
  ['hussam', /الامير حسام/],
  ['dhee-ain', /ذي عين|ذي العين|ذى عين/],
];

export const cityStories: CityStory[] = [
  {
    id: 'khair',
    kind: 'event',
    tag: 'منتجات محلية',
    title: 'مهرجان خيرات الباحة',
    date: '2026-08-04',
    dateLabel: '4 أغسطس 2026',
    dateContext: 'تاريخ التغطية',
    location: 'سوق رغدان التاريخي | مدينة الباحة',
    summary: 'محاصيل موسمية وعسل محلي من المزارعين والنحّالين في أروقة سوق رغدان',
    details: 'في النسخة الخامسة، التقى الزوار بالمزارعين والنحّالين في 15 ركنًا. عُرضت المحاصيل الموسمية ومنتجات العسل على مدار ثلاثة أيام، وأتاح السوق للزوار الشراء مباشرةً من المنتجين.',
    alt: 'زوار يطّلعون على المحاصيل في أحد أركان مهرجان خيرات الباحة',
    photoCaption: 'من جولة افتتاح النسخة الخامسة',
    credit: 'صحيفة سبق',
    source: 'https://sabq.org/article/W3UKXDV',
  },
  {
    id: 'royal-visit',
    kind: 'archive',
    tag: 'زيارة ملكية',
    title: 'زيارة الملك عبدالله لمنطقة الباحة',
    date: '2006-07-26',
    dateLabel: '26 يوليو 2006',
    dateContext: 'حفل تدشين المشاريع',
    location: 'محافظة العقيق | منطقة الباحة',
    summary: 'لقطة أرشيفية من حفل تدشين مشاريع المنطقة خلال الزيارة',
    details: 'ضمن زيارته التفقدية لمنطقة الباحة، حضر الملك عبدالله بن عبدالعزيز حفلًا في محافظة العقيق افتُتحت فيه مشاريع تنموية ووُضع حجر الأساس لمشاريع أخرى. من بينها مشاريع في التعليم والصحة والطرق.',
    alt: 'الملك عبدالله بن عبدالعزيز خلال حفل تدشين مشاريع منطقة الباحة',
    photoCaption: 'صورة من تغطية الزيارة المنشورة في 27 يوليو 2006',
    credit: 'صحيفة الجزيرة',
    source: 'https://www.al-jazirah.com/2006/20060727/fr1.htm',
    reference: 'https://www.spa.gov.sa/418888',
  },
  {
    id: 'raghdan-market',
    kind: 'event',
    tag: 'حِرف وتراث',
    title: 'افتتاح سوق رغدان التاريخي',
    date: '2025-08-02',
    dateLabel: '2 أغسطس 2025',
    dateContext: 'الافتتاح',
    location: 'سوق رغدان التاريخي | مدينة الباحة',
    summary: 'عروض شعبية وحِرف ومشاهد تحكي تفاصيل الحياة قديمًا',
    details: 'جمعت أمسية الافتتاح بين العروض الشعبية والأعمال الحرفية. تنقّل الزوار بين مقتنيات تاريخية ومشاهد تمثيلية من الحياة اليومية قديمًا، وشاركت الأسر المنتجة والحرفيون في أركان السوق.',
    alt: 'عرض شعبي أمام الزوار في افتتاح سوق رغدان التاريخي',
    photoCaption: 'من فعاليات افتتاح السوق عام 2025',
    credit: 'وكالة الأنباء السعودية',
    source: 'https://www.spa.gov.sa/en/N2372027',
  },
  {
    id: 'honey-festival',
    kind: 'event',
    tag: 'عسل ونحّالون',
    title: 'مهرجان العسل في رغدان',
    date: '2025-08-02',
    dateLabel: '2 أغسطس 2025',
    dateContext: 'ختام النسخة الـ17',
    location: 'متنزه غابة رغدان | مدينة الباحة',
    summary: 'جولة بين أركان النحّالين ومنتجات العسل المحلي',
    details: 'استضاف متنزه غابة رغدان النسخة السابعة عشرة من مهرجان العسل. شارك 34 عارضًا من النحّالين، وتعرّف الزوار على منتجاتهم عبر الأركان والعروض المصاحبة.',
    alt: 'زوار أمام أركان النحّالين في مهرجان العسل بالباحة',
    photoCaption: 'أركان النسخة السابعة عشرة من مهرجان العسل',
    credit: 'وكالة الأنباء السعودية',
    source: 'https://www.spa.gov.sa/N2372186',
    stop: 'raghdan',
  },
];

export const cityStoriesPath = '#city/baha/stories';

export const cityStoryFilters: [string, string, string][] = [
  ['all', 'الكل', 'city-stories'],
  ['event', 'الفعاليات', 'city-calendar'],
  ['archive', 'الأرشيف', 'city-archive'],
];

export const tourGuideCategoryMedia: Record<string, string[]> = {
  parks: ['parks', 'mountainCover'],
  water: ['guide-water'],
  farms: ['terraces'],
  heritage: ['villages', 'ain'],
  museums: ['guide-museum'],
  hotels: ['guide-hotel'],
  chalets: ['guide-chalet'],
  restaurants: ['guide-dining', 'guide-dining-alt'],
  cafes: ['guide-coffee', 'guide-coffee-alt'],
  malls: ['guide-shopping'],
};

export const tourGuideCategoryIcons: Record<string, string> = {
  water: 'directory-water',
  farms: 'directory-farm',
  museums: 'directory-museum',
};

export const tourGuideShortSubtitles: Record<string, string> = {
  raghdan: 'إطلالات السراة وسط أشجار العرعر',
  hussam: 'ممرات مشاة وجلسات حول البحيرة',
  'dhee-ain': 'بيوت حجرية متدرجة وعين ماء جارية',
  'almond-farm': 'تجربة ريفية وأكواخ في بني ظبيان',
  'khazim-farm': 'بجوار بحيرة سد الطلقية في بلجرشي',
  'farms-13': 'مدرجات الزيتون وتجارب زراعية ريفية',
  'museums-09': 'مقتنيات التراث والحياة اليومية',
  'hotels-06': 'إقامة فندقية في قلب بلجرشي',
  'park-shorouq': 'مسطحات خضراء وبحيرة ونوافير',
  'gamra-resort': 'أجنحة جبلية مطلة على جبل خيرة',
  'hala-restaurant': 'مأكولات داخل منتجع قمرة الجبلي',
};

// Edited descriptions for the first three places selected for the detail-page review.
export const placeDetailSampleDescriptions: Partial<Record<string, string>> = {
  'almond-farm': 'منتجع ريفي يضم بحيرة وجلسات وسط الطبيعة، مع مقهى وأكواخ للمبيت.',
  'khairah-waterfall': 'شلال طبيعي، ونقطة الوصول المنشورة له عند متنزه غابة خيرة.',
  hussam: 'منتزه عائلي تحيط ببحيرته ممرات للمشي وجلسات، ويضم مسرحًا مفتوحًا.',
};

export const alBahaRegionsSvg = [
  { name: 'مدينة الباحة', lat: 20.0129, lng: 41.4676, major: true },
  { name: 'بلجرشي', lat: 19.8589, lng: 41.5572, major: true },
  { name: 'المخواة', lat: 19.7764, lng: 41.4419, major: true },
  { name: 'بني حسن', lat: 20.055, lng: 41.398, major: false },
  { name: 'المندق', lat: 20.175, lng: 41.275, major: true },
  { name: 'العقيق', lat: 20.268, lng: 41.648, major: true },
  { name: 'القرى', lat: 20.168, lng: 41.388, major: false },
  { name: 'قلوة', lat: 19.946, lng: 41.253, major: false },
  { name: 'الحجرة', lat: 20.233, lng: 41.05, major: false },
  { name: 'غامد الزناد', lat: 19.594, lng: 41.52, major: false },
];

export const directoryMediaSets: Record<string, string[]> = {
  parks: ['parks', 'raghdan', 'tharwa', 'mountainCover', 'hussam'],
  water: ['guide-water', 'mountain', 'khulb', 'parks', 'terraces'],
  farms: ['terraces', 'mountainCover', 'parks', 'villages', 'culture'],
  heritage: ['villages', 'ain', 'culture', 'khalif', 'terraces'],
  museums: ['guide-museum', 'culture', 'villages', 'khalif', 'cityCover'],
  hotels: ['guide-hotel', 'cityCover', 'mountainCover', 'raghdan', 'terraces'],
  chalets: ['guide-chalet', 'terraces', 'mountainCover', 'parks', 'raghdan'],
  restaurants: ['guide-dining', 'guide-dining-alt', 'cityCover', 'culture', 'terraces'],
  cafes: ['guide-coffee', 'guide-coffee-alt', 'terraces', 'cityCover', 'culture'],
  malls: ['guide-shopping', 'cityCover', 'city', 'culture', 'parks'],
};

export const directoryAdvice: Record<string, { intro: string; tips: string[]; kind: string }> = {
  parks: {
    intro: 'وجهة مناسبة لإضافة محطة استراحة أو نزهة ضمن برنامجك السياحي، مع مراجعة الخدمات المتاحة في الموقع قبل الزيارة',
    tips: [
      'اختَر وقتًا مناسبًا للطقس وأحضر ما تحتاجه للمشي.',
      'تحقق من المرافق وساعات الدخول عبر الجهة المشغّلة.',
      'احفظ موقع الوجهة قبل بدء الرحلة.',
    ],
    kind: 'نزهات ومساحات مفتوحة',
  },
  water: {
    intro: 'تجربة مرتبطة بالمشاهد الطبيعية والأودية، وقد تختلف ظروف الوصول وظهور المياه باختلاف الموسم والطقس',
    tips: [
      'راجع حالة الطقس والطرق قبل الانطلاق.',
      'تجنب مجاري السيول والاقتراب من الحواف غير المهيأة.',
      'تحقق من نقطة الوصول المناسبة قبل التوجه للمكان.',
    ],
    kind: 'طبيعة ومشاهد مائية',
  },
  farms: {
    intro: 'فرصة لاكتشاف الطابع الزراعي للمنطقة؛ تختلف التجارب والمنتجات المتاحة بحسب الموسم وطبيعة المزرعة',
    tips: [
      'اسأل عن مواعيد استقبال الزوار والحجز المسبق.',
      'تحقق من الأنشطة المتاحة في تاريخ زيارتك.',
      'احترم المناطق المخصصة للزوار والأنشطة الزراعية.',
    ],
    kind: 'تجارب ريفية وزراعية',
  },
  heritage: {
    intro: 'محطة لاكتشاف الموروث العمراني والثقافي، مع أهمية احترام الموقع والحفاظ على مبانيه وممراته',
    tips: [
      'ارتدِ حذاء مريحًا للمشي على الممرات.',
      'تحقق من أوقات الزيارة وإمكانية الدخول.',
      'تجنب دخول المباني أو المناطق المغلقة أمام الجمهور.',
    ],
    kind: 'تراث وثقافة',
  },
  museums: {
    intro: 'محطة ثقافية يمكن إضافتها إلى مسار الزيارة عند التحقق من أوقات التشغيل وطبيعة العرض المتاح',
    tips: [
      'تحقق من أوقات الفتح والإغلاق وأيام العطلات.',
      'اسأل عن رسوم الدخول أو ضرورة الحجز.',
      'التزم بإرشادات التصوير داخل المعرض.',
    ],
    kind: 'متاحف وثقافة',
  },
  hotels: {
    intro: 'خيار للإقامة مدرج في الدليل؛ تختلف الغرف والخدمات والأسعار حسب مقدم الخدمة وتاريخ الحجز',
    tips: [
      'راجع التوافر والأسعار مباشرة مع المنشأة.',
      'تحقق من سياسة الحجز والإلغاء.',
      'تأكد من الموقع ومواعيد تسجيل الدخول والخروج.',
    ],
    kind: 'إقامة وخدمات',
  },
  chalets: {
    intro: 'خيار لإقامة قصيرة أو استراحة؛ تختلف التجهيزات والسعة والخصوصية من منشأة لأخرى',
    tips: [
      'تأكد من السعة والتجهيزات قبل الحجز.',
      'اطلب تفاصيل السعر وسياسة الإلغاء.',
      'راجع إحداثيات الموقع وتعليمات الوصول.',
    ],
    kind: 'شاليهات واستراحات',
  },
  restaurants: {
    intro: 'مكان ضمن خيارات الطعام بالباحة؛ القوائم والأسعار والمواعيد قابلة للتغير',
    tips: [
      'راجع القائمة وأوقات العمل قبل الزيارة.',
      'اسأل عن الحجز عند وجود مجموعة كبيرة.',
      'تحقق من الموقع وأرقام التواصل الحالية.',
    ],
    kind: 'طعام وتجارب محلية',
  },
  cafes: {
    intro: 'محطة للاستراحة وتناول المشروبات أثناء الجولة؛ تختلف الجلسات وساعات العمل بحسب المنشأة',
    tips: [
      'تحقق من أوقات العمل والجلسات المتاحة.',
      'راجع الموقع قبل إضافته إلى خط سيرك.',
      'اسأل عن توفر الجلسات أو الحجز إذا لزم الأمر.',
    ],
    kind: 'مقاهٍ واستراحات',
  },
  malls: {
    intro: 'خيار للتسوق أو الاستراحة أثناء زيارة المدينة؛ تختلف المتاجر والخدمات ومواعيدها',
    tips: [
      'راجع ساعات تشغيل المجمع والمتاجر المستهدفة.',
      'تحقق من الموقع والمواقف حسب الحاجة.',
      'خطط للزيارة بما يناسب مسار يومك.',
    ],
    kind: 'تسوق وخدمات',
  },
};

export function createGuideRecordIndex(
  normalizeFn: (v: string) => string
): IndexedGuideRecord[] {
  const cats = new Map(tourGuide.categories.map((c) => [c.id, c.label]));
  return (tourGuide.records as GuideRecord[]).map((place) => ({
    ...place,
    categoryLabel: cats.get(place.category) || '',
    searchBlob: normalizeFn(
      [
        place.name,
        place.district,
        cats.get(place.category) || '',
        place.address || '',
        place.description || '',
        place.id === 'hotels-06' ? 'الفندقية' : '',
        place.id === 'restaurants-02' ? 'البستان' : '',
      ].join(' ')
    ),
  }));
}
