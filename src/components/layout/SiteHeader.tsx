import domMedia from '@/data/domMedia.json';

interface NavLinkItem {
  href: string;
  icon: string;
  label: string;
  isGuide?: boolean;
}

const NAV_LINKS: NavLinkItem[] = [
  { href: '#home', icon: '#i-nav-home', label: 'الرئيسية' },
  { href: '#experiences', icon: '#i-nav-experience', label: 'التجارب' },
  { href: '#destinations', icon: '#i-nav-destination', label: 'الوجهات' },
  { href: '#guide', icon: '#i-nav-guide', label: 'الدليل', isGuide: true },
  { href: '#faq', icon: '#i-foot-faq', label: 'الأسئلة الشائعة' },
];

export function SiteHeader() {
  return (
    <header className="header visible" id="header">
      <nav className="nav container" aria-label="القائمة الرئيسية">
        <a href="#home" className="nav-brand">
          <img id="goldLogo" src={domMedia.goldLogo} alt="" />
          <img
            className="brand-wordmark"
            id="brandWordmark"
            src={domMedia.brandWordmark}
            alt="الباحة"
            width={384}
            height={167}
          />
        </a>
        <div className="nav-links">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              {...(item.isGuide ? { 'data-tour-guide-nav': '' } : {})}
            >
              <svg className="ic nav-item-icon" aria-hidden="true">
                <use href={item.icon} />
              </svg>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <button type="button" className="nav-icon" data-open="search" aria-label="ابحث">
            <svg className="ic">
              <use href="#i-search" />
            </svg>
          </button>
          <a href="#planner" className="btn btn-dark header-plan-button" aria-label="خطط رحلتك">
            خطّط رحلتك{' '}
            <svg className="ic" aria-hidden="true">
              <use href="#i-route" />
            </svg>
          </a>
          <button type="button" className="nav-icon menu-open" data-open="menu" aria-label="افتح القائمة">
            <svg className="ic">
              <use href="#i-menu" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
