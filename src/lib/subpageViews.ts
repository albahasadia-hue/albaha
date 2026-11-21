import type {
  CityStory,
  MediaShowcaseItem,
  RouteTiming,
  SeasonKey,
  StopBase,
  TripPlan,
} from './portalTypes';
import {
  cityStories,
  cityStoriesPath,
  cityStoryFilters,
  climateCities,
  images,
  placeNotes,
  places,
  regionalStops,
  seasons,
  stationPhotoInfo,
  stopOperationalCatalog,
  stopVisit,
  typeIcons,
  typeLabels,
} from './portalStaticData';
import { catalogDetailDescriptions, placeDetailDescriptions } from './guideDetailCopy';
import { getGuide144ByStopId } from './guideCatalog144';
import {
  bindSwipe,
  byId,
  cardHead,
  clock,
  formatNum,
  gallerySource,
  glyph,
  isMotionPaused,
  subpageSvgMap,
  wrap,
} from './portalHelpers';
import {
  bindMediaShowcase,
  localWeatherMarkup,
  mediaShowcaseMarkup,
  renderWeatherCard,
} from './weatherAndShowcase';

export interface SubpageViewsDeps {
  signal: AbortSignal;
  getCurrentSeason: () => SeasonKey;
  getSelectedSeason: () => SeasonKey;
  getChoices: () => Set<string>;
  getRouteDraft: () => TripPlan | null;
  getSavedTiming: () => RouteTiming | null;
  getScrollBehavior: () => ScrollBehavior;
  toggleStop: (stop: StopBase) => void;
  setLastHash: (hash: string) => void;
}

export interface SubpageViewsController {
  showPlace: (stop: StopBase) => void;
  showCity: (key: string, storyId?: string | null) => void;
  renderPlaceAction: () => void;
  clearActivePlace: () => void;
  cleanupView: () => void;
  getActivePlace: () => StopBase | null;
}

