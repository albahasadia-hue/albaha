const SEASONS = [
  { key: 'spring', icon: '#i-season-spring', label: 'الربيع' },
  { key: 'summer', icon: '#i-season-summer', label: 'الصيف' },
  { key: 'autumn', icon: '#i-season-autumn', label: 'الخريف' },
  { key: 'winter', icon: '#i-season-winter', label: 'الشتاء' },
];

export function VisitSeasonSection() {
  return (
    <section className="visit-season" id="visit-season" aria-labelledby="season-title">
      <div className="container">
        <div className="section-top season-header reveal">
          <div>
            <div className="caption section-kicker">
              <svg className="section-mark" aria-hidden="true">
                <use href="#i-weather" />
              </svg>
              <span>أجواء الزيارة</span>
            </div>
            <h2 id="season-title">المناخ والفصول</h2>
          </div>
        </div>
        <div className="season-grid">
          <div className="season-intro">
            <div className="season-switch" id="seasonSwitch" role="group" aria-label="فصل الزيارة">
              {SEASONS.map((s) => (
                <button key={s.key} type="button" data-season={s.key}>
                  <svg className="season-tab-icon" aria-hidden="true" focusable="false">
                    <use href={s.icon} />
                  </svg>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            <div className="season-cities" id="seasonRegions" role="group" aria-label="منطقة الأجواء">
              <button type="button" data-season-region="baha">
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-pin" />
                </svg>{' '}
                السراة · الباحة
              </button>
              <button type="button" data-season-region="makhwah">
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-pin" />
                </svg>{' '}
                تهامة · المخواة
              </button>
            </div>
            <dl className="season-facts-grid" id="seasonFacts" aria-label="معلومات المناخ والتجهيز" />
          </div>
          <article className="season-card" aria-live="polite">
            <img id="seasonPhoto" alt="" decoding="async" loading="lazy" />
            <div className="season-card-head">
              <span className="season-location-pill" id="seasonLocationPill">
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-pin" />
                </svg>
                <span id="seasonLocationText">مرتفعات السراة · مدينة الباحة</span>
              </span>
              <p id="seasonWeather" hidden />
            </div>
            <div className="season-card-copy">
              <div className="season-card-top">
                <h3 id="seasonName">
                  <svg className="ic" aria-hidden="true">
                    <use id="seasonIcon" />
                  </svg>
                  <span id="seasonLabel" />
                </h3>
                <p id="seasonMonths" />
                <span className="season-best-pill" id="seasonBestTime" />
              </div>
              <div className="season-card-bottom">
                <p id="seasonTip" />
                <a id="seasonCity" href="/city/baha" />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
