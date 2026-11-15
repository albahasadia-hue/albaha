import photoData from '@/data/photoData.json';

export function GallerySection() {
  return (
    <section id="gallery" className="gallery" aria-labelledby="galleryTitle">
      <div className="container">
        <div className="section-top reveal">
          <div>
            <div className="caption section-kicker">
              <svg
                className="section-mark"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <use href="#i-section-gallery" width="24" height="24" />
              </svg>
              <span>الباحة في صور</span>
            </div>
            <h2 id="galleryTitle">الطبيعة والعمران من المدرجات إلى الغابات</h2>
            <p className="lead">المدرّجات الزراعية والقرى الحجرية وغابات الباحة.</p>
          </div>
        </div>
        <div className="gallery-layout">
          <figure className="gallery-shot scenic-card reveal">
            <img
              className="photo"
              data-photo="terraces"
              src={photoData.terraces}
              alt="مشهد جوي لمدرّجات زراعية خضراء"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="scenic-copy">
              <span className="card-kicker">
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-leaf" />
                </svg>{' '}
                السراة
              </span>
              <h3>مزارع السراة ومدرّجاتها</h3>
              <p>مدرجات زراعية خضراء على سفوح جبال السروات</p>
            </figcaption>
          </figure>
          <a className="gallery-shot scenic-card reveal" href="#place/ain">
            <img
              className="photo"
              data-photo="villages"
              src={photoData.villages}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div className="scenic-copy">
              <span className="card-kicker">
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-heritage" />
                </svg>{' '}
                العمارة المحلية
              </span>
              <h3>القرى الحجرية</h3>
              <span className="card-action">
                جولة في ذي عين{' '}
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-arrow" />
                </svg>
              </span>
            </div>
          </a>
          <a className="gallery-shot scenic-card reveal" href="#place/raghdan">
            <img
              className="photo"
              data-photo="parks"
              src={photoData.parks}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div className="scenic-copy">
              <span className="card-kicker">
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-mountain" />
                </svg>{' '}
                هواء المرتفعات
              </span>
              <h3>الغابات والمتنزهات</h3>
              <span className="card-action">
                نزهة في رغدان{' '}
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-arrow" />
                </svg>
              </span>
            </div>
          </a>
        </div>
        <p className="guide-note">مشاهد موثقة من الأرشيف البصري لمنطقة الباحة</p>
      </div>
    </section>
  );
}
