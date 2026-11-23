import type {
  ApprovedTrip,
  MapLibreMapInstance,
  MapLibreMarkerInstance,
  MapLibreNamespace,
  PortalInitialView,
  RouteTiming,
  SeasonKey,
  StopBase,
  TripPlan,
  TripStyle,
} from './portalTypes';
import {
  HERO_VIDEO_PLAYBACK_RATE,
  climateCities,
  createGuideRecordIndex,
  destinationAreas,
  domMedia,
  geo,
  heroPhotos,
  heroVideoCues,
  images,
  places,
  regionalStops,
  seasons,
  stationDescriptions,
  stationPhotoInfo,
  stopVisit,
  stops,
  typeIcons,
  typeLabels,
} from './portalStaticData';
import {
  byId,
  clock,
  durationLabel,
  enterMotion,
  formatNum,
  gallerySource,
  getSegment,
  glyph,
  isInViewport,
  isMotionPaused,
  loadMapLibreLibrary,
  makePhotoSwitcher,
  motionAllowed,
  nearbyOrder,
  normalizeAr,
  pathFrom,
  qsAll,
  routePath,
  STREET_MAP_STYLE,
  stopAnimations,
  supportsMotion,
  tripLeg,
  wrap,
} from './portalHelpers';
import {
  canonicalizeLegacyPortalLink,
  isPortalPath,
  navigatePortal,
  PORTAL_HOME_TITLE,
  portalNavigationEvent,
  portalSectionId,
} from './portalNavigation';
import { bindSwipe } from './portalHelpers';
import { forecast, localTime, weatherNames } from './weatherAndShowcase';
import { createTripPdf, saveTripFile } from './tripPdfExport';
import {
  routeTimingValid,
  timedSchedule,
} from './conciergeEngine';
import { createSmartGuideUiController } from './smartGuideUiController';
import { bindCityReel, createSubpageViewsController } from './subpageViews';
import { createTourGuideController } from './tourGuideController';
import { FAQ_ITEMS } from '@/data/faqData';
import {
  buildConstraintPlan,
  findNearestStopTo,
  getHoursStatusLabel,
  getRiyadhNowInfo,
} from './plannerTools';
import {
  getPresenceMode,
  highlightResultCard,
  renderGuideDock,
  setActiveCharacterPose,
  syncSingleAvatarPresence,
  waitForMapReady,
} from './guidePresence';

