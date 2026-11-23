'use client';

import { useState } from 'react';
import { FAQ_CATEGORIES, FAQ_ITEMS } from '@/data/faqData';

const FEATURED_FAQ_IDS = [
  'faq-airport',
  'faq-seasons',
  'faq-family-elderly',
  'faq-dhee-ain-hours',
] as const;

const CATEGORY_MAP = new Map(FAQ_CATEGORIES.map((cat) => [cat.id, cat]));

const FEATURED_FAQS = FEATURED_FAQ_IDS.map((id) =>
  FAQ_ITEMS.find((item) => item.id === id)
).filter((item): item is (typeof FAQ_ITEMS)[number] => Boolean(item));

export function FaqTeaserSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="faq-teaser" id="home-faq" aria-labelledby="homeFaqTitle">
      <div className="container">
        <div className="faq-teaser-head reveal">
          <h2 id="homeFaqTitle" className="faq-teaser-heading">
            <svg
              className="section-mark"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <use href="#i-foot-faq" width="24" height="24" />
            </svg>
            <span>الأسئلة الشائعة</span>
          </h2>
          <a href="/faq" className="btn btn-dark faq-teaser-cta">
            <span>كل الأسئلة الشائعة</span>
            <svg className="ic tiny" aria-hidden="true">
              <use href="#i-arrow" />
            </svg>
          </a>
        </div>

        <div className="faq-teaser-list reveal">
          {FEATURED_FAQS.map((item) => {
            const cat = CATEGORY_MAP.get(item.category);
            const isOpen = openId === item.id;
            const panelId = `home-faq-panel-${item.id}`;
            return (
              <article
                key={item.id}
                className={`faq-teaser-item${isOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="faq-teaser-trigger"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleItem(item.id)}
                >
                  <svg className="ic faq-teaser-icon" aria-hidden="true">
                    <use href={cat?.icon || '#i-foot-faq'} />
                  </svg>
                  <span className="faq-teaser-q">{item.question}</span>
                  <svg className="ic tiny faq-teaser-chevron" aria-hidden="true">
                    <use href="#i-chevron" />
                  </svg>
                </button>
                <div id={panelId} className="faq-teaser-panel" hidden={!isOpen}>
                  <p className="faq-teaser-answer">{item.answer}</p>
                  <div className="faq-teaser-panel-foot">
                    {item.highlights && item.highlights.length > 0 ? (
                      <div className="faq-teaser-highlights">
                        {item.highlights.map((hl) => (
                          <span key={hl} className="faq-teaser-chip">
                            {hl}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <a href={`/faq/${item.id}`} className="faq-teaser-more">
                      <span>المزيد في صفحة الأسئلة</span>
                      <svg className="ic tiny" aria-hidden="true">
                        <use href="#i-arrow" />
                      </svg>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
