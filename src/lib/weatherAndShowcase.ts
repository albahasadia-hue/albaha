import { formatNum, glyph, isMotionPaused } from './portalHelpers';
import { climateCities, seasons } from './portalStaticData';
import type { ForecastData, ForecastHour, MediaShowcaseItem, SeasonKey } from './portalTypes';

const saudiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function localTime(): { date: string; month: number; minute: number } {
  const parts = Object.fromEntries(saudiDate.formatToParts().map(({ type, value }) => [type, value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    month: Number(parts.month),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export const seasonForMonth = (month: number): SeasonKey =>
  month >= 3 && month <= 5
    ? 'spring'
    : month >= 6 && month <= 8
      ? 'summer'
      : month >= 9 && month <= 11
        ? 'autumn'
        : 'winter';

export const weatherNames = (code: number): string =>
  code === 0
    ? 'صحو'
    : code <= 3
      ? 'غيوم'
      : code === 45 || code === 48
        ? 'ضباب'
        : code >= 95
          ? 'عواصف رعدية'
          : code >= 51 && code <= 82
            ? 'هطول'
            : 'حالة متغيرة';

export const isWet = (hour: ForecastHour): boolean => hour.rain >= 45 || hour.code >= 51;

const forecastCache = new Map<string, { at: number; promise: Promise<ForecastData | null> }>();
export const weatherSource = 'https://open-meteo.com/';

export function forecast(cityKey: string): Promise<ForecastData | null> {
  const city = climateCities[cityKey];
  if (!city) return Promise.resolve(null);
  const cached = forecastCache.get(cityKey);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.promise;

  const params = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lng),
    timezone: 'Asia/Riyadh',
    forecast_days: '2',
    current: 'temperature_2m,weather_code',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
  });

  const promise = fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(5500),
    credentials: 'omit',
  })
    .then((response) => {
      if (!response.ok) throw new Error('Forecast unavailable');
      return response.json();
    })
    .then(({ current, hourly }) => {
      if (
        !Number.isFinite(current?.temperature_2m) ||
        !Number.isFinite(current.weather_code) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(current.time) ||
        !Array.isArray(hourly?.time)
      ) {
        return null;
      }
      const hours: ForecastHour[] = hourly.time
        .map((time: string, i: number) => ({
          time,
          temp: hourly.temperature_2m?.[i],
          code: hourly.weather_code?.[i],
          rain: hourly.precipitation_probability?.[i],
        }))
        .filter(
          (row: ForecastHour) =>
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(row.time) &&
            [row.temp, row.code, row.rain].every(Number.isFinite)
        );
      return { current, hours };
    })
    .catch(() => null);

  const entry = { at: Date.now(), promise };
  forecastCache.set(cityKey, entry);
  promise.then((data) => {
    if (!data) entry.at = Date.now() - 9.5 * 60 * 1000;
  });
  return promise;
}

