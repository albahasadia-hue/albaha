import { GuideCharacter } from '@/components/common/GuideCharacter';
import { SMART_GUIDE_NAME } from '@/lib/smartGuideName';

export function ContactConciergeSection() {
  return (
    <section id="contact" className="cta-final">
      <div className="container cta-grid reveal">
        <div>
          <div className="caption section-kicker">
            <span className="guide-section-badge" aria-hidden="true">
              <GuideCharacter decorative size={20} className="guide-section-avatar" />
            </span>
            <span>{SMART_GUIDE_NAME}</span>
          </div>
          <h2>{SMART_GUIDE_NAME}</h2>
          <p className="lead">اسأل المساعد عن الوجهات والمبيت والمطاعم، وخطّط لرحلتك في الباحة.</p>
        </div>
        <div className="action-row">
          <button type="button" className="btn btn-dark" data-open="agent">
            افتح {SMART_GUIDE_NAME}{' '}
            <svg className="ic" aria-hidden="true">
              <use href="#i-arrow" />
            </svg>
          </button>
          <a href="/planner" className="btn btn-soft">
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