export function bindCityReel(signal: AbortSignal, isHomeHidden: () => boolean): void {
  const reel = byId('introCityReel');
  const motionButton = byId('introReelMotion');
  if (!reel || !motionButton) return;
  const cards = Array.from(reel.querySelectorAll<HTMLElement>('.intro-reel-card'));
  if (!cards.length) return;

  let position = 0;
  let step = 0;
  let timer = 0;
  let visible = !('IntersectionObserver' in window);
  let paused = false;
  let held = false;
  let hovered = false;
  let keyboardFocus = false;

  // Keep cards stationary between changes so links can be tapped reliably.
  function draw(): void {
    cards.forEach((card, i) => {
      const order = wrap(i - position, cards.length);
      const shown = order < 2;
      card.style.transform = `translate3d(0, ${Math.min(order, 2) * step}px, 0)`;
      card.style.visibility = shown ? 'visible' : 'hidden';
      card.style.pointerEvents = shown ? 'auto' : 'none';
      card.classList.toggle('is-reel-lead', order === 0);
    });
  }

  function schedule(): void {
    window.clearTimeout(timer);
    timer = 0;
    if (
      signal.aborted ||
      !visible ||
      document.hidden ||
      isHomeHidden() ||
      isMotionPaused() ||
      paused ||
      held ||
      hovered ||
      keyboardFocus ||
      !step
    ) {
      return;
    }
    timer = window.setTimeout(() => {
      position = wrap(position + 1, cards.length);
      draw();
      schedule();
    }, 3200);
  }

  function measure(): void {
    if (!reel || !reel.clientHeight) return;
    reel.dataset.enhanced = '';
    const gap = parseFloat(getComputedStyle(reel).getPropertyValue('--reel-gap')) || 0;
    step = cards[0].offsetHeight + gap;
    draw();
    schedule();
  }

  function stepTo(direction: number): void {
    position = wrap(position + direction, cards.length);
    draw();
    schedule();
  }

  bindSwipe(
    reel,
    {
      axis: 'y',
      canStart: (event) => {
        const target = event.target as Element | null;
        if (!step || target?.closest('.intro-reel-nav')) return false;
        held = true;
        schedule();
        return true;
      },
      end: (dy) => {
        if (Math.abs(dy) > 20) stepTo(dy < 0 ? 1 : -1);
      },
      release: () => {
        held = false;
        schedule();
      },
    },
    signal
  );

  byId('introReelPrev')?.addEventListener('click', () => stepTo(-1), { signal });
  byId('introReelNext')?.addEventListener('click', () => stepTo(1), { signal });
  motionButton.addEventListener(
    'click',
    () => {
      paused = !paused;
      motionButton.setAttribute('aria-pressed', String(paused));
      motionButton.textContent = paused ? 'تشغيل الحركة' : 'إيقاف الحركة';
      schedule();
    },
    { signal }
  );

  reel.addEventListener(
    'pointerenter',
    (event) => {
      if (event.pointerType === 'mouse') {
        hovered = true;
        schedule();
      }
    },
    { signal }
  );
  reel.addEventListener(
    'pointerleave',
    (event) => {
      if (event.pointerType === 'mouse') {
        hovered = false;
        schedule();
      }
    },
    { signal }
  );
  reel.addEventListener(
    'focusin',
    (event) => {
      const target = event.target as Element | null;
      if (!target?.closest('.intro-reel-card')) return;
      keyboardFocus = true;
      schedule();
    },
    { signal }
  );
  reel.addEventListener(
    'focusout',
    (event) => {
      if (event.relatedTarget instanceof Node && reel.contains(event.relatedTarget)) return;
      keyboardFocus = false;
      schedule();
    },
    { signal }
  );
  reel.addEventListener(
    'keydown',
    (event) => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      stepTo(event.key === 'ArrowDown' ? 1 : -1);
      cards[position].focus({ preventScroll: true });
    },
    { signal }
  );

  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        schedule();
      },
      { threshold: 0.08 }
    );
    io.observe(reel);
    signal.addEventListener('abort', () => io.disconnect(), { once: true });
  }

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(measure);
    ro.observe(reel);
    signal.addEventListener('abort', () => ro.disconnect(), { once: true });
  } else {
    window.addEventListener('resize', measure, { passive: true, signal });
  }

  document.addEventListener('visibilitychange', schedule, { signal });
  window.addEventListener('albaha:motion-change', schedule, { signal });
  signal.addEventListener(
    'abort',
    () => {
      window.clearTimeout(timer);
      timer = 0;
    },
    { once: true }
  );
  measure();
}

function cityStoryTag(story: CityStory): string {
  return `<span class="city-story-kind">${glyph(story.kind === 'archive' ? 'city-archive' : 'city-calendar', 'ic tiny')}${story.tag}</span>`;
}

function cityStoryPhoto(story: CityStory, caption = false): string {
  return `<figure class="city-story-media"><img src="${images[story.id] || ''}" alt="${story.alt}" decoding="async"${caption ? '' : ' loading="lazy"'}>${caption ? `<figcaption>${story.photoCaption} | ${story.credit}</figcaption>` : ''}</figure>`;
}

function cityStoryCard(story: CityStory): string {
  const action = story.kind === 'archive' ? 'افتح الأرشيف' : 'اقرأ التغطية';
  return `<article class="city-story${story.kind === 'archive' ? ' city-story--archive' : ''}">
      ${cityStoryPhoto(story)}
      <div class="city-story-copy">
        ${cityStoryTag(story)}
        <h3>${story.title}</h3>
        <p class="city-story-summary">${story.summary}</p>
        <div class="city-story-foot">
          <time class="city-story-date" datetime="${story.date}">${story.dateLabel}</time>
          <button type="button" class="city-story-open" data-city-story="${story.id}" aria-label="${action}، ${story.title}"><span>${action}</span><span class="city-story-arrow" aria-hidden="true">${glyph('arrow', 'ic tiny')}</span></button>
        </div>
      </div>
    </article>`;
}