export function renderWeatherCard(element: HTMLElement | null, cityKey: string): void {
  if (!element) return;
  const city = climateCities[cityKey];
  if (!city) return;

  function display({ current, hours }: ForecastData, sample = false) {
    if (!element) return;
    const next = hours.filter((hour) => hour.time > current.time).slice(0, 4);
    element.innerHTML = `
      <div class="weather-strip-main">
        <div class="weather-reading">
          <strong dir="ltr">${Math.round(current.temperature_2m)}°C</strong>
          <div>
            <span class="weather-cond">${weatherNames(current.weather_code)}</span>
            <p class="time-note">${sample ? '<strong>بيانات عرض توضيحية</strong> | درجات وتوقعات افتراضية لساعة المحاكاة <bdi>14:00</bdi>' : `آخر قراءة <bdi>${current.time.slice(0, 10)} | ${current.time.slice(11)}</bdi>`} بتوقيت السعودية.</p>
          </div>
        </div>
        ${next.length ? `<ul class="weather-hours" aria-label="${sample ? 'توقعات نموذج العرض' : 'الساعات القادمة'}">${next.map((hour) => `<li><bdi>${hour.time.slice(11)}</bdi><strong dir="ltr">${Math.round(hour.temp)}°</strong><small>هطول ${hour.rain}٪</small></li>`).join('')}</ul>` : ''}
      </div>
      ${sample ? '' : `<a class="place-source" href="${weatherSource}" target="_blank" rel="noopener">توقعات ${city.name} من Open-Meteo</a>`}`;
  }

  element.innerHTML = '<span class="weather-loading">جاري جلب الطقس…</span>';
  forecast(cityKey).then((data) => {
    if (!element.isConnected) return;
    if (data) {
      display(data);
      return;
    }
    element.innerHTML = `<div class="weather-offline-row"><p class="weather-offline-msg">تعذّر جلب الطقس الحالي. إرشادات الموسم متاحة أدناه.</p>
      <div class="seraj-city-actions"><button type="button" class="concierge-choice" data-weather-sample>اعرض نموذج الطقس</button>
      <a class="place-source" href="${weatherSource}" target="_blank" rel="noopener">مصدر توقعات الطقس</a></div></div>`;
    element.querySelector('[data-weather-sample]')?.addEventListener(
      'click',
      () => {
        const temp = cityKey === 'baha' ? 22 : 28;
        const sampleDate = '2000-01-01T';
        display(
          {
            current: { time: sampleDate + '14:00', temperature_2m: temp, weather_code: 2 },
            hours: [15, 16, 17, 18].map((hour, i) => ({
              time: sampleDate + hour + ':00',
              temp: temp - i,
              code: 2,
              rain: i >= 2 ? 65 : 10,
            })),
          },
          true
        );
      },
      { once: true }
    );
  });
}

export function localWeatherMarkup(
  cityKey: string,
  id: string,
  currentSeason: SeasonKey,
  selectedSeason: SeasonKey
): string {
  const city = climateCities[cityKey];
  const season = seasons[selectedSeason];
  const currentTip =
    city.tips?.[currentSeason] || 'راجع توقعات المحطة واختر وقت الزيارة المناسب للأجواء.';
  return `<section class="place-weather-strip" aria-labelledby="weatherTitle">
    <div class="place-weather-head">
      <div class="place-weather-title">
        <span class="place-weather-badge">${glyph('weather', 'ic tiny')}<span>أجواء الزيارة · ${city.name}</span></span>
        <h2 id="weatherTitle">الأحوال والطقس (${seasons[currentSeason].name})</h2>
      </div>
      <div class="seraj-city-actions">
        <button type="button" class="btn btn-dark" data-weather-plan="${cityKey}" data-visit-id="${id}">خطّط حسب الأجواء ${glyph('route')}</button>
        ${id === 'ain' ? '<button type="button" class="btn btn-soft" data-demo-rain>جرّب سيناريو المطر</button>' : ''}
        <a class="place-source" href="${city.source}" target="_blank" rel="noopener">مرجع الوجهة ${glyph('external', 'ic tiny')}</a>
      </div>
    </div>
    <div class="place-weather-body">
      <div id="placeWeather" aria-live="polite"></div>
      <div class="weather-tips-grid">
        <div class="weather-tip-item"><small>إرشاد ${seasons[currentSeason].name}</small><p>${currentTip}</p></div>
        ${selectedSeason !== currentSeason && city.tips ? `<div class="weather-tip-item"><small>وقت زيارتك · ${season.name}</small><p>${city.tips[selectedSeason]}</p></div>` : ''}
        ${city.climate ? `<div class="weather-tip-item"><small>المناخ المعتاد</small><p>${city.climate}</p></div>` : ''}
      </div>
    </div>
  </section>`;
}

