'use client';

import { useMemo, useState } from 'react';
import { GuideCharacter } from '@/components/common/GuideCharacter';
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategoryId } from '@/data/faqData';
import { SMART_GUIDE_NAME } from '@/lib/smartGuideName';

interface FaqPageViewProps {
  initialHidden?: boolean;
}

const SUPPORT_CHANNELS = [
  {
    tag: 'أمانة منطقة الباحة',
    number: '940',
    description: 'البلاغات البلدية والملاحظات والخدمات الميدانية',
    icon: '#i-heritage',
  },
  {
    tag: 'العناية بالسياح',
    number: '930',
    description: 'الاستفسارات السياحية والإرشاد للزوار يوميًا',
    icon: '#i-foot-headset',
  },
  {
    tag: 'البلاغات الطارئة',
    number: '911',
    description: 'رقم الطوارئ الموحد للحالات الإسعافية والسلامة',
    icon: '#i-foot-phone',
  },
] as const;

function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function formatArabicCount(count: number): string {
  return new Intl.NumberFormat('en-US').format(count);
}

export function FaqPageView({ initialHidden = true }: FaqPageViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<FaqCategoryId>('all');
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set([FAQ_ITEMS[0].id]));

  const categoryCounts = useMemo(() => {
    const counts = new Map<FaqCategoryId, number>();
    counts.set('all', FAQ_ITEMS.length);
    for (const item of FAQ_ITEMS) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, []);

  const categoryLookup = useMemo(
    () => new Map(FAQ_CATEGORIES.map((cat) => [cat.id, cat])),
    []
  );

  const filteredItems = useMemo(() => {
    const cleanQuery = normalizeQuery(query);
    const terms = cleanQuery ? cleanQuery.split(/\s+/).filter(Boolean) : [];
    return FAQ_ITEMS.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!terms.length) return true;
      const haystack = normalizeQuery(
        [
          item.question,
          item.answer,
          ...(item.highlights || []),
          categoryLookup.get(item.category)?.label || '',
        ].join(' ')
      );
      return terms.every((term) => haystack.includes(term));
    });
  }, [selectedCategory, query, categoryLookup]);

  const allExpanded =
    filteredItems.length > 0 && filteredItems.every((item) => openIds.has(item.id));

  function toggleItem(id: string): void {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpandAll(): void {
    if (allExpanded) {
      setOpenIds(new Set());
    } else {
      setOpenIds(new Set(filteredItems.map((item) => item.id)));
    }
  }

  return (
    <article
      id="faqView"
      className="place-view faq-view"
      aria-labelledby="faqTitle"
      hidden={initialHidden}
    >
      <div className="container">
        <div className="tour-guide-detail-nav">
          <nav className="place-trail" aria-label="مسار الصفحة">
            <a href="/">الرئيسية</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">الأسئلة الشائعة</span>
          </nav>
          <a className="tour-guide-back" href="/">
            <svg className="ic tiny" aria-hidden="true">
              <use href="#i-arrow" />
            </svg>
            العودة إلى الرئيسية
          </a>
        </div>

        <header className="faq-hero-card">
          <div className="faq-hero-copy">
            <div className="caption section-kicker faq-hero-kicker">
              <svg className="section-mark" viewBox="0 0 24 24" aria-hidden="true">
                <use href="#i-foot-faq" width="24" height="24" />
              </svg>
              <span>دليل الزائر · إجابات موثقة ومحدثة</span>
            </div>
            <h1 id="faqTitle" tabIndex={-1}>
              الأسئلة الشائعة لزيارة منطقة الباحة
            </h1>
            <p className="lead">
              كل ما تحتاجه حول الوصول والأجواء والوجهات وتخطيط رحلتك في السراة وتهامة.
            </p>
          </div>
          <div className="faq-hero-actions">
            <button
              type="button"
              className="btn faq-hero-btn"
              data-open="agent"
              aria-haspopup="dialog"
              aria-controls="agentPanel"
            >
              <GuideCharacter size={22} className="faq-hero-guide-icon" />
              <span>اسأل {SMART_GUIDE_NAME}</span>
            </button>
          </div>
        </header>

        <section className="faq-filter-panel" aria-label="البحث وتصفية الأسئلة الشائعة">
          <div className="faq-toolbar-row">
            <form
              className="faq-search-box"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                document
                  .getElementById('faqAccordionList')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
            >
              <svg className="ic tiny faq-search-ic" aria-hidden="true">
                <use href="#i-search" />
              </svg>
              <input
                type="search"
                id="faqSearchInput"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث بكلمة مفتاحية: مطار العقيق، الطقس، ذي عين، PDF..."
                aria-label="ابحث في الأسئلة الشائعة"
              />
              {query ? (
                <button
                  type="button"
                  className="faq-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="مسح البحث"
                >
                  <svg className="ic tiny" aria-hidden="true">
                    <use href="#i-x" />
                  </svg>
                </button>
              ) : null}
            </form>

            <div className="faq-toolbar-meta">
              <p className="faq-count" aria-live="polite">
                <strong>{formatArabicCount(filteredItems.length)}</strong> من{' '}
                {formatArabicCount(FAQ_ITEMS.length)} سؤالًا
              </p>
              <button
                type="button"
                className={`faq-expand-btn${allExpanded ? ' is-expanded' : ''}`}
                onClick={toggleExpandAll}
                disabled={!filteredItems.length}
              >
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-chevron" />
                </svg>
                <span>{allExpanded ? 'طي الكل' : 'فتح الكل'}</span>
              </button>
            </div>
          </div>

          <div className="faq-cat-pills" role="group" aria-label="تصفية الأسئلة حسب المحور">
            {FAQ_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`faq-cat-pill${isActive ? ' is-active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <svg className="ic tiny" aria-hidden="true">
                    <use href={cat.icon} />
                  </svg>
                  <span>{cat.label}</span>
                  <bdi className="faq-cat-count">
                    {formatArabicCount(categoryCounts.get(cat.id) ?? 0)}
                  </bdi>
                </button>
              );
            })}
          </div>
        </section>

        {filteredItems.length ? (
          <div className="faq-list" id="faqAccordionList">
            {filteredItems.map((item) => {
              const isOpen = openIds.has(item.id);
              const catMeta = categoryLookup.get(item.category);
              const hasHighlights = Boolean(item.highlights?.length);
              const hasActions = Boolean((item.actionHref && item.actionLabel) || item.askPrompt);
              const askButtonLabel =
                !item.actionHref && item.actionLabel
                  ? item.actionLabel
                  : `اسأل ${SMART_GUIDE_NAME}`;

              return (
                <article
                  key={item.id}
                  id={item.id}
                  className={`faq-item${isOpen ? ' is-open' : ''}`}
                >
                  <h2 className="faq-question-heading">
                    <button
                      type="button"
                      className="faq-trigger"
                      aria-expanded={isOpen}
                      aria-controls={`${item.id}-panel`}
                      onClick={() => toggleItem(item.id)}
                    >
                      <span className="faq-q-icon" data-cat={item.category} aria-hidden="true">
                        <svg className="ic">
                          <use href={catMeta?.icon || '#i-foot-faq'} />
                        </svg>
                      </span>
                      <span className="faq-trigger-copy">
                        <span className="faq-cat-overline">{catMeta?.label}</span>
                        <span className="faq-item-question">{item.question}</span>
                      </span>
                      <span className="faq-chevron" aria-hidden="true">
                        <svg className="ic tiny">
                          <use href="#i-chevron" />
                        </svg>
                      </span>
                    </button>
                  </h2>

                  <div
                    id={`${item.id}-panel`}
                    className="faq-answer"
                    hidden={!isOpen}
                  >
                    <p className="faq-answer-text">{item.answer}</p>

                    {(hasHighlights || hasActions) && (
                      <div className="faq-answer-footer">
                        {hasHighlights ? (
                          <ul className="faq-highlights" aria-label="نقاط سريعة">
                            {item.highlights!.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        ) : null}

                        {hasActions ? (
                          <div className="faq-item-actions">
                            {item.actionHref && item.actionLabel ? (
                              <a href={item.actionHref} className="faq-item-link">
                                <span>{item.actionLabel}</span>
                                <svg className="ic tiny" aria-hidden="true">
                                  <use href="#i-arrow" />
                                </svg>
                              </a>
                            ) : null}
                            {item.askPrompt ? (
                              <button
                                type="button"
                                className="faq-item-ask"
                                data-concierge-ask={item.askPrompt}
                              >
                                <svg className="ic tiny" aria-hidden="true">
                                  <use href="#i-sparkle" />
                                </svg>
                                <span>{askButtonLabel}</span>
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="faq-empty">
            <p>لم نجد سؤالًا يطابق بحثك الحالي.</p>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                setQuery('');
                setSelectedCategory('all');
              }}
            >
              عرض كل الأسئلة
            </button>
          </div>
        )}

        <section className="faq-support-grid" aria-label="أرقام الدعم والبلاغات السريعة">
          {SUPPORT_CHANNELS.map((channel) => (
            <div key={channel.number} className="faq-support-card">
              <div className="faq-support-head">
                <span className="faq-support-icon" aria-hidden="true">
                  <svg className="ic">
                    <use href={channel.icon} />
                  </svg>
                </span>
                <div className="faq-support-meta">
                  <span className="faq-support-tag">{channel.tag}</span>
                  <strong>
                    <bdi dir="ltr">{channel.number}</bdi>
                  </strong>
                </div>
              </div>
              <p>{channel.description}</p>
              <a href={`tel:${channel.number}`} className="faq-support-link">
                <span>اتصال مباشر</span>
                <svg className="ic tiny" aria-hidden="true">
                  <use href="#i-foot-phone" />
                </svg>
              </a>
            </div>
          ))}
        </section>
      </div>
    </article>
  );
}
