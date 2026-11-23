import type {
  ConciergeContextState,
  RouteTiming,
  SeasonKey,
  StopBase,
  TripPlan,
  TripStyle,
} from './portalTypes';
import { climateCities, places } from './portalStaticData';
import { byId, formatNum, qsAll } from './portalHelpers';
import { forecast, isWet, weatherNames } from './weatherAndShowcase';
import { createInitialConciergeContext } from './plannerTools';
import { renderGuideCharacterSvg } from '@/components/common/GuideCharacter';
import {
  detectGovernorate,
  getGuide144ById,
  NEUTRAL_PLACEHOLDER_IMAGE,
  normalizeSearchText,
} from './guideCatalog144';
import {
  hydratePlaceCard,
  sanitizeVisitorFacingText,
  validateGuideAction,
  validateGuideActions,
  validatePlaceIds,
  type SmartGuideAction,
  type SmartGuideConversationTurn,
  type SmartGuideItinerary,
  type SmartGuidePlaceCard,
  type SmartGuideRequestPayload,
  type SmartGuideResponseContract,
} from './smartGuideContract';
import type { ConciergeControllerDeps, ConciergeInput } from './conciergeEngine';

const SESSION_STORAGE_KEY = 'albaha-smart-guide-session-v1';

interface PersistedMessageEntry {
  kind: 'visitor' | 'assistant';
  text: string;
  response?: SmartGuideResponseContract;
  failedInput?: { input: ConciergeInput; label: string };
}

interface PersistedSessionState {
  context: ConciergeContextState;
  history: SmartGuideConversationTurn[];
  messages: PersistedMessageEntry[];
}

const GOVERNORATE_TO_WEATHER_CITY: Record<string, string> = {
  'مدينة الباحة': 'baha',
  'بلجرشي': 'baljurashi',
  'المندق': 'mandaq',
  'العقيق': 'aqiq',
  'المخواة': 'makhwah',
  'القرى': 'qura',
  'بني حسن': 'bani-hassan',
  'قلوة': 'qilwah',
  'غامد الزناد': 'ghamid',
  'الحجرة': 'hajrah',
};

