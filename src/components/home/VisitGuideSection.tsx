import domMedia from '@/data/domMedia.json';
import heroPhotoData from '@/data/heroPhotoData.json';

interface GuideDish {
  title: string;
  description: string;
}

const LOCAL_DISHES: GuideDish[] = [
  {
    title: 'الخبزة المقنّاة',
    description: 'خبز قمح بلدي يُطهى على الحجر الساخن في المناسبات التراثية',
  },
  {
    title: 'الدغابيس',
    description: 'أكلة شعبية أصيلة تُحضّر من دقيق البر وتُطهى مع المرق واللحم',
  },
  {
    title: 'البُن الشدوي',
    description: 'قهوة عربية فاخرة من محاصيل مدرجات جبلي شدا الأعلى والأسفل',
  },
];

export function VisitGuideSection() {
  return (
    <section id="visit-guide" className="visit-guide" aria-labelledby="visitGuideTitle">
      <svg className="heritage-divider" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-woven-band)" />
      </svg>
      <div className="container">
        <div className="section-top reveal">
          <div>
            <div className="caption section-kicker">
              <svg
                className="section-mark"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <use href="#i-section-guide" width="24" height="24" />
              </svg>
              <span>دليل الباحة</span>
            </div>
            <h2 id="visitGuideTitle">دليل الوجهات والضيافة والإقامة</h2>
            <p className="lead">معالم الباحة ومائدتها المحلية وخيارات الإقامة.</p>
          </div>
        </div>

        <nav className="guide-index reveal" aria-label="أقسام دليل الباحة">
          <a href="#guideDaySection" aria-label="برامج الزيارة اليومية">
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <use href="#i-clock" width="24" height="24" />
            </svg>
            <span className="guide-label-full">برامج الزيارة اليومية</span>
            <span className="guide-label-short">البرامج</span>
          </a>
          <a href="#dining" aria-label="المطاعم والأكلات">
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <use href="#i-guide-dining" width="24" height="24" />
            </svg>
            <span className="guide-label-full">المطاعم والأكلات</span>
            <span className="guide-label-short">المطاعم</span>
          </a>
          <a href="#camping" aria-label="المخيمات والإقامة">
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <use href="#i-guide-tent" width="24" height="24" />
            </svg>
            <span className="guide-label-full">المخيمات والإقامة</span>
            <span className="guide-label-short">المبيت</span>
          </a>
        </nav>

        <section id="attractions" className="guide-section" aria-labelledby="attractionsTitle">
          <div className="guide-heading reveal">
            <div className="caption section-kicker">
              <svg
                className="section-mark"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <use href="#i-heritage" width="24" height="24" />
              </svg>
              <span>المزارات السياحية</span>
            </div>
            <h3 id="attractionsTitle">من الحجر إلى الماء</h3>
          </div>
          <div className="guide-sights">
            <article className="guide-card guide-sight-feature reveal">
              <a href="#place/ain" className="scenic-card">
                <img
                  className="photo"
                  data-photo="ain"
                  src={domMedia.ain}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <div className="scenic-copy">
                  <span className="card-kicker">
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-pin" />
                    </svg>{' '}
                    محافظة المخواة
                  </span>
                  <h4>قرية ذي عين</h4>
                  <p>مباني حجرية تاريخية متدرجة على سفح الجبل بجوار عين الماء الدائمة</p>
                  <span className="card-action">
                    استكشف القرية{' '}
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-arrow" />
                    </svg>
                  </span>
                </div>
              </a>
            </article>
            <article className="guide-card reveal">
              <span className="guide-tag">محافظة بلجرشي</span>
              <h4>سوق السبت والمتحف الأبنوي</h4>
              <p>
                يجمع السوق الشعبي التاريخي صباح كل سبت بين الحرف اليدوية ومقتنيات المتحف الأبنوي
                التراثي
              </p>
              <div className="guide-links">
                <a
                  href="https://baha.gov.sa/ar/Departments/ImageAlbum/442?deptId=110"
                  target="_blank"
                  rel="noopener"
                >
                  المتحف{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-external" />
                  </svg>
                </a>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=سوق+السبت+بلجرشي"
                  target="_blank"
                  rel="noopener"
                >
                  الاتجاهات{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-pin" />
                  </svg>
                </a>
              </div>
            </article>
            <article className="guide-card reveal">
              <span className="guide-tag">محافظة بني حسن</span>
              <h4>غابة خيرة والشلال</h4>
              <p>مسطحات خضراء وأشجار عرعر كثيفة تطل على حديقة الشلال في منتزه غابة خيرة</p>
              <div className="guide-links">
                <a
                  href="https://baha.gov.sa/ar/Albums/ImageDetails/412"
                  target="_blank"
                  rel="noopener"
                >
                  عن الشلال{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-external" />
                  </svg>
                </a>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=شلال+خيرة+الباحة"
                  target="_blank"
                  rel="noopener"
                >
                  الاتجاهات{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-pin" />
                  </svg>
                </a>
              </div>
            </article>
          </div>
        </section>

        <section id="dining" className="guide-section guide-dining" aria-labelledby="diningTitle">
          <div className="guide-flavors guide-embroidered reveal">
            <svg className="guide-embroidery-band" aria-hidden="true" focusable="false">
              <rect width="100%" height="100%" fill="url(#woven-band-vertical)" />
            </svg>
            <div className="caption section-kicker">
              <svg
                className="section-mark"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <use href="#i-guide-dining" width="24" height="24" />
              </svg>
              <span>أكلات من الباحة</span>
            </div>
            <h3 id="diningTitle">الموروث الغذائي والمائدة المحلية</h3>
            <dl>
              {LOCAL_DISHES.map((dish) => (
                <div key={dish.title}>
                  <dt>{dish.title}</dt>
                  <dd>{dish.description}</dd>
                </div>
              ))}
            </dl>
            <div className="guide-links">
              <a href="https://www.spa.gov.sa/N2031312" target="_blank" rel="noopener">
                حكاية المقنّاة{' '}
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-external" />
                </svg>
              </a>
              <a href="https://www.spa.gov.sa/N2134212" target="_blank" rel="noopener">
                عن البُن الشدوي{' '}
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-external" />
                </svg>
              </a>
            </div>
          </div>

          <div className="guide-dining-list reveal">
            <div className="dining-list-head">
              <div className="caption section-kicker">
                <svg
                  className="section-mark"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <use href="#i-dining-plate" width="24" height="24" />
                </svg>
                <span>ضيافة ومطاعم مختارة</span>
              </div>
              <h4>وجهات الضيافة والمطاعم المختارة</h4>
            </div>
            <div className="dining-spots">
              <article className="dining-spot">
                <div className="dining-spot-top">
                  <span className="guide-icon-badge" aria-hidden="true">
                    <svg className="ic">
                      <use href="#i-guide-dining" />
                    </svg>
                  </span>
                  <div className="dining-spot-heading">
                    <h5>مطعم هالة</h5>
                    <span className="guide-tag">
                      <svg className="ic tiny" aria-hidden="true">
                        <use href="#i-pin" />
                      </svg>{' '}
                      طريق غابة خيرة
                    </span>
                  </div>
                </div>
                <p>تجربة ضيافة جبلية بأطباق العسل وزيت الزيتون.</p>
                <div className="guide-links">
                  <a
                    href="https://www.gamramountainresort.com/dining/hala-restaurant/"
                    target="_blank"
                    rel="noopener"
                  >
                    صفحة المطعم{' '}
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-external" />
                    </svg>
                  </a>
                </div>
              </article>
              <article className="dining-spot">
                <div className="dining-spot-top">
                  <span className="guide-icon-badge" aria-hidden="true">
                    <svg className="ic">
                      <use href="#i-dining-plate" />
                    </svg>
                  </span>
                  <div className="dining-spot-heading">
                    <h5>مطعم البستان</h5>
                    <span className="guide-tag">
                      <svg className="ic tiny" aria-hidden="true">
                        <use href="#i-pin" />
                      </svg>{' '}
                      مدينة الباحة
                    </span>
                  </div>
                </div>
                <p>من مطاعم الضيافة المعتمدة في دليل الباحة بوسط المدينة.</p>
                <div className="guide-links">
                  <a
                    href="https://bso.gov.sa/assets/tourist_guide_albaha_arabic_241f20cb54/tourist_guide_albaha_arabic_241f20cb54.pdf"
                    target="_blank"
                    rel="noopener"
                  >
                    دليل الباحة{' '}
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-details" />
                    </svg>
                  </a>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=مطعم+البستان+الباحة"
                    target="_blank"
                    rel="noopener"
                  >
                    الاتجاهات{' '}
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-pin" />
                    </svg>
                  </a>
                </div>
              </article>
            </div>
            <p className="guide-note">
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-info" />
              </svg>
              <span>يُنصح بالتحقق المسبق من أوقات العمل وتوفر الأطباق الموسمية لدى المنشآت</span>
            </p>
          </div>
        </section>

        <section id="camping" className="guide-section" aria-labelledby="campingTitle">
          <div className="guide-camp-banner scenic-card reveal">
            <img
              className="photo"
              data-hero-photo="shada"
              src={heroPhotoData.shada.wide}
              alt="إطلالة على جبل شدا"
              loading="lazy"
              decoding="async"
            />
            <div className="scenic-copy">
              <span className="card-kicker section-kicker">
                <svg
                  className="section-mark"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <use href="#i-guide-tent" width="24" height="24" />
                </svg>
                <span>المخيمات والإقامة</span>
              </span>
              <h3 id="campingTitle">الإقامة الجبلية والتخييم</h3>
              <p>تخييم بيئي وإقامة بين جبال الباحة.</p>
            </div>
          </div>
          <div className="guide-camp-grid">
            <article className="guide-card reveal">
              <div className="guide-card-head">
                <span className="guide-icon-badge" aria-hidden="true">
                  <svg className="ic">
                    <use href="#i-guide-tent" />
                  </svg>
                </span>
                <div className="guide-card-titles">
                  <span className="guide-tag">
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-check" />
                    </svg>{' '}
                    تخييم ذاتي
                  </span>
                  <h4>خيمتك في موقع مخصص</h4>
                </div>
              </div>
              <p>تخييم موسمي بتصريح المركز الوطني للغطاء النباتي.</p>
              <div className="guide-links">
                <a
                  href="https://ncvc.gov.sa/ar/EServices/Pages/Service02.aspx"
                  target="_blank"
                  rel="noopener"
                >
                  تصريح التخييم{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-external" />
                  </svg>
                </a>
                <a href="https://camping.ncvc.gov.sa/" target="_blank" rel="noopener">
                  منصة التخييم{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-external" />
                  </svg>
                </a>
                <a
                  href="https://ncvc.gov.sa/ar/MediaCenter/News/Pages/AlBaha-investment.aspx"
                  target="_blank"
                  rel="noopener"
                >
                  عن المواقع{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-external" />
                  </svg>
                </a>
              </div>
            </article>
            <article className="guide-card reveal">
              <div className="guide-card-head">
                <span className="guide-icon-badge" aria-hidden="true">
                  <svg className="ic">
                    <use href="#i-directory-hotel" />
                  </svg>
                </span>
                <div className="guide-card-titles">
                  <span className="guide-tag">
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-pin" />
                    </svg>{' '}
                    حي الشفا بمدينة الباحة
                  </span>
                  <h4>منتجع ماكامايا</h4>
                </div>
              </div>
              <p>إقامة ريفية بإطلالة على غابة رغدان.</p>
              <div className="guide-links">
                <a
                  href="https://gathern.co/view/146533/unit/210735"
                  target="_blank"
                  rel="noopener"
                >
                  تفاصيل الإقامة{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-external" />
                  </svg>
                </a>
              </div>
            </article>
            <article className="guide-card reveal">
              <div className="guide-card-head">
                <span className="guide-icon-badge" aria-hidden="true">
                  <svg className="ic">
                    <use href="#i-mountain" />
                  </svg>
                </span>
                <div className="guide-card-titles">
                  <span className="guide-tag">
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-pin" />
                    </svg>{' '}
                    جبل شدا الأسفل
                  </span>
                  <h4>منتجع الكهف</h4>
                </div>
              </div>
              <p>إقامة بين صخور الجرانيت في شدا الأسفل.</p>
              <div className="guide-links">
                <a
                  href="https://bso.gov.sa/ar/visit-al-baha/plan-your-visit"
                  target="_blank"
                  rel="noopener"
                >
                  عن منتجع الكهف{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-external" />
                  </svg>
                </a>
              </div>
            </article>
          </div>
        </section>

        <section
          id="guideDaySection"
          className="guide-day guide-embroidered reveal"
          aria-labelledby="guideDayTitle"
        >
          <svg className="guide-embroidery-band" aria-hidden="true" focusable="false">
            <rect width="100%" height="100%" fill="url(#engraved-band-vertical)" />
          </svg>
          <div>
            <div className="caption section-kicker">
              <svg
                className="section-mark"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <use href="#i-section-day" width="24" height="24" />
              </svg>
              <span>أفكار ليوم واحد</span>
            </div>
            <h3 id="guideDayTitle">برامج الزيارة اليومية المقترحة</h3>
          </div>
          <div className="guide-day-options">
            <details>
              <summary>
                صباح السبت في بلجرشي{' '}
                <svg className="ic tiny guide-day-chevron" aria-hidden="true">
                  <use href="#i-chevron" />
                </svg>
              </summary>
              <div className="guide-day-content">
                <ol>
                  <li>ابدأ بسوق السبت صباحًا. اسأل عن المقنّاة أو منتجات الموسم عند الباعة.</li>
                  <li>تفقّد موعد استقبال المتحف الأبنوي، وزُره داخل السوق إذا كان مفتوحًا.</li>
                  <li>
                    كمّل بعد الظهر في مزرعة الخازم عند سد الطلقية. اسأل عن استقبال الزوار وما يمكن
                    قطفه في الموسم.
                  </li>
                </ol>
                <div className="guide-links">
                  <a href="#attractions">
                    السوق والمتحف{' '}
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-arrow" />
                    </svg>
                  </a>
                  <a
                    href="https://baha.gov.sa/ar/Albums/ImageDetails/430"
                    target="_blank"
                    rel="noopener"
                  >
                    مزرعة الخازم{' '}
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-external" />
                    </svg>
                  </a>
                </div>
              </div>
            </details>
            <details>
              <summary>
                غابة وغداء في خيرة{' '}
                <svg className="ic tiny guide-day-chevron" aria-hidden="true">
                  <use href="#i-chevron" />
                </svg>
              </summary>
              <div className="guide-day-content">
                <ol>
                  <li>ابدأ بجولة صباحية في غابة خيرة.</li>
                  <li>أضف حديقة الشلال إن ناسبتك ظروف الزيارة.</li>
                  <li>توقّف للغداء في هالة على طريق الغابة. لو ناوي تبيت، راجع خيارات الإقامة.</li>
                </ol>
                <div className="guide-links">
                  <a href="#dining">
                    تفاصيل المطعم{' '}
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-arrow" />
                    </svg>
                  </a>
                  <a href="#camping">
                    خيارات المبيت{' '}
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-arrow" />
                    </svg>
                  </a>
                </div>
              </div>
            </details>
            <details>
              <summary>
                يوم بين ذي عين وشدا{' '}
                <svg className="ic tiny guide-day-chevron" aria-hidden="true">
                  <use href="#i-chevron" />
                </svg>
              </summary>
              <div className="guide-day-content">
                <ol>
                  <li>ابدأ بأزقة قرية ذي عين وعمارتها الحجرية.</li>
                  <li>
                    خصّص بقية اليوم لتجربة جبلية. لو اخترت المبيت في منتجع الكهف، وجهتك شدا
                    الأسفل.
                  </li>
                  <li>اسأل عن البن الشدوي كتذكار من الرحلة.</li>
                </ol>
                <div className="guide-links">
                  <a href="#route/ain">
                    ذي عين على المخطط{' '}
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-route" />
                    </svg>
                  </a>
                </div>
              </div>
            </details>
          </div>
        </section>
      </div>
      <svg className="heritage-divider" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-woven-band)" />
      </svg>
    </section>
  );
}
