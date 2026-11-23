import domMedia from '@/data/domMedia.json';

export function TripPlannerSection() {
  return (
    <section className="planner" id="planner" data-trip-style="all" aria-labelledby="plannerTitle">
      <svg
        className="heritage-divider planner-heritage-divider planner-heritage-divider--top"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="100%" height="100%" fill="url(#experiences-woven-band-thin)" />
      </svg>
      <div className="container">
        <div className="planner-heading reveal">
          <h2 id="plannerTitle" className="planner-heading-title">
            <span className="planner-live-emblem" aria-hidden="true">
              <svg
                className="planner-live-svg"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                focusable="false"
              >
                <defs>
                  <linearGradient id="plannerEmblemBg" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#061A33" />
                    <stop offset="58%" stopColor="#0A2E5C" />
                    <stop offset="100%" stopColor="#006C35" />
                  </linearGradient>
                  <linearGradient id="plannerRouteStroke" x1="10" y1="30" x2="30" y2="11" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#6EE7B7" />
                    <stop offset="55%" stopColor="#F3D089" />
                    <stop offset="100%" stopColor="#FFFFFF" />
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#plannerEmblemBg)" />
                <rect x="2.75" y="2.75" width="34.5" height="34.5" rx="10.25" stroke="#F3D089" strokeOpacity="0.34" strokeWidth="1.2" />
                <path
                  className="planner-route-track"
                  d="M11 29 C11 22.5 21 24.5 21 18.5 C21 13.8 27.5 15.2 28.5 11.5"
                  stroke="#FFFFFF"
                  strokeOpacity="0.24"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                />
                <path
                  className="planner-route-flow"
                  d="M11 29 C11 22.5 21 24.5 21 18.5 C21 13.8 27.5 15.2 28.5 11.5"
                  stroke="url(#plannerRouteStroke)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeDasharray="4 4"
                />
                <circle className="planner-start-dot" cx="11" cy="29" r="3" fill="#6EE7B7" stroke="#061A33" strokeWidth="1.2" />
                <circle className="planner-pin-pulse" cx="28.5" cy="11.5" r="5" fill="#F3D089" fillOpacity="0.32" />
                <circle className="planner-pin-core" cx="28.5" cy="11.5" r="3.4" fill="#F3D089" stroke="#061A33" strokeWidth="1.2" />
                <circle cx="28.5" cy="11.5" r="1.2" fill="#061A33" />
              </svg>
            </span>
            <span>خطّط رحلتك</span>
          </h2>
        </div>

        <div className="trip-draft" id="tripDraft" hidden>
          <div className="trip-draft-copy">
            <strong id="draftTitle">خطة زيارتك المقترحة</strong>
            <p id="draftMeta" />
            <div className="draft-assumptions" id="draftAssumptions" hidden>
              <label>
                <span>اليوم</span>
                <select id="draftVisitDay">
                  <option value="today">اليوم</option>
                  <option value="6">السبت</option>
                  <option value="0">الأحد</option>
                  <option value="1">الاثنين</option>
                  <option value="2">الثلاثاء</option>
                  <option value="3">الأربعاء</option>
                  <option value="4">الخميس</option>
                  <option value="5">الجمعة</option>
                </select>
              </label>
              <label>
                <span>الانطلاق</span>
                <input type="time" id="draftStartTime" defaultValue="09:00" />
              </label>
              <label>
                <span>نهاية التفرغ</span>
                <input type="time" id="draftEndTime" defaultValue="18:00" />
              </label>
              <button type="button" className="btn btn-soft draft-mini-btn" id="draftPreviewUpdate">
                عاين التعديل
              </button>
            </div>
          </div>
          <div className="seraj-city-actions">
            <button type="button" className="btn btn-dark" id="draftApply">
              احفظ التعديل
            </button>
            <button type="button" className="btn btn-soft" id="draftCancel">
              أغلق المعاينة
            </button>
          </div>
        </div>

        <div className="planner-card-shell">
          <div className="planner-unified-card reveal">
            <div className="planner-chooser planner-chooser--merged">
              <div className="planner-chooser-top">
                <div className="field route-field">
                  <label htmlFor="region">
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-pin" />
                    </svg>{' '}
                    المنطقة
                  </label>
                  <select id="region" defaultValue="all">
                    <option value="all">منطقة الباحة بالكامل</option>
                    <option value="city">مدينة الباحة</option>
                    <option value="south">المخواة وجبال شدا</option>
                  </select>
                </div>
                <div className="field route-field">
                  <label htmlFor="days">
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-clock" />
                    </svg>{' '}
                    مدة الرحلة
                  </label>
                  <select id="days" defaultValue="4">
                    <option value="1">يوم واحد</option>
                    <option value="2">يومان</option>
                    <option value="3">3 أيام</option>
                    <option value="4">4 أيام</option>
                    <option value="5">5 أيام</option>
                    <option value="6">6 أيام</option>
                    <option value="7">أسبوع كامل (7 أيام)</option>
                  </select>
                </div>
              </div>
              <div className="filterline" role="group" aria-label="طابع الرحلة">
                <div className="planner-style-grid">
                  <button type="button" className="choice active" data-style="all">
                    <svg className="ic planner-style-ic" aria-hidden="true">
                      <use href="#i-compass" />
                    </svg>
                    <span>كل التجارب</span>
                  </button>
                  <button type="button" className="choice" data-style="nature">
                    <svg className="ic planner-style-ic" aria-hidden="true">
                      <use href="#i-mountain" />
                    </svg>
                    <span>طبيعة</span>
                  </button>
                  <button type="button" className="choice" data-style="heritage">
                    <svg className="ic planner-style-ic" aria-hidden="true">
                      <use href="#i-heritage" />
                    </svg>
                    <span>تراث</span>
                  </button>
                  <button type="button" className="choice" data-style="family">
                    <svg className="ic planner-style-ic" aria-hidden="true">
                      <use href="#i-family" />
                    </svg>
                    <span>عائلية</span>
                  </button>
                </div>
              </div>
              <p className="planner-filter-note" id="routeFilterNote" role="status" hidden>
                تُعرض وجهات المنطقة لعدم توفر هذا الطابع
              </p>
            </div>

            <div className="route-scroll" id="routeScroll">
              <div className="route-sticky" id="routeSticky">
                <div className="map-panel is-live-map" id="mapPanel">
                  <div
                    className="street-map"
                    id="streetMap"
                    role="region"
                    aria-label="خريطة شوارع الباحة التفاعلية"
                  />
                  <div className="street-map-notice" id="streetMapNotice" hidden role="status">
                    <strong>خريطة الشوارع غير متاحة حاليًا.</strong>
                    <span>تحتاج الخريطة إلى اتصال بالإنترنت لتحميل الشوارع والمسار.</span>
                    <button type="button" id="retryStreetMap" className="street-map-retry">
                      إعادة تحميل الخريطة
                    </button>
                  </div>
                  <svg
                    className="terrain-map"
                    id="terrainMap"
                    viewBox="0 0 1024 896"
                    aria-hidden="true"
                    inert
                  >
                    <image
                      id="terrainRelief"
                      x="-1200"
                      y="-1200"
                      width="3050"
                      height="3050"
                      href={domMedia.terrainRelief}
                    />
                    <path id="terrainRoadBorder" className="terrain-road-border" />
                    <path id="terrainRoads" className="terrain-road" />
                    <path id="routeOutline" className="map-route-outline" />
                    <path id="routeLine" className="map-route-line" />
                    <g id="mapPins" />
                  </svg>
                  <div className="map-top">
                    <strong id="mapHeading">خريطة الباحة</strong>
                    <small id="mapStatus">جارٍ تحميل خريطة الشوارع</small>
                  </div>
                  <div className="map-controls">
                    <button
                      type="button"
                      className="map-focus"
                      id="mapFocus"
                      aria-label="عرض كامل المسار"
                    >
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-compass" />
                      </svg>
                    </button>
                    <button type="button" className="map-focus" id="mapZoom" aria-label="تكبير الخريطة">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-plus" />
                      </svg>
                    </button>
                    <button type="button" className="map-focus" id="mapOut" aria-label="تصغير الخريطة">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-minus" />
                      </svg>
                    </button>
                  </div>
                  <div className="map-credit" id="mapCredit" aria-label="مصادر بيانات الخريطة">
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noopener"
                    >
                      © OpenStreetMap
                    </a>
                    <span className="terrain-credit">
                      {' '}
                      ·{' '}
                      <a
                        href="https://registry.opendata.aws/terrain-tiles/"
                        target="_blank"
                        rel="noopener"
                      >
                        Mapzen / SRTM
                      </a>
                    </span>
                    <span className="street-credit">
                      {' '}
                      ·{' '}
                      <a href="https://openmaptiles.org/" target="_blank" rel="noopener">
                        © OpenMapTiles
                      </a>{' '}
                      ·{' '}
                      <a href="https://openfreemap.org/" target="_blank" rel="noopener">
                        OpenFreeMap
                      </a>
                    </span>
                  </div>
                  <div className="scroll-guide">
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-route" />
                    </svg>
                    <span>اسحب الخريطة أو كبّرها بإصبعين</span>
                  </div>
                </div>

                <article className="route-side" aria-label="بطاقة المحطة">
                  <div className="route-head">
                    <div className="route-counter-badge">
                      <svg className="ic route-counter-icon" aria-hidden="true">
                        <use href="#i-route" />
                      </svg>
                      <span id="routeCounter">المحطة 1 من 15</span>
                    </div>
                  </div>
                  <div
                    className="station-dots"
                    id="routeDots"
                    role="group"
                    aria-label="محطات المسار"
                  />
                  <button
                    type="button"
                    className="route-image"
                    id="routeGallery"
                    aria-label="إيقاف تبديل صور المحطة تلقائيًا"
                    aria-pressed="false"
                    aria-describedby="stopPhoto"
                  >
                    <img className="photo" id="stopPhoto" alt="" decoding="async" draggable={false} />
                    <span className="route-category route-category--overlay" id="stopCategory" />
                    <span className="stop-explore-banner" id="stopExploreBanner" role="status" hidden>
                      <span id="stopExploreText" />
                    </span>
                    <span className="photo-note" id="stopPhotoNote" hidden />
                  </button>
                  <div className="route-text">
                    <div className="route-title-row">
                      <h3 className="route-title" id="stopTitle" tabIndex={-1}>
                        غابة رغدان
                      </h3>
                      <div className="route-info">
                        <svg className="ic tiny" aria-hidden="true">
                          <use href="#i-clock" />
                        </svg>
                        <span id="stopDuration">مدة الزيارة المقترحة · 90 دقيقة</span>
                      </div>
                    </div>
                    <p className="route-desc" id="stopDesc">
                      غابة عرعر كثيفة وممشى معلّق بإطلالات ساحرة على السروات
                    </p>
                  </div>
                  <div className="route-footer">
                    <button type="button" className="btn btn-dark" id="addStop">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-plus" />
                      </svg>{' '}
                      أضف إلى رحلتي
                    </button>
                    <a className="btn btn-soft" id="routePlace" href="/place/raghdan">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-details" />
                      </svg>{' '}
                      التفاصيل
                    </a>
                    <a
                      className="btn btn-soft map-link"
                      id="openMaps"
                      href="https://www.google.com/maps"
                      rel="noopener"
                      target="_blank"
                      aria-label="افتح الاتجاهات في خرائط Google"
                    >
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-pin" />
                      </svg>{' '}
                      افتح الاتجاهات
                    </a>
                  </div>
                </article>
                <div id="conciergeLiveRegion" className="visually-hidden" aria-live="polite" aria-atomic="true" />
              </div>
            </div>

            <div className="trip-summary trip-summary--board trip-summary--integrated" id="summary">
              <div className="trip-summary-top">
                <div className="trip-summary-head">
                  <h3 className="trip-summary-title">
                    <svg
                      className="section-mark"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <use href="#i-section-summary" width="24" height="24" />
                    </svg>
                    <span>مخطط المسار المعتمد</span>
                  </h3>
                  <span className="trip-summary-hint" id="summaryHint">
                    اضغط على أي يوم لفتح محطاته، أو اسحب أي محطة لنقلها بين الأيام
                  </span>
                </div>
                <div className="summary-actions">
                  <button type="button" className="btn btn-dark" id="approveTrip" disabled>
                    اعتمد رحلتي{' '}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-check" />
                    </svg>
                  </button>
                  <button type="button" className="btn btn-dark" id="downloadTripPdf" hidden>
                    <span>نزّل مخطط الرحلة PDF</span>{' '}
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-download" />
                    </svg>
                  </button>
                </div>
              </div>
              <p id="summaryWarning" className="summary-warning" role="status" hidden />
              <div id="summaryStops" className="summary-board-days">
                <p className="summary-empty-state">
                  أضف المحطات من الخريطة أعلاه لتنظيم جدول أيام رحلتك هنا.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <svg className="heritage-divider planner-heritage-divider" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-woven-band-thin)" />
      </svg>
    </section>
  );
}
