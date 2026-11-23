import domMedia from '@/data/domMedia.json';

export function StorySection() {
  return (
    <section className="story" aria-labelledby="storyTitle">
      <div className="container story-grid">
        <div className="story-text reveal">
          <div className="caption section-kicker">
            <svg
              className="section-mark"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <use href="#i-section-village" width="24" height="24" />
            </svg>
            <span>من قلب المخواة</span>
          </div>
          <h2 id="storyTitle">قرية ذي عين التراثية إرث معماري أصيل</h2>
          <p className="lead">
            تتدرج المباني الحجرية التاريخية على سفح الجبل بتناغم هندسي فريد وتطل على عين الماء
            الجارية ومزارع الموز والريحان في وادي ذي خضرة
          </p>
        </div>
        <a
          href="/place/ain"
          className="story-art scenic-card reveal"
          aria-label="اكتشف قرية ذي عين"
        >
          <img
            className="photo"
            data-photo="ain"
            src={domMedia.ain}
            alt="بيوت قرية ذي عين الحجرية"
            loading="lazy"
            decoding="async"
          />
          <div className="story-tag">
            <svg className="ic tiny" aria-hidden="true">
              <use href="#i-pin" />
            </svg>{' '}
            قرية ذي عين <span>محافظة المخواة</span>
          </div>
        </a>
        <a href="/place/ain" className="btn btn-dark story-cta reveal">
          تعرّف على ذي عين{' '}
          <svg className="ic" aria-hidden="true">
            <use href="#i-arrow" />
          </svg>
        </a>
      </div>
    </section>
  );
}
