'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  SEARCH_GOVERNORATES,
  SEARCH_SCOPES,
  searchPortal,
  type PortalSearchEntry,
  type SearchScopeId,
} from '@/lib/globalPortalSearch';
import { formatNum } from '@/lib/portalHelpers';
import { isPortalPath, navigatePortal } from '@/lib/portalNavigation';

export function SearchDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScopeId>('all');
  const [governorate, setGovernorate] = useState<string>('كل المحافظات');
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmedQuery = query.trim();
  const hasActiveFilter = scope !== 'all' || governorate !== 'كل المحافظات';
  const hasActiveSearch = trimmedQuery.length > 0 || hasActiveFilter;

  const searchBundle = useMemo(
    () =>
      searchPortal({
        query: trimmedQuery,
        scope,
        governorate,
        limit: 40,
      }),
    [trimmedQuery, scope, governorate]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery, scope, governorate]);

  // Global Ctrl+K / Cmd+K shortcut & focus synchronization when opened from header
  useEffect(() => {
    const handleGlobalKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (dialog.open) {
          dialog.close();
        } else {
          document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => {
            if (d !== dialog) d.close();
          });
          dialog.showModal();
          document.documentElement.classList.add('has-dialog');
          window.requestAnimationFrame(() => {
            inputRef.current?.focus({ preventScroll: true });
            inputRef.current?.select();
          });
        }
      }
    };

    const handleSearchOpen = () => {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    };

    window.addEventListener('keydown', handleGlobalKey);
    window.addEventListener('albaha:search-open', handleSearchOpen);
    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
      window.removeEventListener('albaha:search-open', handleSearchOpen);
    };
  }, []);

  function closeSearch() {
    dialogRef.current?.close();
    if (!document.querySelector('dialog[open]')) {
      document.documentElement.classList.remove('has-dialog');
    }
  }

  function resetAll() {
    setQuery('');
    setScope('all');
    setGovernorate('كل المحافظات');
    setActiveIndex(0);
    inputRef.current?.focus({ preventScroll: true });
  }

  function selectEntry(entry: PortalSearchEntry) {
    closeSearch();
    if (isPortalPath(entry.href)) {
      navigatePortal(entry.href);
    } else {
      window.location.assign(entry.href);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!searchBundle.hits.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (activeIndex + 1) % searchBundle.hits.length;
      setActiveIndex(next);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-ps-idx="${next}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = (activeIndex - 1 + searchBundle.hits.length) % searchBundle.hits.length;
      setActiveIndex(prev);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-ps-idx="${prev}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && document.activeElement === inputRef.current) {
      event.preventDefault();
      const chosen = searchBundle.hits[activeIndex] || searchBundle.hits[0];
      if (chosen) selectEntry(chosen.entry);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`portal-search-dialog${hasActiveSearch ? ' is-searching' : ''}`}
      id="searchPanel"
      aria-label="البحث الشامل في بوابة الباحة"
      onKeyDown={handleKeyDown}
    >
      <div className="ps-shell">
        {/* Mobile-only top title bar for the Full-Screen Advanced Search Page */}
        <div className="ps-mobile-topbar">
          <div className="ps-mobile-title">
            <svg className="ic" aria-hidden="true">
              <use href="#i-search" />
            </svg>
            <strong>البحث المتقدم في الباحة</strong>
          </div>
          <button
            type="button"
            className="ps-close-btn ps-close-mobile"
            data-close=""
            onClick={closeSearch}
            aria-label="إغلاق البحث"
          >
            <svg className="ic" aria-hidden="true">
              <use href="#i-x" />
            </svg>
          </button>
        </div>

        {/* Main Glassmorphic Search Bar */}
        <div className="ps-bar">
          <span className="ps-bar-icon" aria-hidden="true">
            <svg className="ic">
              <use href="#i-search" />
            </svg>
          </span>
          <input
            ref={inputRef}
            className="ps-input"
            id="searchInput"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في الموقع: وجهات، مطاعم، فنادق، أسئلة، استثمار…"
            aria-label="البحث الشامل في الموقع"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query ? (
            <button
              type="button"
              className="ps-clear-btn"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus({ preventScroll: true });
              }}
              aria-label="مسح نص البحث"
            >
              مسح
            </button>
          ) : null}
          <button
            type="button"
            className={`ps-filter-toggle${desktopFiltersOpen || hasActiveFilter ? ' is-active' : ''}`}
            onClick={() => setDesktopFiltersOpen((v) => !v)}
            aria-expanded={desktopFiltersOpen}
            aria-label="خيارات التصفية المتقدمة"
            title="تصفية حسب الفئة والمحافظة"
          >
            <svg className="ic tiny" aria-hidden="true">
              <use href="#i-compass" />
            </svg>
            <span>تصفية</span>
          </button>
          <button
            type="button"
            className="ps-close-btn ps-close-desktop"
            data-close=""
            onClick={closeSearch}
            aria-label="إغلاق البحث"
          >
            <svg className="ic" aria-hidden="true">
              <use href="#i-x" />
            </svg>
          </button>
        </div>

        {/* Advanced Filter Controls: Always visible on Mobile Full-Page; visible on Desktop when searching or toggled */}
        <div
          className={`ps-advanced-controls${
            hasActiveSearch || desktopFiltersOpen ? ' is-visible-desktop' : ''
          }`}
        >
          <div className="ps-scope-strip" role="tablist" aria-label="تصفية حسب الفئة">
            {SEARCH_SCOPES.map((item) => {
              const isSelected = scope === item.id;
              const count = searchBundle.scopeCounts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`ps-scope-pill${isSelected ? ' is-active' : ''}`}
                  onClick={() => setScope(item.id)}
                >
                  <svg className="ic tiny" aria-hidden="true">
                    <use href={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                  {hasActiveSearch ? (
                    <small className="ps-pill-count">{formatNum(count)}</small>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div
            className={`ps-gov-strip${
              desktopFiltersOpen || governorate !== 'كل المحافظات' ? ' is-visible-desktop' : ''
            }`}
            role="group"
            aria-label="تصفية حسب المحافظة"
          >
            {SEARCH_GOVERNORATES.map((gov) => {
              const isSelected = governorate === gov;
              return (
                <button
                  key={gov}
                  type="button"
                  aria-pressed={isSelected}
                  className={`ps-gov-pill${isSelected ? ' is-active' : ''}`}
                  onClick={() => setGovernorate(gov)}
                >
                  {gov}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Body: Hidden on desktop when idle so ONLY the clean Glassmorphic Search Bar appears; full-height workspace on mobile */}
        <div
          className={`ps-body${hasActiveSearch ? ' has-results-panel' : ''}`}
          id="searchResults"
          aria-live="polite"
        >
          {!hasActiveSearch ? (
            <div className="ps-mobile-idle">
              <span className="ps-idle-badge" aria-hidden="true">
                <svg className="ic">
                  <use href="#i-search" />
                </svg>
              </span>
              <p>اكتب ما تبحث عنه أعلاه أو اختر الفئة والمحافظة لاستعراض النتائج مباشرة.</p>
            </div>
          ) : searchBundle.hits.length > 0 ? (
            <>
              <div className="ps-results-meta">
                <span>
                  {formatNum(searchBundle.totalMatched)} نتيجة مطابقة في البوابة
                </span>
                {hasActiveFilter ? (
                  <button type="button" className="ps-reset-link" onClick={resetAll}>
                    إعادة ضبط الفلاتر
                  </button>
                ) : null}
              </div>
              <div className="ps-results-list" ref={listRef} role="listbox" aria-label="نتائج البحث">
                {searchBundle.hits.map(({ entry }, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <a
                      key={entry.id}
                      href={entry.href}
                      role="option"
                      aria-selected={isActive}
                      data-ps-idx={idx}
                      className={`ps-result-card${isActive ? ' is-active' : ''}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={(event) => {
                        if (
                          event.button === 0 &&
                          !event.metaKey &&
                          !event.ctrlKey &&
                          !event.shiftKey &&
                          !event.altKey
                        ) {
                          event.preventDefault();
                          selectEntry(entry);
                        }
                      }}
                    >
                      {entry.image ? (
                        <img
                          className="ps-result-thumb"
                          src={entry.image}
                          alt=""
                          decoding="async"
                        />
                      ) : (
                        <span className="ps-result-ic" aria-hidden="true">
                          <svg className="ic">
                            <use href={entry.icon} />
                          </svg>
                        </span>
                      )}
                      <div className="ps-result-copy">
                        <div className="ps-result-head">
                          <strong>{entry.title}</strong>
                          <span className="ps-result-badge">{entry.badge}</span>
                        </div>
                        <span className="ps-result-sub">{entry.subtitle}</span>
                        <p className="ps-result-snippet">{entry.snippet}</p>
                      </div>
                      <span className="ps-result-arrow" aria-hidden="true">
                        <svg className="ic tiny">
                          <use href="#i-arrow" />
                        </svg>
                      </span>
                    </a>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="ps-empty-state">
              <strong>لا توجد نتائج مطابقة لبحثك الحالي</strong>
              <p>جرّب كتابة كلمة أقصر أو تغيير الفئة أو المحافظة المختارة.</p>
              {hasActiveFilter ? (
                <button type="button" className="btn btn-soft ps-empty-reset" onClick={resetAll}>
                  عرض كل الفئات والمحافظات
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
