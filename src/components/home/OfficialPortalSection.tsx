interface KpiItem {
  label: string;
  icon: string;
  value: string;
  note?: string;
}

interface DetailCard {
  title: string;
  description: string;
  link?: {
    href: string;
    label: string;
  };
}

const TOP_KPIS: KpiItem[] = [
  { label: 'نباتات ضمن مبادرة الباحة الخضراء', icon: '#i-leaf', value: '1M+' },
  { label: 'طلب رخصة تجارية', icon: '#i-directory-shopping', value: '12.47K' },
  { label: 'ساعة تطوّع بلدي', icon: '#i-clock', value: '6,800+' },
];

const DETAILED_KPIS: KpiItem[] = [
  {
    label: 'إجمالي الزيارات الرقابية (2026)',
    icon: '#i-check',
    value: '99.37K',
    note: 'تعزيز الامتثال وجودة الخدمات والأسواق',
  },
  {
    label: 'طلبات الرخص التجارية',
    icon: '#i-directory-shopping',
    value: '12.47K',
    note: 'تمكين القطاع الخاص والأنشطة الاقتصادية',
  },
  {
    label: 'طلبات الرخص الإنشائية والحفريات',
    icon: '#i-heritage',
    value: '14.19K',
    note: '6.17K رخصة إنشائية و8.02K رخصة حفريات',
  },
  {
    label: 'الاستثمار البلدي ومعالجة البلاغات',
    icon: '#i-compass',
    value: '2.00K',
    note: 'طلب رخصة استثمارية و8.37K بلاغ معالج',
  },
  {
    label: 'السكان والنطاق الديموغرافي',
    icon: '#i-family',
    value: '487,108+',
    note: 'نسمة في مدينة الباحة ومحافظاتها',
  },
  {
    label: 'مبادرة الباحة الخضراء',
    icon: '#i-leaf',
    value: '1,000,000+',
    note: 'شجرة وشجيرة وزهرة لتعزيز الغطاء النباتي',
  },
  {
    label: 'التطوع البلدي (أكتوبر 2026)',
    icon: '#i-clock',
    value: '6,800+',
    note: 'ساعة تطوعية بمشاركة 1,365 متطوعاً في 91 مبادرة',
  },
  {
    label: 'التنوع البيئي والمناخي',
    icon: '#i-weather',
    value: '12°–23°م',
    note: 'متوسط الحرارة وأمطار السراة 229–581 ملم',
  },
];

const VISION_CARDS: DetailCard[] = [
  {
    title: 'الرؤية المؤسسية',
    description:
      'مدن مستدامة وفق معايير التميز لتحقيق مستهدفات رؤية المملكة العربية السعودية 2030 في جودة الحياة وأنسنة المدن',
  },
  {
    title: 'الرسالة التنموية',
    description:
      'الارتقاء بجودة الخدمات البلدية المقدمة والبنية التحتية وتحسين المشهد الحضري وتعزيز الاستثمارات البلدية لخلق بيئة عمرانية جاذبة',
  },
  {
    title: 'القيم والهوية البصرية',
    description:
      'حسن التعامل، الإتقان في الأداء، الانضباط، تكافؤ الفرص، روح الفريق، والشفافية وفق دليل الهوية البصرية للأمانة.',
    link: {
      href: 'https://baha.gov.sa/ar/InternalPages/page/%D8%A7%D9%84%D9%87%D9%88%D9%8A%D8%A9-%D8%A7%D9%84%D8%A8%D8%B5%D8%B1%D9%8A%D8%A9',
      label: 'دليل الهوية البصرية للأمانة',
    },
  },
];

const PROJECT_CARDS: DetailCard[] = [
  {
    title: 'مشروع منتجع رغدان السياحي',
    description:
      'مشروع فندقي وسياحي متكامل يضم 120 مفتاحاً فندقياً وقاعات متعددة الاستخدامات ومطاعم مطلة على غابة رغدان',
  },
  {
    title: 'مجمع «الباحة سكاي» الترفيهي',
    description:
      'أحدث المشاريع الترفيهية والسياحية بين غابة رغدان ومنتزه القيم على مساحة 8,994 م²؛ يضم صالات تزلج وبولينج وواقع افتراضي وملاعب بادل ومقاهي',
  },
  {
    title: 'فندق روتانا إيدج ومشروع الباحة بلازا',
    description:
      'مشاريع ضيافة ومراكز تجارية حديثة بالمنطقة المركزية بمدينة الباحة لتعزيز الجاذبية السياحية وتجربة التسوق والترفيه',
  },
  {
    title: 'منتزه الأمير حسام ومنتزه غابة رغدان',
    description:
      'يمتد منتزه غابة رغدان على 482,195 م²، بينما يضم منتزه الأمير حسام (161,000 م²) مسطحات خضراء (80,000 م²) وبحيرة (1,200 م²) ومسرحاً مفتوحاً لـ 1,000 شخص',
  },
  {
    title: 'الموجهات التصميمية لعمارة جبال السروات',
    description:
      'تطوير المشهد العمراني بالتكامل مع المكتب الاستراتيجي لتطوير منطقة الباحة ومركز دعم هيئات التطوير للحفاظ على الهوية المعمارية الحجرية الأصيلة',
  },
  {
    title: 'الفرص الاستثمارية عبر منصة «فرص»',
    description:
      'طرح الفرص الاستثمارية التجارية والترفيهية والخدمية في مدينة الباحة والمحافظات (بما فيها 10 فرص جديدة بمحافظة العقيق وفرص المنطقة المركزية)',
  },
];

