import domMedia from '@/data/domMedia.json';

export function TripPlannerSection() {
  return (
    <section className="planner" id="planner">
      <div className="container">
        <div className="planner-heading reveal">
          <div className="caption section-kicker">
            <svg
              className="section-mark"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <use href="#i-hero-plan" width="24" height="24" />
            </svg>
            <span>تخطيط المسار والزيارة</span>
          </div>
          <h2>تخطيط المسارات والجولات الميدانية</h2>
          <p className="lead">اختر المنطقة ومدة الزيارة، واستكشف محطات رحلتك على الخريطة.</p>
        </div>

        <div className="planner-chooser reveal">
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
          <div className="filterline" role="group" aria-label="طابع الرحلة">
            <span>طابع الرحلة</span>
            <button type="button" className="choice active" data-style="all">
              كل التجارب
            </button>
            <button type="button" className="choice" data-style="nature">
              طبيعة
            </button>
            <button type="button" className="choice" data-style="heritage">
              تراث
            </button>
            <button type="button" className="choice" data-style="family">
              عائلية
            </button>
          </div>
          <p className="planner-filter-note" id="routeFilterNote" role="status" hidden>
            تُعرض وجهات المنطقة لعدم توفر هذا الطابع
          </p>
        </div>

        <div className="planner-intro">
          <div className="caption section-kicker">
            <svg
              className="section-mark"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <use href="#i-section-route-map" width="24" height="24" />
            </svg>
            <span>مسار استكشافي تفاعلي</span>
          </div>
          <nav className="season-cities planner-cities" aria-label="أجواء المدن على المسار">
            <a href="#city/baha">
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-weather" />
              </svg>{' '}
              أجواء مدينة الباحة
            </a>
            <a href="#city/makhwah">
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-weather" />
              </svg>{' '}
              أجواء المخواة
            </a>
          </nav>
        </div>
      </div>

      <div className="container">
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
                  <div className="caption" id="routeCounter">
                    المحطة 1 من 4
                  </div>
                  <div className="route-nav" id="routeNav" role="group" aria-label="تصفح المحطات">
                    <button type="button" id="routePrev" aria-label="المحطة السابقة">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-arrow" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      id="routePause"
                      aria-label="أوقف تبديل المحطات"
                      aria-pressed="false"
                    >
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-pause" />
                      </svg>
                    </button>
                    <button type="button" id="routeNext" aria-label="المحطة التالية">
                      <svg className="ic" aria-hidden="true">
                        <use href="#i-arrow" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  className="station-dots"
                  id="routeDots"
                  role="group"
                  aria-label="محطات المسار"
                />
                <small id="mapApproximate" className="map-approx-note" hidden>
                  المسار المرسوم توضيحي وليس مسار ملاحة معتمدًا
                </small>
                <button
                  type="button"
                  className="route-image"
                  id="routeGallery"
                  aria-label="إيقاف تبديل صور المحطة تلقائيًا"
                  aria-pressed="false"
                  aria-describedby="stopPhoto"
                >
                  <img className="photo" id="stopPhoto" alt="" decoding="async" draggable={false} />
                  <span className="photo-note" id="stopPhotoNote" hidden />
                </button>
                <div className="route-text">
                  <div className="stop-explore-banner" id="stopExploreBanner" role="status" hidden>
                    <span id="stopExploreText" />
                  </div>
                  <span className="route-category" id="stopCategory" />
                  <h3 className="route-title" id="stopTitle" tabIndex={-1}>
                    غابة رغدان
                  </h3>
                  <div className="route-info">
                    <svg className="ic tiny" aria-hidden="true">
                      <use href="#i-clock" />
                    </svg>
                    <span id="stopDuration">مدة الزيارة المقترحة 90 دقيقة</span>
                  </div>
                  <p className="route-desc" id="stopDesc">
                    استعرض بيانات الوجهة وأضفها إلى مسار الزيارة
                  </p>
                  <p className="route-weather">
                    <a id="stopCity" href="#city/baha">
                      مدينة الباحة
                    </a>
                    <span id="stopWeather" />
                  </p>
                </div>
                <div className="route-footer">
                  <button type="button" className="btn btn-dark" id="addStop">
                    <svg className="ic" aria-hidden="true">
                      <use href="#i-plus" />
                    </svg>{' '}
                    أضف إلى رحلتي
                  </button>
                  <a className="btn btn-soft" id="routePlace" href="#place/raghdan">
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

          <div className="trip-summary" id="summary">
            <div>
              <div className="caption section-kicker">
                <svg
                  className="section-mark"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <use href="#i-section-summary" width="24" height="24" />
                </svg>
                <span>ملخص رحلتك</span>
              </div>
              <h3>مخطط المسار المعتمد</h3>
              <p id="summaryMeta">منطقة الباحة | يومان | لم تُضف محطات بعد</p>
              <p id="summaryWarning" className="summary-warning" role="status" hidden />
              <div id="summaryStops" className="summary-list">
                <span className="summary-item">اختر المحطات من الخريطة</span>
              </div>
              <p className="note">
                المواعيد بتوقيت المملكة العربية السعودية ومدة الانتقال تقديرية
              </p>
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
          <section className="today-trip-panel" id="todayTripPanel" hidden aria-labelledby="todayTripTitle">
            <div className="today-trip-head">
              <div>
                <span className="today-trip-kicker">وضع التنفيذ اليومي</span>
                <h4 id="todayTripTitle">رحلتي اليوم</h4>
              </div>
              <div className="today-trip-controls">
                <button type="button" className="btn btn-soft" id="todayReplanBtn">
                  أعد ترتيب المتبقي
                </button>
              </div>
            </div>
            <div className="today-trip-next" id="todayNextStop" />
            <div className="today-trip-timeline" id="todayTimeline" />
          </section>
        </div>
      </div>
    </section>
  );
}
