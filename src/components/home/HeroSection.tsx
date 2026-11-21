import domMedia from '@/data/domMedia.json';

export function HeroSection() {
  return (
    <section className="hero" id="home" tabIndex={0} aria-label="مشاهد من الباحة">
      <div className="hero-media" id="heroMedia" aria-hidden="true">
        <video
          id="heroVideo"
          className="hero-video is-active"
          src="/hero.mp4?v=2"
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          aria-hidden="true"
        />
        <picture id="heroOpening" className="hero-frame is-current">
          <source
            media="(max-width: 800px) and (orientation: portrait)"
            srcSet={domMedia.heroOpeningPortrait}
          />
          <img
            src={domMedia.heroOpeningWide}
            alt=""
            fetchPriority="high"
            draggable={false}
          />
        </picture>
      </div>
      <div className="hero-lens" aria-hidden="true" />
      <div className="hero-copy">
        <h1 className="hero-title" id="heroTitle">
          غابة رغدان
        </h1>
        <p id="heroLead">
          إطلالات شاهقة من مرتفعات الباحة بين أشجار العرعر وأجواء الضباب
        </p>
        <div className="action-row">
          <a className="btn btn-glass" href="#planner">
            <svg className="ic hero-action-icon" aria-hidden="true">
              <use href="#i-hero-plan" />
            </svg>
            <span>خطّط رحلتك</span>
          </a>
          <a className="btn btn-glass" href="#destinations">
            <svg className="ic hero-action-icon" aria-hidden="true">
              <use href="#i-hero-discover" />
            </svg>
            <span>اكتشف الوجهات</span>
          </a>
        </div>
      </div>
    </section>
  );
}