export function mediaShowcaseMarkup({
  id,
  items,
  title,
  zoomAttrs = '',
}: {
  id: string;
  items: MediaShowcaseItem[];
  title: string;
  zoomAttrs?: string;
}): string {
  const multi = items.length > 1;
  const first = items[0];
  return `<div class="ab-showcase" id="${id}" data-showcase data-count="${items.length}">
    <div class="ab-showcase-stage">
      ${items.map((item, i) => `<img class="ab-showcase-img${i === 0 ? ' is-active' : ''}" src="${item.src}" alt="${item.alt || title}" loading="eager" decoding="async" data-showcase-slide="${i}">`).join('')}
      <button type="button" class="ab-showcase-zoom" data-showcase-zoom ${zoomAttrs} aria-label="عرض صور ${title} بملء الشاشة">${glyph('image', 'ic tiny')}<span>تكبير العرض${multi ? ` (${formatNum(items.length)})` : ''}</span></button>
      ${multi ? `<button type="button" class="ab-showcase-step prev" data-showcase-step="-1" aria-label="الصورة السابقة">${glyph('arrow', 'ic tiny')}</button><button type="button" class="ab-showcase-step next" data-showcase-step="1" aria-label="الصورة التالية">${glyph('arrow', 'ic tiny')}</button>` : ''}
      <div class="ab-showcase-bar">
        <span class="ab-showcase-caption" data-showcase-caption>${first?.caption || title}</span>
        ${multi ? `<div class="ab-showcase-dots" role="tablist" aria-label="اختيار الصورة">${items.map((_item, i) => `<button type="button" role="tab" aria-selected="${i === 0}" aria-label="صورة ${formatNum(i + 1)}" data-showcase-dot="${i}"></button>`).join('')}</div>` : ''}
      </div>
    </div>
  </div>`;
}

let unifiedLightboxState: { title: string; items: MediaShowcaseItem[]; index: number } = {
  title: '',
  items: [],
  index: 0,
};

function renderUnifiedLightbox() {
  const panel = document.getElementById('directory-lightbox') as HTMLDialogElement | null;
  if (!panel || !unifiedLightboxState.items.length) return;
  const { items, index, title } = unifiedLightboxState;
  const current = items[index];
  const titleEl = panel.querySelector('[data-dl-title]');
  if (titleEl) titleEl.textContent = title || 'معرض الصور';
  const img = panel.querySelector<HTMLImageElement>('[data-dl-image]');
  if (img) {
    img.src = current.src;
    img.alt = current.alt || title || '';
  }
  const captionEl = panel.querySelector('[data-dl-caption]');
  if (captionEl) captionEl.textContent = current.caption || title || '';
  const counterEl = panel.querySelector('[data-dl-counter]');
  if (counterEl) counterEl.textContent = `${formatNum(index + 1)} / ${formatNum(items.length)}`;
  const actionsEl = panel.querySelector<HTMLElement>('.dl-actions');
  if (actionsEl) actionsEl.hidden = items.length < 2;
}

export function openUnifiedLightbox(
  title: string,
  items: MediaShowcaseItem[],
  index = 0,
  signal?: AbortSignal
): void {
  if (!items?.length) return;
  let panel = document.getElementById('directory-lightbox') as HTMLDialogElement | null;
  if (!panel) {
    panel = document.createElement('dialog');
    panel.id = 'directory-lightbox';
    panel.className = 'directory-lightbox';
    panel.innerHTML = `<div class="dl-layout" dir="rtl"><div class="dl-bar"><strong data-dl-title>معرض الصور</strong><button type="button" data-dl-close aria-label="إغلاق المعرض">×</button></div><div class="dl-stage"><img data-dl-image alt=""></div><div class="dl-foot"><div class="dl-info"><span data-dl-caption></span><span data-dl-counter></span></div><div class="dl-actions"><button type="button" data-dl-step="-1" aria-label="الصورة السابقة">${glyph('arrow', 'ic tiny')} السابق</button><button type="button" data-dl-step="1" aria-label="الصورة التالية">التالي ${glyph('arrow', 'ic tiny')}</button></div></div></div>`;
    document.body.append(panel);
    panel.addEventListener(
      'click',
      (e) => {
        const target = e.target as Element;
        if (target === panel || target.closest('[data-dl-close]')) {
          panel?.close();
          return;
        }
        const step = target.closest<HTMLElement>('[data-dl-step]');
        if (step && unifiedLightboxState.items.length > 1) {
          const total = unifiedLightboxState.items.length;
          unifiedLightboxState.index =
            (unifiedLightboxState.index + Number(step.dataset.dlStep) + total) % total;
          renderUnifiedLightbox();
        }
      },
      { signal }
    );
    panel.addEventListener(
      'keydown',
      (e) => {
        if (
          unifiedLightboxState.items.length > 1 &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
        ) {
          e.preventDefault();
          const total = unifiedLightboxState.items.length;
          unifiedLightboxState.index =
            (unifiedLightboxState.index + (e.key === 'ArrowLeft' ? 1 : -1) + total) % total;
          renderUnifiedLightbox();
        }
      },
      { signal }
    );
    signal?.addEventListener(
      'abort',
      () => {
        if (panel?.open) panel.close();
        panel?.remove();
      },
      { once: true }
    );
  }
  unifiedLightboxState = {
    title,
    items,
    index: Math.max(0, Math.min(index, items.length - 1)),
  };
  renderUnifiedLightbox();
  if (!panel.open) panel.showModal();
}