export function initAlBahaPortal(initialView: PortalInitialView = 'home'): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  if (canonicalizeLegacyPortalLink(true)) return () => {};

  const masterController = new AbortController();
  const { signal } = masterController;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const smooth: ScrollBehavior = 'smooth';
  const getReducedBehavior = (): ScrollBehavior =>
    reducedMotion.matches ? 'instant' : 'smooth';

  const region = byId<HTMLSelectElement>('region');
  const days = byId<HTMLSelectElement>('days');
  const routeStage = byId('routeScroll');
  const terrainSvg = document.getElementById('terrainMap') as SVGSVGElement | null;
  const mapPanel = byId('mapPanel');
  const streetMap = byId('streetMap');
  const homeView = byId('homeView');
  const placeView = byId('placeView');
  const tourGuideView = byId('tourGuideView');
  const faqView = byId('faqView');
  const investView = byId('investView');
  const supportView = byId('supportRequestView');

  if (!region || !days || !routeStage || !terrainSvg || !mapPanel || !streetMap) {
    return () => masterController.abort();
  }
  const svg: SVGSVGElement = terrainSvg;

  const initialTitle = document.title;
  const storeKey = 'albaha-v4-trip-v1';

  let savedTiming: RouteTiming | null = null;
  let routeDraft: TripPlan | null = null;
  let viewedStopId: string | null = null;
  let choices = new Set<string>();
  let lockedIds = new Set<string>();
  let completedIds = new Set<string>();
  let style: TripStyle = 'all';
  let approved: ApprovedTrip | null = null;
  let chosen: StopBase[] = stops;
  let station = -1;
  let activeDockKind: 'none' | 'map' | 'guide' = 'none';
  let pendingGuideDock: {
    guideId: string;
    name: string;
    message: string;
    missingCoordinates: boolean;
  } | null = null;
  let isDockingFromConcierge = false;
  let conciergeRef: ReturnType<typeof createSmartGuideUiController> | null = null;
  let lastAgentOpener: HTMLElement | null = null;
  let zoom = 1;
  let toastTimer = 0;
  let didWarnStorage = false;
  let lastPath = '/';
  let homePath = '/';
  let homeScroll = 0;

  let liveMap: {
    map: MapLibreMapInstance;
    library: MapLibreNamespace;
    markers: MapLibreMarkerInstance[];
  } | null = null;
  let liveMapLoading = false;
  let streetMapActive = false;
  let streetDefaultAttempted = false;

  document.documentElement.classList.add('js');

  const goldLogoImg = byId<HTMLImageElement>('goldLogo');
  const brandWordmarkImg = byId<HTMLImageElement>('brandWordmark');
  if (goldLogoImg?.src) {
    qsAll<HTMLImageElement>('[data-logo]').forEach((img) => {
      img.src = goldLogoImg.src;
    });
  }
  if (brandWordmarkImg?.src) {
    qsAll<HTMLImageElement>('[data-wordmark]').forEach((img) => {
      img.src = brandWordmarkImg.src;
    });
  }
  qsAll<HTMLImageElement>('[data-photo]').forEach((img) => {
    const key = img.dataset.photo;
    if (key && images[key]) img.src = images[key];
  });
  qsAll<HTMLImageElement>('[data-hero-photo]').forEach((img) => {
    const key = img.dataset.heroPhoto;
    if (key && heroPhotos[key]?.wide) img.src = heroPhotos[key].wide;
  });

  // Populate extra governorate options in #region cleanly with teardown markers
  const addedRegionOptions: HTMLOptionElement[] = [];
  for (const area of destinationAreas.slice(2)) {
    if (!Array.from(region.options).some((opt) => opt.value === area.region)) {
      const opt = new Option(area.name, area.region);
      opt.dataset.dynamicRegion = '1';
      region.add(opt);
      addedRegionOptions.push(opt);
    }
  }

  // Destination directory 10-card grid
  const destinationGrid = byId('destinationGrid');
  if (destinationGrid) {
    destinationGrid.innerHTML = destinationAreas
      .map(
        (area) => `
    <a class="destination-area" href="/city/${area.id}">
      <img src="${images[area.image] || ''}" alt="" loading="lazy" decoding="async">
      ${glyph('arrow', 'ic tiny')}
      <strong>${area.name}</strong><small>${area.tag}</small>
    </a>`
      )
      .join('');
  }

  // Compute terrain mapExtent from #terrainRelief attributes
  const terrainRelief = byId('terrainRelief');
  const mapLeft = Number(terrainRelief?.getAttribute('x') ?? -1200);
  const mapTop = Number(terrainRelief?.getAttribute('y') ?? -1200);
  const mapExtent = {
    left: mapLeft,
    right: mapLeft + Number(terrainRelief?.getAttribute('width') ?? 3050),
    top: mapTop,
    bottom: mapTop + Number(terrainRelief?.getAttribute('height') ?? 3050),
  };

  function toast(message: string): void {
    const el = byId('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove('show'), 2700);
  }

  function restoreTrip(): void {
    try {
      const raw = window.localStorage.getItem(storeKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved) return;
      if (region && Array.from(region.options).some((option) => option.value === saved.region)) {
        region.value = saved.region;
      }
      if (days && Array.from(days.options).some((option) => option.value === saved.days)) {
        days.value = saved.days;
      }
      if (Object.hasOwn(typeLabels, saved.style)) style = saved.style as TripStyle;
      if (Array.isArray(saved.choices)) {
        choices = new Set(saved.choices.filter((id: string) => places.has(id)));
      }
      if (Array.isArray(saved.lockedIds)) {
        lockedIds = new Set(saved.lockedIds.filter((id: string) => places.has(id)));
      }
      if (Array.isArray(saved.completedIds)) {
        completedIds = new Set(saved.completedIds.filter((id: string) => places.has(id)));
      }
      if (
        routeTimingValid(saved.timing) &&
        saved.timing.stations.length === choices.size &&
        saved.timing.stations.every(
          (row: { id: string; day: number }) =>
            choices.has(row.id) && row.day <= Number(days?.value || 7)
        )
      ) {
        savedTiming = saved.timing;
      }
      if (saved.approved?.status === 'approved' && saved.approved.stations?.length) {
        approved = saved.approved;
      }
    } catch {
      /* The planner remains usable when storage is unavailable. */
    }
  }

  function saveTrip(): boolean {
    if (!region || !days) return false;
    try {
      window.localStorage.setItem(
        storeKey,
        JSON.stringify({
          region: region.value,
          days: days.value,
          style,
          choices: [...choices],
          lockedIds: [...lockedIds],
          completedIds: [...completedIds],
          timing: savedTiming,
          approved,
        })
      );
      return true;
    } catch {
      if (!didWarnStorage) {
        didWarnStorage = true;
        toast('يمكنك تنزيل الخطة للاحتفاظ بها.');
      }
      return false;
    }
  }

  // Keep the original selects as the form state; visible controls mirror them.
  const pickers = [region, days].map((select) => {
    const field = select.closest('.route-field') as HTMLElement;
    const label = field.querySelector('label') as HTMLLabelElement;
    const prevHtmlFor = label.htmlFor;
    const trigger = document.createElement('button');
    const list = document.createElement('div');
    label.id = `${select.id}Label`;
    trigger.type = 'button';
    trigger.className = 'route-picker-trigger';
    trigger.id = `${select.id}Picker`;
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-labelledby', `${label.id} ${select.id}Value`);
    trigger.setAttribute('aria-controls', `${select.id}Options`);
    trigger.innerHTML = `<span id="${select.id}Value"></span>${glyph('chevron', 'ic tiny')}`;
    list.className = 'route-picker-list';
    list.id = `${select.id}Options`;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-labelledby', label.id);
    list.hidden = true;

    const options = Array.from(select.options).map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = -1;
      button.setAttribute('role', 'option');
      const span = document.createElement('span');
      span.textContent = option.textContent;
      button.append(span);
      button.insertAdjacentHTML('beforeend', glyph('check', 'ic tiny'));
      button.addEventListener(
        'click',
        () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          close(true);
        },
        { signal }
      );
      return button;
    });

    function close(restoreFocus = false): void {
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    }
    function open(): void {
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      options[select.selectedIndex]?.focus();
    }
    function sync(): void {
      const firstChild = trigger.firstElementChild;
      if (firstChild) {
        firstChild.textContent = select.selectedOptions[0]?.textContent || '';
      }
      options.forEach((option, i) =>
        option.setAttribute('aria-selected', String(i === select.selectedIndex))
      );
    }

    select.hidden = true;
    label.htmlFor = trigger.id;
    list.append(...options);
    field.append(trigger, list);

    trigger.addEventListener(
      'click',
      () => {
        if (list.hidden) open();
        else close(true);
      },
      { signal }
    );
    field.addEventListener(
      'keydown',
      (event) => {
        const key = event.key;
        if (key === 'Escape' && !list.hidden) {
          event.preventDefault();
          close(true);
          return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
        event.preventDefault();
        if (list.hidden) {
          open();
          return;
        }
        const index =
          document.activeElement instanceof HTMLButtonElement
            ? options.indexOf(document.activeElement)
            : -1;
        const next =
          key === 'Home'
            ? 0
            : key === 'End'
              ? options.length - 1
              : (index + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next]?.focus();
      },
      { signal }
    );
    field.addEventListener(
      'focusout',
      (event) => {
        if (!(event.relatedTarget instanceof Node) || !field.contains(event.relatedTarget)) {
          close();
        }
      },
      { signal }
    );
    select.addEventListener('change', sync, { signal });

    signal.addEventListener(
      'abort',
      () => {
        trigger.remove();
        list.remove();
        select.hidden = false;
        label.htmlFor = prevHtmlFor;
      },
      { once: true }
    );

    return { field, close, sync };
  });

  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target instanceof Node ? event.target : null;
      pickers.forEach((picker) => {
        if (!target || !picker.field.contains(target)) picker.close();
      });
    },
    { signal }
  );

  // Panels (Menu, Search, Smart Guide Drawer)
  const smartGuidePanel = byId<HTMLDialogElement>('agentPanel');
  const smartGuideScroll = byId('conciergeScroll');
  const smartGuideViewport = window.visualViewport;
  const useVisibleGuideViewport = window.matchMedia('(max-width: 768px), (pointer: coarse)');
  let smartGuideViewportFrame = 0;

  function syncSmartGuideViewport(): void {
    if (!smartGuidePanel?.open) return;
    const { style } = smartGuidePanel;
    if (!useVisibleGuideViewport.matches) {
      style.removeProperty('--sg-vvh');
      style.removeProperty('--sg-vvt');
      return;
    }
    const height = `${Math.floor(smartGuideViewport?.height ?? window.innerHeight)}px`;
    const top = `${Math.max(0, smartGuideViewport?.offsetTop ?? 0)}px`;
    if (style.getPropertyValue('--sg-vvh') === height && style.getPropertyValue('--sg-vvt') === top) {
      return;
    }
    const wasAtLatestMessage = smartGuideScroll &&
      smartGuideScroll.scrollHeight - smartGuideScroll.clientHeight - smartGuideScroll.scrollTop <= 24;
    style.setProperty('--sg-vvh', height);
    style.setProperty('--sg-vvt', top);
    if (wasAtLatestMessage && smartGuideScroll) {
      smartGuideScroll.scrollTop = smartGuideScroll.scrollHeight;
    }
  }

  function scheduleSmartGuideViewportSync(): void {
    if (!smartGuidePanel?.open || smartGuideViewportFrame) return;
    smartGuideViewportFrame = window.requestAnimationFrame(() => {
      smartGuideViewportFrame = 0;
      if (!signal.aborted) syncSmartGuideViewport();
    });
  }

  function openPanel(name: string, opener?: HTMLElement | null): void {
    const panel = byId<HTMLDialogElement>(`${name}Panel`);
    if (!panel) return;
    if (panel.open) {
      if (name === 'agent') {
        byId('conciergeInput')?.focus({ preventScroll: true });
      }
      return;
    }
    qsAll<HTMLDialogElement>('dialog[open]').forEach((d) => {
      if (d !== panel) d.close();
    });

    if (name === 'agent') {
      lastAgentOpener =
        opener ||
        (document.activeElement instanceof HTMLElement ? document.activeElement : null) ||
        byId('sirajLauncher');
      activeDockKind = 'none';
      panel.show();
      document.documentElement.classList.add('has-smart-guide');
      if (window.innerWidth <= 768) {
        document.documentElement.classList.add('has-dialog');
      } else {
        window.setTimeout(() => {
          if (!signal.aborted) window.dispatchEvent(new Event('resize'));
        }, 260);
      }
      syncSingleAvatarPresence('dialog');
      syncSmartGuideViewport();
      const siraj = byId('sirajLauncher');
      if (siraj) siraj.dataset.greeted = '';
      conciergeRef?.refreshContextUi();
      const prefersTouch = window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 768;
      if (prefersTouch) {
        byId('conciergeCloseBtn')?.focus({ preventScroll: true });
      } else {
        byId('conciergeInput')?.focus({ preventScroll: true });
      }
      return;
    }

    panel.showModal();
    document.documentElement.classList.add('has-dialog');
    if (name === 'search') byId('searchInput')?.focus({ preventScroll: true });
  }

  qsAll<HTMLDialogElement>('dialog').forEach((dialog) => {
    dialog.addEventListener(
      'click',
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target === dialog || target?.closest('[data-close], .menu-list a')) dialog.close();
      },
      { signal }
    );
    dialog.addEventListener(
      'close',
      () => {
        if (dialog.id === 'agentPanel') {
          document.documentElement.classList.remove('has-smart-guide');
          dialog.style.removeProperty('--sg-vvh');
          dialog.style.removeProperty('--sg-vvt');
          if (window.innerWidth > 768) {
            window.setTimeout(() => {
              if (!signal.aborted) window.dispatchEvent(new Event('resize'));
            }, 260);
          }
          if (!document.querySelector('dialog[open]')) {
            document.documentElement.classList.remove('has-dialog');
          }
          if (activeDockKind === 'none') {
            syncSingleAvatarPresence('floating');
          }
          const restoreTarget =
            lastAgentOpener && lastAgentOpener.isConnected && !lastAgentOpener.hidden
              ? lastAgentOpener
              : byId('sirajLauncher');
          lastAgentOpener = null;
          window.requestAnimationFrame(() => {
            if (!signal.aborted && restoreTarget && restoreTarget.isConnected) {
              restoreTarget.focus({ preventScroll: true });
            }
          });
          return;
        }
        if (!document.querySelector('dialog[open]')) {
          document.documentElement.classList.remove('has-dialog');
        }
      },
      { signal }
    );
  });

  // Escape closes non-modal Smart Guide panel cleanly and restores focus to opener
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      const agentPanel = byId<HTMLDialogElement>('agentPanel');
      if (agentPanel?.open) {
        event.preventDefault();
        agentPanel.close();
      }
    },
    { signal }
  );

  // Mobile keyboard viewport adaptation
  smartGuideViewport?.addEventListener('resize', scheduleSmartGuideViewportSync, { signal });
  smartGuideViewport?.addEventListener('scroll', scheduleSmartGuideViewportSync, { signal });
  window.addEventListener('resize', scheduleSmartGuideViewportSync, { passive: true, signal });
  byId('conciergeInput')?.addEventListener('focus', scheduleSmartGuideViewportSync, { signal });
  byId('conciergeInput')?.addEventListener('blur', scheduleSmartGuideViewportSync, { signal });

  qsAll<HTMLElement>('[data-open]').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        if (button.dataset.open) openPanel(button.dataset.open, button);
      },
      { signal }
    )
  );

  // Search Overlay
  const guideTopics = [
    {
      id: 'attractions',
      name: 'المزارات السياحية',
      aliases: 'سوق السبت بلجرشي المتحف الأبنوي غابة خيرة شلال',
      desc: '',
      tag: 'دليل الباحة',
    },
    {
      id: 'dining',
      name: 'المطاعم والأكلات',
      aliases: 'هالة البستان الخبزة المقناة الدغابيس البن الشدوي قهوة طعام',
      desc: '',
      tag: 'دليل الباحة',
    },
    {
      id: 'camping',
      name: 'المخيمات والإقامة',
      aliases: 'تخييم مخيم خيمة تصريح مبيت منتجع ماكامايا الكهف الشفا شدا الأسفل',
      desc: '',
      tag: 'دليل الباحة',
    },
  ];

  let globalGuideData: ReturnType<typeof createGuideRecordIndex> | null = null;
  function getGlobalGuideData() {
    if (!globalGuideData) {
      globalGuideData = createGuideRecordIndex(normalizeAr);
    }
    return globalGuideData;
  }

  function showResults(value: string): void {
    const resultsEl = byId('searchResults');
    if (!resultsEl) return;
    const terms = normalizeAr(value).split(/\s+/).filter(Boolean);
    const matches = ({
      name,
      tag,
      aliases,
      desc,
    }: {
      name: string;
      tag: string;
      aliases?: string;
      desc: string;
    }) => {
      const searchText = normalizeAr([name, tag, aliases || '', desc].join(' '));
      return terms.every((term) => searchText.includes(term));
    };
    const safe = (s: unknown) =>
      String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const destinations = stops.filter(matches).map(
      (stop) => `
      <button type="button" class="search-result" data-destination="${stop.id}">
        <span>${stop.name}</span><small>${stop.tag}</small>
      </button>`
    );
    const guideRecords = terms.length
      ? getGlobalGuideData()
          .filter((place) => terms.every((term) => place.searchBlob.includes(term)))
          .slice(0, 24)
          .map(
            (place) => `
      <button type="button" class="search-result" data-guide-place="${safe(place.id)}">
        <span>${safe(place.name)}</span><small>${safe(place.district || 'الباحة')} · ${safe(place.categoryLabel)}</small>
      </button>`
          )
      : [];
    const topics = guideTopics.filter(matches).map(
      (topic) => `
      <button type="button" class="search-result" data-guide-topic="${topic.id}">
        <span>${topic.name}</span><small>دليل الباحة</small>
      </button>`
    );
    const faqResults = terms.length
      ? FAQ_ITEMS.filter((item) => {
          const blob = normalizeAr([item.question, item.answer, ...(item.highlights || [])].join(' '));
          return terms.every((term) => blob.includes(term));
        })
          .slice(0, 6)
          .map(
            (item) => `
      <button type="button" class="search-result" data-faq-jump="${safe(item.id)}">
        <span>${safe(item.question)}</span><small>الأسئلة الشائعة</small>
      </button>`
          )
      : [];
    resultsEl.innerHTML =
      guideRecords.concat(destinations, faqResults, topics).join('') ||
      '<p class="muted">لم نجد نتيجة. جرّب اسم وجهة أو محافظة أو نوع تجربة.</p>';
  }

  const searchInput = byId<HTMLInputElement>('searchInput');
  searchInput?.addEventListener('input', (event) => {
    showResults((event.target as HTMLInputElement).value);
  }, { signal });
  searchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    byId('searchResults')?.querySelector<HTMLButtonElement>('button')?.click();
  }, { signal });
  showResults('');

  // Hero video & cues
  const hero = byId('home');
  const heroCopy = hero?.querySelector<HTMLElement>('.hero-copy') || null;
  const heroMedia = byId('heroMedia');
  const heroVideo = byId<HTMLVideoElement>('heroVideo');
  const heroTitle = byId('heroTitle');
  const heroLead = byId('heroLead');
  const header = byId('header');
  const sirajBtn = byId('sirajLauncher');
  const heroActionRow = heroCopy?.querySelector<HTMLElement>('.action-row') || null;

  let heroCueIndex = 0;
  let heroVisible = !('IntersectionObserver' in window);
  let heroVideoFailed = false;
  let heroCueRaf = 0;
  let scrollFrame = 0;

  function syncSirajPosition(): void {
    if (!sirajBtn) return;
    if (!hero || !heroCopy || homeView?.hidden) {
      sirajBtn.classList.remove('is-hero-docked');
      sirajBtn.style.removeProperty('--siraj-hero-bottom');
      return;
    }
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const heroRect = hero.getBoundingClientRect();
    const copyRect = heroCopy.getBoundingClientRect();
    const titleRect = heroTitle ? heroTitle.getBoundingClientRect() : copyRect;
    const leadRect = heroLead ? heroLead.getBoundingClientRect() : copyRect;
    const actionRect = heroActionRow ? heroActionRow.getBoundingClientRect() : copyRect;

    const inHero =
      window.scrollY <= Math.max(48, hero.offsetHeight * 0.28) &&
      heroRect.bottom > vh * 0.68 &&
      copyRect.height > 0 &&
      actionRect.top < vh;

    if (!inHero) {
      sirajBtn.classList.remove('is-hero-docked');
      sirajBtn.style.removeProperty('--siraj-hero-bottom');
      return;
    }

    const btnW = sirajBtn.offsetWidth || 46;
    const btnH = sirajBtn.offsetHeight || 46;
    const leftEdge = parseFloat(getComputedStyle(sirajBtn).left) || 16;
    const safeClearLeft = leftEdge + btnW + 12;

    const targetMidWithTitle = (titleRect.top + titleRect.bottom) / 2;
    const titleLevelBottom = vh - (targetMidWithTitle + btnH / 2);
    const minAboveButtons = vh - actionRect.top + 16;
    const minAboveLead = vh - leadRect.top + 10;
    let bottomPx = Math.max(titleLevelBottom, minAboveButtons, minAboveLead);

    let titleTextLeft = titleRect.left;
    if (heroTitle && heroTitle.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(heroTitle);
      const glyphRect = range.getBoundingClientRect();
      if (glyphRect.width > 0) titleTextLeft = glyphRect.left;
    }
    if (titleTextLeft < safeClearLeft) {
      bottomPx = Math.max(bottomPx, vh - titleRect.top + 10);
    }

    const headerBottom = header ? header.getBoundingClientRect().bottom : 64;
    const maxBottom = Math.max(24, vh - headerBottom - btnH - 12);
    bottomPx = Math.round(Math.min(bottomPx, maxBottom));

    sirajBtn.style.setProperty('--siraj-hero-bottom', `${bottomPx}px`);
    sirajBtn.classList.add('is-hero-docked');
  }

  function applyHeroPlaybackRate(): void {
    if (!heroVideo) return;
    heroVideo.defaultPlaybackRate = HERO_VIDEO_PLAYBACK_RATE;
    if (heroVideo.playbackRate !== HERO_VIDEO_PLAYBACK_RATE) {
      heroVideo.playbackRate = HERO_VIDEO_PLAYBACK_RATE;
    }
  }

  function resolveHeroCueIndex(timeSec: number): number {
    const t = Number.isFinite(timeSec) ? Math.max(0, timeSec) + 0.04 : 0;
    for (let i = heroVideoCues.length - 1; i >= 0; i--) {
      if (t >= heroVideoCues[i].start) return i;
    }
    return 0;
  }

  function applyHeroCue(index: number, animate = true): void {
    if (index === heroCueIndex || !heroVideoCues[index]) return;
    heroCueIndex = index;
    const cue = heroVideoCues[index];
    if (heroTitle) heroTitle.textContent = cue.title;
    if (heroLead) heroLead.textContent = cue.lead;
    if (animate && motionAllowed() && heroVisible) {
      [heroTitle, heroLead].forEach((element, idx) => {
        if (!element) return;
        element.getAnimations().forEach((animation) => animation.cancel());
        element.animate(
          [
            { opacity: 0.12, transform: 'translate3d(0, 12px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          ],
          { duration: 420, delay: idx * 55, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
      });
    }
    syncSirajPosition();
  }

  function syncHeroCueFromVideo(animate = true): void {
    if (!heroVideo || heroVideoFailed) return;
    applyHeroCue(resolveHeroCueIndex(heroVideo.currentTime || 0), animate);
  }

  function stopHeroCueLoop(): void {
    if (heroCueRaf) {
      window.cancelAnimationFrame(heroCueRaf);
      heroCueRaf = 0;
    }
  }

  function tickHeroCue(): void {
    heroCueRaf = 0;
    syncHeroCueFromVideo(true);
    if (
      heroVideo &&
      !heroVideo.paused &&
      !heroVideoFailed &&
      heroVisible &&
      !document.hidden &&
      !isMotionPaused() &&
      !signal.aborted
    ) {
      heroCueRaf = window.requestAnimationFrame(tickHeroCue);
    }
  }

  function startHeroCueLoop(): void {
    if (
      !heroCueRaf &&
      heroVideo &&
      !heroVideo.paused &&
      !heroVideoFailed &&
      heroVisible &&
      !document.hidden &&
      !isMotionPaused() &&
      !signal.aborted
    ) {
      heroCueRaf = window.requestAnimationFrame(tickHeroCue);
    }
  }

  function syncHeroVideo(): void {
    if (!heroVideo) return;
    if (heroVideoFailed) {
      heroVideo.classList.remove('is-active');
      stopHeroCueLoop();
      return;
    }
    applyHeroPlaybackRate();
    heroVideo.classList.add('is-active');
    const shouldPlay = heroVisible && !document.hidden && !isMotionPaused();
    if (shouldPlay) {
      if (heroVideo.readyState >= 2 && heroVideo.paused) {
        heroVideo.play().catch(() => {});
      }
      syncHeroCueFromVideo(false);
      startHeroCueLoop();
    } else {
      stopHeroCueLoop();
      if (!heroVideo.paused) heroVideo.pause();
    }
  }

  if (heroVideo) {
    applyHeroPlaybackRate();
    heroVideo.addEventListener('loadedmetadata', applyHeroPlaybackRate, { signal });
    heroVideo.addEventListener('canplay', syncHeroVideo, { signal });
    heroVideo.addEventListener('loadeddata', syncHeroVideo, { signal });
    heroVideo.addEventListener(
      'play',
      () => {
        applyHeroPlaybackRate();
        startHeroCueLoop();
      },
      { signal }
    );
    heroVideo.addEventListener('pause', stopHeroCueLoop, { signal });
    heroVideo.addEventListener('timeupdate', () => syncHeroCueFromVideo(true), { signal });
    heroVideo.addEventListener('seeked', () => syncHeroCueFromVideo(false), { signal });
    heroVideo.addEventListener(
      'error',
      () => {
        heroVideoFailed = true;
        heroVideo.classList.remove('is-active');
        stopHeroCueLoop();
      },
      { signal }
    );
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!heroMedia || !hero) return;
      if (isMotionPaused()) {
        heroMedia.style.setProperty('--hero-parallax', '0px');
        return;
      }
      const maxShift = Math.min(hero.offsetHeight * 0.14, 72);
      const shift = Math.min(Math.max(window.scrollY, 0) * 0.14, maxShift);
      heroMedia.style.setProperty('--hero-parallax', `${shift.toFixed(1)}px`);
    },
    { passive: true, signal }
  );

  if ('IntersectionObserver' in window && heroCopy) {
    const heroIo = new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry.intersectionRatio >= 0.22;
        syncHeroVideo();
      },
      { threshold: 0.22 }
    );
    heroIo.observe(heroCopy);
    signal.addEventListener('abort', () => heroIo.disconnect(), { once: true });
  }
  document.addEventListener('visibilitychange', syncHeroVideo, { signal });
  syncHeroVideo();

  // Destinations Carousel
  const carousel = byId('destCarousel');
  const caroDotsWrap = byId('carouselDots');
  let measureCarousel = () => {};

  if (carousel) {
    const originalCards = Array.from(carousel.children) as HTMLElement[];
    for (const card of originalCards) {
      const id = card.dataset.destTone || '';
      const stop = places.get(id);
      const cover = heroPhotos[id];
      const img = card.querySelector('picture img') as HTMLImageElement | null;
      if (img && (cover?.wide || (stop && (images[`${stop.image}Cover`] || images[stop.image])))) {
        img.src = cover?.wide || images[`${stop!.image}Cover`] || images[stop!.image];
      }
    }

    const clonedCards = originalCards.map((card) => {
      const clone = card.cloneNode(true) as HTMLElement;
      clone.setAttribute('aria-hidden', 'true');
      clone.tabIndex = -1;
      clone.querySelectorAll('img').forEach((im) => im.removeAttribute('data-embedded-photo'));
      return clone;
    });
    carousel.append(...clonedCards);

    const cards = Array.from(carousel.children) as HTMLElement[];
    const cardCount = cards.length;
    const realCount = originalCards.length;
    const carouselRegion = carousel.closest('.carousel-wrap') as HTMLElement | null;

    let cardPosition = 0;
    let cardStep = 0;
    let cardFrame = 0;
    let previousTime = 0;
    let cardTarget: number | null = null;
    let cardMotion: { from: number; start: number } | null = null;
    let resumeAt = 0;
    let dragOrigin: number | null = null;
    let carouselVisible = !('IntersectionObserver' in window);
    let carouselHovered = false;
    let carouselKeyboardFocus = false;
    let lastActiveReal = -1;

    const caroDotButtons = caroDotsWrap
      ? originalCards.map((card, idx) => {
          const title = card.querySelector('h3')?.textContent?.trim() || `وجهة ${idx + 1}`;
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'carousel-dot';
          dot.setAttribute('role', 'tab');
          dot.setAttribute('aria-selected', String(idx === 0));
          dot.setAttribute('aria-label', title);
          dot.title = title;
          dot.addEventListener(
            'click',
            () => {
              const distance =
                wrap(idx - wrap(cardPosition, realCount) + realCount / 2, realCount) - realCount / 2;
              goToCard(cardPosition + distance);
            },
            { signal }
          );
          caroDotsWrap.append(dot);
          return dot;
        })
      : [];

    function syncCarouselDots(activeReal: number): void {
      if (activeReal === lastActiveReal || !caroDotButtons.length) return;
      lastActiveReal = activeReal;
      caroDotButtons.forEach((dot, idx) =>
        dot.setAttribute('aria-selected', String(idx === activeReal))
      );
    }

    function drawCards(): void {
      cards.forEach((card, index) => {
        const distance = wrap(cardPosition - index + cardCount / 2, cardCount) - cardCount / 2;
        const absD = Math.abs(distance);
        card.style.setProperty('--card-x', `${(distance * cardStep).toFixed(2)}px`);
        card.style.setProperty(
          '--card-depth',
          Math.max(0.935, 1 - Math.min(absD, 2.2) * 0.025).toFixed(4)
        );
        card.style.setProperty('--card-z', String(Math.round(14 - Math.min(absD, 4) * 2)));
      });
      syncCarouselDots(wrap(Math.round(cardPosition), realCount));
    }

    measureCarousel = () => {
      if (!carousel.clientWidth) return;
      carousel.dataset.enhanced = '';
      cardStep = Math.max(carousel.clientWidth * 0.345, (cards[0]?.offsetWidth || 300) + 16);
      drawCards();
    };

    function queueCards(): void {
      if (cardFrame || !cardStep || document.hidden || !carouselVisible || signal.aborted) return;
      if (
        !cardMotion &&
        (isMotionPaused() || carouselHovered || carouselKeyboardFocus || dragOrigin !== null)
      ) {
        return;
      }
      cardFrame = window.requestAnimationFrame(updateCards);
    }

    function updateCards(time: number): void {
      cardFrame = 0;
      const dt = previousTime ? Math.min(time - previousTime, 40) : 16;
      previousTime = time;
      if (cardMotion && cardTarget !== null) {
        const progress = Math.min(1, (time - cardMotion.start) / 580);
        cardPosition = cardMotion.from + (cardTarget - cardMotion.from) * (1 - (1 - progress) ** 3);
        if (progress === 1) {
          cardPosition = wrap(cardTarget, cardCount);
          cardTarget = null;
          cardMotion = null;
        }
      } else if (
        !isMotionPaused() &&
        !carouselHovered &&
        !carouselKeyboardFocus &&
        dragOrigin === null &&
        time > resumeAt
      ) {
        cardPosition = wrap(cardPosition + dt / 3200, cardCount);
      }
      drawCards();
      queueCards();
    }

    function goToCard(target: number, immediate = isMotionPaused()): void {
      resumeAt = performance.now() + 900;
      if (immediate || !carouselVisible) {
        cardPosition = wrap(target, cardCount);
        cardTarget = null;
        cardMotion = null;
        drawCards();
      } else {
        cardTarget = target;
        cardMotion = { from: cardPosition, start: performance.now() };
      }
      queueCards();
    }

    function stepCards(direction: number): void {
      const position = cardTarget ?? cardPosition;
      const target =
        direction > 0 ? Math.floor(position + 0.06) + 1 : Math.ceil(position - 0.06) - 1;
      goToCard(target);
    }

    byId('caroPrev')?.addEventListener('click', () => stepCards(-1), { signal });
    byId('caroNext')?.addEventListener('click', () => stepCards(1), { signal });
    carousel.addEventListener(
      'pointerover',
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (event.pointerType === 'mouse' && target?.closest('.dest-card')) carouselHovered = true;
      },
      { signal }
    );
    carousel.addEventListener(
      'pointerout',
      (event) => {
        if (event.pointerType !== 'mouse') return;
        const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
        if (related && related.closest('.dest-card') && carousel.contains(related)) return;
        carouselHovered = false;
        previousTime = 0;
        queueCards();
      },
      { signal }
    );
    carouselRegion?.addEventListener(
      'focusin',
      (event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        carouselKeyboardFocus = Boolean(target?.matches(':focus-visible'));
        const index = target ? cards.indexOf(target) : -1;
        if (index < 0 || !carouselKeyboardFocus) return;
        const distance = wrap(index - cardPosition + cardCount / 2, cardCount) - cardCount / 2;
        goToCard(cardPosition + distance, true);
      },
      { signal }
    );
    carouselRegion?.addEventListener(
      'focusout',
      (event) => {
        if (event.relatedTarget instanceof Node && carouselRegion.contains(event.relatedTarget)) {
          return;
        }
        carouselKeyboardFocus = false;
        previousTime = 0;
        queueCards();
      },
      { signal }
    );
    carousel.addEventListener(
      'keydown',
      (event) => {
        if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? 1 : -1;
        const target = event.target instanceof HTMLElement ? event.target : null;
        const focused = target ? originalCards.indexOf(target) : -1;
        if (focused >= 0) {
          originalCards[wrap(focused + direction, realCount)].focus({ preventScroll: true });
        } else {
          stepCards(direction);
        }
      },
      { signal }
    );

    bindSwipe(
      carousel,
      {
        start: () => {
          cardTarget = null;
          cardMotion = null;
          dragOrigin = cardPosition;
          carousel.classList.add('is-dragging');
        },
        move: (dx) => {
          if (dragOrigin === null || !cardStep) return;
          cardPosition = dragOrigin + dx / cardStep;
          drawCards();
        },
        end: (dx) => {
          if (dragOrigin === null) return;
          const offset =
            Math.abs(dx) > 32
              ? Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / (cardStep || 300)))
              : 0;
          goToCard(Math.round(dragOrigin) + offset);
          dragOrigin = null;
          carousel.classList.remove('is-dragging');
          queueCards();
        },
      },
      signal
    );

    if (typeof IntersectionObserver !== 'undefined') {
      const carIo = new IntersectionObserver(
        ([entry]) => {
          carouselVisible = entry.isIntersecting;
          if (carouselVisible) previousTime = 0;
          queueCards();
        },
        { threshold: 0.12 }
      );
      carIo.observe(carousel);
      signal.addEventListener('abort', () => carIo.disconnect(), { once: true });
    }
    document.addEventListener(
      'visibilitychange',
      () => {
        previousTime = 0;
        queueCards();
      },
      { signal }
    );
    window.addEventListener(
      'albaha:motion-change',
      () => {
        if (isMotionPaused()) goToCard(Math.round(cardTarget ?? cardPosition), true);
        else {
          previousTime = 0;
          queueCards();
        }
      },
      { signal }
    );
    if (typeof ResizeObserver !== 'undefined') {
      const carRo = new ResizeObserver(measureCarousel);
      carRo.observe(carousel);
      signal.addEventListener('abort', () => carRo.disconnect(), { once: true });
    }

    signal.addEventListener(
      'abort',
      () => {
        if (cardFrame) window.cancelAnimationFrame(cardFrame);
        clonedCards.forEach((clone) => clone.remove());
        caroDotButtons.forEach((dot) => dot.remove());
        carousel.removeAttribute('data-enhanced');
      },
      { once: true }
    );

    measureCarousel();
    queueCards();
  }

  // Terrain / Street Map & Planner
  const filterButtons = qsAll<HTMLButtonElement>('[data-style]');
  const terrainPointers = new Map<number, { x: number; y: number }>();
  const minTerrainZoom = 0.65;
  const maxTerrainZoom = 5;
  let terrainCenter: { x: number; y: number } | null = null;
  let terrainView: {
    left: number;
    top: number;
    scale: number;
    width: number;
    height: number;
    fit: { x: number; y: number; width: number };
  } | null = null;
  let terrainGestureStart: { x: number; y: number; distance: number } = {
    x: 0,
    y: 0,
    distance: 1,
  };
  let terrainDragged = false;
  let ignoreTerrainClickUntil = 0;
  let mapLegs: ReturnType<typeof getSegment>[] = [];
  const mapZoomIn = byId<HTMLButtonElement>('mapZoom');
  const mapZoomOut = byId<HTMLButtonElement>('mapOut');
  const streetMapNotice = byId('streetMapNotice');

  const roads = Object.entries(geo.routes)
    .filter(([id]) => {
      const [first, last] = id.split('-');
      return first < last || !geo.routes[`${last}-${first}`];
    })
    .map(([, road]) => pathFrom(road.points))
    .join('');
  byId('terrainRoadBorder')?.setAttribute('d', roads);
  byId('terrainRoads')?.setAttribute('d', roads);

  function mapBounds(viewWidth: number, viewHeight: number) {
    const points = [
      ...chosen.map((stop) => geo.stations[stop.id]),
      ...mapLegs.flatMap((leg) => leg.points),
    ];
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const paddedWidth = Math.max(1, viewWidth - Math.min(100, viewWidth * 0.27));
    const paddedHeight = Math.max(1, viewHeight - Math.min(125, viewHeight * 0.28));
    const scale = Math.max(
      300 / viewWidth,
      (right - left) / paddedWidth,
      (bottom - top) / paddedHeight
    );
    return { x: (left + right) / 2, y: (top + bottom) / 2, width: viewWidth * scale };
  }

  function updateViewport(): void {
    if (!svg || streetMapActive || !svg.clientWidth || !svg.clientHeight || !chosen.length) return;
    const viewWidth = svg.clientWidth;
    const viewHeight = svg.clientHeight;
    const fit = mapBounds(viewWidth, viewHeight);
    const width = fit.width / zoom;
    const scale = width / viewWidth;
    const height = viewHeight * scale;
    const center = terrainCenter || fit;
    const clampOffset = (value: number, low: number, high: number) =>
      high < low ? (low + high) / 2 : Math.max(low, Math.min(high, value));
    const left = clampOffset(center.x - width / 2, mapExtent.left, mapExtent.right - width);
    const top = clampOffset(center.y - height / 2, mapExtent.top, mapExtent.bottom - height);
    terrainView = { left, top, scale, width, height, fit };
    if (terrainCenter) terrainCenter = { x: left + width / 2, y: top + height / 2 };
    svg.setAttribute('viewBox', [left, top, width, height].join(' '));
    const pinsContainer = byId('mapPins');
    if (pinsContainer) {
      for (const pin of Array.from(pinsContainer.children) as HTMLElement[]) {
        const pinId = pin.dataset.mapPin || '';
        const coords = geo.stations[pinId];
        if (!coords) continue;
        const [x, y] = coords;
        pin.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`);
        const fo = pin.querySelector('foreignObject');
        fo?.setAttribute('y', String((y - top) / scale < 69 ? 16 : -42));
      }
    }
    if (mapZoomIn) mapZoomIn.disabled = zoom >= maxTerrainZoom;
    if (mapZoomOut) mapZoomOut.disabled = zoom <= minTerrainZoom;
  }

  function setTerrainZoom(
    value: number,
    from?: { x: number; y: number },
    to = from
  ): void {
    const view = terrainView;
    if (!view || !svg) return;
    zoom = Math.max(minTerrainZoom, Math.min(maxTerrainZoom, value));
    const rect = svg.getBoundingClientRect();
    const nextScale = view.fit.width / (zoom * rect.width);
    const start = from || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const finish = to || start;
    terrainCenter = {
      x:
        view.left +
        (start.x - rect.left) * view.scale +
        (rect.left + rect.width / 2 - finish.x) * nextScale,
      y:
        view.top +
        (start.y - rect.top) * view.scale +
        (rect.top + rect.height / 2 - finish.y) * nextScale,
    };
    updateViewport();
  }

  function pointerCenter() {
    const [a, b] = Array.from(terrainPointers.values());
    return b
      ? {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        }
      : { ...a, distance: 1 };
  }

  svg.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || !terrainView) return;
      terrainPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      terrainGestureStart = pointerCenter();
    },
    { signal }
  );
  svg.addEventListener(
    'pointermove',
    (event) => {
      if (!terrainPointers.has(event.pointerId)) return;
      const before = terrainDragged ? pointerCenter() : terrainGestureStart;
      terrainPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = pointerCenter();
      const moved = Math.hypot(after.x - before.x, after.y - before.y) > 5;
      if (!terrainDragged && terrainPointers.size === 1 && !moved) return;
      terrainDragged = true;
      svg.classList.add('is-panning');
      for (const id of terrainPointers.keys()) {
        if (!svg.hasPointerCapture(id)) svg.setPointerCapture(id);
      }
      setTerrainZoom((zoom * after.distance) / before.distance, before, after);
    },
    { signal }
  );

  function releaseTerrainPointer(event: PointerEvent): void {
    if (!terrainPointers.delete(event.pointerId)) return;
    if (terrainPointers.size) {
      terrainGestureStart = pointerCenter();
      return;
    }
    if (terrainDragged) ignoreTerrainClickUntil = performance.now() + 240;
    terrainDragged = false;
    svg.classList.remove('is-panning');
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    svg.addEventListener(type, releaseTerrainPointer, { signal });
  }
  svg.addEventListener(
    'pointerleave',
    (event) => {
      if (!svg.hasPointerCapture(event.pointerId)) releaseTerrainPointer(event);
    },
    { signal }
  );
  svg.addEventListener(
    'click',
    (event) => {
      if (performance.now() >= ignoreTerrainClickUntil) return;
      event.stopPropagation();
      event.preventDefault();
    },
    { capture: true, signal }
  );
  svg.addEventListener(
    'keydown',
    (event) => {
      if (event.target !== svg || !terrainView) return;
      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -46],
        ArrowDown: [0, 46],
        ArrowLeft: [-46, 0],
        ArrowRight: [46, 0],
      };
      if (event.key in moves) {
        event.preventDefault();
        const [dx, dy] = moves[event.key];
        const { left, top, width, height, scale } = terrainView;
        terrainCenter = { x: left + width / 2 + dx * scale, y: top + height / 2 + dy * scale };
        updateViewport();
      } else if (['+', '=', '-'].includes(event.key) && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setTerrainZoom(zoom * (event.key === '-' ? 1 / 1.4 : 1.4));
      }
    },
    { signal }
  );

  function fitStreetMap(): void {
    if (!liveMap || !streetMap?.clientWidth || !chosen.length) return;
    const { map, library } = liveMap;
    const bounds = new library.LngLatBounds();
    chosen.forEach((stop) => bounds.extend([stop.lng, stop.lat]));
    for (const leg of mapLegs) leg.coordinates.forEach((point) => bounds.extend(point));
    if (chosen.length === 1) {
      map.jumpTo({ center: [chosen[0].lng, chosen[0].lat], zoom: 13 });
      return;
    }
    const small = streetMap.clientWidth < 500;
    map.fitBounds(bounds, {
      padding: { top: 66, right: small ? 48 : 65, bottom: 54, left: small ? 38 : 65 },
      maxZoom: 13,
      duration: 0,
    });
  }

  function resetMapView(): void {
    if (streetMapActive) {
      fitStreetMap();
      return;
    }
    terrainCenter = null;
    zoom = 1;
    updateViewport();
  }

  byId('mapFocus')?.addEventListener('click', resetMapView, { signal });
  mapZoomIn?.addEventListener(
    'click',
    () =>
      streetMapActive && liveMap
        ? liveMap.map.zoomIn({ duration: reducedMotion.matches ? 0 : 240 })
        : setTerrainZoom(zoom * 1.4),
    { signal }
  );
  mapZoomOut?.addEventListener(
    'click',
    () =>
      streetMapActive && liveMap
        ? liveMap.map.zoomOut({ duration: reducedMotion.matches ? 0 : 240 })
        : setTerrainZoom(zoom / 1.4),
    { signal }
  );

  function updateMapStatus(): void {
    const count = `${formatNum(chosen.length)} ${chosen.length === 1 ? 'محطة' : 'محطات'}`;
    const mapStatus = byId('mapStatus');
    const mapApprox = byId('mapApproximate');
    if (mapStatus) mapStatus.textContent = `${count} · خريطة الشوارع`;
    if (mapApprox) mapApprox.hidden = !mapLegs.some((leg) => leg.approximate);
  }

  function renderStreetRoute({ fitView = true } = {}): void {
    if (!liveMap) return;
    const { map, library } = liveMap;
    const features = mapLegs.map((leg) => ({
      type: 'Feature',
      properties: { approximate: leg.approximate },
      geometry: { type: 'LineString', coordinates: leg.coordinates },
    }));
    map.getSource('albaha-route')?.setData({ type: 'FeatureCollection', features });
    liveMap.markers.forEach((marker) => marker.remove());
    const locked = (routeDraft?.timing || savedTiming)?.locked;
    liveMap.markers = chosen.map((stop, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'street-marker';
      button.dataset.station = String(index);
      button.setAttribute('aria-label', `${index + 1}. ${stop.name}`);
      button.textContent = String(index + 1);
      const isExploration = Boolean(
        !routeDraft && viewedStopId === stop.id && !choices.has(stop.id)
      );
      button.classList.toggle('is-locked', locked === stop.id || lockedIds.has(stop.id));
      button.classList.toggle('is-completed', completedIds.has(stop.id));
      button.classList.toggle('is-exploration', isExploration);
      if (index === station) {
        button.classList.add('active');
        button.setAttribute('aria-current', 'step');
      }
      const label = document.createElement('span');
      label.className = 'street-marker-name';
      label.dir = 'rtl';
      label.textContent = stop.name;
      button.append(label);
      return new library.Marker({ element: button, anchor: 'center' })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map);
    });
    if (fitView) fitStreetMap();
    updateMapStatus();
  }

  function renderMap(): void {
    mapLegs = chosen.slice(1).map((stop, index) => getSegment(chosen[index], stop));
    const path = routePath(mapLegs);
    byId('routeOutline')?.setAttribute('d', path);
    byId('routeLine')?.setAttribute('d', path);
    const locked = (routeDraft?.timing || savedTiming)?.locked;
    const mapPins = byId('mapPins');
    if (mapPins) {
      mapPins.innerHTML = chosen
        .map((stop, index) => {
          const isLocked = locked === stop.id || lockedIds.has(stop.id);
          const isCompleted = completedIds.has(stop.id);
          const isExploration = Boolean(
            !routeDraft && viewedStopId === stop.id && !choices.has(stop.id)
          );
          const cls = `map-pin${isLocked ? ' is-locked' : ''}${isCompleted ? ' is-completed' : ''}${isExploration ? ' is-exploration' : ''}`;
          return `
      <g class="${cls}" role="button" tabindex="0"
         data-map-pin="${stop.id}" data-station="${index}" aria-label="${index + 1}. ${stop.name}">
        <circle class="terrain-pin-hit" r="17"/><circle class="terrain-pin-dot" r="11.5"/><text>${index + 1}</text>
        <foreignObject class="terrain-pin-caption" x="-72.5" y="-42" width="145" height="27">
          <div xmlns="http://www.w3.org/1999/xhtml" class="terrain-pin-label" dir="rtl">${stop.name}</div>
        </foreignObject>
      </g>`;
        })
        .join('');
    }
    if (streetMapActive) {
      renderStreetRoute();
    } else {
      updateViewport();
      if (!liveMapLoading) updateMapStatus();
    }
  }

  function showStationOnMap(stop: StopBase): void {
    if (streetMapActive && liveMap) {
      const { map } = liveMap;
      if (!map.getBounds().contains([stop.lng, stop.lat])) {
        map.panTo([stop.lng, stop.lat], { duration: reducedMotion.matches ? 0 : 320 });
      }
    } else if (terrainView) {
      const pinCoords = geo.stations[stop.id];
      if (!pinCoords) return;
      const [x, y] = pinCoords;
      const { left, top, width, height, scale } = terrainView;
      if (
        x < left + 20 * scale ||
        x > left + width - 20 * scale ||
        y < top + 45 * scale ||
        y > top + height - 20 * scale
      ) {
        terrainCenter = { x, y };
        updateViewport();
      }
    }
  }

  function syncMapZoomControls(): void {
    if (!streetMapActive || !liveMap) return;
    const { map } = liveMap;
    if (mapZoomIn) mapZoomIn.disabled = map.getZoom() >= map.getMaxZoom();
    if (mapZoomOut) mapZoomOut.disabled = map.getZoom() <= map.getMinZoom();
  }

  function activateStreetMap(): void {
    if (!liveMap || !streetMap || !svg || !mapPanel) return;
    streetMapActive = true;
    streetMap.inert = false;
    svg.inert = true;
    svg.setAttribute('aria-hidden', 'true');
    mapPanel.classList.add('is-live-map');
    if (streetMapNotice) streetMapNotice.hidden = true;
    liveMap.map.resize();
    renderStreetRoute();
    syncMapZoomControls();
  }

  async function loadStreetMap(): Promise<void> {
    if (liveMapLoading || liveMap || signal.aborted || !streetMap || !mapPanel) return;
    liveMapLoading = true;
    if (streetMapNotice) streetMapNotice.hidden = true;
    const mapStatus = byId('mapStatus');
    if (mapStatus) mapStatus.textContent = 'جارٍ تحميل خريطة الشوارع';

    let map: MapLibreMapInstance | undefined;
    let timeout = 0;
    try {
      const library = await loadMapLibreLibrary();
      if (signal.aborted || !streetMap.isConnected) return;
      map = new library.Map({
        container: streetMap,
        style: STREET_MAP_STYLE,
        center: [41.44, 20.01],
        zoom: 11,
        minZoom: 6,
        maxZoom: 18,
        attributionControl: false,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
      });
      map.touchZoomRotate.disableRotation();
      await new Promise<void>((resolve, reject) => {
        timeout = window.setTimeout(() => reject(new Error('Map tiles timeout')), 10000);
        const onAbort = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        signal.addEventListener('abort', onAbort, { once: true });
        const basemapVisible = () => {
          if (signal.aborted) {
            window.clearTimeout(timeout);
            resolve();
            return;
          }
          if (map!.queryRenderedFeatures().some((feature) => feature.source)) {
            window.clearTimeout(timeout);
            resolve();
          }
        };
        map!.once('load', basemapVisible);
        map!.once('idle', basemapVisible);
      });
      window.clearTimeout(timeout);
      if (signal.aborted || !streetMap.isConnected) {
        map.remove();
        return;
      }
      map.addSource('albaha-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      for (const [id, width, color] of [
        ['route-casing', 3.8, '#fff'],
        ['route-road', 1.9, '#1666bf'],
      ] as const) {
        map.addLayer({
          id,
          source: 'albaha-route',
          type: 'line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': color, 'line-width': width },
        });
      }
      liveMap = { map, library, markers: [] };
      map
        .getCanvas()
        .setAttribute(
          'aria-label',
          'خريطة شوارع الباحة. استخدم الأسهم للتحريك وعلامتي الجمع والطرح للتكبير والتصغير.'
        );
      map.on('zoomend', syncMapZoomControls);
      activateStreetMap();
    } catch (error) {
      console.warn('تعذّر تحميل خريطة الشوارع', error);
      try {
        map?.remove();
      } catch {
        // Ignore cleanup failure
      }
      liveMap = null;
      streetMapActive = false;
      mapPanel.classList.add('is-live-map');
      if (streetMapNotice) streetMapNotice.hidden = false;
      if (mapStatus) mapStatus.textContent = 'خريطة الشوارع غير متاحة. يمكن إعادة المحاولة';
    } finally {
      window.clearTimeout(timeout);
      liveMapLoading = false;
    }
  }

  byId('retryStreetMap')?.addEventListener('click', () => void loadStreetMap(), { signal });

  const startDefaultStreetMap = () => {
    if (streetDefaultAttempted || signal.aborted) return;
    streetDefaultAttempted = true;
    void loadStreetMap();
  };
  if (typeof IntersectionObserver !== 'undefined') {
    const mapLayerObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        mapLayerObserver.disconnect();
        startDefaultStreetMap();
      },
      { rootMargin: '240px' }
    );
    mapLayerObserver.observe(mapPanel);
    signal.addEventListener('abort', () => mapLayerObserver.disconnect(), { once: true });
  } else {
    window.addEventListener('load', startDefaultStreetMap, { once: true, signal });
  }

  signal.addEventListener(
    'abort',
    () => {
      if (liveMap) {
        try {
          liveMap.markers.forEach((m) => m.remove());
          liveMap.map.remove();
        } catch {
          // Ignore teardown errors
        }
        liveMap = null;
      }
      streetMapActive = false;
      liveMapLoading = false;
      streetMap.inert = false;
      svg.inert = false;
      svg.removeAttribute('aria-hidden');
      mapPanel.classList.remove('is-live-map');
    },
    { once: true }
  );

  // Weather & Seasons
  const currentSeason: SeasonKey = (() => {
    const m = localTime().month;
    return m >= 3 && m <= 5
      ? 'spring'
      : m >= 6 && m <= 8
        ? 'summer'
        : m >= 9 && m <= 11
          ? 'autumn'
          : 'winter';
  })();
  let selectedSeason: SeasonKey = currentSeason;
  let seasonRegion: string | null = null;
  let seasonInView = false;
  let seasonWeatherRequest = 0;

  const seasonPhotoEl = byId<HTMLImageElement>('seasonPhoto');
  const showSeasonPhoto = seasonPhotoEl ? makePhotoSwitcher(seasonPhotoEl, signal) : () => {};

  async function showSeasonWeather(cityKey: string): Promise<void> {
    const request = ++seasonWeatherRequest;
    const status = byId('seasonWeather');
    if (!status) return;
    status.hidden = false;
    status.textContent = 'جارٍ جلب الأجواء الحالية';
    const data = await forecast(cityKey);
    if (request !== seasonWeatherRequest || signal.aborted) return;
    status.textContent = data
      ? `${weatherNames(data.current.weather_code)} · ${formatNum(Math.round(data.current.temperature_2m))}°م`
      : 'الطقس الحالي غير متاح';
  }

  function renderSeason(key: SeasonKey): void {
    selectedSeason = key;
    const season = seasons[key];
    const cityKey = seasonRegion ?? season.city;
    const city = climateCities[cityKey] || climateCities.baha;
    const seasonLabel = byId('seasonLabel');
    const seasonMonths = byId('seasonMonths');
    const seasonIcon = byId('seasonIcon');
    const seasonTip = byId('seasonTip');
    const seasonCity = byId<HTMLAnchorElement>('seasonCity');
    if (seasonLabel) seasonLabel.textContent = season.name;
    if (seasonMonths) seasonMonths.textContent = season.months;
    if (seasonIcon) seasonIcon.setAttribute('href', `#i-season-${key}`);
    showSeasonPhoto(
      images[city.image] || images[season.image] || '',
      `مشهد من ${city.name}`
    );
    if (seasonTip) seasonTip.textContent = city.tips?.[key] || '';
    if (seasonCity) {
      seasonCity.href = `/city/${cityKey}`;
      seasonCity.innerHTML = `أجواء ${city.name} ${glyph('arrow', 'ic tiny')}`;
    }
    const seasonFacts = byId('seasonFacts');
    if (seasonFacts) {
      const factProfiles: Record<
        string,
        Record<SeasonKey, { temp: string; elevation: string; attire: string; bestFor: string }>
      > = {
        baha: {
          spring: {
            temp: '15° – 25°م',
            elevation: '2,200 م · مرتفعات السراة',
            attire: 'سترة خفيفة للمساء وحذاء مشي',
            bestFor: 'غابة رغدان والمدرجات والشلالات',
          },
          summer: {
            temp: '17° – 28°م',
            elevation: '2,200 م · نسيم جبلي معتدل',
            attire: 'ملابس قطنية مع جاكيت خفيف ليلاً',
            bestFor: 'متنزه الأمير حسام والضباب المسائي',
          },
          autumn: {
            temp: '13° – 23°م',
            elevation: '2,200 م · أجواء صافية',
            attire: 'معطف خفيف خصوصاً بعد الغروب',
            bestFor: 'الأسواق التراثية والمطلات الجبلية',
          },
          winter: {
            temp: '8° – 18°م',
            elevation: '2,200 م · برودة جبلية وضباب',
            attire: 'ملابس شتوية دافئة ومظلة للضباب',
            bestFor: 'المقاهي المطلة والجولات الصباحية',
          },
        },
        makhwah: {
          spring: {
            temp: '22° – 33°م',
            elevation: '450 م · أودية تهامة',
            attire: 'ملابس خفيفة وقبعة وماء للشرب',
            bestFor: 'قرية ذي عين ومزارع الموز',
          },
          summer: {
            temp: '27° – 39°م',
            elevation: '450 م · دفء نهاري مرتفع',
            attire: 'زيارة صباحية أو مسائية وواقي شمس',
            bestFor: 'القرى الحجرية قبيل الغروب',
          },
          autumn: {
            temp: '23° – 34°م',
            elevation: '450 م · اعتدال تدريجي',
            attire: 'ملابس خفيفة وحذاء ثابت للصخور',
            bestFor: 'جبل شدا الأسفل والبن الشدوي',
          },
          winter: {
            temp: '18° – 28°م',
            elevation: '450 م · مشتى دافئ ومثالي',
            attire: 'ملابس ربيعية مريحة طوال اليوم',
            bestFor: 'ذي عين وشدا الأعلى والتخييم الشتوي',
          },
        },
      };
      const profile = (factProfiles[cityKey] || factProfiles.baha)[key];
      const tempRange = profile.temp.replace('°م', '°');
      seasonFacts.innerHTML = `
        <div class="season-fact-card"><dt>متوسط الحرارة</dt><dd><bdi dir="ltr">${tempRange}</bdi> م</dd></div>
        <div class="season-fact-card"><dt>الارتفاع والطبيعة</dt><dd>${profile.elevation}</dd></div>
        <div class="season-fact-card"><dt>اللباس المقترح</dt><dd>${profile.attire}</dd></div>
        <div class="season-fact-card"><dt>الأنسب للزيارة</dt><dd>${profile.bestFor}</dd></div>
      `;
    }
    if (motionAllowed()) {
      for (const el of [byId('seasonName'), seasonMonths, seasonTip]) {
        if (!el) continue;
        el.classList.remove('is-season-updating');
        void el.offsetWidth;
        el.classList.add('is-season-updating');
      }
    }
    qsAll<HTMLElement>('[data-season]').forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.season === key))
    );
    qsAll<HTMLElement>('[data-season-region]').forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.seasonRegion === cityKey))
    );
    if (seasonInView) void showSeasonWeather(cityKey);
  }

  function showRouteWeather(stop: StopBase): void {
    const cityKey = stopVisit[stop.id].city;
    const city = climateCities[cityKey];
    const stopCity = byId<HTMLAnchorElement>('stopCity');
    const stopWeather = byId('stopWeather');
    if (stopCity) {
      stopCity.href = `/city/${cityKey}`;
      stopCity.textContent = city.name;
    }
    if (stopWeather) stopWeather.textContent = seasons[currentSeason].name;
    if (
      !routeStage ||
      !routeStage.getBoundingClientRect().height ||
      routeStage.getBoundingClientRect().top > window.innerHeight + 180
    ) {
      return;
    }
    void forecast(cityKey).then((data) => {
      if (signal.aborted || chosen[station]?.id !== stop.id || !data || !stopWeather) return;
      stopWeather.textContent = `${Math.round(data.current.temperature_2m)}° | ${weatherNames(data.current.weather_code)} | ${data.current.time.slice(11)}`;
    });
  }

  // Route photo gallery
  const routeGallery = (() => {
    const frame = byId<HTMLButtonElement>('routeGallery');
    const stopPhoto = byId<HTMLImageElement>('stopPhoto');
    const photoNote = byId('stopPhotoNote');
    if (!frame || !stopPhoto) {
      return { setStation: (_id: string) => {} };
    }
    const showPhoto = makePhotoSwitcher(stopPhoto, signal);
    let gallery: [string, string][] = [];
    let stationId = '';
    let index = 0;
    let timer = 0;
    let visible = !('IntersectionObserver' in window);
    let paused = false;
    let swiping = false;

    function schedule(): void {
      window.clearTimeout(timer);
      if (
        signal.aborted ||
        !visible ||
        paused ||
        swiping ||
        document.hidden ||
        isMotionPaused() ||
        gallery.length < 2
      ) {
        return;
      }
      timer = window.setTimeout(() => show(index + 1), 5200);
    }

    function show(next: number, direction = Math.sign(next - index) || 1): void {
      if (!gallery.length) return;
      index = (next + gallery.length) % gallery.length;
      const [key, label] = gallery[index];
      showPhoto(gallerySource(key), label, direction);
      schedule();
    }

    bindSwipe(
      frame,
      {
        start: () => {
          swiping = true;
          schedule();
        },
        end: (dx) => {
          swiping = false;
          if (Math.abs(dx) > 34) show(index + Math.sign(dx));
          else schedule();
        },
      },
      signal
    );
    frame.addEventListener(
      'click',
      () => {
        paused = !paused;
        frame.setAttribute('aria-pressed', String(paused));
        schedule();
      },
      { signal }
    );
    frame.addEventListener(
      'keydown',
      (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        show(index + (event.key === 'ArrowRight' ? 1 : -1));
      },
      { signal }
    );
    if (typeof IntersectionObserver !== 'undefined') {
      const rgIo = new IntersectionObserver(
        ([entry]) => {
          visible = entry.intersectionRatio >= 0.25;
          schedule();
        },
        { threshold: 0.25 }
      );
      rgIo.observe(frame);
      signal.addEventListener('abort', () => rgIo.disconnect(), { once: true });
    }
    document.addEventListener('visibilitychange', schedule, { signal });
    window.addEventListener('albaha:motion-change', schedule, { signal });
    signal.addEventListener('abort', () => window.clearTimeout(timer), { once: true });

    return {
      setStation(id: string) {
        if (stationId === id) return;
        stationId = id;
        gallery = stopVisit[id].gallery;
        const note = stationPhotoInfo[id];
        if (photoNote) {
          photoNote.textContent = note?.context ? note.caption : '';
          photoNote.hidden = !note?.context;
        }
        frame.disabled = gallery.length < 2;
        show(0);
      },
    };
  })();

  function renderAddButton(): void {
    const selected = chosen[station] ? choices.has(chosen[station].id) : false;
    const add = byId('addStop');
    if (!add) return;
    if (routeDraft) {
      add.removeAttribute('aria-pressed');
      add.innerHTML = `${glyph('plus')} أضف المسار`;
      return;
    }
    add.setAttribute('aria-pressed', String(selected));
    add.innerHTML = selected
      ? `${glyph('check')} أُضيفت إلى رحلتي`
      : `${glyph('plus')} أضف إلى رحلتي`;
  }

  const routeText = document.querySelector<HTMLElement>('.route-text');
  let routeTextMotion: Animation[] = [];

  function renderStation(next: number, force = false): void {
    if ((!force && next === station) || !chosen[next]) return;
    station = next;
    const stop = chosen[station];
    const counter = byId('routeCounter');
    const stopTitle = byId('stopTitle');
    const stopCategory = byId('stopCategory');
    const routePlace = byId<HTMLAnchorElement>('routePlace');
    const duration = byId('stopDuration');
    const stopDesc = byId('stopDesc');
    const openMaps = byId<HTMLAnchorElement>('openMaps');
    if (counter) counter.textContent = `المحطة ${formatNum(station + 1)} من ${formatNum(chosen.length)}`;
    if (stopTitle) stopTitle.textContent = stop.name;
    if (stopCategory) stopCategory.innerHTML = `${glyph(typeIcons[stop.types[0]], 'ic tiny')} ${stop.tag}`;
    if (routePlace) routePlace.href = `/place/${stop.id}`;
    const timed = (routeDraft?.timing || savedTiming)?.stations.find((row) => row.id === stop.id);
    if (duration) {
      if (timed) {
        duration.innerHTML = `<bdi>${clock(timed.start)}–${clock(timed.end)}</bdi> | ${formatNum(timed.end - timed.start)} دقيقة`;
      } else {
        duration.textContent = `مدة الزيارة المقترحة · ${formatNum(stop.min)} دقيقة`;
      }
    }
    if (stopDesc) stopDesc.textContent = stationDescriptions[stop.id] || stop.desc;

    const isExploration = Boolean(
      !routeDraft && viewedStopId === stop.id && !choices.has(stop.id)
    );
    const exploreBanner = byId('stopExploreBanner');
    const exploreText = byId('stopExploreText');
    if (exploreBanner && exploreText) {
      exploreBanner.hidden = !isExploration;
      exploreText.textContent = isExploration ? `تستكشف الآن ${stop.name}` : '';
    }

    routeGallery.setStation(stop.id);
    showRouteWeather(stop);
    if (openMaps) {
      openMaps.href = `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;
    }
    routeStage?.querySelectorAll<HTMLElement>('[data-station]').forEach((button) => {
      const active = Number(button.dataset.station) === station;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    renderAddButton();

    if (!isDockingFromConcierge && getPresenceMode() === 'docked-map') {
      syncDockedMapStop(stop, isExploration);
    }

    stopAnimations(routeTextMotion);
    routeTextMotion =
      routeText && isInViewport(routeText)
        ? enterMotion(
            [stopCategory, stopTitle, stopDesc].filter(
              (el): el is HTMLElement => Boolean(el && isInViewport(el))
            ),
            { duration: 720, step: 110 }
          )
        : [];
  }

  const stationCard = routeStage.querySelector<HTMLElement>('.route-side');
  const stationNav = byId('routeNav');
  const stationPause = byId<HTMLButtonElement>('routePause');
  const stationPointers = new Set<number>();
  let stationVisible = !('IntersectionObserver' in window);
  let stationPaused = false;
  let stationHovered = false;
  let stationTimer = 0;

  function queueStationCycle(): void {
    window.clearTimeout(stationTimer);
    if (
      signal.aborted ||
      chosen.length < 2 ||
      !stationVisible ||
      stationPaused ||
      stationHovered ||
      stationPointers.size ||
      document.hidden ||
      homeView?.hidden ||
      getPresenceMode() === 'docked-map' ||
      isMotionPaused() ||
      stationCard?.querySelector(':focus-visible')
    ) {
      return;
    }
    stationTimer = window.setTimeout(() => {
      renderStation((station + 1) % chosen.length);
      queueStationCycle();
    }, 6200);
  }

  function syncStationControls(): void {
    const prevBtn = byId<HTMLButtonElement>('routePrev');
    const nextBtn = byId<HTMLButtonElement>('routeNext');
    if (prevBtn) prevBtn.disabled = chosen.length < 2;
    if (nextBtn) nextBtn.disabled = chosen.length < 2;
    if (stationPause) {
      stationPause.disabled = chosen.length < 2 || isMotionPaused();
      const paused = stationPaused || isMotionPaused();
      stationPause.setAttribute('aria-pressed', String(paused));
      stationPause.setAttribute('aria-label', paused ? 'شغّل تبديل المحطات' : 'أوقف تبديل المحطات');
      stationPause.innerHTML = glyph(paused ? 'play' : 'pause');
    }
  }

  function goToStation(next: number, behavior: ScrollBehavior = smooth, fromLink = false): void {
    if (!chosen[next]) return;
    renderStation(next);
    showStationOnMap(chosen[next]);
    if (fromLink) routeStage?.scrollIntoView({ behavior, block: 'start' });
    queueStationCycle();
  }

  function selectStationByUser(next: number): void {
    goToStation(next);
    const active = chosen[station];
    if (active) {
      conciergeRef?.setActiveStopContext(active.id, active.operational?.guideId || null);
    }
  }

  byId('routePrev')?.addEventListener(
    'click',
    () => {
      conciergeRef?.bumpRequestSeq();
      selectStationByUser(wrap(station - 1, chosen.length));
    },
    { signal }
  );
  byId('routeNext')?.addEventListener(
    'click',
    () => {
      conciergeRef?.bumpRequestSeq();
      selectStationByUser(wrap(station + 1, chosen.length));
    },
    { signal }
  );
  stationPause?.addEventListener(
    'click',
    () => {
      stationPaused = !stationPaused;
      syncStationControls();
      queueStationCycle();
    },
    { signal }
  );
  stationNav?.addEventListener(
    'keydown',
    (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      selectStationByUser(wrap(station + (event.key === 'ArrowLeft' ? 1 : -1), chosen.length));
    },
    { signal }
  );
  stationCard?.addEventListener(
    'pointerenter',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      stationHovered = true;
      queueStationCycle();
    },
    { signal }
  );
  stationCard?.addEventListener(
    'pointerleave',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      stationHovered = false;
      queueStationCycle();
    },
    { signal }
  );
  stationCard?.addEventListener('focusin', queueStationCycle, { signal });
  stationCard?.addEventListener(
    'focusout',
    () => window.requestAnimationFrame(queueStationCycle),
    { signal }
  );
  routeStage.addEventListener(
    'pointerdown',
    (event) => {
      stationPointers.add(event.pointerId);
      queueStationCycle();
    },
    { signal }
  );
  for (const type of ['pointerup', 'pointercancel'] as const) {
    window.addEventListener(
      type,
      (event) => {
        if (stationPointers.delete(event.pointerId)) queueStationCycle();
      },
      { signal }
    );
  }
  document.addEventListener('visibilitychange', queueStationCycle, { signal });
  window.addEventListener(
    'albaha:motion-change',
    () => {
      syncStationControls();
      queueStationCycle();
    },
    { signal }
  );
  if ('IntersectionObserver' in window && stationCard) {
    const scIo = new IntersectionObserver(
      ([entry]) => {
        stationVisible = entry.intersectionRatio >= 0.35;
        queueStationCycle();
      },
      { threshold: 0.35 }
    );
    scIo.observe(stationCard);
    signal.addEventListener('abort', () => scIo.disconnect(), { once: true });
  }
  signal.addEventListener(
    'abort',
    () => {
      window.clearTimeout(stationTimer);
      window.clearTimeout(toastTimer);
      stopAnimations(routeTextMotion);
    },
    { once: true }
  );

  const manualDays = new Map<string, number>();
  let manualOrder: string[] = [];
  let hasManualDayEdits = false;
  let activeEditDay: number | null = null;
  let draggedStopId: string | null = null;
  const openDays = new Set<number>();

  function snapshotCurrentDaysToManual(): void {
    if (hasManualDayEdits) return;
    const current = scheduleTrip();
    manualDays.clear();
    manualOrder = [];
    for (const row of current.stations) {
      manualDays.set(row.id, row.day);
      manualOrder.push(row.id);
    }
    hasManualDayEdits = true;
  }

  function assignDefaultDayForStop(stopId: string, totalDays: number): number {
    if (activeEditDay && activeEditDay >= 1 && activeEditDay <= totalDays) {
      return activeEditDay;
    }
    const existing = manualDays.get(stopId);
    if (existing && existing >= 1 && existing <= totalDays) return existing;
    const counts = new Map<number, number>();
    for (let d = 1; d <= totalDays; d += 1) counts.set(d, 0);
    for (const [id, d] of manualDays.entries()) {
      if (choices.has(id) && d >= 1 && d <= totalDays) {
        counts.set(d, (counts.get(d) || 0) + 1);
      }
    }
    let minDay = 1;
    let minCount = Number.POSITIVE_INFINITY;
    for (let d = 1; d <= totalDays; d += 1) {
      const c = counts.get(d) || 0;
      if (c < minCount) {
        minCount = c;
        minDay = d;
      }
    }
    return minDay;
  }

  function moveStopToDay(stopId: string, targetDay: number, beforeStopId?: string): void {
    const totalDays = Math.max(1, Number(days?.value || 1));
    const clampedDay = Math.max(1, Math.min(totalDays, targetDay));
    if (!choices.has(stopId)) return;
    snapshotCurrentDaysToManual();
    manualDays.set(stopId, clampedDay);
    manualOrder = manualOrder.filter((id) => id !== stopId);
    if (beforeStopId && beforeStopId !== stopId && manualOrder.includes(beforeStopId)) {
      const insertAt = manualOrder.indexOf(beforeStopId);
      manualOrder.splice(insertAt, 0, stopId);
    } else {
      manualOrder.push(stopId);
    }
    openDays.add(clampedDay);
    approved = null;
    savedTiming = null;
    renderSummary();
    const stop = places.get(stopId);
    if (stop) toast(`نُقلت ${stop.name} إلى اليوم ${formatNum(clampedDay)}.`);
  }

  function scheduleTrip(selection = choices, duration = days!.value) {
    if (selection === choices && savedTiming) {
      return { ...timedSchedule(savedTiming), unscheduled: [] as string[] };
    }
    const totalDays = Math.max(1, Number(duration));
    const matching = stops.filter((stop) => selection.has(stop.id));
    const useManual = selection === choices && hasManualDayEdits;

    if (useManual) {
      for (const id of Array.from(manualDays.keys())) {
        if (!selection.has(id)) manualDays.delete(id);
      }
      manualOrder = manualOrder.filter((id) => selection.has(id));
      for (const stop of matching) {
        if (!manualOrder.includes(stop.id)) manualOrder.push(stop.id);
        const curDay = manualDays.get(stop.id);
        if (!curDay || curDay < 1 || curDay > totalDays) {
          manualDays.set(stop.id, assignDefaultDayForStop(stop.id, totalDays));
        }
      }
    }

    const orderedMatching = useManual
      ? [...matching].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id))
      : matching.some((stop) => regionalStops.has(stop.id))
        ? nearbyOrder(matching)
        : matching;

    const scheduled: Array<{
      id: string;
      name: string;
      day: number;
      start: number;
      end: number;
      drive_minutes: number | null;
      drive_estimated: boolean;
      visit_minutes: number;
      latitude: number;
      longitude: number;
    }> = [];
    const unscheduled: string[] = [];

    if (useManual) {
      const buckets = new Map<number, StopBase[]>();
      for (let d = 1; d <= totalDays; d += 1) buckets.set(d, []);
      for (const stop of orderedMatching) {
        const d = Math.max(1, Math.min(totalDays, manualDays.get(stop.id) || 1));
        buckets.get(d)?.push(stop);
      }
      for (let d = 1; d <= totalDays; d += 1) {
        const dayList = buckets.get(d) || [];
        let time = 9 * 60;
        let previous: StopBase | null = null;
        for (const stop of dayList) {
          const leg = previous ? tripLeg(previous, stop) : null;
          const hours = stopVisit[stop.id]?.hours;
          const start = previous
            ? time + (leg ? leg.min + 15 : 15)
            : Math.max(hours?.[0] ?? 540, 540);
          time = start + stop.min;
          scheduled.push({
            id: stop.id,
            name: stop.name,
            day: d,
            start,
            end: time,
            drive_minutes: leg?.min ?? null,
            drive_estimated: Boolean(leg?.estimated),
            visit_minutes: stop.min,
            latitude: stop.lat,
            longitude: stop.lng,
          });
          previous = stop;
        }
      }
    } else {
      const dayCount = Math.min(totalDays, orderedMatching.length || 1);
      let time = 9 * 60;
      let day = 1;
      let previous: StopBase | null = null;
      for (const [index, stop] of orderedMatching.entries()) {
        const plannedDay = Math.floor((index * dayCount) / orderedMatching.length) + 1;
        if (plannedDay > day) {
          day = plannedDay;
          time = 9 * 60;
          previous = null;
        }
        const hours = stopVisit[stop.id]?.hours;
        const closing = Math.min(hours?.[1] ?? 1260, 1260);
        let leg = previous ? tripLeg(previous, stop) : null;
        let start = Math.max(hours?.[0] ?? 540, time + (leg ? leg.min + 15 : 0));
        if (start + stop.min > closing && previous && day < dayCount) {
          day += 1;
          leg = null;
          start = Math.max(hours?.[0] ?? 540, 540);
        }
        if (start + stop.min > closing) {
          unscheduled.push(stop.name);
          continue;
        }
        time = start + stop.min;
        scheduled.push({
          id: stop.id,
          name: stop.name,
          day,
          start,
          end: time,
          drive_minutes: leg?.min ?? null,
          drive_estimated: Boolean(leg?.estimated),
          visit_minutes: stop.min,
          latitude: stop.lat,
          longitude: stop.lng,
        });
        previous = stop;
      }
    }
    return {
      stations: scheduled,
      unscheduled,
      visit_minutes: scheduled.reduce((sum, row) => sum + row.visit_minutes, 0),
      drive_minutes: scheduled.reduce((sum, row) => sum + (row.drive_minutes ?? 0), 0),
    };
  }

  function renderSummary(): void {
    if (!region || !days) return;
    pickers.forEach((picker) => picker.sync());
    const plan = scheduleTrip();
    const totalDays = Math.max(1, Number(days.value));
    if (activeEditDay && activeEditDay > totalDays) activeEditDay = totalDays;
    for (const d of Array.from(openDays)) {
      if (d > totalDays) openDays.delete(d);
    }
    const summaryStops = byId('summaryStops');
    if (summaryStops) {
      if (!plan.stations.length) {
        summaryStops.innerHTML =
          '<p class="summary-empty-state">أضف المحطات من الخريطة أعلاه لتنظيم جدول أيام رحلتك، ويمكنك فتح أي يوم أو سحب المحطات بين الأيام بحرية.</p>';
      } else {
        const byDay = new Map<number, typeof plan.stations>();
        for (const row of plan.stations) {
          const list = byDay.get(row.day) || [];
          list.push(row);
          byDay.set(row.day, list);
        }
        const activeDayNumbers = Array.from(byDay.keys()).sort((a, b) => a - b);
        const allDayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);
        const trashIconSvg = `<svg class="ic tiny summary-trash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
        if (activeEditDay && !byDay.has(activeEditDay)) activeEditDay = null;
        summaryStops.innerHTML = activeDayNumbers
          .map((dayNum) => {
            const dayStops = byDay.get(dayNum) || [];
            const isEditingDay = activeEditDay === dayNum;
            const isOpen = openDays.has(dayNum);
            const panelId = `summaryDayPanel-${dayNum}`;
            const daySpan = `<span class="summary-day-span"><bdi dir="ltr">${clock(dayStops[0].start)}–${clock(dayStops[dayStops.length - 1].end)}</bdi></span>`;
            const editBtn = `<button type="button" class="summary-day-edit-btn${isEditingDay ? ' is-active' : ''}" data-edit-day="${dayNum}" aria-pressed="${isEditingDay}" aria-label="تعديل اليوم ${formatNum(dayNum)}" title="تعديل محطات اليوم ${formatNum(dayNum)}">
              <svg class="ic tiny" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>`;

            const stopsHtml = dayStops
              .map((stop, idx) => {
                const driveBadge =
                  stop.drive_minutes && stop.drive_minutes > 0
                    ? `<span class="summary-stop-drive">${glyph('car', 'ic tiny')} ${formatNum(stop.drive_minutes)} د</span>`
                    : '';
                const quickMoveHtml =
                  activeEditDay !== null && totalDays > 1
                    ? `<div class="summary-stop-move-bar" aria-label="نقل إلى يوم">
                        ${allDayNumbers
                          .map(
                            (d) =>
                              `<button type="button" class="summary-move-day-pill${d === dayNum ? ' is-current' : ''}" data-move-stop="${stop.id}" data-target-day="${d}" ${d === dayNum ? 'disabled' : ''}>ي${formatNum(d)}</button>`
                          )
                          .join('')}
                      </div>`
                    : '';
                return `<article class="summary-stop-card" draggable="true" data-stop-id="${stop.id}" data-stop-day="${dayNum}">
                  <div class="summary-stop-top">
                    <span class="summary-drag-handle" aria-hidden="true" title="اسحب لنقل المحطة">
                      <svg viewBox="0 0 12 16" width="10" height="14" fill="currentColor"><circle cx="3" cy="3" r="1.3"/><circle cx="9" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="9" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="9" cy="13" r="1.3"/></svg>
                    </span>
                    <span class="summary-stop-index">${formatNum(idx + 1)}</span>
                    <strong class="summary-stop-name" title="${stop.name}">${stop.name}</strong>
                    <button type="button" class="summary-stop-remove" data-remove="${stop.id}" aria-label="حذف ${stop.name}" title="حذف المحطة">${trashIconSvg}</button>
                  </div>
                  <div class="summary-stop-meta">
                    <span class="summary-stop-time">${glyph('clock', 'ic tiny')} <bdi dir="ltr">${clock(stop.start)}–${clock(stop.end)}</bdi></span>
                    <span class="summary-stop-metrics">
                      <span class="summary-stop-dur">${formatNum(stop.visit_minutes)} د</span>
                      ${driveBadge}
                    </span>
                  </div>
                  ${quickMoveHtml}
                </article>`;
              })
              .join('');

            return `<section class="summary-day-card${isOpen ? ' is-open' : ''}${isEditingDay ? ' is-editing' : ''}" data-day="${dayNum}" aria-label="اليوم ${formatNum(dayNum)}">
              <div class="summary-day-head">
                <button type="button" class="summary-day-toggle" data-toggle-day="${dayNum}" aria-expanded="${isOpen}" aria-controls="${panelId}">
                  <span class="summary-day-pill">اليوم ${formatNum(dayNum)}</span>
                  <span class="summary-day-meta-inline">
                    <span class="summary-day-count">${formatNum(dayStops.length)} ${dayStops.length === 1 ? 'محطة' : 'محطات'}</span>
                    ${daySpan}
                  </span>
                  <svg class="ic tiny summary-day-chevron" aria-hidden="true"><use href="#i-chevron"/></svg>
                </button>
                ${editBtn}
              </div>
              <div id="${panelId}" class="summary-day-body" ${isOpen ? '' : 'hidden'}>
                <div class="summary-day-stops">${stopsHtml}</div>
              </div>
            </section>`;
          })
          .join('');
      }
    }
    const warning = byId('summaryWarning');
    const unscheduled = plan.unscheduled || [];
    if (warning) {
      warning.hidden = !unscheduled.length;
      warning.textContent = unscheduled.length
        ? `زِد أيام الرحلة أو خفّف المحطات. لم يتسع الجدول لـ${formatNum(unscheduled.length)}: ${unscheduled.join('، ')}.`
        : '';
    }
    const approveBtn = byId<HTMLButtonElement>('approveTrip');
    if (approveBtn) {
      approveBtn.disabled = !plan.stations.length || Boolean(approved) || Boolean(unscheduled.length);
      approveBtn.innerHTML = `${approved ? 'اعتُمدت الرحلة' : 'اعتمد رحلتي'} ${glyph('check')}`;
    }
    const downloadBtn = byId('downloadTripPdf');
    if (downloadBtn) downloadBtn.hidden = !approved;
    renderTodayTripPanel(plan);
  }

  // Collapsible day toggles + Drag-and-drop + day edit interactions (#summaryStops)
  const summaryStopsEl = byId('summaryStops');
  summaryStopsEl?.addEventListener(
    'dragstart',
    (event) => {
      const card = (event.target instanceof Element ? event.target : null)?.closest<HTMLElement>(
        '.summary-stop-card[data-stop-id]'
      );
      if (!card || !card.dataset.stopId) return;
      draggedStopId = card.dataset.stopId;
      card.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedStopId);
      }
    },
    { signal }
  );
  summaryStopsEl?.addEventListener(
    'dragover',
    (event) => {
      const dayCard = (event.target instanceof Element ? event.target : null)?.closest<HTMLElement>(
        '.summary-day-card[data-day]'
      );
      if (!dayCard) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      summaryStopsEl
        .querySelectorAll<HTMLElement>('.summary-day-card.is-drop-target')
        .forEach((el) => {
          if (el !== dayCard) el.classList.remove('is-drop-target');
        });
      dayCard.classList.add('is-drop-target');
    },
    { signal }
  );
  summaryStopsEl?.addEventListener(
    'dragleave',
    (event) => {
      const dayCard = (event.target instanceof Element ? event.target : null)?.closest<HTMLElement>(
        '.summary-day-card[data-day]'
      );
      if (!dayCard) return;
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (related && dayCard.contains(related)) return;
      dayCard.classList.remove('is-drop-target');
    },
    { signal }
  );
  summaryStopsEl?.addEventListener(
    'drop',
    (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const dayCard = targetEl?.closest<HTMLElement>('.summary-day-card[data-day]');
      if (!dayCard) return;
      event.preventDefault();
      dayCard.classList.remove('is-drop-target');
      const stopId = draggedStopId || event.dataTransfer?.getData('text/plain') || '';
      draggedStopId = null;
      const targetDay = Number(dayCard.dataset.day);
      if (!stopId || !targetDay) return;
      const overStopCard = targetEl?.closest<HTMLElement>('.summary-stop-card[data-stop-id]');
      moveStopToDay(stopId, targetDay, overStopCard?.dataset.stopId);
    },
    { signal }
  );
  summaryStopsEl?.addEventListener(
    'dragend',
    () => {
      draggedStopId = null;
      summaryStopsEl
        .querySelectorAll('.is-dragging, .is-drop-target')
        .forEach((el) => el.classList.remove('is-dragging', 'is-drop-target'));
    },
    { signal }
  );
  summaryStopsEl?.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const toggleBtn = target?.closest<HTMLElement>('[data-toggle-day]');
      if (toggleBtn?.dataset.toggleDay) {
        const d = Number(toggleBtn.dataset.toggleDay);
        if (openDays.has(d)) openDays.delete(d);
        else openDays.add(d);
        renderSummary();
        return;
      }
      const editBtn = target?.closest<HTMLElement>('[data-edit-day]');
      if (editBtn?.dataset.editDay) {
        const d = Number(editBtn.dataset.editDay);
        activeEditDay = activeEditDay === d ? null : d;
        if (activeEditDay) {
          snapshotCurrentDaysToManual();
          openDays.add(activeEditDay);
        }
        renderSummary();
        if (activeEditDay) {
          toast(`وضع تعديل اليوم ${formatNum(activeEditDay)} مفعّل — اسحب المحطات أو أضف من الخريطة.`);
        }
        return;
      }
      const moveBtn = target?.closest<HTMLElement>('[data-move-stop][data-target-day]');
      if (moveBtn?.dataset.moveStop && moveBtn.dataset.targetDay) {
        moveStopToDay(moveBtn.dataset.moveStop, Number(moveBtn.dataset.targetDay));
      }
    },
    { signal }
  );

  function renderTodayTripPanel(plan: ReturnType<typeof scheduleTrip>): void {
    const panel = byId('todayTripPanel');
    const nextBox = byId('todayNextStop');
    const timeline = byId('todayTimeline');
    if (!panel || !nextBox || !timeline) return;
    if (!choices.size || !plan.stations.length) {
      panel.hidden = true;
      nextBox.replaceChildren();
      timeline.replaceChildren();
      return;
    }
    panel.hidden = false;
    const remaining = plan.stations.filter((s) => !completedIds.has(s.id));
    const doneCount = plan.stations.length - remaining.length;
    const nextRow = remaining[0] || null;
    const nextStop = nextRow ? places.get(nextRow.id) : null;

    if (nextRow && nextStop) {
      const hoursStr = getHoursStatusLabel(nextStop);
      nextBox.innerHTML = `
        <div class="today-next-card">
          <div class="today-next-info">
            <span class="today-next-badge">المحطة التالية (${formatNum(doneCount + 1)} من ${formatNum(plan.stations.length)})</span>
            <strong>${nextRow.name}</strong>
            <p class="today-next-time"><bdi>${clock(nextRow.start)}–${clock(nextRow.end)}</bdi> · ${nextStop.operational?.walkingLabel || 'مشي خفيف'}</p>
            <small class="today-next-hours">${hoursStr}</small>
          </div>
          <div class="today-next-actions">
            <a class="btn btn-dark today-action-btn" href="https://www.google.com/maps/search/?api=1&query=${nextRow.latitude},${nextRow.longitude}" target="_blank" rel="noopener">افتح الاتجاهات</a>
            <button type="button" class="btn btn-soft today-action-btn" data-today-complete="${nextRow.id}">تمت الزيارة</button>
            <button type="button" class="btn btn-soft today-action-btn" data-today-focus="${nextRow.id}">اعرض على الخريطة</button>
          </div>
        </div>
      `;
    } else {
      nextBox.innerHTML = `
        <div class="today-next-card is-complete">
          <div class="today-next-info">
            <span class="today-next-badge">اكتملت الخطة</span>
            <strong>تمت زيارة جميع محطات خطتك (${formatNum(plan.stations.length)})</strong>
            <p class="today-next-time">يمكنك مراجعة الأماكن في الأسفل أو إعادة تعيين حالة الزيارة.</p>
          </div>
          <div class="today-next-actions">
            <button type="button" class="btn btn-soft today-action-btn" data-today-reset-done="1">إعادة ضبط حالة الزيارات</button>
          </div>
        </div>
      `;
    }

    timeline.innerHTML = plan.stations
      .map((row, idx) => {
        const isDone = completedIds.has(row.id);
        const isLocked = lockedIds.has(row.id);
        return `
        <div class="today-timeline-item${isDone ? ' is-done' : ''}${nextRow?.id === row.id ? ' is-next' : ''}">
          <span class="today-step-num">${formatNum(idx + 1)}</span>
          <div class="today-step-copy">
            <strong>${row.name}</strong>
            <span><bdi>${clock(row.start)}–${clock(row.end)}</bdi>${isLocked ? ' · <em class="today-tag-lock">مثبّتة</em>' : ''}${isDone ? ' · <em class="today-tag-done">تمت الزيارة</em>' : ''}</span>
          </div>
          <button type="button" class="today-step-toggle" data-today-complete="${row.id}" aria-pressed="${isDone}">
            ${isDone ? 'تمت ✓' : 'تمت الزيارة'}
          </button>
        </div>`;
      })
      .join('');
  }

  function toTimeInputValue(mins: number): string {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(mins)));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function parseTimeInputMinutes(val: string, fallback: number): number {
    const match = val.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function rebuildRoute(): void {
    if (!region || !days) return;
    byId('planner')?.setAttribute('data-trip-style', style);
    filterButtons.forEach((button) => {
      const active = button.dataset.style === style;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const activeId = chosen[station]?.id;
    const regionStops = stops.filter(
      (stop) => region.value === 'all' || region.value === stop.region
    );
    const filtered = regionStops.filter(
      (stop) => style === 'all' || stop.types.includes(style)
    );
    const candidates = filtered.length ? filtered : regionStops;
    const dayCount = Number(days.value);
    const limit =
      dayCount >= 7 || (dayCount >= 4 && region.value === 'all' && style === 'all')
        ? 15
        : Math.max(2, dayCount * 2);
    const prioritized = [...candidates].sort((a, b) => {
      const qa = a.operational?.qualifiedPlannable ? 0 : 1;
      const qb = b.operational?.qualifiedPlannable ? 0 : 1;
      return qa - qb;
    });
    const ordered =
      region.value === 'all' && dayCount <= 2 ? prioritized : nearbyOrder(prioritized);
    const suggested = ordered.slice(0, limit);
    const selectedInArea = candidates.filter((stop) => choices.has(stop.id));
    const timedInArea = (savedTiming?.stations || [])
      .map((row) => places.get(row.id)!)
      .filter((stop) => stop && candidates.includes(stop));
    chosen = routeDraft
      ? routeDraft.ids.map((id) => places.get(id)!).filter(Boolean)
      : [...new Set([...timedInArea, ...suggested, ...selectedInArea])];
    if (!routeDraft && viewedStopId && !chosen.some((stop) => stop.id === viewedStopId)) {
      const viewedStop = places.get(viewedStopId);
      if (viewedStop) chosen = [...chosen, viewedStop];
    }
    const tripDraftEl = byId('tripDraft');
    if (tripDraftEl) tripDraftEl.hidden = !routeDraft;
    const draftAssumptions = byId('draftAssumptions');
    if (draftAssumptions) draftAssumptions.hidden = !routeDraft;
    if (routeDraft) {
      const timing = routeDraft.timing;
      const draftMeta = byId('draftMeta');
      if (draftMeta) {
        draftMeta.textContent = `${seasons[timing.season].name} | ${formatNum(chosen.length)} ${chosen.length === 1 ? 'محطة' : 'محطات'} | ${clock(timing.stations[0]?.start ?? timing.start)} | توقيت السعودية`;
      }
      const visitDaySelect = byId<HTMLSelectElement>('draftVisitDay');
      const startTimeInput = byId<HTMLInputElement>('draftStartTime');
      const endTimeInput = byId<HTMLInputElement>('draftEndTime');
      if (visitDaySelect) {
        visitDaySelect.value =
          typeof timing.visitDay === 'number' ? String(timing.visitDay) : 'today';
      }
      if (startTimeInput) {
        startTimeInput.value = toTimeInputValue(timing.stations[0]?.start ?? timing.start ?? 540);
      }
      if (endTimeInput) {
        const defaultEnd =
          timing.returnByEnd ??
          Math.max(
            (timing.stations[0]?.start ?? 540) + 180,
            (timing.stations[timing.stations.length - 1]?.end ?? 1080) + 30
          );
        endTimeInput.value = toTimeInputValue(defaultEnd);
      }
    }
    station = -1;
    zoom = 1;
    terrainCenter = null;
    const filterNote = byId('routeFilterNote');
    if (filterNote) filterNote.hidden = Boolean(routeDraft) || filtered.length > 0;
    const routeDots = byId('routeDots');
    if (routeDots) {
      routeDots.innerHTML = chosen
        .map(
          (stop, i) => `
      <button type="button" data-station="${i}" aria-label="انتقل إلى ${stop.name}" title="${stop.name}"><svg class="ic station-dot-pin" aria-hidden="true"><use href="#i-pin"/></svg><span>${formatNum(i + 1)}</span></button>
    `
        )
        .join('');
    }
    renderMap();
    renderStation(Math.max(0, chosen.findIndex((stop) => stop.id === activeId)));
    syncStationControls();
    queueStationCycle();
    renderSummary();
  }

  function editTrip(rebuild = false, resetTiming = false): void {
    approved = null;
    if (routeDraft) {
      routeDraft = null;
      rebuild = true;
    }
    if (viewedStopId) {
      viewedStopId = null;
      rebuild = true;
    }
    if (
      savedTiming &&
      (resetTiming ||
        savedTiming.stations.length !== choices.size ||
        savedTiming.stations.some((row) => !choices.has(row.id)))
    ) {
      savedTiming = null;
      rebuild = true;
    }
    if (rebuild) rebuildRoute();
    else renderSummary();
    saveTrip();
  }

  async function downloadTripPdf(): Promise<void> {
    const trip = approved;
    const button = byId<HTMLButtonElement>('downloadTripPdf');
    if (!trip || !button || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const label = button.querySelector('span');
    if (label) label.textContent = 'جارٍ تجهيز الملف…';
    try {
      const file = await createTripPdf(trip, mapExtent);
      saveTripFile(file, 'albaha-trip.pdf');
    } catch (error) {
      console.error('Trip PDF export failed', error);
      toast('تعذّر تجهيز ملف الرحلة. جرّب التنزيل مرة ثانية.');
    } finally {
      if (!signal.aborted) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        if (label) label.textContent = 'نزّل مخطط الرحلة PDF';
      }
    }
  }

  byId('approveTrip')?.addEventListener(
    'click',
    () => {
      if (!region || !days) return;
      const plan = scheduleTrip();
      if (!plan.stations.length || plan.unscheduled?.length) return;
      approved = {
        schema_version: 1,
        status: 'approved',
        approved_at: new Date().toISOString(),
        region: region.value,
        region_name: region.selectedOptions[0]?.textContent || '',
        days: Number(days.value),
        style,
        style_name: typeLabels[style],
        season: savedTiming?.season ?? null,
        timezone: 'Asia/Riyadh',
        ...plan,
        stations: plan.stations.map(({ start, end, ...stop }) => ({
          ...stop,
          starts_at: clock(start),
          ends_at: clock(end),
        })),
      };
      const saved = saveTrip();
      renderSummary();
      toast(
        saved
          ? 'اعتُمدت رحلتك وحُفظت على هذا المتصفح.'
          : 'اعتُمدت رحلتك في هذه الجلسة. نزّل الخطة للاحتفاظ بها.'
      );
    },
    { signal }
  );

  byId('downloadTripPdf')?.addEventListener('click', () => void downloadTripPdf(), { signal });

  region.addEventListener('change', () => editTrip(true, true), { signal });
  days.addEventListener(
    'change',
    () => {
      hasManualDayEdits = false;
      manualDays.clear();
      activeEditDay = null;
      editTrip(true, true);
    },
    { signal }
  );
  filterButtons.forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        style = (button.dataset.style as TripStyle) || 'all';
        editTrip(true, true);
      },
      { signal }
    )
  );

  function goToSection(id: string): void {
    if (homeView?.hidden) navigatePortal(id === 'home' ? '/' : `/${id}`);
    else byId(id)?.scrollIntoView({ behavior: smooth });
  }

  function syncDockedMapStop(
    stop: StopBase,
    _isExploration: boolean,
    _customMessage?: string
  ): void {
    activeDockKind = 'none';
    conciergeRef?.setActiveStopContext(stop.id, stop.operational?.guideId || null);
    const agentPanel = byId<HTMLDialogElement>('agentPanel');
    if (!agentPanel?.open) {
      syncSingleAvatarPresence('floating');
    }
  }

  function toggleLockStop(stopId: string): boolean {
    const stop = places.get(stopId);
    if (!stop) return false;
    const pinned = !lockedIds.has(stopId);
    if (pinned) lockedIds.add(stopId);
    else lockedIds.delete(stopId);
    if (routeDraft) {
      routeDraft.timing.locked = pinned ? stopId : null;
      routeDraft.timing.lockedIds = [...lockedIds];
    } else if (savedTiming) {
      savedTiming.locked = pinned ? stopId : null;
      savedTiming.lockedIds = [...lockedIds];
    }
    saveTrip();
    renderMap();
    if (chosen[station]?.id === stopId) renderStation(station, true);
    toast(pinned ? `ثُبّتت محطة ${stop.name}.` : `أُلغي تثبيت ${stop.name}.`);
    return pinned;
  }

  function markStopVisited(stopId: string): void {
    const stop = places.get(stopId);
    if (!stop) return;
    const nowDone = !completedIds.has(stopId);
    if (nowDone) completedIds.add(stopId);
    else completedIds.delete(stopId);
    if (savedTiming) {
      savedTiming.completedIds = [...completedIds];
    }
    saveTrip();
    renderMap();
    if (chosen[station]?.id === stopId) renderStation(station, true);
    renderSummary();
    toast(nowDone ? `سُجّلت زيارة ${stop.name}.` : `أُلغي تعليم ${stop.name} كمكتملة.`);
  }

  function replanRemainingStops(): void {
    if (!choices.size) {
      toast('أضف محطات إلى رحلتك أولًا ليتم ترتيب المتبقي منها.');
      return;
    }
    const remainingIds = [...choices].filter((id) => !completedIds.has(id));
    if (!remainingIds.length) {
      toast('تمت زيارة جميع المحطات المحفوظة بالفعل.');
      return;
    }
    const nowInfo = getRiyadhNowInfo();
    const lastDoneId = [...completedIds].reverse().find((id) => places.has(id));
    const originStop = lastDoneId ? places.get(lastDoneId) : places.get(remainingIds[0]);
    const currentPlan = scheduleTrip();
    const doneRows = currentPlan.stations
      .filter((s) => completedIds.has(s.id))
      .map((s) => ({
        id: s.id,
        day: s.day,
        start: s.start,
        end: s.end,
        drive_minutes: s.drive_minutes,
        drive_estimated: s.drive_estimated,
        completed: true,
        locked: lockedIds.has(s.id),
      }));
    const lastDoneEnd = doneRows[doneRows.length - 1]?.end ?? 0;
    const candidateStart = Math.max(9 * 60, Math.min(16 * 60, nowInfo.minute + 10, lastDoneEnd ? lastDoneEnd + 15 : nowInfo.minute + 10));
    const built = buildConstraintPlan({
      days: Number(days?.value || 1),
      region: 'all',
      style,
      season: currentSeason,
      month: nowInfo.month,
      start: candidateStart,
      budget: Math.max(180, 19 * 60 - candidateStart),
      returnByEnd: 19 * 60 + 30,
      startPointLabel: originStop?.name || 'مدينة الباحة',
      visitDay: nowInfo.dayOfWeek,
      withChildren: style === 'family',
      lessWalking: Boolean(savedTiming?.lessWalking),
      indoorOnly: false,
      includeIds: remainingIds,
      lockedIds: [...lockedIds],
      completedIds: [...completedIds],
      originCoords: originStop ? { lat: originStop.lat, lng: originStop.lng } : null,
    });
    const remainingRows = built.plan.timing.stations.filter((s) => remainingIds.includes(s.id));
    const fallbackRemaining = remainingIds
      .filter((id) => !remainingRows.some((r) => r.id === id))
      .map((id, i) => {
        const stop = places.get(id)!;
        const start = candidateStart + i * 75;
        return {
          id,
          day: 1,
          start,
          end: start + (stop?.min || 60),
          drive_minutes: 15,
          drive_estimated: true,
          locked: lockedIds.has(id),
          completed: false,
        };
      });
    const mergedStations = [...doneRows, ...(remainingRows.length ? remainingRows : fallbackRemaining)];
    savedTiming = {
      ...(savedTiming || built.plan.timing),
      season: currentSeason,
      start: mergedStations[0]?.start ?? candidateStart,
      limit: Math.max(180, 19 * 60 - candidateStart),
      locked: [...lockedIds][0] || null,
      lockedIds: [...lockedIds],
      completedIds: [...completedIds],
      stations: mergedStations,
    };
    approved = null;
    editTrip(true);
    toast(`أُعيد ترتيب ${formatNum(remainingIds.length)} محطات متبقية من أقرب مسار.`);
  }

  async function focusStopFromConcierge(
    stopId: string,
    opts?: { message?: string; isExploration?: boolean }
  ): Promise<void> {
    const stop = places.get(stopId);
    if (!stop) return;
    activeDockKind = 'none';
    const agentDialog = byId<HTMLDialogElement>('agentPanel');
    if (agentDialog?.open && window.innerWidth <= 768) {
      agentDialog.close();
      document.documentElement.classList.remove('has-dialog');
      document.documentElement.classList.remove('has-smart-guide');
    }

    if (homeView?.hidden) {
      navigatePortal('/planner');
    }

    const savedHasStop = choices.has(stopId);
    const isExploration = opts?.isExploration ?? (!routeDraft && !savedHasStop);

    if (!chosen.some((s) => s.id === stopId)) {
      if (!routeDraft) {
        viewedStopId = stopId;
        rebuildRoute();
      }
    } else if (isExploration && !savedHasStop) {
      viewedStopId = stopId;
    }

    byId('planner')?.scrollIntoView({ behavior: getReducedBehavior(), block: 'start' });
    await waitForMapReady({ mapPanel, streetMapActive, liveMap, signal });
    if (signal.aborted) return;

    const idx = chosen.findIndex((s) => s.id === stopId);
    isDockingFromConcierge = true;
    try {
      if (idx >= 0) {
        goToStation(idx, getReducedBehavior(), false);
      }
    } finally {
      isDockingFromConcierge = false;
    }

    syncDockedMapStop(stop, isExploration, opts?.message);
    highlightResultCard(stationCard);
    byId('stopTitle')?.focus({ preventScroll: true });
  }

  function mountPendingGuideDock(currentPath: string): void {
    if (!pendingGuideDock || currentPath !== `/guide/place/${pendingGuideDock.guideId}`) return;
    const { guideId, name, message, missingCoordinates } = pendingGuideDock;
    renderGuideDock(
      {
        guideId,
        name,
        message,
        missingCoordinates,
        onResume: () => {
          pendingGuideDock = null;
          activeDockKind = 'none';
          conciergeRef?.setActiveStopContext(null, guideId);
          openPanel('agent');
        },
        onRetry: () => {
          pendingGuideDock = null;
          activeDockKind = 'none';
          conciergeRef?.setActiveStopContext(null, guideId);
          openPanel('agent');
        },
        onDismiss: () => {
          pendingGuideDock = null;
          activeDockKind = 'none';
        },
      },
      signal
    );
  }

  function dockAtGuidePlace(
    guideId: string,
    opts?: { missingCoordinates?: boolean; message?: string }
  ): void {
    const rec = getGlobalGuideData().find((r) => r.id === guideId);
    if (!rec) return;
    activeDockKind = 'guide';
    const agentDialog = byId<HTMLDialogElement>('agentPanel');
    if (agentDialog?.open) agentDialog.close();
    document.documentElement.classList.remove('has-dialog');

    conciergeRef?.setActiveStopContext(null, guideId);
    const msg =
      opts?.message ||
      (opts?.missingCoordinates
        ? `المكان «${rec.name}» غير مربوط بإحداثيات معتمدة على الخريطة؛ نعرض بطاقته في الدليل السياحي.`
        : `تستكشف الآن «${rec.name}» في الدليل السياحي.`);

    pendingGuideDock = {
      guideId,
      name: rec.name,
      message: msg,
      missingCoordinates: Boolean(opts?.missingCoordinates),
    };

    const targetPath = `/guide/place/${guideId}`;
    if (window.location.pathname !== targetPath) navigatePortal(targetPath);
    else mountPendingGuideDock(targetPath);

    window.requestAnimationFrame(() => {
      if (signal.aborted) return;
      mountPendingGuideDock(window.location.pathname);
    });
  }

  function getActivePageContext() {
    const h = window.location.pathname;
    const placeId = h.startsWith('/place/') ? h.slice(7) : subpageViews.getActivePlace()?.id || null;
    const guidePlaceId = h.startsWith('/guide/place/') ? h.slice(13) : null;
    return {
      placeId,
      guidePlaceId,
      activeStopId: chosen[station]?.id || null,
      lockedIds: [...lockedIds],
      completedIds: [...completedIds],
    };
  }

  function selectDestination(id: string): void {
    activeDockKind = 'none';
    syncSingleAvatarPresence('floating');
    conciergeRef?.bumpRequestSeq();
    document.querySelector<HTMLDialogElement>('dialog[open]')?.close();
    document.documentElement.classList.remove('has-dialog');
    if (homeView?.hidden) {
      navigatePortal(`/route/${id}`);
      return;
    }
    if (routeDraft && !chosen.some((stop) => stop.id === id)) {
      routeDraft = null;
      viewedStopId = null;
      rebuildRoute();
    }
    if (!chosen.some((stop) => stop.id === id)) {
      viewedStopId = id;
      rebuildRoute();
    }
    window.requestAnimationFrame(() => {
      if (signal.aborted) return;
      byId('stopTitle')?.focus({ preventScroll: true });
      goToStation(
        chosen.findIndex((stop) => stop.id === id),
        'instant',
        true
      );
    });
  }

  let toggleStopFn: (stop: StopBase) => void = () => {};

  // Subpage views & Tour Guide controllers
  const subpageViews = createSubpageViewsController({
    signal,
    getCurrentSeason: () => currentSeason,
    getSelectedSeason: () => selectedSeason,
    getChoices: () => choices,
    getRouteDraft: () => routeDraft,
    getSavedTiming: () => savedTiming,
    toggleStop: (stop) => toggleStopFn(stop),
  });

  const tourGuideController = createTourGuideController({
    signal,
    getChoices: () => choices,
    getLastPath: () => lastPath,
    getScrollBehavior: getReducedBehavior,
    toggleStop: (stop) => toggleStopFn(stop),
  });

  toggleStopFn = (stop: StopBase) => {
    if (choices.has(stop.id)) {
      choices.delete(stop.id);
      manualDays.delete(stop.id);
      manualOrder = manualOrder.filter((id) => id !== stop.id);
      toast(`أُزيلت ${stop.name} من الرحلة.`);
    } else {
      choices.add(stop.id);
      if (activeEditDay) {
        snapshotCurrentDaysToManual();
        const totalDays = Math.max(1, Number(days?.value || 1));
        const targetDay = Math.min(totalDays, activeEditDay);
        manualDays.set(stop.id, targetDay);
        if (!manualOrder.includes(stop.id)) manualOrder.push(stop.id);
        openDays.add(targetDay);
        toast(`أُضيفت ${stop.name} إلى اليوم ${formatNum(targetDay)}.`);
      } else if (hasManualDayEdits) {
        const totalDays = Math.max(1, Number(days?.value || 1));
        const targetDay = assignDefaultDayForStop(stop.id, totalDays);
        manualDays.set(stop.id, targetDay);
        if (!manualOrder.includes(stop.id)) manualOrder.push(stop.id);
        toast(`أُضيفت ${stop.name} إلى اليوم ${formatNum(targetDay)}.`);
      } else {
        toast(`أُضيفت ${stop.name} إلى رحلتك.`);
      }
    }
    editTrip();
    renderAddButton();
    subpageViews.renderPlaceAction();
    tourGuideController.updateTourGuideTrip();
  };

  // Smart Guide controller
  const concierge = createSmartGuideUiController({
    signal,
    getCurrentSeason: () => currentSeason,
    scheduleTrip,
    getGuideRecords: getGlobalGuideData,
    getState: () => ({
      choices,
      approved: Boolean(approved),
      region: region.value,
      days: days.value,
      style,
      savedTiming,
      routeDraft,
      lockedIds: [...lockedIds],
      completedIds: [...completedIds],
      activeStopId: chosen[station]?.id || null,
    }),
    getActivePageContext,
    applySavedPlan: (plan: TripPlan) => {
      routeDraft = null;
      savedTiming = plan.timing ?? null;
      if (plan.timing?.lockedIds?.length) {
        plan.timing.lockedIds.forEach((id) => lockedIds.add(id));
      }
      region.value = plan.region;
      days.value = plan.days;
      style = plan.style;
      choices = new Set(plan.ids);
      editTrip(true);
      subpageViews.renderPlaceAction();
      tourGuideController.updateTourGuideTrip();
    },
    setRouteDraft: (plan: TripPlan | null) => {
      if (routeDraft === plan) return;
      routeDraft = plan;
      viewedStopId = null;
      rebuildRoute();
    },
    toggleStop: toggleStopFn,
    goToSection,
    selectDestination,
    focusStopFromConcierge,
    dockAtGuidePlace,
    toggleLockStop,
    markStopVisited,
    onModeBadgeChange: () => {
      /* Badge intentionally omitted for clean editorial header */
    },
    openPanel,
    closePanel: () => (byId('agentPanel') as HTMLDialogElement | null)?.close(),
    downloadTripPdf: () => void downloadTripPdf(),
    hasTourGuidePlace: (id: string) => tourGuideController.hasPlace(id),
    openGuideFilter: (opts) => tourGuideController.openFiltered(opts),
    openFaq: (faqId) => {
      navigatePortal(faqId ? `/faq/${faqId}` : '/faq');
    },
  });
  conciergeRef = concierge;

  byId('addStop')?.addEventListener(
    'click',
    () => {
      if (routeDraft) {
        byId('draftApply')?.click();
      } else if (chosen[station]) {
        toggleStopFn(chosen[station]);
      }
    },
    { signal }
  );

  byId('draftPreviewUpdate')?.addEventListener(
    'click',
    () => {
      if (!routeDraft) return;
      const visitDayVal = byId<HTMLSelectElement>('draftVisitDay')?.value || 'today';
      const nowInfo = getRiyadhNowInfo();
      const visitDay = visitDayVal === 'today' ? nowInfo.dayOfWeek : Number(visitDayVal);
      const startMin = parseTimeInputMinutes(
        byId<HTMLInputElement>('draftStartTime')?.value || '09:00',
        routeDraft.timing.start || 540
      );
      const endMin = parseTimeInputMinutes(
        byId<HTMLInputElement>('draftEndTime')?.value || '18:00',
        Math.max(startMin + 120, 1080)
      );
      const budget = Math.max(90, endMin - startMin);
      const rebuilt = buildConstraintPlan({
        days: Number(routeDraft.days) || 1,
        region: routeDraft.region || 'all',
        style: routeDraft.style,
        season: routeDraft.timing.season || currentSeason,
        month: routeDraft.timing.month,
        start: startMin,
        budget,
        returnByEnd: endMin,
        startPointLabel: routeDraft.timing.startPoint || 'مدينة الباحة',
        visitDay,
        withChildren: routeDraft.style === 'family',
        lessWalking: Boolean(routeDraft.timing.lessWalking),
        indoorOnly: false,
        includeIds: routeDraft.ids,
        lockedIds: [...lockedIds],
        completedIds: [...completedIds],
      });
      routeDraft = rebuilt.plan;
      conciergeRef?.bumpRequestSeq();
      rebuildRoute();
      toast('حُدّثت معاينة الجدول حسب الوقت واليوم دون تغيير خطتك المحفوظة.');
    },
    { signal }
  );

  byId('todayReplanBtn')?.addEventListener('click', replanRemainingStops, { signal });

  byId('todayTripPanel')?.addEventListener(
    'click',
    (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const completeBtn = targetEl?.closest<HTMLElement>('[data-today-complete]');
      if (completeBtn?.dataset.todayComplete) {
        markStopVisited(completeBtn.dataset.todayComplete);
        return;
      }
      const focusBtn = targetEl?.closest<HTMLElement>('[data-today-focus]');
      if (focusBtn?.dataset.todayFocus) {
        void focusStopFromConcierge(focusBtn.dataset.todayFocus, {
          isExploration: false,
          message: `المحطة التالية في رحلتك اليوم: ${places.get(focusBtn.dataset.todayFocus)?.name || ''}.`,
        });
        return;
      }
      const resetDoneBtn = targetEl?.closest<HTMLElement>('[data-today-reset-done]');
      if (resetDoneBtn) {
        completedIds.clear();
        if (savedTiming) savedTiming.completedIds = [];
        saveTrip();
        renderMap();
        renderSummary();
        toast('أُعيد ضبط حالة الزيارات لرحلتك.');
      }
    },
    { signal }
  );

  byId('mapPins')?.addEventListener(
    'keydown',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.matches('[data-station]') && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        selectStationByUser(Number((target as HTMLElement).dataset.station));
      }
    },
    { signal }
  );

  document.addEventListener(
    'click',
    (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const target = targetEl?.closest<HTMLElement>(
        '[data-station], [data-destination], [data-remove], [data-guide-topic], [data-guide-place], [data-faq-jump]'
      );
      if (!target) return;
      if (target.hasAttribute('data-faq-jump')) {
        (byId('searchPanel') as HTMLDialogElement | null)?.close();
        document.documentElement.classList.remove('has-dialog');
        const faqId = target.dataset.faqJump || '';
        navigatePortal(faqId ? `/faq/${faqId}` : '/faq');
      } else if (target.hasAttribute('data-guide-place')) {
        (byId('searchPanel') as HTMLDialogElement | null)?.close();
        document.documentElement.classList.remove('has-dialog');
        navigatePortal(`/guide/place/${target.dataset.guidePlace}`);
      } else if (target.hasAttribute('data-guide-topic')) {
        (byId('searchPanel') as HTMLDialogElement | null)?.close();
        document.documentElement.classList.remove('has-dialog');
        if (target.dataset.guideTopic) goToSection(target.dataset.guideTopic);
      } else if (target.hasAttribute('data-station')) {
        conciergeRef?.bumpRequestSeq();
        selectStationByUser(Number(target.dataset.station));
      } else if (target.hasAttribute('data-remove')) {
        const removedId = target.dataset.remove;
        if (removedId) {
          choices.delete(removedId);
          manualDays.delete(removedId);
          manualOrder = manualOrder.filter((id) => id !== removedId);
          lockedIds.delete(removedId);
          completedIds.delete(removedId);
        }
        editTrip();
        renderAddButton();
      } else if (target.dataset.destination) {
        selectDestination(target.dataset.destination);
      }
    },
    { signal }
  );

  byId('seasonSwitch')?.addEventListener(
    'click',
    (event) => {
      const button = (event.target instanceof Element ? event.target : null)?.closest<HTMLElement>(
        '[data-season]'
      );
      if (button?.dataset.season) renderSeason(button.dataset.season as SeasonKey);
    },
    { signal }
  );
  byId('seasonRegions')?.addEventListener(
    'click',
    (event) => {
      const button = (event.target instanceof Element ? event.target : null)?.closest<HTMLElement>(
        '[data-season-region]'
      );
      if (!button) return;
      seasonRegion = button.dataset.seasonRegion || null;
      renderSeason(selectedSeason);
    },
    { signal }
  );

  document.addEventListener(
    'click',
    (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const askButton = targetEl?.closest<HTMLElement>('[data-concierge-ask]');
      if (askButton) {
        const prompt = askButton.dataset.conciergeAsk?.trim();
        if (prompt) {
          openPanel('agent');
          void concierge.askConcierge({ text: prompt }, prompt);
        }
        return;
      }
      const button = targetEl?.closest<HTMLElement>('[data-weather-plan], [data-demo-rain]');
      if (!button) return;
      openPanel('agent');
      if (button.hasAttribute('data-demo-rain')) {
        void concierge.askConcierge(
          { intent: 'rain-demo', city: 'makhwah', id: 'ain' },
          'جرّب سيناريو المطر في ذي عين'
        );
      } else {
        void concierge.askConcierge(
          { intent: 'weather-plan', city: button.dataset.weatherPlan, id: button.dataset.visitId },
          'خطّط حسب الأجواء'
        );
      }
    },
    { signal }
  );

  if (typeof IntersectionObserver !== 'undefined') {
    const stickyEl = byId('routeSticky');
    if (stickyEl) {
      const stationWeatherObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && chosen[station]) showRouteWeather(chosen[station]);
        },
        { rootMargin: '120px' }
      );
      stationWeatherObserver.observe(stickyEl);
      signal.addEventListener('abort', () => stationWeatherObserver.disconnect(), { once: true });
    }
  }

  renderSeason(currentSeason);
  const seasonEl = byId('visit-season');
  if ('IntersectionObserver' in window && seasonEl) {
    const seasonObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        seasonInView = true;
        seasonObserver.disconnect();
        void showSeasonWeather(seasonRegion ?? seasons[selectedSeason].city);
      },
      { rootMargin: '120px' }
    );
    seasonObserver.observe(seasonEl);
    signal.addEventListener('abort', () => seasonObserver.disconnect(), { once: true });
  } else {
    seasonInView = true;
    void showSeasonWeather(seasons[selectedSeason].city);
  }

  // Header scroll, active tab tracking & Siraj docking
  function syncHeaderActiveNav(): void {
    const navLinks = qsAll<HTMLAnchorElement>('#header .nav-links a');
    if (!navLinks.length) return;
    let activeHref: string | null = '/';

    if (investView && !investView.hidden) {
      activeHref = '/invest';
    } else if (tourGuideView && !tourGuideView.hidden) {
      activeHref = '/guide';
    } else if (placeView && !placeView.hidden) {
      activeHref = '/destinations';
    } else if ((faqView && !faqView.hidden) || (supportView && !supportView.hidden)) {
      activeHref = null;
    } else if (homeView && !homeView.hidden) {
      const headerLine = 160;
      const expRect = byId('experiences')?.getBoundingClientRect();
      const destRect = byId('destinations')?.getBoundingClientRect();
      const dirRect = byId('destination-directory')?.getBoundingClientRect();
      const plannerRect = byId('planner')?.getBoundingClientRect();
      const destGroupBottom = Math.max(
        destRect?.bottom ?? -Infinity,
        plannerRect?.bottom ?? -Infinity,
        dirRect?.bottom ?? -Infinity
      );

      if (destRect && destRect.top <= headerLine && destGroupBottom > headerLine) {
        activeHref = '/destinations';
      } else if (expRect && expRect.top <= headerLine && (!destRect || destRect.top > headerLine)) {
        activeHref = '/experiences';
      } else {
        activeHref = '/';
      }
    }

    navLinks.forEach((link) => {
      const isMatch = Boolean(activeHref && link.getAttribute('href') === activeHref);
      if (isMatch) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function syncHeaderState(): void {
    if (!header) return;
    const visible = true;
    if (header.inert === visible) {
      header.inert = !visible;
      header.classList.toggle('visible', visible);
    }
    header.classList.toggle('is-scrolled', window.scrollY > 40);
    syncHeaderActiveNav();
    syncSirajPosition();
  }

  function scheduleScroll(): void {
    if (scrollFrame || signal.aborted) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      syncHeaderState();
    });
  }

  syncHeaderState();
  window.addEventListener('scroll', scheduleScroll, { passive: true, signal });

  function syncPage(restoreHomeScroll = false): void {
    const path = window.location.pathname;
    const place = path.startsWith('/place/') ? places.get(path.slice(7)) : null;
    const storySection =
      path === '/city/baha/stories' || path.startsWith('/city/baha/stories/');
    const cityKey = storySection ? 'baha' : path.slice(6);
    const city =
      path.startsWith('/city/') && Object.hasOwn(climateCities, cityKey) ? cityKey : null;
    const routeId = path.startsWith('/route/') ? path.slice(7) : null;
    const guideRoute = path === '/guide' || path.startsWith('/guide/place/');
    const faqRoute = path === '/faq' || path.startsWith('/faq/');
    const investRoute =
      path === '/invest' || path.startsWith('/invest/');
    const supportRoute = Boolean(supportView && path === `/${initialView}`);
    const sectionId = portalSectionId(path);
    const returning = Boolean(homeView?.hidden);
    const smoothDevelopmentScroll =
      !restoreHomeScroll && sectionId === 'official-portal' && investView && !investView.hidden;

    if ((place || city || guideRoute || faqRoute || investRoute || supportRoute) && !returning) {
      homePath = lastPath;
      homeScroll = window.scrollY;
    }

    qsAll<HTMLElement>('[data-tour-guide-nav]').forEach((link) => {
      if (guideRoute) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    qsAll<HTMLElement>('a[href="/faq"]').forEach((link) => {
      if (faqRoute) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    qsAll<HTMLElement>('a[href="/invest"]').forEach((link) => {
      if (investRoute) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (supportView) supportView.hidden = !supportRoute;

    if (investRoute || supportRoute) {
      tourGuideController.cleanupView();
      subpageViews.clearActivePlace();
      subpageViews.cleanupView();
      if (homeView) homeView.hidden = true;
      if (placeView) placeView.hidden = true;
      if (tourGuideView) tourGuideView.hidden = true;
      if (faqView) faqView.hidden = true;
      if (investView) investView.hidden = !investRoute;
      document.title = investRoute ? 'الاستثمار في منطقة الباحة | بوابة منطقة الباحة' : initialTitle;
      window.requestAnimationFrame(() => {
        if (signal.aborted) return;
        window.scrollTo({ top: 0, behavior: 'instant' });
        byId(investRoute ? 'investTitle' : 'supportRequestTitle')?.focus({ preventScroll: true });
      });
    } else if (faqRoute) {
      tourGuideController.cleanupView();
      subpageViews.clearActivePlace();
      subpageViews.cleanupView();
      if (homeView) homeView.hidden = true;
      if (placeView) placeView.hidden = true;
      if (tourGuideView) tourGuideView.hidden = true;
      if (investView) investView.hidden = true;
      if (faqView) faqView.hidden = false;
      document.title = 'الأسئلة الشائعة | بوابة منطقة الباحة';
      const targetFaqId = path.startsWith('/faq/') ? path.slice(5) : '';
      window.requestAnimationFrame(() => {
        if (signal.aborted) return;
        const faqEl = targetFaqId ? byId(targetFaqId) : null;
        if (faqEl) {
          const trigger = faqEl.querySelector<HTMLButtonElement>('.faq-trigger');
          if (trigger && trigger.getAttribute('aria-expanded') !== 'true') {
            trigger.click();
          }
          faqEl.scrollIntoView({ behavior: getReducedBehavior(), block: 'start' });
          trigger?.focus({ preventScroll: true });
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' });
          byId('faqTitle')?.focus({ preventScroll: true });
        }
      });
    } else if (guideRoute) {
      subpageViews.clearActivePlace();
      subpageViews.cleanupView();
      if (homeView) homeView.hidden = true;
      if (placeView) placeView.hidden = true;
      if (faqView) faqView.hidden = true;
      if (investView) investView.hidden = true;
      tourGuideController.showTourGuide(
        path === '/guide' ? undefined : path.slice(13) || 'missing'
      );
      mountPendingGuideDock(path);
    } else if (place || city) {
      tourGuideController.cleanupView();
      if (tourGuideView) tourGuideView.hidden = true;
      if (faqView) faqView.hidden = true;
      if (investView) investView.hidden = true;
      if (place) subpageViews.showPlace(place);
      else if (city) {
        subpageViews.showCity(
          city,
          storySection ? path.slice('/city/baha/stories/'.length) : null
        );
      }
    } else if (returning || (routeId && places.has(routeId))) {
      tourGuideController.cleanupView();
      subpageViews.cleanupView();
      if (tourGuideView) tourGuideView.hidden = true;
      if (faqView) faqView.hidden = true;
      if (investView) investView.hidden = true;
      subpageViews.clearActivePlace();
      if (homeView) homeView.hidden = false;
      if (placeView) placeView.hidden = true;
      document.title = PORTAL_HOME_TITLE;
      window.requestAnimationFrame(() => {
        if (signal.aborted) return;
        if (streetMapActive && liveMap) liveMap.map.resize();
        updateViewport();
        queueStationCycle();
        measureCarousel();
        if (routeId && places.has(routeId)) {
          selectDestination(routeId);
        } else if (restoreHomeScroll && path === homePath) {
          window.scrollTo({ top: homeScroll, behavior: 'instant' });
        } else if (sectionId) {
          byId(sectionId)?.scrollIntoView({
            behavior: smoothDevelopmentScroll ? getReducedBehavior() : 'instant',
          });
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }
        scheduleScroll();
      });
    } else if (sectionId) {
      byId(sectionId)?.scrollIntoView({ behavior: getReducedBehavior(), block: 'start' });
    } else if (path === '/' && !restoreHomeScroll && !window.location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (!guideRoute && activeDockKind === 'guide') {
      activeDockKind = 'none';
      pendingGuideDock = null;
      syncSingleAvatarPresence('floating');
    }

    lastPath = path;
    syncHeaderActiveNav();
    scheduleScroll();
  }

  document.querySelector('.skip-link')?.addEventListener(
    'click',
    (event) => {
      if (supportView && !supportView.hidden) {
        event.preventDefault();
        byId('supportRequestTitle')?.focus();
        return;
      }
      const title =
        investView && !investView.hidden
          ? byId('investTitle')
          : faqView && !faqView.hidden
            ? byId('faqTitle')
            : tourGuideView?.hidden
              ? byId('placeTitle')
              : byId('tourGuideTitle');
      if (
        !title ||
        (tourGuideView?.hidden && placeView?.hidden && faqView?.hidden && investView?.hidden)
      ) {
        event.preventDefault();
        byId('content')?.focus();
        return;
      }
      event.preventDefault();
      title.focus();
    },
    { signal }
  );
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey) return;
      const element = event.target instanceof Element ? event.target : null;
      const anchor = element?.closest<HTMLAnchorElement>('a[href^="/"]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const target = new URL(anchor.href);
      if (target.origin !== window.location.origin || !isPortalPath(target.pathname)) return;
      event.preventDefault();
      navigatePortal(target.href);
    },
    { signal }
  );
  window.addEventListener(portalNavigationEvent, () => syncPage(), { signal });
  window.addEventListener('popstate', () => {
    canonicalizeLegacyPortalLink();
    syncPage(true);
  }, { signal });
  window.addEventListener('hashchange', () => {
    if (canonicalizeLegacyPortalLink()) syncPage();
  }, { signal });

  // KPI counters & Scroll reveal entrances
  const kpiRafs = new Set<number>();
  function animateKpiCounter(bdi: HTMLElement): void {
    if (!bdi || bdi.dataset.kpiCounted === '1') return;
    const raw = (bdi.dataset.kpiOriginal || bdi.textContent || '').trim();
    const match = raw.match(/^([\d,]+(?:\.\d+)?)\s*(M\+?|K\+?|%|\+)?$/i);
    if (!match) return;
    bdi.dataset.kpiOriginal = raw;
    bdi.dataset.kpiCounted = '1';
    if (!motionAllowed()) return;
    const numStr = match[1].replace(/,/g, '');
    const targetVal = parseFloat(numStr);
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
    const useCommas = match[1].includes(',');
    const suffix = match[2] || '';
    const dur = 1100;
    const start = performance.now();
    const tick = (now: number) => {
      if (signal.aborted) return;
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3.2);
      const current = targetVal * eased;
      let formatted = decimals > 0 ? current.toFixed(decimals) : String(Math.round(current));
      if (useCommas) {
        const parts = formatted.split('.');
        parts[0] = Number(parts[0]).toLocaleString('en-US');
        formatted = parts.join('.');
      }
      bdi.textContent = p >= 1 ? raw : formatted + suffix;
      if (p < 1) {
        const id = window.requestAnimationFrame(tick);
        kpiRafs.add(id);
      }
    };
    const id = window.requestAnimationFrame(tick);
    kpiRafs.add(id);
  }

  for (const disclosure of qsAll<HTMLDetailsElement>('.official-disclosure')) {
    disclosure.addEventListener(
      'toggle',
      () => {
        if (!disclosure.open) return;
        disclosure.querySelectorAll<HTMLElement>('.kpi-num bdi').forEach(animateKpiCounter);
      },
      { signal }
    );
  }

  function observeEntrances(): void {
    if (!supportsMotion || isMotionPaused() || !('IntersectionObserver' in window)) return;
    const pending = new Set<HTMLElement>(
      qsAll<HTMLElement>(
        '.reveal, .destination-area, .season-card, .app-phone, .kpi-card, .official-disclosure, .guide-card, .experience'
      )
    );
    const groups = new Map<HTMLElement, HTMLElement>();
    const headings = qsAll<HTMLElement>(
      '.section-top, .intro-copy, .story-text, .guide-heading, .planner-heading, .season-intro, .cta-grid, .app-promo-copy'
    );
    for (const group of headings) {
      pending.delete(group);
      const parts = group.querySelectorAll<HTMLElement>(
        '.caption, h2, h3, .lead, .action-row, .caro-btns, .season-switch, .season-cities, .app-promo-tagline, .app-store-links'
      );
      for (const part of Array.from(parts)) {
        pending.add(part);
        groups.set(part, group);
      }
    }

    const playing = new Map<HTMLElement, Animation>();
    function finish(target: HTMLElement): void {
      observer.unobserve(target);
      pending.delete(target);
      playing.delete(target);
      delete target.dataset.entrancePending;
      if (target.classList.contains('kpi-card')) {
        target.querySelectorAll<HTMLElement>('.kpi-num bdi').forEach(animateKpiCounter);
      }
    }

    function revealTarget(target: HTMLElement, step = 0): void {
      if (!pending.has(target) || playing.has(target)) return;
      if (target.contains(document.activeElement) || !motionAllowed()) {
        finish(target);
        return;
      }
      const [animation] = enterMotion([target], {
        delay: Math.min(step, 5) * 90,
        duration: 760,
      });
      delete target.dataset.entrancePending;
      if (!animation) {
        finish(target);
        return;
      }
      playing.set(target, animation);
      if (target.classList.contains('kpi-card')) {
        target.querySelectorAll<HTMLElement>('.kpi-num bdi').forEach(animateKpiCounter);
      }
      animation.onfinish = () => finish(target);
      animation.oncancel = () => finish(target);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const delays = new Map<Element | null, number>();
        const ordered = entries
          .slice()
          .sort((a, b) =>
            a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
          );
        for (const { target, isIntersecting } of ordered) {
          const el = target as HTMLElement;
          if (!pending.has(el) || !isIntersecting) continue;
          const group = groups.get(el) || el.closest('section') || el.parentElement;
          const step = delays.get(group) || 0;
          delays.set(group, step + 1);
          revealTarget(el, step);
        }
      },
      { threshold: 0.04, rootMargin: '0px 0px -18px 0px' }
    );

    for (const target of pending) {
      const rect = target.getBoundingClientRect();
      if (rect.height > 0 && rect.top < window.innerHeight * 0.96) {
        revealTarget(target, 0);
      } else {
        target.dataset.entrancePending = '';
        observer.observe(target);
      }
    }

    document.addEventListener(
      'focusin',
      (event) => {
        const targetEl = event.target instanceof Node ? event.target : null;
        for (const target of pending) {
          if (targetEl && target.contains(targetEl)) finish(target);
        }
      },
      { signal }
    );
    window.addEventListener(
      'scroll',
      () => {
        let step = 0;
        for (const target of [...pending]) {
          const rect = target.getBoundingClientRect();
          if (rect.height > 0 && rect.top < window.innerHeight * 1.02) {
            revealTarget(target, step++);
          }
        }
      },
      { passive: true, signal }
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) return;
        for (const target of pending) {
          observer.unobserve(target);
          observer.observe(target);
        }
      },
      { signal }
    );
    window.addEventListener(
      'albaha:motion-change',
      () => {
        if (isMotionPaused()) {
          for (const target of [...pending]) finish(target);
        }
      },
      { signal }
    );

    signal.addEventListener(
      'abort',
      () => {
        observer.disconnect();
        for (const anim of playing.values()) anim.cancel();
        playing.clear();
        for (const target of pending) delete target.dataset.entrancePending;
        pending.clear();
      },
      { once: true }
    );
  }

  bindCityReel(signal, () => Boolean(homeView?.hidden));
  observeEntrances();

  restoreTrip();
  rebuildRoute();
  measureCarousel();
  syncPage(true);

  const syncHeaderSpace = () => {
    if (!header) return;
    document.documentElement.style.setProperty(
      '--hero-header-space',
      `${Math.ceil(header.getBoundingClientRect().height)}px`
    );
    syncSirajPosition();
  };
  syncHeaderSpace();

  if (typeof ResizeObserver !== 'undefined') {
    const layoutObserver = new ResizeObserver(syncHeaderSpace);
    if (header) layoutObserver.observe(header);
    if (heroCopy) layoutObserver.observe(heroCopy);
    const mapResizeObserver = new ResizeObserver(() => {
      if (homeView?.hidden || !mapPanel?.clientWidth) return;
      if (streetMapActive && liveMap) liveMap.map.resize();
      updateViewport();
    });
    if (mapPanel) mapResizeObserver.observe(mapPanel);
    signal.addEventListener(
      'abort',
      () => {
        layoutObserver.disconnect();
        mapResizeObserver.disconnect();
      },
      { once: true }
    );
  } else {
    window.addEventListener(
      'resize',
      () => {
        syncHeaderSpace();
        if (streetMapActive && liveMap) liveMap.map.resize();
        updateViewport();
        measureCarousel();
      },
      { signal }
    );
  }

  signal.addEventListener(
    'abort',
    () => {
      stopHeroCueLoop();
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      kpiRafs.forEach((id) => window.cancelAnimationFrame(id));
      kpiRafs.clear();
      addedRegionOptions.forEach((opt) => opt.remove());
      if (destinationGrid) destinationGrid.replaceChildren();
      document.documentElement.classList.remove('has-dialog');
      document.documentElement.classList.remove('has-smart-guide');
    },
    { once: true }
  );

  return () => {
    masterController.abort();
  };
}
