import photoData from '@/data/photoData.json';

interface ExperienceItem {
  href: string;
  photoKey: 'mountainCover' | 'culture' | 'hussamCover';
  extraClass?: string;
  alt: string;
  kickerIcon: string;
  kicker: string;
  title: string;
  action: string;
}

const EXPERIENCES: ExperienceItem[] = [
  {
    href: '#place/shada',
    photoKey: 'mountainCover',
    alt: '',
    kickerIcon: '#i-mountain',
    kicker: 'طبيعة ومغامرة',
    title: 'إلى قمم الباحة',
    action: 'اكتشف جبل شدا',
  },
  {
    href: '#place/ain',
    photoKey: 'culture',
    extraClass: 'experience-culture',
    alt: 'جدّة تضبط كمّ ثوب حفيدتها المطرّز وبجوارهما رجل بزيّ تراثي أمام بيت حجري',
    kickerIcon: '#i-heritage',
    kicker: 'تراث وثقافة',
    title: 'الثقافة والتراث',
    action: 'اكتشف قرية ذي عين',
  },
  {
    href: '#place/hussam',
    photoKey: 'hussamCover',
    alt: '',
    kickerIcon: '#i-family',
    kicker: 'تجربة عائلية',
    title: 'يوم مع العائلة',
    action: 'اكتشف منتزه الأمير حسام',
  },
];

export function ExperiencesSection() {
  return (
    <section id="experiences" className="experiences">
      <svg className="heritage-divider" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-woven-band-thin)" />
      </svg>
      <svg className="heritage-texture" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-engraving)" />
      </svg>
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
                <use href="#i-section-experiences" width="24" height="24" />
              </svg>
              <span>تجارب الباحة</span>
            </div>
            <h2>مسارات وتجارب منطقة الباحة</h2>
            <p className="lead">طبيعة وتراث وتجارب للعائلة.</p>
          </div>
        </div>
        <div className="experience-grid">
          {EXPERIENCES.map((item) => (
            <a
              key={item.href + item.photoKey}
              className={`experience ${item.extraClass ? `${item.extraClass} ` : ''}scenic-card reveal`}
              href={item.href}
            >
              <img
                className="photo"
                data-photo={item.photoKey}
                src={photoData[item.photoKey]}
                alt={item.alt}
                loading="lazy"
                decoding="async"
              />
              <div className="scenic-copy">
                <span className="card-kicker">
                  <svg className="ic tiny" aria-hidden="true">
                    <use href={item.kickerIcon} />
                  </svg>{' '}
                  {item.kicker}
                </span>
                <h3>{item.title}</h3>
                <span className="card-action">
                  {item.action}{' '}
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-arrow" />
                  </svg>
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
      <svg className="heritage-divider" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" fill="url(#experiences-woven-band-thin)" />
      </svg>
    </section>
  );
}
