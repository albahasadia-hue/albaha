import { GuideCharacter } from '@/components/common/GuideCharacter';
import { SMART_GUIDE_NAME } from '@/lib/smartGuideName';

const STARTER_PROMPTS: Array<{
  label: string;
  subtitle: string;
  prompt: string;
  icon: string;
}> = [
  {
    label: 'رتّب لي يومين مع العيال',
    subtitle: 'برنامج عائلي متكامل بمحطات مريحة',
    prompt: 'رتّب لي يومين مع العيال',
    icon: '#i-route',
  },
  {
    label: 'خطّط حسب الأجواء الآن',
    subtitle: 'جولة تراعي حالة الطقس الحالية',
    prompt: 'رتّب لي جولة اليوم حسب الأجواء',
    icon: '#i-weather',
  },
  {
    label: 'وين أبيت في العقيق؟',
    subtitle: 'فنادق وشقق قريبة من المطار',
    prompt: 'أنا في العقيق، وين أقدر أبيت؟',
    icon: '#i-directory-hotel',
  },
  {
    label: 'اكتشف قرية ذي عين',
    subtitle: 'التراث الحجري وعين الماء والموقع',
    prompt: 'وش يميز قرية ذي عين التراثية؟',
    icon: '#i-section-village',
  },
];

export function ConciergeDialog() {
  return (
    <dialog
      className="side-panel concierge-panel smart-guide-panel"
      id="agentPanel"
      dir="rtl"
      aria-labelledby="conciergeTitle"
    >
      <div className="panel-content concierge-shell smart-guide-shell">
        <header className="concierge-header sg-header">
          <div className="concierge-identity sg-identity">
            <span className="concierge-avatar sg-avatar" aria-hidden="true">
              <GuideCharacter
                id="conciergeHeaderChar"
                pose="idle"
                size={28}
                className="guide-dialog-avatar"
              />
            </span>
            <div className="sg-identity-copy">
              <h2 id="conciergeTitle">{SMART_GUIDE_NAME}</h2>
              <span className="sg-live-sub">
                <i className="sg-live-dot" aria-hidden="true" />
                مرافقك الذكي · حوار متواصل
              </span>
            </div>
          </div>

          <div className="concierge-head-actions sg-head-actions">
            <button
              type="button"
              className="concierge-head-btn sg-head-btn"
              id="conciergeReset"
              data-concierge-reset=""
              aria-label="محادثة جديدة"
              title="بدء محادثة جديدة"
              hidden
            >
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-plus" />
              </svg>
              <span className="sg-reset-label">جديد</span>
            </button>
            <button
              type="button"
              className="panel-close sg-close-btn"
              id="conciergeCloseBtn"
              data-close=""
              aria-label={`إغلاق ${SMART_GUIDE_NAME}`}
              title="إغلاق"
            >
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-x" />
              </svg>
            </button>
          </div>
        </header>

        <div
          className="concierge-body sg-body"
          id="conciergeScroll"
          tabIndex={0}
          aria-label={`محادثة ${SMART_GUIDE_NAME}`}
        >
          <section className="concierge-welcome sg-welcome" id="conciergeWelcome">
            <div className="sg-welcome-hero">
              <span className="sg-welcome-avatar" aria-hidden="true">
                <GuideCharacter pose="idle" size={42} />
              </span>
              <div className="sg-welcome-copy">
                <h3>حيّاك في الباحة! وش ودّك نرتّب اليوم؟</h3>
                <p>
                  اسألني عن الوجهات والسكن والمطاعم، وعدّل خطة رحلتك معي خطوة بخطوة في نفس المحادثة.
                </p>
              </div>
            </div>

            <div className="sg-starters" aria-label="اختصارات البداية">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.prompt}
                  type="button"
                  className="sg-starter-btn"
                  data-concierge-prompt={item.prompt}
                >
                  <span className="sg-starter-ic" aria-hidden="true">
                    <svg className="ic tiny">
                      <use href={item.icon} />
                    </svg>
                  </span>
                  <span className="sg-starter-text">
                    <strong>{item.label}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div
            className="concierge-thread sg-thread"
            id="conciergeThread"
            role="log"
            aria-label={`رسائل ${SMART_GUIDE_NAME}`}
            aria-live="polite"
            aria-relevant="additions"
          />
          <p className="concierge-status visually-hidden" id="conciergeStatus" role="status" />
        </div>

        <div className="concierge-composer sg-composer">
          <form id="conciergeForm" className="sg-form">
            <input
              type="text"
              id="conciergeInput"
              aria-label={`اسأل ${SMART_GUIDE_NAME}`}
              placeholder="اكتب سؤالك أو عدّل خطتك (مثلاً: خلّ الرحلة يومين)…"
              maxLength={280}
              autoComplete="off"
              enterKeyHint="send"
              required
            />
            <button
              className="concierge-send sg-send-btn"
              type="submit"
              aria-label="إرسال السؤال"
              title="إرسال"
            >
              <svg className="ic" aria-hidden="true">
                <use href="#i-arrow" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </dialog>
  );
}