export function bindMediaShowcase(
  root: HTMLElement | null,
  items: MediaShowcaseItem[],
  {
    thumbsEl = null,
    title = '',
    interval = 3800,
    openLightboxOnZoom = true,
    signal,
  }: {
    thumbsEl?: HTMLElement | null;
    title?: string;
    interval?: number;
    openLightboxOnZoom?: boolean;
    signal: AbortSignal;
  }
): { getIndex: () => number; go?: (next: number) => void } {
  if (!root || !items?.length) return { getIndex: () => 0 };
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-showcase-slide]'));
  const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-showcase-dot]'));
  const thumbs = thumbsEl
    ? Array.from(thumbsEl.querySelectorAll<HTMLElement>('[data-showcase-thumb]'))
    : [];
  const captionEl = root.querySelector<HTMLElement>('[data-showcase-caption]');
  let index = 0;
  let timer = 0;
  let paused = false;

  const fallbackSrc = '/media/photo-parks.webp';
  const applyShowcaseFallback = (event: Event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallbackApplied === '1') return;
    img.dataset.fallbackApplied = '1';
    if (!img.getAttribute('src') || !img.getAttribute('src')!.endsWith('photo-parks.webp')) {
      img.src = fallbackSrc;
    }
  };
  root.addEventListener('error', applyShowcaseFallback, { capture: true, signal });
  if (thumbsEl) thumbsEl.addEventListener('error', applyShowcaseFallback, { capture: true, signal });

  const go = (next: number) => {
    index = (next + items.length) % items.length;
    slides.forEach((img, i) => img.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => dot.setAttribute('aria-selected', String(i === index)));
    thumbs.forEach((btn, i) => btn.setAttribute('aria-current', i === index ? 'true' : 'false'));
    if (captionEl) captionEl.textContent = items[index].caption || title;
  };

  const schedule = () => {
    clearTimeout(timer);
    if (!root.isConnected || items.length < 2 || paused || document.hidden || isMotionPaused()) {
      return;
    }
    timer = window.setTimeout(() => {
      go(index + 1);
      schedule();
    }, interval);
  };

  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });

  root.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element;
      const stepBtn = target.closest<HTMLElement>('[data-showcase-step]');
      if (stepBtn) {
        event.stopPropagation();
        go(index + Number(stepBtn.dataset.showcaseStep));
        schedule();
        return;
      }
      const dotBtn = target.closest<HTMLElement>('[data-showcase-dot]');
      if (dotBtn) {
        event.stopPropagation();
        go(Number(dotBtn.dataset.showcaseDot));
        schedule();
        return;
      }
      if (openLightboxOnZoom) openUnifiedLightbox(title, items, index, signal);
    },
    { signal }
  );

  if (thumbsEl) {
    thumbsEl.addEventListener(
      'click',
      (event) => {
        const thumbBtn = (event.target as Element).closest<HTMLElement>('[data-showcase-thumb]');
        if (!thumbBtn) return;
        event.preventDefault();
        go(Number(thumbBtn.dataset.showcaseThumb));
        schedule();
      },
      { signal }
    );
  }

  root.addEventListener(
    'mouseenter',
    () => {
      paused = true;
      schedule();
    },
    { signal }
  );
  root.addEventListener(
    'mouseleave',
    () => {
      paused = false;
      schedule();
    },
    { signal }
  );
  root.addEventListener(
    'focusin',
    () => {
      paused = true;
      schedule();
    },
    { signal }
  );
  root.addEventListener(
    'focusout',
    () => {
      paused = false;
      schedule();
    },
    { signal }
  );
  window.addEventListener('albaha:motion-change', schedule, { signal });
  document.addEventListener('visibilitychange', schedule, { signal });
  go(0);
  schedule();
  return { getIndex: () => index, go };
}
