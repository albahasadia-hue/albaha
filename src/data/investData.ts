export type InvestSectorId = 'all' | 'hospitality' | 'entertainment' | 'commercial' | 'municipal';

export interface InvestKpi {
  label: string;
  value: string;
  note: string;
  icon: string;
}

export interface InvestSector {
  id: InvestSectorId;
  label: string;
  summary: string;
  icon: string;
}

export interface InvestProject {
  id: string;
  sector: Exclude<InvestSectorId, 'all'>;
  title: string;
  location: string;
  summary: string;
  highlights: { label: string; icon: string }[];
}

export interface InvestChannel {
  tag: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  external?: boolean;
  categoryIcon: string;
  icon: string;
}

export const INVEST_KPIS: InvestKpi[] = [
  {
    label: 'طلبات الرخص الاستثمارية',
    value: '2.00K',
    note: 'حراك استثماري بلدي متنامٍ في المنطقة',
    icon: '#i-nav-invest',
  },
  {
    label: 'طلبات الرخص التجارية',
    value: '12.47K',
    note: 'تمكين القطاع الخاص والأنشطة الاقتصادية',
    icon: '#i-directory-shopping',
  },
  {
    label: 'الرخص الإنشائية والحفريات',
    value: '14.19K',
    note: '6.17K رخصة إنشائية و8.02K رخصة حفريات',
    icon: '#i-heritage',
  },
  {
    label: 'النطاق السكاني للمنطقة',
    value: '487,108+',
    note: 'نسمة في مدينة الباحة ومحافظاتها',
    icon: '#i-family',
  },
];

export const INVEST_SECTORS: InvestSector[] = [
  {
    id: 'all',
    label: 'جميع القطاعات',
    summary: 'استعرض كافة المجالات والفرص الاستثمارية المتاحة في منطقة الباحة.',
    icon: '#i-nav-invest',
  },
  {
    id: 'hospitality',
    label: 'الضيافة والمنتجعات',
    summary: 'مشاريع فندقية ومنتجعات جبلية مطلة على غابات السراة ومرتفعات المنطقة.',
    icon: '#i-directory-hotel',
  },
  {
    id: 'entertainment',
    label: 'الترفيه والسياحة البيئية',
    summary: 'مجمعات ترفيهية ومرافق أسرية ومزارع ريفية وتجارب طبيعية مستدامة.',
    icon: '#i-leaf',
  },
  {
    id: 'commercial',
    label: 'التطوير التجاري والحضري',
    summary: 'مراكز تجارية حديثة وتطوير الأنشطة بالمنطقة المركزية والمحافظات.',
    icon: '#i-directory-shopping',
  },
  {
    id: 'municipal',
    label: 'الفرص البلدية والابتكار',
    summary: 'فرص الاستثمار البلدي المطروحة عبر منصة «فرص» ومسارات الابتكار.',
    icon: '#i-digital-services',
  },
];

export const INVEST_PROJECTS: InvestProject[] = [
  {
    id: 'raghdan-resort',
    sector: 'hospitality',
    title: 'مشروع منتجع رغدان السياحي',
    location: 'غابة رغدان · مدينة الباحة',
    summary: 'منتجع فندقي ومطاعم بإطلالة على رغدان.',
    highlights: [
      { label: '120 مفتاحًا فندقيًا', icon: '#i-directory-hotel' },
      { label: 'قاعات متعددة الاستخدامات', icon: '#i-heritage' },
      { label: 'إطلالة على غابة رغدان', icon: '#i-leaf' },
    ],
  },
  {
    id: 'albaha-sky',
    sector: 'entertainment',
    title: 'مجمع «الباحة سكاي» الترفيهي',
    location: 'بين غابة رغدان ومنتزه القيم',
    summary: 'تزلّج وبولينج وواقع افتراضي للعائلات.',
    highlights: [
      { label: 'مساحة 8,994 م²', icon: '#i-map' },
      { label: 'صالات ترفيه وملاعب بادل', icon: '#i-nav-experience' },
      { label: 'مقاهٍ ومناطق عائلية', icon: '#i-directory-coffee' },
    ],
  },
  {
    id: 'rotana-plaza',
    sector: 'commercial',
    title: 'فندق روتانا إيدج ومشروع الباحة بلازا',
    location: 'المنطقة المركزية · مدينة الباحة',
    summary: 'ضيافة وتسوق وترفيه في قلب الباحة.',
    highlights: [
      { label: 'ضيافة فندقية حديثة', icon: '#i-directory-hotel' },
      { label: 'مراكز تسوق وترفيه', icon: '#i-directory-shopping' },
      { label: 'موقع محوري وسط المدينة', icon: '#i-pin' },
    ],
  },
  {
    id: 'furas-opportunities',
    sector: 'municipal',
    title: 'الفرص الاستثمارية عبر منصة «فرص»',
    location: 'مدينة الباحة والعقيق والمحافظات',
    summary: 'فرص تجارية وترفيهية وخدمية في الباحة.',
    highlights: [
      { label: '10 فرص جديدة بالعقيق', icon: '#i-nav-invest' },
      { label: 'فرص المنطقة المركزية', icon: '#i-pin' },
      { label: 'تقديم إلكتروني عبر منصة فرص', icon: '#i-digital-services' },
    ],
  },
];

export const INVEST_CHANNELS: InvestChannel[] = [
  {
    tag: 'الفرص البلدية الموحدة',
    title: 'منصة «فرص»',
    description: 'تصفّح الفرص الاستثمارية المطروحة والتقديم الإلكتروني المباشر',
    href: 'https://furas.momra.gov.sa',
    linkLabel: 'الانتقال إلى منصة فرص',
    external: true,
    categoryIcon: '#i-nav-invest',
    icon: '#i-external',
  },
  {
    tag: 'الخدمات والتراخيص',
    title: 'بوابة أمانة الباحة',
    description: 'الرخص التجارية والإنشائية وخدمات المستثمرين والبيانات المفتوحة',
    href: 'https://baha.gov.sa',
    linkLabel: 'زيارة البوابة الرسمية',
    external: true,
    categoryIcon: '#i-digital-services',
    icon: '#i-external',
  },
  {
    tag: 'التواصل والاستفسار',
    title: 'العناية بالمستثمرين',
    description: 'الرد على الاستفسارات الاستثمارية وتوجيه طلبات الفرص البلدية',
    href: 'mailto:bahacare@baha.gov.sa',
    linkLabel: 'bahacare@baha.gov.sa',
    external: false,
    categoryIcon: '#i-foot-headset',
    icon: '#i-foot-mail',
  },
];
