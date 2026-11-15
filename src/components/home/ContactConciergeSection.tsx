import { GuideCharacter } from '@/components/common/GuideCharacter';

export function ContactConciergeSection() {
  return (
    <section id="contact" className="cta-final">
      <div className="container cta-grid reveal">
        <div>
          <div className="caption section-kicker">
            <span className="guide-section-badge" aria-hidden="true">
              <GuideCharacter decorative size={20} className="guide-section-avatar" />
            </span>
            <span>المرشد السياحي الذكي</span>
          </div>
          <h2>المرشد السياحي الذكي</h2>
          <p className="lead">اسأل المرشد عن الوجهات والطقس، وخطّط لزيارتك.</p>
        </div>
        <div className="action-row">
          <button type="button" className="btn btn-dark" data-open="agent">
            اسأل المرشد{' '}
            <svg className="ic" aria-hidden="true">
              <use href="#i-arrow" />
            </svg>
          </button>
          <a href="#planner" className="btn btn-soft">
            افتح مخطط الرحلة{' '}
            <svg className="ic" aria-hidden="true">
              <use href="#i-route" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
