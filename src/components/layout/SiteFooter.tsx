import domMedia from '@/data/domMedia.json';
import { SMART_GUIDE_NAME } from '@/lib/smartGuideName';

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
    <>
      <svg className="heritage-divider footer-heritage-divider" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-woven-band-thin)" />
      </svg>
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
                    alt="الباحة"
                    width={384}
                    height={167}
                  />
                </a>
                <p>البوابة الرسمية للتنمية الحضرية والسياحة والخدمات الرقمية</p>
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
                    {SMART_GUIDE_NAME}
                  </button>
                </li>
                <li>
                  <a href="#app">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-download" />
                    </svg>
                    تطبيق الباحة
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
                  <a href="/reports">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-foot-headset" />
                    </svg>
                    البلاغات والشكاوى
                  </a>
                </li>
                <li>
                  <a href="/feedback">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-foot-message" />
                    </svg>
                    الملاحظات والاقتراحات
                  </a>
                </li>
                <li>
                  <a href="tel:+966177252140" title="هاتف أمانة منطقة الباحة: +966 17 725 2140">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-foot-phone" />
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

          <div className="footer-meta footer-meta--social">
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
            <p className="footer-copyright">
              <bdi dir="ltr">© 2026</bdi> أمانة منطقة الباحة - جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
