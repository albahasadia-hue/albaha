'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  INVEST_CHANNELS,
  INVEST_KPIS,
  INVEST_PROJECTS,
  INVEST_SECTORS,
  type InvestSectorId,
} from '@/data/investData';

interface InvestPageViewProps {
  initialHidden?: boolean;
}

const sectorLookup = new Map(INVEST_SECTORS.map((sector) => [sector.id, sector]));

function InvestSectorFilter({
  value,
  onChange,
}: {
  value: InvestSectorId;
  onChange: (value: InvestSectorId) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = INVEST_SECTORS.findIndex((sector) => sector.id === value);
  const selected = INVEST_SECTORS[selectedIndex];

  useEffect(() => {
    if (!open) return;
    options.current[selectedIndex]?.focus();
    function dismissOnOutsidePress(event: PointerEvent) {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismissOnOutsidePress);
    return () => document.removeEventListener('pointerdown', dismissOnOutsidePress);
  }, [open, selectedIndex]);

  function focusTriggerAndClose() {
    trigger.current?.focus({ preventScroll: true });
    setOpen(false);
  }

  function handleMenuKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      focusTriggerAndClose();
      return;
    }
    const current = options.current.indexOf(document.activeElement as HTMLButtonElement);
    const last = INVEST_SECTORS.length - 1;
    const destinations: Record<string, number> = {
      ArrowDown: Math.min(current + 1, last),
      ArrowUp: Math.max(current - 1, 0),
      Home: 0,
      End: last,
    };
    const destination = destinations[event.key];
    if (destination === undefined) return;
    event.preventDefault();
    options.current[destination]?.focus();
  }

  return (
    <div
      className="invest-sector-filter"
      ref={wrapper}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        id="investSectorSelect"
        className="invest-sector-trigger"
        ref={trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`تصفية المشاريع حسب القطاع، ${selected.label}`}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <svg className="ic invest-sector-option-icon" aria-hidden="true"><use href={selected.icon} /></svg>
        <span>{selected.label}</span>
        <svg className="ic tiny invest-sector-chevron" aria-hidden="true"><use href="#i-chevron" /></svg>
      </button>
      <div
        className="invest-sector-menu"
        id={menuId}
        role="listbox"
        aria-label="القطاعات الاستثمارية"
        hidden={!open}
        onKeyDown={handleMenuKey}
      >
        {INVEST_SECTORS.map((sector, index) => (
          <button
            key={sector.id}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={sector.id === value}
            className="invest-sector-option"
            ref={(element) => { options.current[index] = element; }}
            onClick={() => {
              onChange(sector.id);
              focusTriggerAndClose();
            }}
          >
            <svg className="ic invest-sector-option-icon" aria-hidden="true"><use href={sector.icon} /></svg>
            <span>{sector.label}</span>
            {sector.id === value && <svg className="ic tiny" aria-hidden="true"><use href="#i-check" /></svg>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function InvestPageView({ initialHidden = true }: InvestPageViewProps) {
  const [selectedSector, setSelectedSector] = useState<InvestSectorId>('all');
  const visibleProjects = selectedSector === 'all'
    ? INVEST_PROJECTS
    : INVEST_PROJECTS.filter((project) => project.sector === selectedSector);

  return (
    <article
      id="investView"
      className="invest-view"
      aria-labelledby="investTitle"
      hidden={initialHidden}
    >
      <div className="container">
        <div className="tour-guide-detail-nav">
          <nav className="place-trail" aria-label="مسار الصفحة">
            <a href="/">الرئيسية</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">الاستثمار</span>
          </nav>
          <a className="tour-guide-back" href="/">
            <svg className="ic tiny" aria-hidden="true">
              <use href="#i-arrow" />
            </svg>
            العودة إلى الرئيسية
          </a>
        </div>

        <header className="invest-hero-card">
          <div className="invest-hero-copy">
            <div className="caption section-kicker">
              <svg className="section-mark" viewBox="0 0 24 24" aria-hidden="true">
                <use href="#i-nav-invest" width="24" height="24" />
              </svg>
              <span>الاستثمار والتنمية الاقتصادية · منطقة الباحة</span>
            </div>
            <h1 id="investTitle" tabIndex={-1}>
              الاستثمار في منطقة الباحة
            </h1>
            <p className="lead">
              بوابة الفرص الاستثمارية البلدية والسياحية في السراة وتهامة ضمن مستهدفات رؤية السعودية 2030.
            </p>
          </div>
          <div className="invest-hero-actions">
            <a
              href="https://furas.momra.gov.sa"
              target="_blank"
              rel="noopener"
              className="btn btn-glass invest-hero-action invest-hero-action--primary"
            >
              <span>استكشف منصة فرص</span>
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-external" />
              </svg>
            </a>
            <a href="/official-portal" className="btn btn-glass invest-hero-action">
              <span>مؤشرات التنمية</span>
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-arrow" />
              </svg>
            </a>
          </div>
        </header>

        <section className="invest-kpis" aria-label="مؤشرات البيئة الاستثمارية">
          {INVEST_KPIS.map((kpi) => (
            <div key={kpi.label} className="invest-kpi-card">
              <span className="invest-kpi-head">
                <svg className="ic tiny" aria-hidden="true">
                  <use href={kpi.icon} />
                </svg>
                <span>{kpi.label}</span>
              </span>
              <strong dir="ltr">{kpi.value}</strong>
              <p>{kpi.note}</p>
            </div>
          ))}
        </section>

        <section className="invest-section" aria-labelledby="investSectorsTitle">
          <div className="invest-section-head">
            <div>
              <h2 id="investSectorsTitle">القطاعات والمشاريع الاستثمارية</h2>
              <p>تصفية المشاريع والفرص الرئيسية حسب القطاع الاستثماري.</p>
            </div>
            <InvestSectorFilter value={selectedSector} onChange={setSelectedSector} />
          </div>

          <div className="invest-projects-grid" id="investProjectsList">
            {visibleProjects.map((project) => {
              const sectorMeta = sectorLookup.get(project.sector);
              return (
                <article key={project.id} className="invest-project-card">
                  <div className="invest-project-meta">
                    <span className="invest-sector-badge">
                      <svg className="ic tiny" aria-hidden="true">
                        <use href={sectorMeta?.icon || '#i-nav-invest'} />
                      </svg>
                      {sectorMeta?.label}
                    </span>
                    <span className="invest-project-loc">
                      <svg className="ic tiny" aria-hidden="true">
                        <use href="#i-pin" />
                      </svg>
                      {project.location}
                    </span>
                  </div>
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <ul className="invest-highlights">
                    {project.highlights.map((item) => (
                      <li key={item.label}>
                        <svg className="ic tiny" aria-hidden="true">
                          <use href={item.icon} />
                        </svg>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="invest-channels" aria-label="قنوات المستثمرين الرسمية">
          {INVEST_CHANNELS.map((channel) => (
            <article key={channel.title} className="invest-channel-card">
              <div className="invest-channel-head">
                <span className="invest-channel-icon" aria-hidden="true">
                  <svg className="ic"><use href={channel.categoryIcon} /></svg>
                </span>
                <div>
                  <span className="invest-channel-tag">{channel.tag}</span>
                  <h3>{channel.title}</h3>
                </div>
              </div>
              <p>{channel.description}</p>
              <a
                href={channel.href}
                className="invest-channel-link"
                {...(channel.external ? { target: '_blank', rel: 'noopener' } : {})}
              >
                <span dir={channel.external ? undefined : 'ltr'}>{channel.linkLabel}</span>
                <svg className="ic tiny" aria-hidden="true">
                  <use href={channel.icon} />
                </svg>
              </a>
            </article>
          ))}
        </section>
      </div>
    </article>
  );
}
