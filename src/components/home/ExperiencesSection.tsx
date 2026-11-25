import photoData from '@/data/photoData.json';

interface ExperienceItem {
  href: string;
  tone: 'nature' | 'heritage' | 'family';
  photoKey: 'mountainCover' | 'culture' | 'hussamCover';
  extraClass?: string;
  alt: string;
  kickerIcon: string;
  kicker: string;
  action: string;
}

const EXPERIENCES: ExperienceItem[] = [
  {
    href: '/place/shada',
    tone: 'nature',
    photoKey: 'mountainCover',
    alt: '',
    kickerIcon: '#i-mountain',
    kicker: 'طبيعة ومغامرة',
    action: 'اكتشف جبل شدا',
  },
  {
    href: '/place/ain',
    tone: 'heritage',
    photoKey: 'culture',
    extraClass: 'experience-culture',
    alt: 'جدّة تضبط كمّ ثوب حفيدتها المطرّز وبجوارهما رجل بزيّ تراثي أمام بيت حجري',
    kickerIcon: '#i-heritage',
    kicker: 'تراث وثقافة',
    action: 'اكتشف قرية ذي عين',
  },
  {
    href: '/place/hussam',
    tone: 'family',
    photoKey: 'hussamCover',
    alt: '',
    kickerIcon: '#i-family',
    kicker: 'تجارب عائلية',
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
        <div className="section-top experiences-top reveal">
          <div className="experiences-intro">
            <h2 className="experiences-heading">عِش المتعة في منطقة الباحة</h2>
            <div className="exp-cat-strip" role="navigation" aria-label="تصنيفات تجارب الباحة">
              {EXPERIENCES.map((item) => (
                <a
                  key={`cat-${item.tone}`}
                  href={item.href}
                  className="exp-cat-card"
                  data-exp-tone={item.tone}
                >
                  <span className="exp-cat-icon" aria-hidden="true">
                    <svg className="ic tiny">
                      <use href={item.kickerIcon} />
                    </svg>
                  </span>
                  <span className="exp-cat-text">
                    <strong>{item.kicker}</strong>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="experience-grid">
          {EXPERIENCES.map((item) => (
            <a
              key={item.href + item.photoKey}
              className={`experience ${item.extraClass ? `${item.extraClass} ` : ''}scenic-card reveal`}
              data-exp-tone={item.tone}
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
                <h3 className="card-kicker" data-exp-tone={item.tone}>
                  <svg className="ic tiny" aria-hidden="true">
                    <use href={item.kickerIcon} />
                  </svg>{' '}
                  {item.kicker}
                </h3>
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
