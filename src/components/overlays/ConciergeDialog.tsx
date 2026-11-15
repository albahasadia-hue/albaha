import { GuideCharacter } from '@/components/common/GuideCharacter';

export function ConciergeDialog() {
  return (
    <dialog
      className="side-panel concierge-panel"
      id="agentPanel"
      aria-labelledby="conciergeTitle"
    >
      <div className="panel-content concierge-shell">
        <header className="concierge-header">
          <div className="concierge-identity">
            <span className="concierge-avatar" aria-hidden="true">
              <GuideCharacter id="conciergeHeaderChar" pose="idle" size={38} className="guide-dialog-avatar" />
            </span>
            <div className="concierge-title-wrap">
              <div className="concierge-title-row">
                <h2 id="conciergeTitle">المرشد السياحي الذكي</h2>
              </div>
              <p className="concierge-subtitle">
                <span id="conciergeModeText">مساعد تخطيط زيارتك في الباحة</span>
              </p>
            </div>
          </div>
          <div className="concierge-head-actions">
            <button
              type="button"
              className="concierge-head-btn"
              data-concierge-reset=""
              aria-label="بدء محادثة جديدة"
              title="محادثة جديدة"
            >
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-plus" />
              </svg>
            </button>
            <button
              type="button"
              className="panel-close"
              data-close=""
              aria-label="إغلاق المرشد السياحي الذكي"
            >
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-x" />
              </svg>
            </button>
          </div>
        </header>

        <ul className="concierge-context" id="conciergeContext" aria-label="تفضيلات زيارتك" hidden />

        <div
          className="concierge-body"
          id="conciergeScroll"
          tabIndex={0}
          aria-label="محتوى المرشد السياحي"
        >
          <div className="concierge-welcome" id="conciergeWelcome">
            <h3>كيف أساعدك اليوم في رحلتك؟</h3>
            <div className="concierge-shortcuts" aria-label="القائمة السريعة للمساعد">
              <button type="button" data-concierge-intent="plan">
                <svg className="ic" aria-hidden="true">
                  <use href="#i-route" />
                </svg>
                <span>
                  <strong>رتّب لي رحلة</strong>
                  <small>برنامج يومي بالساعات</small>
                </span>
              </button>
              <button type="button" data-concierge-intent="weather-now">
                <svg className="ic" aria-hidden="true">
                  <use href="#i-weather" />
                </svg>
                <span>
                  <strong>الأجواء والطقس</strong>
                  <small>السراة وتهامة والملابس</small>
                </span>
              </button>
              <button type="button" data-concierge-intent="discover">
                <svg className="ic" aria-hidden="true">
                  <use href="#i-compass" />
                </svg>
                <span>
                  <strong>اقترح لي وجهات</strong>
                  <small>معالم وطبيعة وتراث</small>
                </span>
              </button>
              <button type="button" data-concierge-intent="dining">
                <svg className="ic" aria-hidden="true">
                  <use href="#i-guide-dining" />
                </svg>
                <span>
                  <strong>المطاعم والمقاهي</strong>
                  <small>خيارات الدليل والمأكولات</small>
                </span>
              </button>
              <button type="button" data-concierge-intent="camping">
                <svg className="ic" aria-hidden="true">
                  <use href="#i-guide-tent" />
                </svg>
                <span>
                  <strong>الإقامة والمخيمات</strong>
                  <small>فنادق وشاليهات ومنتجعات</small>
                </span>
              </button>
              <button type="button" data-concierge-intent="travel">
                <svg className="ic" aria-hidden="true">
                  <use href="#i-car" />
                </svg>
                <span>
                  <strong>الوصول والأوراق</strong>
                  <small>المطار والطرق والتأشيرة</small>
                </span>
              </button>
              <button type="button" data-concierge-intent="saved">
                <svg className="ic" aria-hidden="true">
                  <use href="#i-map" />
                </svg>
                <span>
                  <strong>محطات رحلتي</strong>
                  <small>راجع مسارك المعتمد</small>
                </span>
              </button>
              <button type="button" data-concierge-intent="faq">
                <svg className="ic" aria-hidden="true">
                  <use href="#i-foot-faq" />
                </svg>
                <span>
                  <strong>الأسئلة الشائعة</strong>
                  <small>المواعيد والأرقام الرسمية</small>
                </span>
              </button>
            </div>
          </div>

          <div
            className="concierge-thread"
            id="conciergeThread"
            role="log"
            aria-label="المحادثة مع المرشد السياحي الذكي"
            aria-live="polite"
            aria-relevant="additions"
          />
          <p className="concierge-status" id="conciergeStatus" role="status" />
        </div>

        <div className="concierge-composer">
          <div className="concierge-quickbar" aria-label="اختصارات سريعة">
            <button type="button" data-concierge-intent="discover">
              الوجهات
            </button>
            <button type="button" data-concierge-intent="weather-now">
              الطقس
            </button>
            <button type="button" data-concierge-prompt="فنادق وشاليهات في الباحة">
              الفنادق
            </button>
            <button type="button" data-concierge-prompt="متاحف وأسواق بلجرشي">
              أسواق ومتاحف
            </button>
            <button type="button" data-concierge-intent="faq">
              الأسئلة العامة
            </button>
          </div>
          <form id="conciergeForm">
            <input
              type="text"
              id="conciergeInput"
              aria-label="اسأل المرشد"
              placeholder="اسأل عن مكان، خطة عائلية، وقت زيارة، أو الخريطة..."
              maxLength={240}
              autoComplete="off"
              required
            />
            <button className="concierge-send" type="submit" aria-label="أرسل السؤال">
              <svg className="ic" aria-hidden="true">
                <use href="#i-arrow" />
              </svg>
            </button>
          </form>
          <div className="concierge-composer-meta">
            <div>
              <button type="button" id="conciergeHelp">
                أمثلة لما تسأله
              </button>
              <button type="button" id="conciergeReset" data-concierge-reset="">
                محادثة جديدة
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
