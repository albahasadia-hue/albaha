import domMedia from '@/data/domMedia.json';

interface ReelCardItem {
  id: keyof typeof domMedia & ('royal-visit' | 'khair' | 'raghdan-market' | 'honey-festival');
  kind: 'archive' | 'event';
  href: string;
  ariaLabel: string;
  tagIcon: string;
  tag: string;
  title: string;
}

const REEL_CARDS: ReelCardItem[] = [
  {
    id: 'royal-visit',
    kind: 'archive',
    href: '/city/baha/stories/royal-visit',
    ariaLabel: 'زيارة الملك عبدالله لمنطقة الباحة',
    tagIcon: '#i-city-archive',
    tag: 'زيارة ملكية',
    title: 'زيارة الملك عبدالله',
  },
  {
    id: 'khair',
    kind: 'event',
    href: '/city/baha/stories/khair',
    ariaLabel: 'مهرجان خيرات الباحة',
    tagIcon: '#i-city-calendar',
    tag: 'منتجات محلية',
    title: 'خيرات الباحة',
  },
  {
    id: 'raghdan-market',
    kind: 'event',
    href: '/city/baha/stories/raghdan-market',
    ariaLabel: 'افتتاح سوق رغدان التاريخي',
    tagIcon: '#i-city-calendar',
    tag: 'حِرف وتراث',
    title: 'سوق رغدان التاريخي',
  },
  {
    id: 'honey-festival',
    kind: 'event',
    href: '/city/baha/stories/honey-festival',
    ariaLabel: 'مهرجان العسل في رغدان',
    tagIcon: '#i-city-calendar',
    tag: 'عسل ونحّالون',
    title: 'مهرجان العسل',
  },
];

export function DiscoverIntroSection() {
  return (
    <section className="intro" id="discover" aria-labelledby="discover-title">
      <div className="container intro-layout">
        <div className="intro-head">
          <div className="intro-copy reveal">
            <div className="caption section-kicker">
              <svg
                className="section-mark section-mark--baha"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <use href="#i-section-baha" width="24" height="24" />
              </svg>
              <span>منطقة الباحة، المملكة العربية السعودية</span>
            </div>
            <h2 id="discover-title">أصالة المكان بين السراة وتهامة</h2>
            <p className="intro-lead">
              مدينة على قمم السروات بين الغابات الخضراء والقرى الحجرية.
            </p>
          </div>

          <div className="intro-actions reveal">
            <a className="btn btn-soft" href="/city/baha">
              <svg className="section-mark section-mark--baha" aria-hidden="true">
                <use href="#i-section-baha" width="24" height="24" />
              </svg>
              <span>استكشف مدينة الباحة</span>
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-arrow" />
              </svg>
            </a>
          </div>
        </div>

        <div className="intro-visuals reveal">
          <figure className="intro-badge">
            <img
              className="photo"
              data-embedded-photo="cityCover"
              src={domMedia.cityCover}
              alt="أحياء الباحة من مرتفع يطل على المدينة"
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <strong>
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-pin" />
                </svg>{' '}
                مدينة الباحة
              </strong>
              <span>إطلالة من مرتفعات السروات</span>
            </figcaption>
          </figure>
          <button
            type="button"
            className="intro-reel-motion"
            id="introReelMotion"
            aria-controls="introCityReel"
            aria-pressed="false"
          >
            إيقاف الحركة
          </button>
          <div className="intro-reel" id="introCityReel" role="region" aria-label="تغطيات مختارة من الباحة">
            {REEL_CARDS.map((card) => (
              <a
                key={card.id}
                className="intro-reel-card"
                data-kind={card.kind}
                href={card.href}
                aria-label={card.ariaLabel}
              >
                <img
                  data-embedded-photo={card.id}
                  src={domMedia[card.id]}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                <span className="intro-reel-copy">
                  <span className="intro-reel-tag">
                    <svg className="ic tiny" aria-hidden="true">
                      <use href={card.tagIcon} />
                    </svg>
                    {card.tag}
                  </span>
                  <strong>{card.title}</strong>
                </span>
              </a>
            ))}
            <div className="intro-reel-nav" aria-label="تحريك تغطيات الباحة">
              <button type="button" id="introReelPrev" aria-label="التغطية السابقة" title="السابق">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </button>
              <button type="button" id="introReelNext" aria-label="التغطية التالية" title="التالي">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
