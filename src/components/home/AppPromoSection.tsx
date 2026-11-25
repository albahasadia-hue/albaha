import domMedia from '@/data/domMedia.json';

export function AppPromoSection() {
  return (
    <section className="app-promo" id="app" aria-labelledby="app-title">
      <svg className="heritage-divider" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-woven-band-thin)" />
      </svg>
      <svg className="heritage-texture" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-engraving)" />
      </svg>
      <div className="container app-promo-layout">
        <div className="app-promo-copy">
          <p className="caption section-kicker">
            <svg
              className="section-mark"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <use href="#i-section-app" width="24" height="24" />
            </svg>
            <span>تطبيق أمانة منطقة الباحة</span>
          </p>
          <h2 id="app-title">حمّل التطبيق الآن</h2>
          <p className="app-promo-tagline">الخدمات البلدية والسياحية في منصة رقمية موحدة</p>
          <div className="app-store-links" role="group" aria-label="متاجر تطبيق الباحة">
            <a
              href="https://play.google.com/store/apps/details?id=com.gama.bahaty"
              target="_blank"
              rel="noopener"
              dir="ltr"
              aria-label="حمّل تطبيق باحة من Google Play"
            >
              <img src={domMedia.googlePlayBadge} alt="" width={21} height={24} />
              <span>
                <small dir="rtl">متوفر على</small>
                <strong lang="en">Google Play</strong>
              </span>
            </a>
            <a
              href="https://apps.apple.com/sa/app/%D8%A8%D8%A7%D8%AD%D8%A9/id6451152165"
              target="_blank"
              rel="noopener"
              dir="ltr"
              aria-label="حمّل تطبيق باحة من App Store"
            >
              <img src={domMedia.appStoreBadge} alt="" width={20} height={24} />
              <span>
                <small dir="rtl">متوفر على</small>
                <strong lang="en">App Store</strong>
              </span>
            </a>
          </div>
        </div>
        <figure className="app-phone">
          <div className="app-phone-frame">
            <div className="app-phone-screen app-phone-screen--app-preview">
              <img
                className="app-phone-app-screenshot"
                src={domMedia.appPhoneScreenshot}
                alt="واجهة تطبيق الباحة تعرض غابة رغدان والمساعد السياحي ومخطط الرحلة"
                loading="lazy"
                decoding="async"
                width={900}
                height={1777}
              />
            </div>
          </div>
          <figcaption>معاينة تطبيق الباحة الآن</figcaption>
        </figure>
      </div>
      <svg className="heritage-divider" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-woven-band-thin)" />
      </svg>
    </section>
  );
}
