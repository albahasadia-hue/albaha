import { GuideCharacter } from '@/components/common/GuideCharacter';

const STARTER_PROMPTS: Array<{ label: string; prompt: string; icon: string }> = [
  {
    label: 'رتّب لي يومين مع العيال',
    prompt: 'رتّب لي يومين مع العيال',
    icon: '#i-route',
  },
  {
    label: 'وين أبيت في العقيق؟',
    prompt: 'أنا في العقيق، وين أقدر أبيت؟',
    icon: '#i-directory-hotel',
  },
  {
    label: 'وش عندك عن فندق مدينة السحاب؟',
    prompt: 'وش عندك عن فندق مدينة السحاب؟',
    icon: '#i-compass',
  },
  {
    label: 'اكتشف قرية ذي عين',
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
            <h2 id="conciergeTitle">المرشد الذكي</h2>
          </div>

          <div className="concierge-head-actions sg-head-actions">
            <button
              type="button"
              className="concierge-head-btn sg-head-btn"
              id="conciergeReset"
              data-concierge-reset=""
              aria-label="محادثة جديدة"
              title="محادثة جديدة"
              hidden
            >
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-plus" />
              </svg>
            </button>
            <button
              type="button"
              className="panel-close sg-close-btn"
              id="conciergeCloseBtn"
              data-close=""
              aria-label="إغلاق المرشد الذكي"
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
          aria-label="محادثة المرشد الذكي"
        >
          <section className="concierge-welcome sg-welcome" id="conciergeWelcome">
            <h3>وش ودّك تكتشف اليوم؟</h3>
            <div className="sg-starters" aria-label="اختصارات البداية">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.prompt}
                  type="button"
                  className="sg-starter-btn"
                  data-concierge-prompt={item.prompt}
                >
                  <svg className="ic tiny" aria-hidden="true">
                    <use href={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          <div
            className="concierge-thread sg-thread"
            id="conciergeThread"
            role="log"
            aria-label="رسائل المرشد الذكي"
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
              aria-label="اسأل المرشد الذكي"
              placeholder="اسأل عن مكان، مبيت، مطعم، أو خطة رحلة..."
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
