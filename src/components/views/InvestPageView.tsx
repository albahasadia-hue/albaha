'use client';

import { useMemo, useState } from 'react';
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

export function InvestPageView({ initialHidden = true }: InvestPageViewProps) {
  const [selectedSector, setSelectedSector] = useState<InvestSectorId>('all');

  const visibleProjects = useMemo(() => {
    if (selectedSector === 'all') return INVEST_PROJECTS;
    return INVEST_PROJECTS.filter((project) => project.sector === selectedSector);
  }, [selectedSector]);

  const sectorLookup = useMemo(
    () => new Map(INVEST_SECTORS.map((sector) => [sector.id, sector])),
    []
  );

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
              className="btn btn-dark"
            >
              <span>استكشف منصة فرص</span>
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-external" />
              </svg>
            </a>
            <a href="/official-portal" className="btn btn-soft">
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
            <div className="invest-sector-select-wrap">
              <svg className="ic tiny invest-select-icon" aria-hidden="true">
                <use href={sectorLookup.get(selectedSector)?.icon || '#i-nav-invest'} />
              </svg>
              <select
                id="investSectorSelect"
                className="invest-sector-select"
                value={selectedSector}
                onChange={(event) => setSelectedSector(event.target.value as InvestSectorId)}
                aria-label="تصفية المشاريع حسب القطاع"
              >
                {INVEST_SECTORS.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.label}
                  </option>
                ))}
              </select>
              <svg className="ic tiny invest-select-chev" aria-hidden="true">
                <use href="#i-chevron" />
              </svg>
            </div>
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
                      <li key={item}>
                        <svg className="ic tiny" aria-hidden="true">
                          <use href="#i-check" />
                        </svg>
                        <span>{item}</span>
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
            <div key={channel.title} className="invest-channel-card">
              <span className="invest-channel-tag">{channel.tag}</span>
              <strong>{channel.title}</strong>
              <p>{channel.description}</p>
              <a
                href={channel.href}
                className="invest-channel-link"
                {...(channel.external ? { target: '_blank', rel: 'noopener' } : {})}
              >
                <span>{channel.linkLabel}</span>
                <svg className="ic tiny" aria-hidden="true">
                  <use href={channel.icon} />
                </svg>
              </a>
            </div>
          ))}
        </section>
      </div>
    </article>
  );
}
