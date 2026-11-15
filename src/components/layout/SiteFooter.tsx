import domMedia from '@/data/domMedia.json';

interface ContactChannel {
  href: string;
  label: string;
  title: string;
  icon: string;
  external?: boolean;
}

const CONTACT_CHANNELS: ContactChannel[] = [
  {
    href: 'tel:+966177252140',
    label: 'هاتف أمانة الباحة، +966 17 725 2140',
    title: 'هاتف الأمانة: +966 17 725 2140',
    icon: '#i-foot-phone',
  },
  {
    href: 'mailto:bahacare@baha.gov.sa',
    label: 'البريد الإلكتروني لأمانة الباحة',
    title: 'bahacare@baha.gov.sa',
    icon: '#i-foot-mail',
  },
  {
    href: 'tel:940',
    label: 'البلاغات البلدية، 940',
    title: 'البلاغات البلدية: 940',
    icon: '#i-foot-headset',
  },
  {
    href: 'https://baha.gov.sa/ar/EServices/Details/657',
    label: 'خدمة اتصل بنا على بوابة أمانة الباحة',
    title: 'خدمة اتصل بنا',
    icon: '#i-foot-message',
    external: true,
  },
  {
    href: 'https://x.com/amantalbaha',
    label: 'أمانة الباحة على إكس',
    title: 'إكس',
    icon: '#i-foot-x',
    external: true,
  },
  {
    href: 'https://www.youtube.com/@amanatalbaha',
    label: 'قناة أمانة الباحة على يوتيوب',
    title: 'يوتيوب',
    icon: '#i-foot-youtube',
    external: true,
  },
  {
    href: 'https://baha.gov.sa/ar/ElectronicParticipation/SocialMedia',
    label: 'واتساب عبر صفحة وسائل التواصل لأمانة الباحة',
    title: 'واتساب عبر صفحة قنوات الأمانة',
    icon: '#i-foot-whatsapp',
    external: true,
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-identity">
            <a href="#home" className="foot-brand-emblem" aria-label="الباحة، الصفحة الرئيسية">
              <img className="foot-logo" data-logo="" src={domMedia.goldLogo} alt="" />
            </a>
            <div className="footer-brand-copy">
              <a href="#home" className="foot-brand-wordmark" aria-label="الباحة، الصفحة الرئيسية">
                <img
                  className="brand-wordmark"
                  data-wordmark=""
                  src={domMedia.brandWordmark}
                  alt=""
                  width={384}
                  height={167}
                />
              </a>
              <p>البوابة الرسمية للتنمية الحضرية والسياحة والخدمات الرقمية</p>
              <ul className="footer-list footer-icons footer-contact-icons" aria-label="قنوات التواصل">
                {CONTACT_CHANNELS.map((channel) => (
                  <li key={channel.label}>
                    <a
                      href={channel.href}
                      aria-label={channel.label}
                      title={channel.title}
                      {...(channel.external ? { target: '_blank', rel: 'noopener' } : {})}
                    >
                      <svg className="ic" aria-hidden="true">
                        <use href={channel.icon} />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <nav className="foot-links" aria-labelledby="footer-explore-title">
            <h2 className="footer-heading" id="footer-explore-title">
              استكشف
            </h2>
            <ul className="footer-list">
              <li>
                <a href="#destinations">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-pin" />
                  </svg>
                  الوجهات
                </a>
              </li>
              <li>
                <a href="#experiences">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-mountain" />
                  </svg>
                  التجارب
                </a>
              </li>
              <li>
                <a href="#destination-directory">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-foot-image" />
                  </svg>
                  الباحة في صور
                </a>
              </li>
              <li>
                <a href="#visit-guide">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-compass" />
                  </svg>
                  دليل الباحة
                </a>
              </li>
            </ul>
          </nav>

          <nav className="foot-links" aria-labelledby="footer-trip-title">
            <h2 className="footer-heading" id="footer-trip-title">
              رحلتك
            </h2>
            <ul className="footer-list">
              <li>
                <a href="#planner">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-route" />
                  </svg>
                  مخطط الرحلة
                </a>
              </li>
              <li>
                <a href="#summary">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-check" />
                  </svg>
                  ملخص الرحلة
                </a>
              </li>
              <li>
                <button type="button" data-open="agent" aria-haspopup="dialog">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-sparkle" />
                  </svg>
                  المرشد السياحي
                </button>
              </li>
              <li>
                <a href="#app">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-download" />
                  </svg>
                  الباحة آب
                </a>
              </li>
            </ul>
          </nav>

          <nav className="foot-links footer-help" aria-labelledby="footer-help-title">
            <h2 className="footer-heading" id="footer-help-title">
              المساعدة والدعم
            </h2>
            <ul className="footer-list">
              <li>
                <a href="tel:940">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-foot-headset" />
                  </svg>
                  البلاغات والشكاوى
                </a>
              </li>
              <li>
                <a href="https://baha.gov.sa/ar/EServices/Details/657" target="_blank" rel="noopener">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-foot-message" />
                  </svg>
                  الملاحظات والاقتراحات
                </a>
              </li>
              <li>
                <a href="https://baha.gov.sa/ar/EServices/Details/657" target="_blank" rel="noopener">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-foot-mail" />
                  </svg>
                  اتصل بالأمانة
                </a>
              </li>
              <li>
                <a href="#faq">
                  <svg className="ic" aria-hidden="true">
                    <use href="#i-foot-faq" />
                  </svg>
                  الأسئلة الشائعة
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="footer-meta">
          <p className="footer-copyright">
            <bdi dir="ltr">© 2026</bdi> أمانة منطقة الباحة - جميع الحقوق محفوظة
          </p>
          <details className="footer-credits">
            <summary>مصادر الصور والخريطة</summary>
            <p>
              <a
                target="_blank"
                rel="noopener"
                href="https://commons.wikimedia.org/wiki/File:Sarawat_Mountains,_Baha_Region,_Saudi_Arabia_(7).jpg"
              >
                السروات ومدينة الباحة، ريتشارد مورتل
              </a>{' '}
              ·{' '}
              <a target="_blank" rel="noopener" href="https://creativecommons.org/licenses/by/2.0/">
                رخصة المشاع الإبداعي
              </a>
            </p>
            <p>
              <a
                target="_blank"
                rel="noopener"
                href="https://commons.wikimedia.org/wiki/File:Sarawat_Mountains,_Baha_Region,_Saudi_Arabia_(4).jpg"
              >
                إطلالة مدينة الباحة، ريتشارد مورتل
              </a>{' '}
              ·{' '}
              <a target="_blank" rel="noopener" href="https://creativecommons.org/licenses/by/2.0/">
                رخصة المشاع الإبداعي
              </a>
            </p>
            <p>
              <a
                target="_blank"
                rel="noopener"
                href="https://commons.wikimedia.org/wiki/File:Sarawat_Mountains,_Baha_Region,_Saudi_Arabia_(1).jpg"
              >
                جبال السروات، ريتشارد مورتل
              </a>{' '}
              ·{' '}
              <a target="_blank" rel="noopener" href="https://creativecommons.org/licenses/by/2.0/">
                رخصة المشاع الإبداعي
              </a>
            </p>
            <p>
              <a target="_blank" rel="noopener" href="https://commons.wikimedia.org/wiki/File:Topview3.jpg">
                قرية ذي عين، أُفاروق بهوتا
              </a>{' '}
              ·{' '}
              <a target="_blank" rel="noopener" href="https://creativecommons.org/licenses/by-sa/4.0/">
                رخصة المشاع الإبداعي
              </a>
            </p>
            <p>
              <a target="_blank" rel="noopener" href="https://commons.wikimedia.org/wiki/File:AL_Baha_1234.jpg">
                غابة رغدان، مجووود العدواني
              </a>{' '}
              ·{' '}
              <a target="_blank" rel="noopener" href="https://creativecommons.org/licenses/by-sa/3.0/">
                رخصة المشاع الإبداعي
              </a>
            </p>
            <p>
              <a
                target="_blank"
                rel="noopener"
                href="https://commons.wikimedia.org/wiki/File:جبل_شدا.jpg"
              >
                جبل شدا الأعلى، أسامة الكاشف
              </a>{' '}
              ·{' '}
              <a target="_blank" rel="noopener" href="https://creativecommons.org/licenses/by-sa/4.0/">
                رخصة المشاع الإبداعي
              </a>
            </p>
            <p>
              المشاهد البانورامية لرغدان وذي عين من{' '}
              <a target="_blank" rel="noopener" href="https://baha.gov.sa/">
                أمانة منطقة الباحة
              </a>
              .
            </p>
            <p>رُمّمت صورة الأزياء ومشاهد المدرّجات والقرى والمتنزهات من الصور المرجعية.</p>
            <p>
              <a target="_blank" rel="noopener" href="https://baha.gov.sa/en/Albums/ImageDetails/304">
                معلومات منتزه الأمير حسام من أمانة الباحة
              </a>{' '}
              ·{' '}
              <a target="_blank" rel="noopener" href="https://www.spa.gov.sa/1933776">
                صورة المنتزه من وكالة الأنباء السعودية
              </a>
            </p>
            <p>
              <a target="_blank" rel="noopener" href="https://baha.gov.sa/ar/News/Details/1417">
                سوق السبت في بلجرشي خلال احتفال اليوم الوطني
              </a>{' '}
              · أمانة منطقة الباحة
            </p>
            <p>
              <a target="_blank" rel="noopener" href="https://spa.gov.sa/N2376287">
                إطلالة متنزه الخلب في المندق
              </a>{' '}
              · وكالة الأنباء السعودية
            </p>
            <p>
              <a
                target="_blank"
                rel="noopener"
                href="https://baha.gov.sa/ar/Departments/ImageAlbum/202?deptId=112"
              >
                حديقة المحافظة في وسط العقيق
              </a>{' '}
              · أمانة منطقة الباحة
            </p>
            <p>
              <a target="_blank" rel="noopener" href="https://www.spa.gov.sa/2267676">
                المباني الحجرية في موقع الخلف والخليف
              </a>{' '}
              · وكالة الأنباء السعودية
            </p>
            <p>
              <a target="_blank" rel="noopener" href="https://www.spa.gov.sa/N2636219">
                المسطحات الخضراء في متنزه الثروة الوطني
              </a>{' '}
              · وكالة الأنباء السعودية
            </p>
            <p>
              <a target="_blank" rel="noopener" href="https://www.spa.gov.sa/N2637573">
                الجسر المعلّق في متنزه الأمير مشاري
              </a>{' '}
              · وكالة الأنباء السعودية
            </p>
            <p>
              <a
                target="_blank"
                rel="noopener"
                href="https://baha.gov.sa/ar/Departments/ImageAlbum/137?deptId=115"
              >
                ممشى الحجرة
              </a>{' '}
              · أمانة منطقة الباحة
            </p>
            <p>
              <a target="_blank" rel="noopener" href="https://slaati.com/2022/06/18/p2058302.html">
                إعادة افتتاح سوق السبت في غامد الزناد
              </a>{' '}
              · صحيفة صدى
            </p>
            <p>
              التضاريس من{' '}
              <a
                target="_blank"
                rel="noopener"
                href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md"
              >
                Mapzen وSRTM
              </a>
              . بيانات الطرق من{' '}
              <a target="_blank" rel="noopener" href="https://www.openstreetmap.org/copyright">
                OpenStreetMap
              </a>
              ، وحساب المسار عبر{' '}
              <a target="_blank" rel="noopener" href="https://project-osrm.org/">
                OSRM
              </a>
              .
            </p>
          </details>
        </div>
      </div>
    </footer>
  );
}