function renderCityStories(): string {
  return `<section id="bahaStories" class="city-stories" aria-labelledby="bahaStoriesTitle">
      <div class="city-stories-head">
        <div>
          <div class="caption section-kicker">${glyph('city-stories', 'section-mark')}<span>دفتر مدينة الباحة</span></div>
          <h2 id="bahaStoriesTitle" tabindex="-1">الفعاليات والأرشيف الإعلامي</h2>
          <p class="lead">تغطيات من أسواق المدينة ومهرجاناتها، وزيارات من أرشيف المنطقة.</p>
        </div>
        <div class="city-story-filters" role="group" aria-label="نوع التغطية">
          ${cityStoryFilters.map(([key, label, icon]) => `<button type="button" data-city-filter="${key}" aria-pressed="${key === 'all'}" aria-controls="bahaStoryGrid">${glyph(icon, 'ic tiny')}${label}</button>`).join('')}
        </div>
      </div>
      <span class="city-story-status" role="status" id="bahaStoryStatus"></span>
      <div class="city-story-grid" id="bahaStoryGrid"></div>
      <dialog class="city-report" id="bahaReport" aria-labelledby="bahaReportTitle">
        <form method="dialog" class="city-report-close"><button type="submit" aria-label="أغلق التغطية" autofocus>${glyph('x')}</button></form>
        <div id="bahaReportBody"></div>
      </dialog>
    </section>`;
}

function scrollToCityStories(behavior: ScrollBehavior): void {
  byId('bahaStoriesTitle')?.focus({ preventScroll: true });
  byId('bahaStories')?.scrollIntoView({ behavior });
}

function openCityReport(story: CityStory, detailHash = ''): void {
  const dialog = byId('bahaReport') as HTMLDialogElement | null;
  const body = byId('bahaReportBody');
  if (!dialog || !body) return;
  dialog.dataset.detailHash = detailHash;
  body.classList.toggle('city-story--archive', story.kind === 'archive');
  body.innerHTML = `
      ${cityStoryPhoto(story, true)}
      <div class="city-report-content">
        ${cityStoryTag(story)}
        <h2 id="bahaReportTitle">${story.title}</h2>
        <div class="city-report-meta">
          <span class="city-story-date">${glyph('city-calendar', 'ic tiny')}<time datetime="${story.date}">${story.dateLabel}</time> | ${story.dateContext}</span>
          <span class="city-story-date">${glyph('pin', 'ic tiny')}${story.location}</span>
        </div>
        <p>${story.details}</p>
        <div class="place-actions">
          <a class="btn btn-dark" href="${story.source}" target="_blank" rel="noopener">التغطية الأصلية ${glyph('external', 'ic tiny')}</a>
          ${story.reference ? `<a class="btn btn-soft" href="${story.reference}" target="_blank" rel="noopener">أرشيف واس ${glyph('external', 'ic tiny')}</a>` : ''}
          ${story.stop ? `<a class="btn btn-soft" href="#place/${story.stop}">استكشف غابة رغدان ${glyph('arrow', 'ic tiny')}</a>` : ''}
        </div>
      </div>`;
  dialog.showModal();
  dialog.scrollTop = 0;
}