export function createSmartGuideUiController(deps: ConciergeControllerDeps): {
  askConcierge: (input: ConciergeInput, label: string) => Promise<void>;
  reset: () => void;
  setActiveStopContext: (stopId: string | null, guideId?: string | null) => void;
  bumpRequestSeq: () => void;
  getContext: () => ConciergeContextState;
  refreshContextUi: () => void;
} {
  const { signal } = deps;
  const conciergePanel = byId('agentPanel') as HTMLDialogElement | null;
  const conciergeThread = byId('conciergeThread');
  const conciergeScroll = byId('conciergeScroll');
  const conciergeInput = byId('conciergeInput') as HTMLInputElement | null;
  const conciergeForm = byId('conciergeForm') as HTMLFormElement | null;
  const conciergeSend = conciergeForm?.querySelector<HTMLButtonElement>('.concierge-send') || null;
  const conciergeReset = byId('conciergeReset') as HTMLButtonElement | null;
  const conciergeWelcome = byId('conciergeWelcome');
  const conciergeStatus = byId('conciergeStatus');

  let conciergeContext: ConciergeContextState = createInitialConciergeContext(
    deps.getCurrentSeason()
  );
  let history: SmartGuideConversationTurn[] = [];
  let persistedMessages: PersistedMessageEntry[] = [];
  let conciergePending = false;
  let latestRequestSeq = 0;
  let lastFailedAttempt: { input: ConciergeInput; label: string } | null = null;
  let typingNode: HTMLElement | null = null;

  function isMobileViewport(): boolean {
    return window.innerWidth <= 768;
  }

  function maybeCloseOnMobileNavigation(): void {
    if (isMobileViewport() && conciergePanel?.open) {
      conciergePanel.close();
    }
  }

  function saveSession(): void {
    try {
      const payload: PersistedSessionState = {
        context: conciergeContext,
        history: history.slice(-16),
        messages: persistedMessages.slice(-24),
      };
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore private browsing / quota storage limits
    }
  }

  function loadSession(): PersistedSessionState | null {
    try {
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedSessionState;
      if (!parsed || !Array.isArray(parsed.messages)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function clearSession(): void {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  function syncWelcomeVisibility(): void {
    const hasMessages = persistedMessages.length > 0;
    if (conciergeWelcome) conciergeWelcome.hidden = hasMessages;
    if (conciergeReset) conciergeReset.hidden = !hasMessages;
  }

  function scrollToElement(el: HTMLElement): void {
    if (!conciergeScroll) return;
    window.requestAnimationFrame(() => {
      if (signal.aborted || !conciergeScroll) return;
      const rect = el.getBoundingClientRect();
      const viewport = conciergeScroll.getBoundingClientRect();
      if (rect.height > conciergeScroll.clientHeight - 28) {
        conciergeScroll.scrollTop += rect.top - viewport.top - 10;
      } else if (rect.bottom > viewport.bottom - 8) {
        conciergeScroll.scrollTop += rect.bottom - viewport.bottom + 16;
      }
    });
  }

  function changeDraft(plan: TripPlan | null): void {
    conciergeContext.hasUnsavedPreview = Boolean(plan);
    if (deps.getState().routeDraft === plan) return;
    deps.setRouteDraft(plan);
  }

  function matchesSavedPlan(plan: TripPlan): boolean {
    const state = deps.getState();
    return (
      state.choices.size === plan.ids.length &&
      plan.ids.every((id) => state.choices.has(id)) &&
      state.region === plan.region &&
      state.days === plan.days &&
      state.style === plan.style &&
      JSON.stringify(plan.timing ?? null) === JSON.stringify(state.savedTiming)
    );
  }

  function navigateToInternalHref(href: string): void {
    maybeCloseOnMobileNavigation();
    if (href.startsWith('#')) {
      const target = href.slice(1);
      if (window.location.hash === href) {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else {
        window.location.hash = target;
      }
    }
  }

  function syncTripToggleButtons(): void {
    if (!conciergeThread) return;
    const choices = deps.getState().choices;
    conciergeThread.querySelectorAll<HTMLButtonElement>('[data-sg-trip-stop]').forEach((btn) => {
      const stopId = btn.dataset.sgTripStop || '';
      const inTrip = choices.has(stopId);
      btn.setAttribute('aria-pressed', String(inTrip));
      btn.classList.toggle('is-added', inTrip);
      btn.textContent = inTrip ? 'في رحلتك ✓' : 'أضف لرحلتي';
    });
  }

  function executeValidatedAction(rawAction: SmartGuideAction, fromAuto = false): boolean {
    const action = validateGuideAction(rawAction);
    if (!action) return false;
    if (fromAuto && !action.autoExecute) return false;

    switch (action.type) {
      case 'navigate_map': {
        if (action.stopId && places.has(action.stopId)) {
          maybeCloseOnMobileNavigation();
          if (deps.focusStopFromConcierge) {
            void deps.focusStopFromConcierge(action.stopId, {
              isExploration: !deps.getState().choices.has(action.stopId),
            });
          } else {
            deps.selectDestination(action.stopId);
          }
        } else {
          maybeCloseOnMobileNavigation();
          deps.goToSection('planner');
        }
        return true;
      }
      case 'focus_map_stop': {
        if (!action.stopId || !places.has(action.stopId)) return false;
        conciergeContext.activeStopId = action.stopId;
        conciergeContext.place = action.stopId;
        maybeCloseOnMobileNavigation();
        if (deps.focusStopFromConcierge) {
          void deps.focusStopFromConcierge(action.stopId, {
            isExploration: !deps.getState().choices.has(action.stopId),
            message: action.label,
          });
        } else {
          deps.selectDestination(action.stopId);
        }
        return true;
      }
      case 'navigate_place': {
        if (!action.stopId || !places.has(action.stopId)) return false;
        conciergeContext.activeStopId = action.stopId;
        conciergeContext.place = action.stopId;
        navigateToInternalHref(`#place/${action.stopId}`);
        return true;
      }
      case 'navigate_guide_place': {
        if (!action.guideId || !deps.hasTourGuidePlace(action.guideId)) return false;
        conciergeContext.activeGuideId = action.guideId;
        if (action.guideItemId) conciergeContext.lastGuideItemId = action.guideItemId;
        navigateToInternalHref(`#guide/place/${action.guideId}`);
        return true;
      }
      case 'navigate_section': {
        if (!action.sectionId) return false;
        maybeCloseOnMobileNavigation();
        if (['guide', 'faq', 'invest'].includes(action.sectionId)) {
          navigateToInternalHref(`#${action.sectionId}`);
        } else {
          deps.goToSection(action.sectionId);
        }
        return true;
      }
      case 'navigate_city': {
        if (!action.cityKey || !Object.hasOwn(climateCities, action.cityKey)) return false;
        navigateToInternalHref(`#city/${action.cityKey}`);
        return true;
      }
      case 'navigate_faq': {
        maybeCloseOnMobileNavigation();
        if (deps.openFaq) deps.openFaq(action.faqId);
        else navigateToInternalHref(action.faqId ? `#faq/${action.faqId}` : '#faq');
        return true;
      }
      case 'add_to_trip': {
        if (!action.stopId) return false;
        const stop = places.get(action.stopId);
        if (!stop) return false;
        deps.toggleStop(stop);
        syncTripToggleButtons();
        return true;
      }
      case 'preview_plan': {
        if (!action.plan) return false;
        changeDraft(action.plan);
        maybeCloseOnMobileNavigation();
        deps.goToSection('planner');
        return true;
      }
      case 'apply_plan': {
        if (!action.plan) return false;
        if (!matchesSavedPlan(action.plan)) {
          deps.applySavedPlan(action.plan);
        } else {
          changeDraft(null);
        }
        syncTripToggleButtons();
        appendSystemConfirmation(
          'تمت إضافة الخطة إلى «مخطط رحلتك». تقدر تراجع المحطات على الخريطة أو تعدّلها في أي وقت.',
          [{ type: 'navigate_section', sectionId: 'summary', label: 'راجع ملخص رحلتي' }]
        );
        return true;
      }
      case 'quick_prompt': {
        if (!action.promptText) return false;
        void askConcierge({ text: action.promptText }, action.promptText);
        return true;
      }
      case 'retry': {
        if (lastFailedAttempt) {
          void askConcierge(lastFailedAttempt.input, lastFailedAttempt.label, true);
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  function createCompactPlaceRow(card: SmartGuidePlaceCard): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'sg-place-row';

    // Single clickable link wrapping thumbnail + green name + diagonal ↖ arrow + short description
    const link = document.createElement('a');
    link.className = 'sg-place-link';
    link.href = card.internalHref;
    link.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        if (card.stopId && places.has(card.stopId)) {
          executeValidatedAction({
            type: 'navigate_place',
            stopId: card.stopId,
            label: card.name,
          });
        } else {
          executeValidatedAction({
            type: 'navigate_guide_place',
            guideId: card.tourGuideId || `g-${card.id}`,
            guideItemId: card.id,
            label: card.name,
          });
        }
      },
      { signal }
    );

    const img = document.createElement('img');
    img.className = 'sg-place-thumb';
    img.src = card.image || NEUTRAL_PLACEHOLDER_IMAGE;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener(
      'error',
      () => {
        if (!img.src.endsWith('guide-neutral.svg')) {
          img.src = NEUTRAL_PLACEHOLDER_IMAGE;
        }
      },
      { once: true, signal }
    );

    const copy = document.createElement('span');
    copy.className = 'sg-place-copy';

    const titleRow = document.createElement('span');
    titleRow.className = 'sg-place-title-row';

    const nameEl = document.createElement('strong');
    nameEl.className = 'sg-place-name';
    nameEl.textContent = card.name;

    const arrowEl = document.createElement('span');
    arrowEl.className = 'sg-place-arrow';
    arrowEl.setAttribute('aria-hidden', 'true');
    arrowEl.textContent = '↖';

    titleRow.append(nameEl, arrowEl);

    const descEl = document.createElement('span');
    descEl.className = 'sg-place-desc';
    const metaBits = [
      card.reason || `${card.governorate} · ${card.shortDescription}`,
      card.distanceKm !== null ? `${formatNum(card.distanceKm)} كم` : '',
    ].filter(Boolean);
    descEl.textContent = metaBits.join(' · ');

    copy.append(titleRow, descEl);
    link.append(img, copy);
    li.append(link);

    // Light text-link action bar (strictly showing only available verified channels)
    const actionLinks: HTMLElement[] = [];

    if (card.canShowOnMap && card.stopId && places.has(card.stopId)) {
      const mapBtn = document.createElement('button');
      mapBtn.type = 'button';
      mapBtn.className = 'sg-text-link';
      mapBtn.textContent = 'على الخريطة';
      mapBtn.addEventListener(
        'click',
        () =>
          executeValidatedAction({
            type: 'focus_map_stop',
            stopId: card.stopId!,
            label: card.name,
          }),
        { signal }
      );
      actionLinks.push(mapBtn);
    }

    if (card.canAddToTrip && card.stopId && places.has(card.stopId)) {
      const tripBtn = document.createElement('button');
      tripBtn.type = 'button';
      tripBtn.className = 'sg-text-link';
      tripBtn.dataset.sgTripStop = card.stopId;
      const inTrip = deps.getState().choices.has(card.stopId);
      tripBtn.setAttribute('aria-pressed', String(inTrip));
      tripBtn.classList.toggle('is-added', inTrip);
      tripBtn.textContent = inTrip ? 'في رحلتك ✓' : 'أضف لرحلتي';
      tripBtn.addEventListener(
        'click',
        () =>
          executeValidatedAction({
            type: 'add_to_trip',
            stopId: card.stopId!,
            label: card.name,
          }),
        { signal }
      );
      actionLinks.push(tripBtn);
    }

    if (card.phones.length > 0) {
      const primaryPhone = card.phones[0];
      const telLink = document.createElement('a');
      telLink.className = 'sg-text-link';
      telLink.href = primaryPhone.telHref;
      telLink.innerHTML = `اتصال <bdi dir="ltr">${primaryPhone.display}</bdi>`;
      actionLinks.push(telLink);
    }

    if (card.whatsappUrl) {
      const waLink = document.createElement('a');
      waLink.className = 'sg-text-link is-whatsapp';
      waLink.href = card.whatsappUrl;
      waLink.target = '_blank';
      waLink.rel = 'noopener noreferrer';
      waLink.textContent = 'واتساب';
      actionLinks.push(waLink);
    }

    if (card.bookingLink) {
      const bookLink = document.createElement('a');
      bookLink.className = 'sg-text-link is-booking';
      bookLink.href = card.bookingLink.url;
      bookLink.target = '_blank';
      bookLink.rel = 'noopener noreferrer';
      bookLink.textContent = card.bookingLink.label;
      actionLinks.push(bookLink);
    }

    if (card.officialWebsite && card.officialWebsite.url !== card.bookingLink?.url) {
      const siteLink = document.createElement('a');
      siteLink.className = 'sg-text-link';
      siteLink.href = card.officialWebsite.url;
      siteLink.target = '_blank';
      siteLink.rel = 'noopener noreferrer';
      siteLink.textContent = card.officialWebsite.label;
      actionLinks.push(siteLink);
    }

    if (actionLinks.length > 0) {
      const bar = document.createElement('div');
      bar.className = 'sg-row-actions';
      bar.append(...actionLinks);
      li.append(bar);
    }

    return li;
  }

  function createItineraryBlock(itinerary: SmartGuideItinerary): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'sg-itinerary';

    for (const dayGroup of itinerary.groupedDays) {
      const section = document.createElement('div');
      section.className = 'sg-day-group';

      const heading = document.createElement('h5');
      heading.className = 'sg-day-heading';
      heading.textContent = dayGroup.label;
      section.append(heading);

      const list = document.createElement('ul');
      list.className = 'sg-place-list';

      for (const stop of dayGroup.stops) {
        const li = document.createElement('li');
        li.className = 'sg-place-row';

        const link = document.createElement('a');
        link.className = 'sg-place-link';
        link.href = stop.internalHref;
        link.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            executeValidatedAction({
              type: 'navigate_place',
              stopId: stop.stopId,
              label: stop.name,
            });
          },
          { signal }
        );

        const img = document.createElement('img');
        img.className = 'sg-place-thumb';
        img.src = stop.image || NEUTRAL_PLACEHOLDER_IMAGE;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener(
          'error',
          () => {
            if (!img.src.endsWith('guide-neutral.svg')) {
              img.src = NEUTRAL_PLACEHOLDER_IMAGE;
            }
          },
          { once: true, signal }
        );

        const copy = document.createElement('span');
        copy.className = 'sg-place-copy';

        const titleRow = document.createElement('span');
        titleRow.className = 'sg-place-title-row';

        const nameEl = document.createElement('strong');
        nameEl.className = 'sg-place-name';
        nameEl.textContent = stop.name;

        const arrowEl = document.createElement('span');
        arrowEl.className = 'sg-place-arrow';
        arrowEl.setAttribute('aria-hidden', 'true');
        arrowEl.textContent = '↖';

        titleRow.append(nameEl, arrowEl);

        const descEl = document.createElement('span');
        descEl.className = 'sg-place-desc';
        descEl.textContent = `${stop.governorate} · ${stop.shortDescription}`;

        const timeEl = document.createElement('span');
        timeEl.className = 'sg-place-time';
        const bdi = document.createElement('bdi');
        bdi.dir = 'ltr';
        bdi.textContent = `${stop.startTime} – ${stop.endTime}`;
        timeEl.append(bdi);

        copy.append(titleRow, descEl, timeEl);
        link.append(img, copy);
        li.append(link);

        // Light text actions under each itinerary stop
        const bar = document.createElement('div');
        bar.className = 'sg-row-actions';

        const mapBtn = document.createElement('button');
        mapBtn.type = 'button';
        mapBtn.className = 'sg-text-link';
        mapBtn.textContent = 'على الخريطة';
        mapBtn.addEventListener(
          'click',
          () =>
            executeValidatedAction({
              type: 'focus_map_stop',
              stopId: stop.stopId,
              label: stop.name,
            }),
          { signal }
        );

        const tripBtn = document.createElement('button');
        tripBtn.type = 'button';
        tripBtn.className = 'sg-text-link';
        tripBtn.dataset.sgTripStop = stop.stopId;
        const inTrip = deps.getState().choices.has(stop.stopId);
        tripBtn.setAttribute('aria-pressed', String(inTrip));
        tripBtn.classList.toggle('is-added', inTrip);
        tripBtn.textContent = inTrip ? 'في رحلتك ✓' : 'أضف لرحلتي';
        tripBtn.addEventListener(
          'click',
          () =>
            executeValidatedAction({
              type: 'add_to_trip',
              stopId: stop.stopId,
              label: stop.name,
            }),
          { signal }
        );

        bar.append(mapBtn, tripBtn);
        li.append(bar);
        list.append(li);
      }

      section.append(list);
      wrap.append(section);
    }

    return wrap;
  }

  function renderVisitorBubble(text: string): HTMLElement {
    const article = document.createElement('article');
    article.className = 'concierge-message sg-msg is-visitor';
    article.setAttribute('aria-label', 'سؤالك');
    const p = document.createElement('p');
    p.textContent = text;
    article.append(p);
    return article;
  }

  function renderAssistantBubble(
    response: SmartGuideResponseContract,
    opts?: { retryTarget?: { input: ConciergeInput; label: string } }
  ): HTMLElement {
    const article = document.createElement('article');
    article.className = 'concierge-message sg-msg is-guide';

    const header = document.createElement('h4');
    header.className = 'sg-msg-sender';
    header.textContent = 'المرشد الذكي';
    article.append(header);

    const body = document.createElement('p');
    body.className = 'sg-msg-text';
    body.textContent = sanitizeVisitorFacingText(response.replyText);
    article.append(body);

    // Client-side validation & hydration defense-in-depth
    const { validIds } = validatePlaceIds(response.placeIds);
    const validIdSet = new Set(validIds);
    const validatedCards: SmartGuidePlaceCard[] = [];
    if (Array.isArray(response.places) && response.places.length > 0) {
      for (const card of response.places) {
        if (!validIdSet.has(card.id)) continue;
        const catalogRec = getGuide144ById(card.id);
        if (!catalogRec) continue;
        // Always ensure links/phones come from verified catalog
        validatedCards.push(
          hydratePlaceCard(catalogRec, {
            reason: card.reason,
            distanceKm: card.distanceKm,
          })
        );
      }
    }

    if (response.itinerary && response.itinerary.groupedDays.length > 0) {
      article.append(createItineraryBlock(response.itinerary));
    } else if (validatedCards.length > 0) {
      const list = document.createElement('ul');
      list.className = 'sg-place-list';
      for (const card of validatedCards) {
        list.append(createCompactPlaceRow(card));
      }
      article.append(list);
    }

    const { validActions } = validateGuideActions(response.actions);
    const visibleActions = validActions.filter((a) => !a.autoExecute);
    if (visibleActions.length > 0) {
      const bar = document.createElement('div');
      bar.className = 'sg-actions-bar';
      for (const action of visibleActions) {
        if (action.type === 'open_directions' && action.guideItemId) {
          const item = getGuide144ById(action.guideItemId);
          if (!item) continue;
          const destination = item.coordinates?.join(',') ||
            [item.name, item.address, item.governorate, 'منطقة الباحة'].filter(Boolean).join('، ');
          const link = document.createElement('a');
          link.className = 'sg-secondary-link';
          link.textContent = action.label;
          link.href = `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination })}`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          bar.append(link);
          continue;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = action.primary ? 'sg-primary-btn' : 'sg-secondary-link';
        btn.textContent = action.label;
        btn.addEventListener(
          'click',
          () => {
            if (action.type === 'retry' && opts?.retryTarget) {
              lastFailedAttempt = opts.retryTarget;
            }
            executeValidatedAction(action, false);
          },
          { signal }
        );
        bar.append(btn);
      }
      article.append(bar);
    }

    return article;
  }

  function appendSystemConfirmation(text: string, actions: SmartGuideAction[] = []): void {
    if (!conciergeThread) return;
    const response: SmartGuideResponseContract = {
      replyText: text,
      placeIds: [],
      places: [],
      itinerary: null,
      actions,
      context: conciergeContext,
    };
    const bubble = renderAssistantBubble(response);
    conciergeThread.append(bubble);
    persistedMessages.push({ kind: 'assistant', text, response });
    saveSession();
    scrollToElement(bubble);
  }

  function showTypingIndicator(phrase = 'أرتّب لك الجولة…'): void {
    removeTypingIndicator();
    if (!conciergeThread) return;
    const bubble = document.createElement('div');
    bubble.className = 'sg-typing-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    bubble.innerHTML = `
      <span class="sg-typing-avatar" aria-hidden="true">${renderGuideCharacterSvg({ pose: 'listening', size: 24 })}</span>
      <span class="sg-typing-copy">${phrase}</span>
      <span class="sg-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    `;
    typingNode = bubble;
    conciergeThread.append(bubble);
    if (conciergeStatus) conciergeStatus.textContent = phrase;
    scrollToElement(bubble);
  }

  function removeTypingIndicator(): void {
    if (typingNode) {
      typingNode.remove();
      typingNode = null;
    }
    if (conciergeStatus) conciergeStatus.textContent = '';
  }

  async function maybeFetchWeatherForQuestion(
    text: string,
    intent?: string,
    explicitCity?: string
  ): Promise<SmartGuideRequestPayload['weather']> {
    const norm = normalizeSearchText(text);
    const needsWeather =
      intent === 'weather-plan' ||
      intent === 'weather-now' ||
      intent === 'rain-demo' ||
      conciergeContext.pendingTrip?.weather ||
      /طقس|الجو|اجواء|مطر|امطار|ضباب/.test(norm);
    if (!needsWeather) return null;

    const gov = detectGovernorate(norm);
    const cityKey =
      explicitCity && Object.hasOwn(climateCities, explicitCity)
        ? explicitCity
        : gov
          ? GOVERNORATE_TO_WEATHER_CITY[gov.canonical] || 'baha'
          : conciergeContext.pendingTrip?.city || 'baha';

    const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1400));
    const data = await Promise.race([forecast(cityKey), timeout]);
    if (!data) return null;
    const wet = data.hours.slice(0, 6).some(isWet);
    return {
      city: cityKey,
      cityName: climateCities[cityKey]?.name || 'الباحة',
      tempC: data.current.temperature_2m,
      conditionLabel: weatherNames(data.current.weather_code),
      isWet: Boolean(wet),
      source: 'Open-Meteo',
      observedAt: data.current.time,
    };
  }

  async function askConcierge(
    input: ConciergeInput,
    label: string,
    isRetry = false
  ): Promise<void> {
    if (conciergePending || signal.aborted) return;
    const displayLabel = (label || input.text || '').trim();
    if (!displayLabel && !input.intent) return;

    conciergePending = true;
    const mySeq = ++latestRequestSeq;
    if (conciergeSend) conciergeSend.disabled = true;
    if (conciergeReset) conciergeReset.disabled = true;

    if (!isRetry && displayLabel) {
      const visitorNode = renderVisitorBubble(displayLabel);
      persistedMessages.push({ kind: 'visitor', text: displayLabel });
      history.push({ role: 'user', text: displayLabel });
      syncWelcomeVisibility();
      conciergeThread?.append(visitorNode);
      scrollToElement(visitorNode);
      saveSession();
    }

    const normLabel = normalizeSearchText(displayLabel);
    const loadingPhrase = /رحل|يومين|ايام|رتب|خطط|بدل|خلها/.test(normLabel)
      ? 'أرتّب لك الجولة…'
      : 'لحظة وأردّ عليك…';
    showTypingIndicator(loadingPhrase);

    try {
      const state = deps.getState();
      const pageCtx = deps.getActivePageContext?.() || {
        placeId: null,
        guidePlaceId: null,
        activeStopId: state.activeStopId || null,
        lockedIds: state.lockedIds || [],
        completedIds: state.completedIds || [],
      };
      const weatherSnap = await maybeFetchWeatherForQuestion(
        input.text || displayLabel,
        input.intent,
        input.city
      );

      const requestPayload: SmartGuideRequestPayload = {
        question: input.text || displayLabel,
        intent: input.intent,
        preference: input.field ? { field: input.field, value: input.value } : undefined,
        city: input.city,
        placeId: pageCtx.placeId || input.id || null,
        guidePlaceId: pageCtx.guidePlaceId || null,
        context: {
          ...conciergeContext,
          activeStopId: conciergeContext.activeStopId || pageCtx.activeStopId || null,
          activeGuideId: conciergeContext.activeGuideId || pageCtx.guidePlaceId || null,
          lockedIds: [...new Set([...(conciergeContext.lockedIds || []), ...pageCtx.lockedIds])],
          completedIds: [...new Set([...(conciergeContext.completedIds || []), ...pageCtx.completedIds])],
        },
        history: history.slice(-6),
        savedState: {
          days: state.days,
          region: state.region,
          style: state.style,
          ids: [...state.choices],
          timing: state.savedTiming,
          completedIds: pageCtx.completedIds,
          lockedIds: pageCtx.lockedIds,
        },
        weather: weatherSnap,
        demoRain: input.intent === 'rain-demo',
        requestSeq: mySeq,
      };

      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = (await res.json()) as {
        ok?: boolean;
        reply?: SmartGuideResponseContract;
      };

      if (!json.ok || !json.reply) {
        throw new Error('Malformed guide payload');
      }

      if (signal.aborted || mySeq !== latestRequestSeq) return;
      removeTypingIndicator();

      const reply = json.reply;
      conciergeContext = reply.context || conciergeContext;
      if (reply.itinerary?.plan) {
        changeDraft(reply.itinerary.plan);
      }

      if (reply.retryable) {
        lastFailedAttempt = { input, label: displayLabel };
      } else {
        lastFailedAttempt = null;
      }

      const bubble = renderAssistantBubble(reply, {
        retryTarget: { input, label: displayLabel },
      });
      conciergeThread?.append(bubble);
      persistedMessages.push({
        kind: 'assistant',
        text: reply.replyText,
        response: reply,
        failedInput: reply.retryable ? { input, label: displayLabel } : undefined,
      });
      const historySummaryParts = [reply.replyText];
      if (reply.places.length > 0) {
        historySummaryParts.push(
          `[الأماكن المعروضة: ${reply.places.map((p) => `${p.name} (id:${p.id}، ${p.governorate})`).join(' | ')}]`
        );
      } else if (reply.itinerary?.groupedDays?.length) {
        const stopNames = reply.itinerary.groupedDays
          .map((d) => `${d.label}: ${d.stops.map((s) => `${s.name} ${s.startTime}`).join('، ')}`)
          .join(' | ');
        historySummaryParts.push(`[برنامج الرحلة المعروض: ${stopNames}]`);
      }
      history.push({ role: 'assistant', text: historySummaryParts.join('\n') });
      saveSession();
      scrollToElement(bubble);

      // Auto-execute ONLY validated explicit navigation actions
      const { validActions } = validateGuideActions(reply.actions);
      const autoNav = validActions.find((a) => a.autoExecute);
      if (autoNav) {
        executeValidatedAction(autoNav, true);
      }
    } catch {
      if (signal.aborted || mySeq !== latestRequestSeq) return;
      removeTypingIndicator();
      lastFailedAttempt = { input, label: displayLabel };
      const errReply: SmartGuideResponseContract = {
        replyText: 'تعذّر الاتصال الآن، وسؤالك محفوظ. جرّب إعادة المحاولة.',
        placeIds: [],
        places: [],
        itinerary: null,
        actions: [{ type: 'retry', label: 'إعادة المحاولة', primary: true }],
        context: conciergeContext,
        retryable: true,
      };
      const bubble = renderAssistantBubble(errReply, {
        retryTarget: { input, label: displayLabel },
      });
      conciergeThread?.append(bubble);
      persistedMessages.push({
        kind: 'assistant',
        text: errReply.replyText,
        response: errReply,
        failedInput: { input, label: displayLabel },
      });
      saveSession();
      scrollToElement(bubble);
    } finally {
      conciergePending = false;
      if (!signal.aborted) {
        if (conciergeSend) conciergeSend.disabled = false;
        if (conciergeReset) conciergeReset.disabled = false;
      }
    }
  }

  function reset(): void {
    if (conciergePending) return;
    latestRequestSeq += 1;
    removeTypingIndicator();
    conciergeThread?.replaceChildren();
    persistedMessages = [];
    history = [];
    lastFailedAttempt = null;
    conciergeContext = createInitialConciergeContext(deps.getCurrentSeason());
    clearSession();
    changeDraft(null);
    syncWelcomeVisibility();
    if (conciergeInput) conciergeInput.value = '';
    if (conciergeScroll) {
      conciergeScroll.scrollTop = 0;
    }
    conciergeInput?.focus({ preventScroll: true });
  }

  // Restore saved conversation on mount (preserves conversation across navigation & route reloads)
  const restored = loadSession();
  if (restored && restored.messages.length > 0 && conciergeThread) {
    conciergeContext = {
      ...createInitialConciergeContext(deps.getCurrentSeason()),
      ...restored.context,
    };
    history = restored.history || [];
    persistedMessages = restored.messages;
    syncWelcomeVisibility();
    for (const entry of persistedMessages) {
      if (entry.kind === 'visitor') {
        conciergeThread.append(renderVisitorBubble(entry.text));
      } else if (entry.response) {
        conciergeThread.append(
          renderAssistantBubble(entry.response, { retryTarget: entry.failedInput })
        );
      }
    }
    if (conciergeScroll) {
      conciergeScroll.scrollTop = conciergeScroll.scrollHeight;
    }
  } else {
    syncWelcomeVisibility();
  }

  // Bind starter prompt buttons
  qsAll<HTMLElement>('[data-concierge-prompt]').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        const prompt = button.dataset.conciergePrompt?.trim();
        if (prompt) void askConcierge({ text: prompt }, prompt);
      },
      { signal }
    )
  );

  // Bind composer submit
  conciergeForm?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      const text = conciergeInput?.value.trim() || '';
      if (!text || conciergePending || !conciergeInput) return;
      conciergeInput.value = '';
      void askConcierge({ text }, text);
    },
    { signal }
  );

  // Bind reset buttons
  qsAll<HTMLElement>('[data-concierge-reset]').forEach((button) =>
    button.addEventListener('click', reset, { signal })
  );

  byId('draftCancel')?.addEventListener(
    'click',
    () => {
      changeDraft(null);
      byId('routeDots')?.querySelector('button')?.focus({ preventScroll: true });
    },
    { signal }
  );

  byId('draftApply')?.addEventListener(
    'click',
    () => {
      const draft = deps.getState().routeDraft;
      if (!draft) return;
      deps.applySavedPlan(draft);
      syncTripToggleButtons();
    },
    { signal }
  );

  signal.addEventListener(
    'abort',
    () => {
      removeTypingIndicator();
      conciergeThread?.replaceChildren();
    },
    { once: true }
  );

  return {
    askConcierge,
    reset,
    setActiveStopContext: (stopId: string | null, guideId?: string | null) => {
      conciergeContext.activeStopId = stopId;
      if (stopId) conciergeContext.place = stopId;
      if (guideId !== undefined) conciergeContext.activeGuideId = guideId;
    },
    bumpRequestSeq: () => {
      latestRequestSeq += 1;
    },
    getContext: () => ({ ...conciergeContext }),
    refreshContextUi: () => {
      syncWelcomeVisibility();
      syncTripToggleButtons();
    },
  };
}
