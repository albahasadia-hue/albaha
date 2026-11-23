import domMedia from '@/data/domMedia.json';

interface DestinationCard {
  id: 'raghdan' | 'ain' | 'shada' | 'hussam';
  city: string;
  title: string;
  summary: string;
}

const DESTINATIONS: DestinationCard[] = [
  { id: 'raghdan', city: 'مدينة الباحة', title: 'غابة رغدان', summary: 'غابة على مرتفعات السروات' },
  { id: 'ain', city: 'المخواة', title: 'قرية ذي عين', summary: 'عمارة حجرية وعين ماء' },
  { id: 'shada', city: 'المخواة', title: 'جبل شدا الأعلى', summary: 'تكوينات جرانيتية وإطلالات' },
  { id: 'hussam', city: 'مدينة الباحة', title: 'منتزه الأمير حسام', summary: 'جلسات وممرات حول البحيرة' },
];

export function DestinationsCarouselSection() {
  return (
    <section id="destinations" className="destinations">
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
                <use href="#i-compass" width="24" height="24" />
              </svg>
              <span>مسارات تستحق الاكتشاف</span>
            </div>
            <h2>أبرز المعالم والوجهات الرئيسية</h2>
          </div>
          <div className="caro-btns">
            <button
              type="button"
              id="caroPrev"
              aria-controls="destCarousel"
              aria-label="الوجهة السابقة"
            >
              <svg className="ic" style={{ transform: 'rotate(180deg)' }}>
                <use href="#i-arrow" />
              </svg>
            </button>
            <button
              type="button"
              id="caroNext"
              aria-controls="destCarousel"
              aria-label="الوجهة التالية"
            >
              <svg className="ic">
                <use href="#i-arrow" />
              </svg>
            </button>
          </div>
        </div>
        <div className="carousel-wrap">
          <div
            className="carousel"
            id="destCarousel"
            tabIndex={0}
            role="region"
            aria-label="بطاقات الوجهات"
          >
            {DESTINATIONS.map((dest) => (
              <a
                key={dest.id}
                className="dest-card scenic-card"
                data-dest-tone={dest.id}
                href={`/place/${dest.id}`}
              >
                <picture className="scenic-picture">
                  <img
                    className="photo"
                    data-embedded-photo={dest.id}
                    src={domMedia[dest.id]}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </picture>
                <div className="scenic-copy">
                  <div>
                    <span className="dest-city">
                      <svg className="ic tiny" aria-hidden="true">
                        <use href="#i-pin" />
                      </svg>
                      {dest.city}
                    </span>
                    <h3>{dest.title}</h3>
                    <p className="dest-summary">{dest.summary}</p>
                  </div>
                  <span className="dest-card-action" aria-hidden="true">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-arrow" />
                    </svg>
                  </span>
                </div>
              </a>
            ))}
          </div>
          <div className="carousel-footer">
            <div
              className="carousel-dots"
              id="carouselDots"
              role="tablist"
              aria-label="اختيار وجهة"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