const SERVICE_CARDS: DetailCard[] = [
  {
    title: 'الاستعلام عن معاملة وتقديم خطاب إلكتروني',
    description:
      'إتاحة تقديم الخطابات الإلكترونية والاستعلام الفوري عن المعاملات البلدية وطلبات المنح والأراضي عبر البوابة الرقمية',
  },
  {
    title: 'بلاغات 940 وتطبيق «بلدي» و«الباحة»',
    description:
      'رفع البلاغات البلدية، متابعة الطلبات والاعتراضات، واستعراض الفعاليات والأخبار ومرافق المدن عبر تطبيق الباحة وتطبيق بلدي',
  },
  {
    title: 'الرخص التجارية والإنشائية والمكاتب الهندسية',
    description:
      'إصدار وتجديد الرخص التجارية، رخص السكن الجماعي، اعتماد المخططات الخاصة، وخدمات الدمج والتجزئة ومنصة رسم مرافق الإيواء',
  },
  {
    title: 'المنصة الرقمية الموحدة للطرق وتنسيق البنية التحتية',
    description:
      'تنسيق أعمال الحفريات ومشاريع المرافق داخل نطاق المدن مع الجهات الخدمية وبوابة موافقة الجهات الحكومية',
  },
  {
    title: 'مركز الابتكار البلدي وهاكاثون الابتكار',
    description:
      'يضم 8 مسارات: التخطيط الحضري وأنسنة المدن، تحسين المشهد الحضري، تنمية الاستثمارات، تحسين تجارب المستفيدين، الشراكات، الطوارئ، التاجر المتنقل، وإكرام الموتى',
  },
  {
    title: 'البيانات المفتوحة وجولة «بانوراما الباحة 360°»',
    description:
      'إتاحة مجموعات البيانات المفتوحة بصيغ مقروءة آلياً (CSV, XLS, JSON, XML) وجولات افتراضية 360° لمعالم صيف الباحة',
  },
];

export function OfficialPortalSection() {
  return (
    <section
      className="official-portal"
      id="official-portal"
      aria-labelledby="officialPortalTitle"
    >
      <div className="container">
        <div className="official-title-box">
          <div className="caption section-kicker">
            <svg className="section-mark" aria-hidden="true">
              <use href="#i-heritage" />
            </svg>
            <span>رؤية السعودية 2030</span>
          </div>
          <h2 id="officialPortalTitle">التنمية والاستدامة في الباحة</h2>
          <p className="lead">هوية محلية نحافظ عليها، ومدن أكثر خضرة، وخدمات بلدية أسهل.</p>
        </div>

        <dl className="kpi-grid" aria-label="أبرز مؤشرات الباحة">
          {TOP_KPIS.map((item) => (
            <div key={item.label} className="kpi-card">
              <dt className="kpi-label">{item.label}</dt>
              <dd className="kpi-num kpi-value">
                <svg className="ic" aria-hidden="true">
                  <use href={item.icon} />
                </svg>
                <bdi dir="ltr">{item.value}</bdi>
              </dd>
            </div>
          ))}
        </dl>

        <div className="official-panels">
          <details className="official-disclosure" id="officialVision">
            <summary>
              <svg className="ic" aria-hidden="true">
                <use href="#i-heritage" />
              </svg>
              <span>الرؤية والرسالة والهوية</span>
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-chevron" />
              </svg>
            </summary>
            <div className="official-detail-body">
              <div className="official-detail-cards">
                {VISION_CARDS.map((card) => (
                  <article key={card.title} className="official-detail-card">
                    <h4>{card.title}</h4>
                    <p>{card.description}</p>
                    {card.link ? (
                      <div className="guide-links">
                        <a href={card.link.href} target="_blank" rel="noopener">
                          {card.link.label}{' '}
                          <svg className="ic tiny" aria-hidden="true">
                            <use href="#i-external" />
                          </svg>
                        </a>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          </details>

          <details className="official-disclosure" id="officialIndicators">
            <summary>
              <svg className="ic" aria-hidden="true">
                <use href="#i-check" />
              </svg>
              <span>المؤشرات البلدية بالتفصيل</span>
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-chevron" />
              </svg>
            </summary>
            <div className="official-detail-body">
              <dl className="kpi-grid" aria-label="مؤشرات الأداء البلدي والسكان والبيئة">
                {DETAILED_KPIS.map((item) => (
                  <div key={item.label} className="kpi-card">
                    <dt className="kpi-label">{item.label}</dt>
                    <dd className="kpi-num kpi-value">
                      <svg className="ic" aria-hidden="true">
                        <use href={item.icon} />
                      </svg>
                      <bdi dir="ltr">{item.value}</bdi>
                    </dd>
                    {item.note ? <dd className="kpi-note">{item.note}</dd> : null}
                  </div>
                ))}
              </dl>
            </div>
          </details>

          <details className="official-disclosure" id="officialProjects">
            <summary>
              <svg className="ic" aria-hidden="true">
                <use href="#i-compass" />
              </svg>
              <span>المشاريع التنموية والاستثمار</span>
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-chevron" />
              </svg>
            </summary>
            <div className="official-detail-body">
              <div className="official-detail-cards">
                {PROJECT_CARDS.map((card) => (
                  <article key={card.title} className="official-detail-card">
                    <h4>{card.title}</h4>
                    <p>{card.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </details>

          <details className="official-disclosure" id="officialServices">
            <summary>
              <svg className="ic" aria-hidden="true">
                <use href="#i-digital-services" />
              </svg>
              <span>الخدمات الرقمية والابتكار</span>
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-chevron" />
              </svg>
            </summary>
            <div className="official-detail-body">
              <div className="official-detail-cards">
                {SERVICE_CARDS.map((card) => (
                  <article key={card.title} className="official-detail-card">
                    <h4>{card.title}</h4>
                    <p>{card.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
