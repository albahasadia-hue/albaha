interface MenuLink {
  href: string;
  label: string;
  icon: string;
  isGuide?: boolean;
}

const MENU_LINKS: MenuLink[] = [
  { href: '#home', label: 'الرئيسية', icon: '#i-nav-home' },
  { href: '#experiences', label: 'التجارب', icon: '#i-nav-experience' },
  { href: '#destinations', label: 'الوجهات', icon: '#i-nav-destination' },
  { href: '#guide', label: 'الدليل', icon: '#i-nav-guide', isGuide: true },
  { href: '#invest', label: 'الاستثمار', icon: '#i-nav-invest' },
  { href: '#planner', label: 'خطّط رحلتك', icon: '#i-route' },
  { href: '#visit-season', label: 'أجواء الزيارة', icon: '#i-weather' },
];

export function MenuDialog() {
  return (
    <dialog className="side-panel" id="menuPanel" aria-label="قائمة الصفحات">
      <div className="panel-content">
        <div className="panel-top">
          <strong>اكتشف الباحة</strong>
          <button type="button" className="panel-close" data-close="" aria-label="إغلاق">
            <svg className="ic">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <nav className="menu-list">
          {MENU_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              {...(item.isGuide ? { 'data-tour-guide-nav': '' } : {})}
            >
              {item.label}{' '}
              <svg className="ic">
                <use href={item.icon} />
              </svg>
            </a>
          ))}
        </nav>
        <div className="menu-bottom">
          <h3>ما الوجهة التي تبحث عنها؟</h3>
          <button type="button" data-open="search" className="btn btn-dark" style={{ width: '100%' }}>
            ابحث عن مكان{' '}
            <svg className="ic">
              <use href="#i-search" />
            </svg>
          </button>
        </div>
      </div>
    </dialog>
  );
}