export function createSubpageViewsController(deps: SubpageViewsDeps): SubpageViewsController {
  const homeView = byId('homeView');
  const placeView = byId('placeView');
  let activePlace: StopBase | null = null;
  let viewAbortController: AbortController | null = null;

  function cleanupView(): void {
    viewAbortController?.abort();
    viewAbortController = null;
  }

  function newViewSignal(): AbortSignal {
    cleanupView();
    const controller = new AbortController();
    viewAbortController = controller;
    if (deps.signal.aborted) {
      controller.abort();
    } else {
      deps.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }

  function renderPlaceAction(): void {
    const button = byId('placeAdd');
    if (!button || !activePlace) return;
    const selected = deps.getChoices().has(activePlace.id);
    button.setAttribute('aria-pressed', String(selected));
    button.innerHTML = selected
      ? `${glyph('check')} أُضيفت إلى رحلتي`
      : `${glyph('plus')} أضف إلى رحلتي`;
  }

  function openVisitPage(title: string, cityKey: string): void {
    if (homeView) homeView.hidden = true;
    if (placeView) placeView.hidden = false;
    document.title = `${title} | اكتشف الباحة`;
    byId('placeTitle')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    void renderWeatherCard(byId('placeWeather'), cityKey);
  }

  function bindCityStories(viewSignal: AbortSignal): void {
    const grid = byId('bahaStoryGrid');
    const dialog = byId('bahaReport') as HTMLDialogElement | null;
    const storiesRoot = byId('bahaStories');
    if (!grid || !dialog || !storiesRoot) return;
    const filters = storiesRoot.querySelectorAll<HTMLElement>('[data-city-filter]');

    function filterStories(kind: string): void {
      if (!grid) return;
      const visible =
        kind === 'all' ? cityStories : cityStories.filter((story) => story.kind === kind);
      grid.toggleAttribute('data-single', visible.length <= 1);
      grid.innerHTML = visible.map((story) => cityStoryCard(story)).join('');
      filters.forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.cityFilter === kind))
      );
      const status = byId('bahaStoryStatus');
      if (status) status.textContent = `عدد التغطيات المعروضة ${formatNum(visible.length)}`;
    }

    filterStories('all');
    filters.forEach((button) =>
      button.addEventListener(
        'click',
        () => filterStories(button.dataset.cityFilter || 'all'),
        { signal: viewSignal }
      )
    );
    byId('bahaStoriesJump')?.addEventListener(
      'click',
      () => scrollToCityStories(deps.getScrollBehavior()),
      { signal: viewSignal }
    );
    grid.addEventListener(
      'click',
      (event) => {
        const trigger = (event.target as Element | null)?.closest<HTMLElement>('[data-city-story]');
        if (!trigger) return;
        const story = cityStories.find((entry) => entry.id === trigger.dataset.cityStory);
        if (story) openCityReport(story);
      },
      { signal: viewSignal }
    );
    dialog.addEventListener(
      'click',
      (event) => {
        const target = event.target as Element | null;
        if (target === dialog || target?.closest('a[href^="#"]')) dialog.close();
      },
      { signal: viewSignal }
    );
    dialog.addEventListener(
      'close',
      () => {
        if (
          !dialog.isConnected ||
          placeView?.hidden ||
          dialog.dataset.detailHash !== window.location.hash
        ) {
          return;
        }
        if (dialog.dataset.detailHash) {
          window.history.replaceState(window.history.state, '', cityStoriesPath);
          deps.setLastHash(cityStoriesPath);
        }
      },
      { signal: viewSignal }
    );
  }

  function showPlace(stop: StopBase): void {
    if (!placeView) return;
    const viewSignal = newViewSignal();
    const notes = placeNotes[stop.id];
    const record = getGuide144ByStopId(stop.id);
    const description = placeDetailDescriptions[stop.id]
      || (record && catalogDetailDescriptions[record.id])
      || notes.about;
    const visit = stopVisit[stop.id];
    const ops = stop.operational || stopOperationalCatalog[stop.id];
    const city = climateCities[visit?.city] || climateCities.baha;
    const category = stop.types[0];
    const timed = (deps.getRouteDraft()?.timing || deps.getSavedTiming())?.stations.find(
      (row) => row.id === stop.id
    );
    const hoursText = visit?.hours
      ? `متاح يومياً من <bdi dir="ltr">${clock(visit.hours[0])}–${clock(visit.hours[1])}</bdi>، ويُفضّل الوصول المبكر لتفادي الزحام والاستمتاع بالإضاءة الطبيعية.`
      : ops?.hoursVerified
        ? `${ops.hoursVerified.label}، ويُنصح بمراعاة حالة الطقس الجبلي وتوقيت الغروب قبل الانطلاق.`
        : `أفضل أوقات الزيارة ${visit.best}، مع اصطحاب ملابس مريحة ومناسبة لطبيعة الأجواء الجبلية.`;
    const walkingText =
      ops?.walkingLabel && ops.walkingLabel.length >= 16
        ? `${ops.walkingLabel}، مع إمكانية التوقف المريح عند نقاط الإطلالة والاستراحة.`
        : visit?.walking || 'ممرات ممهّدة ومناسبة لجولة مريحة دون مشقّة.';
    const facilitiesText = ops?.facilities?.length
      ? `${ops.familyFriendly ? 'مناسب للعائلات والأطفال' : 'تجربة جبلية أو تراثية متدرّجة'}، ويوفّر ${ops.facilities.slice(0, 3).join('، ')}.`
      : ops?.familyFriendly
        ? 'وجهة ملائمة للعائلات والأطفال مع جلسات مريحة ومرافق عامة قريبة.'
        : 'موقع طبيعي مفتوح يوفّر نقاط إطلالة وتصوير ومساحات توقف مريحة.';
    const showcaseItems: MediaShowcaseItem[] = (
      visit?.gallery?.length ? visit.gallery : [[stop.image, stop.name]]
    ).map(([key, label]) => ({
      src: gallerySource(key),
      caption: label || stop.name,
      alt: `${stop.name} — ${label || notes.area}`,
    }));
    const nearbyIds = (city?.ids || []).filter((sid) => sid !== stop.id && places.has(sid));
    const topIdeas = notes.ideas.slice(0, 3);
    activePlace = stop;
    placeView.innerHTML = `
      <div class="container">
        <nav class="place-trail" aria-label="مسار الصفحة"><a href="#home">الرئيسية</a><span aria-hidden="true">/</span><a href="#city/${visit.city}">${city.name}</a><span aria-hidden="true">/</span><span aria-current="page">${stop.name}</span></nav>
        <div class="place-hero place-hero--destination">
          <div class="place-hero-copy">
            <div class="place-kicker-row">
              <span class="place-cat-pill">${glyph(typeIcons[category], 'ic tiny')} ${typeLabels[category]}</span>
              <span class="place-area-pill">${glyph('pin', 'ic tiny')} ${notes.area}</span>
            </div>
            <h1 id="placeTitle" tabindex="-1">${stop.name}</h1>
            <p class="lead">${description}</p>
            <dl class="place-facts">
              <div><dt>${cardHead(glyph('weather', 'card-ic-svg'), 'الوقت المقترح')}</dt><dd>${timed ? `<bdi dir="ltr">${clock(timed.start)}–${clock(timed.end)}</bdi>` : visit.best}</dd></div>
              <div><dt>${cardHead(subpageSvgMap.clock, 'مدة الزيارة')}</dt><dd>${formatNum(timed ? timed.end - timed.start : stop.min)} دقيقة</dd></div>
            </dl>
            <div class="place-actions">
              <a class="btn btn-dark" href="#route/${stop.id}">ارجع إلى رحلتي ${glyph('route')}</a>
              <button type="button" class="btn btn-soft" id="placeAdd" aria-pressed="false"></button>
              <a class="btn btn-soft" href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}" target="_blank" rel="noopener">الخرائط ${glyph('external', 'ic tiny')}</a>
            </div>
          </div>
          <div class="place-hero-media">
            ${mediaShowcaseMarkup({ id: 'placeHeroShowcase', items: showcaseItems, title: stop.name })}
          </div>
        </div>
        ${localWeatherMarkup(Object.hasOwn(climateCities, visit?.city || '') ? visit.city : 'baha', stop.id, deps.getCurrentSeason(), deps.getSelectedSeason())}
        <section class="place-guide" aria-labelledby="placeGuideTitle">
          <div class="place-guide-bento">
            <div class="place-bento-card place-ideas-card">
              <div class="place-bento-head">
                <div class="caption section-kicker">${glyph('section-day', 'section-mark')}<span>إرشادات وتجربة الزيارة</span></div>
                <h2 id="placeGuideTitle">أفكار ومقترحات في ${stop.name}</h2>
              </div>
              <ol class="place-ideas-list">${topIdeas.map((idea, idx) => `<li><span class="place-idea-num">${formatNum(idx + 1).padStart(2, '0')}</span><p>${idea}</p></li>`).join('')}</ol>
            </div>
            <div class="place-bento-card place-field-card">
              <div class="place-bento-head">
                <div class="caption section-kicker">${glyph('pin', 'section-mark')}<span>معلومات ميدانية</span></div>
                <h2>جاهزية المسار والوصول</h2>
              </div>
              <div class="place-field-rows">
                <div class="place-field-row"><strong>${cardHead(subpageSvgMap.footsteps, 'طبيعة المسار والمشي')}</strong><p>${walkingText}</p></div>
                <div class="place-field-row"><strong>${cardHead(glyph('section-guide', 'card-ic-svg'), 'المرافق والملاءمة')}</strong><p>${facilitiesText}</p></div>
                <div class="place-field-row"><strong>${cardHead(subpageSvgMap.clock, 'ساعات الزيارة والتجهيز')}</strong><p>${hoursText}</p></div>
              </div>
            </div>
          </div>
          ${
            nearbyIds.length
              ? `<div class="place-nearby"><h3>محطات قريبة في ${city.name}</h3><div class="city-links">${nearbyIds
                  .map((sid) => {
                    const sp = places.get(sid)!;
                    return `<a class="city-stop-card" href="#place/${sid}"><img src="${images[sp.image] || ''}" alt="" loading="lazy" decoding="async"><span><strong>${sp.name}</strong><small>${sp.tag} · ${formatNum(sp.min)} دقيقة</small></span>${glyph('arrow', 'ic tiny')}</a>`;
                  })
                  .join('')}</div></div>`
              : ''
          }
        </section>
      </div>`;
    bindMediaShowcase(byId('placeHeroShowcase'), showcaseItems, {
      title: stop.name,
      interval: 4000,
      signal: viewSignal,
    });
    renderPlaceAction();
    byId('placeAdd')?.addEventListener('click', () => deps.toggleStop(stop), {
      signal: viewSignal,
    });
    openVisitPage(stop.name, Object.hasOwn(climateCities, visit?.city || '') ? visit.city : 'baha');
  }

  function showCity(key: string, storyId: string | null = null): void {
    const city = climateCities[key];
    if (!placeView || !city) return;
    const viewSignal = newViewSignal();
    const currentSeason = deps.getCurrentSeason();
    const hasStories = key === 'baha';
    const mapLink = `<a class="btn btn-soft" href="#route/${city.ids[0]}">شاهد المنطقة على الخريطة ${glyph('route')}</a>`;
    const seenKeys = new Set<string>();
    const showcaseItems: MediaShowcaseItem[] = [];
    const pushSlide = (imgKey: string, caption?: string) => {
      if (!imgKey || seenKeys.has(imgKey)) return;
      const src = gallerySource(imgKey);
      if (!src) return;
      seenKeys.add(imgKey);
      showcaseItems.push({
        src,
        caption: caption || city.name,
        alt: `${city.name} — ${caption || city.area}`,
      });
    };
    pushSlide(
      city.image,
      city.photo?.caption || (key === 'makhwah' ? 'قرية ذي عين بمحافظة المخواة' : `إطلالة على ${city.name}`)
    );
    for (const sid of city.ids) {
      const sp = places.get(sid);
      const gal = stopVisit[sid]?.gallery;
      if (gal?.length) {
        gal.forEach(([gk, gl]) => pushSlide(gk, `${sp?.name || city.name} · ${gl}`));
      } else if (sp) {
        pushSlide(sp.image, sp.name);
      }
    }
    const cityStops = city.ids.map((id) => places.get(id)).filter((s): s is StopBase => Boolean(s));
    const totalMins = cityStops.reduce((sum, sp) => sum + (sp.min || 60), 0);
    activePlace = null;
    placeView.innerHTML = `<div class="container">
      <nav class="place-trail" aria-label="مسار الصفحة"><a href="#home">الرئيسية</a><span aria-hidden="true">/</span><a href="#destination-directory">الوجهات</a><span aria-hidden="true">/</span><span aria-current="page">${city.name}</span></nav>
      <div class="place-hero">
        <div class="place-hero-copy">
          <div class="place-kicker-row">
            <span class="place-cat-pill">${glyph('pin', 'ic tiny')} ${city.area}</span>
            <span class="place-area-pill">${glyph('weather', 'ic tiny')} ${seasons[currentSeason].name}</span>
          </div>
          <h1 id="placeTitle" tabindex="-1">${city.name}</h1>
          <p class="lead">${city.intro}</p>
          <dl class="place-facts">
            <div><dt>${cardHead(glyph('route', 'card-ic-svg'), 'المحطات على المسار')}</dt><dd>${formatNum(cityStops.length)} محطات</dd></div>
            <div><dt>${cardHead(subpageSvgMap.clock, 'الوقت التقديري للجولة')}</dt><dd>${formatNum(totalMins)} دقيقة</dd></div>
            <div><dt>${cardHead(glyph('weather', 'card-ic-svg'), 'الموسم المناسب الآن')}</dt><dd>${seasons[currentSeason].name}</dd></div>
          </dl>
          <div class="place-actions">${hasStories ? `<button type="button" class="btn btn-dark" id="bahaStoriesJump">الفعاليات والأرشيف ${glyph('city-stories')}</button>` : `<a class="btn btn-dark" href="#guide">تصفّح دليل المنطقة ${glyph('section-guide')}</a>`}${mapLink}</div>
        </div>
        <div class="place-hero-media">
          ${mediaShowcaseMarkup({ id: 'cityHeroShowcase', items: showcaseItems, title: city.name })}
          ${city.photo?.context ? `<p class="time-note place-photo-credit">${city.photo.caption}</p>` : ''}
        </div>
      </div>
      ${localWeatherMarkup(key, '', currentSeason, deps.getSelectedSeason())}
      ${hasStories ? renderCityStories() : ''}
      <section class="city-stops-section" aria-labelledby="cityStops">
        <div class="city-stops-head">
          <div class="caption section-kicker">${glyph('pin', 'section-mark')}<span>محطات ومزارات مختارة</span></div>
          <h2 id="cityStops">محطات تستحق الوقفة في ${city.name}</h2>
        </div>
        <div class="city-links">${cityStops.map((sp) => `<a class="city-stop-card" href="#place/${sp.id}"><img src="${images[sp.image] || ''}" alt="" loading="lazy" decoding="async"><span><strong>${sp.name}</strong><small>${sp.tag} · ${formatNum(sp.min)} دقيقة</small></span>${glyph('arrow', 'ic tiny')}</a>`).join('')}</div>
      </section>
    </div>`;
    bindMediaShowcase(byId('cityHeroShowcase'), showcaseItems, {
      title: city.name,
      interval: 4000,
      signal: viewSignal,
    });
    if (hasStories) bindCityStories(viewSignal);
    openVisitPage(city.name, key);
    if (hasStories && storyId !== null) {
      scrollToCityStories('instant');
      const story = cityStories.find((entry) => entry.id === storyId);
      if (story) {
        window.requestAnimationFrame(() => {
          if (!viewSignal.aborted) openCityReport(story, window.location.hash);
        });
      }
    }
  }

  deps.signal.addEventListener('abort', cleanupView, { once: true });

  return {
    showPlace,
    showCity,
    renderPlaceAction,
    clearActivePlace: () => {
      activePlace = null;
    },
    cleanupView,
    getActivePlace: () => activePlace,
  };
}
