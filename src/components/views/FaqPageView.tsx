'use client';

import { useMemo, useState } from 'react';
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategoryId, type FaqItem } from '@/data/faqData';

interface FaqPageViewProps {
  initialHidden?: boolean;
}

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

  function renderHighlightList(item: FaqItem) {
    if (!item.highlights?.length) return null;
    return (
      <ul className="faq-highlights">
        {item.highlights.map((note) => (
          <li key={note}>
            <svg className="ic tiny" aria-hidden="true">
              <use href="#i-check" />
            </svg>
            <span>{note}</span>
          </li>
        ))}
      </ul>
    );
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
            <a href="#home">الرئيسية</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">الأسئلة الشائعة</span>
          </nav>
          <a className="tour-guide-back" href="#home">
            <svg className="ic tiny" aria-hidden="true">
              <use href="#i-arrow" />
            </svg>
            العودة إلى الرئيسية
          </a>
        </div>

        <header className="faq-hero-card">
          <div className="faq-hero-copy">
            <div className="caption section-kicker">
              <svg className="section-mark" viewBox="0 0 24 24" aria-hidden="true">
                <use href="#i-foot-faq" width="24" height="24" />
              </svg>
              <span>مركز الإرشاد والزوار</span>
            </div>
            <h1 id="faqTitle" tabIndex={-1}>
              الأسئلة الشائعة لزيارة منطقة الباحة
            </h1>
            <p className="lead">
              إجابات موثقة حول الوصول والأجواء والوجهات وتخطيط رحلتك في الباحة.
            </p>
          </div>
          <div className="faq-hero-actions">
            <button type="button" className="btn btn-dark" data-open="agent">
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-compass" />
              </svg>
              اسأل المرشد السياحي الذكي
            </button>
            <a href="#planner" className="btn btn-soft">
              <svg className="ic tiny" aria-hidden="true">
                <use href="#i-route" />
              </svg>
              خطّط رحلتك الآن
            </a>
          </div>
        </header>

        <section className="faq-toolbar" aria-label="تصفية الأسئلة الشائعة">
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
              placeholder="ابحث في الأسئلة: مطار العقيق، الطقس، ذي عين، PDF..."
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
            <button type="submit" className="faq-search-btn" id="faqSearchBtn">
              بحث
            </button>
          </form>

          <div className="faq-select-wrap">
            <svg className="ic tiny faq-select-icon" aria-hidden="true">
              <use href={categoryLookup.get(selectedCategory)?.icon || '#i-foot-faq'} />
            </svg>
            <select
              id="faqCategorySelect"
              className="faq-category-select"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as FaqCategoryId)}
              aria-label="تصفية الأسئلة حسب المحور"
            >
              {FAQ_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label} ({formatArabicCount(categoryCounts.get(cat.id) ?? 0)})
                </option>
              ))}
            </select>
            <svg className="ic tiny faq-select-chev" aria-hidden="true">
              <use href="#i-chevron" />
            </svg>
          </div>
        </section>

        <div className="faq-results-bar">
          <p className="faq-count">
            عرض {formatArabicCount(filteredItems.length)} من{' '}
            {formatArabicCount(FAQ_ITEMS.length)} سؤالًا
          </p>
          <button
            type="button"
            className="faq-expand-btn"
            onClick={toggleExpandAll}
            disabled={!filteredItems.length}
          >
            {allExpanded ? 'طي جميع الإجابات' : 'فتح جميع الإجابات'}
          </button>
        </div>

        {filteredItems.length ? (
          <div className="faq-list" id="faqAccordionList">
            {filteredItems.map((item) => {
              const isOpen = openIds.has(item.id);
              const catMeta = categoryLookup.get(item.category);
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
                      <span className="faq-trigger-meta">
                        <span className="faq-item-badge">
                          <svg className="ic tiny" aria-hidden="true">
                            <use href={catMeta?.icon || '#i-foot-faq'} />
                          </svg>
                          {catMeta?.label}
                        </span>
                        <span className="faq-item-question">{item.question}</span>
                      </span>
                      <span className="faq-chevron" aria-hidden="true">
                        <svg className="ic tiny">
                          <use href="#i-plus" />
                        </svg>
                      </span>
                    </button>
                  </h2>
                  <div
                    id={`${item.id}-panel`}
                    className="faq-answer"
                    hidden={!isOpen}
                  >
                    <p>{item.answer}</p>
                    {renderHighlightList(item)}
                    {(item.actionHref || item.askPrompt) && (
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
                              <use href="#i-compass" />
                            </svg>
                            <span>اسأل المرشد عن هذا الموضوع</span>
                          </button>
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
          <div className="faq-support-card">
            <span className="faq-support-tag">أمانة منطقة الباحة</span>
            <strong>940</strong>
            <p>البلاغات البلدية والملاحظات والخدمات الميدانية</p>
            <a
              href="tel:940"
              className="faq-support-link"
            >
              اتصال مباشر <svg className="ic tiny" aria-hidden="true"><use href="#i-foot-phone" /></svg>
            </a>
          </div>
          <div className="faq-support-card">
            <span className="faq-support-tag">العناية بالسياح</span>
            <strong>930</strong>
            <p>الاستفسارات السياحية والإرشاد للزوار يوميًا</p>
            <a href="tel:930" className="faq-support-link">
              اتصال مباشر <svg className="ic tiny" aria-hidden="true"><use href="#i-foot-phone" /></svg>
            </a>
          </div>
          <div className="faq-support-card">
            <span className="faq-support-tag">البلاغات الطارئة</span>
            <strong>911</strong>
            <p>رقم الطوارئ الموحد للحالات الإسعافية والسلامة</p>
            <a href="tel:911" className="faq-support-link">
              اتصال مباشر <svg className="ic tiny" aria-hidden="true"><use href="#i-foot-phone" /></svg>
            </a>
          </div>
        </section>
      </div>
    </article>
  );
}
