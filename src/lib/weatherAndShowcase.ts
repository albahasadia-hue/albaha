import { formatNum, glyph, isMotionPaused } from './portalHelpers';
import { climateCities, places, seasons } from './portalStaticData';
import type { ForecastData, ForecastHour, MediaShowcaseItem, SeasonKey, StopBase } from './portalTypes';

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

type WeatherLocation = Pick<StopBase, 'lat' | 'lng'>;

export function forecast(cityKey: string, location?: WeatherLocation): Promise<ForecastData | null> {
  const point = location ?? climateCities[cityKey];
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return Promise.resolve(null);
  }
  const cacheKey = `${point.lat},${point.lng}`;
  const cached = forecastCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.promise;

  const params = new URLSearchParams({
    latitude: String(point.lat),
    longitude: String(point.lng),
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
  forecastCache.set(cacheKey, entry);
  promise.then((data) => {
    if (!data) entry.at = Date.now() - 9.5 * 60 * 1000;
  });
  return promise;
}

const skyDescriptions: Partial<Record<number, string>> = {
  0: 'والسماء صافية',
  1: 'مع غيوم قليلة',
  2: 'والسماء غائمة جزئيًا',
  3: 'والسماء غائمة',
  45: 'مع ضباب',
  48: 'مع ضباب',
};

const precipitationDescriptions: Partial<Record<number, string>> = {
  51: 'رذاذ خفيف',
  53: 'رذاذ',
  55: 'رذاذ كثيف',
  56: 'رذاذ متجمّد',
  57: 'رذاذ متجمّد',
  61: 'أمطار خفيفة',
  63: 'أمطار متوسطة',
  65: 'أمطار غزيرة',
  66: 'أمطار متجمّدة خفيفة',
  67: 'أمطار متجمّدة غزيرة',
  71: 'تساقط خفيف للثلوج',
  73: 'تساقط للثلوج',
  75: 'تساقط كثيف للثلوج',
  77: 'تساقط حبيبات ثلجية',
  80: 'زخات مطر خفيفة',
  81: 'زخات مطر متوسطة',
  82: 'زخات مطر غزيرة',
  85: 'زخات ثلج خفيفة',
  86: 'زخات ثلج كثيفة',
  95: 'عواصف رعدية',
  96: 'عواصف رعدية مع تساقط البَرَد',
  97: 'عواصف رعدية قوية',
  99: 'عواصف رعدية مع تساقط كثيف للبَرَد',
};

function describeForecastHour({ temp, code, rain }: ForecastHour): string {
  let temperature = 'حارّة';
  if (temp < 12) temperature = 'باردة';
  else if (temp < 19) temperature = 'مائلة للبرودة';
  else if (temp < 26) temperature = 'لطيفة';
  else if (temp < 32) temperature = 'دافئة';

  const description = `الأجواء ${temperature}`;
  const precipitation = precipitationDescriptions[code];
  if (precipitation) return `${description} مع ${precipitation}.`;

  const sky = skyDescriptions[code];
  const outlook = sky ? `${description} ${sky}` : description;
  if (rain >= 50) return `${outlook}، والأمطار مرجّحة.`;
  if (rain >= 25) return `${outlook}، مع احتمال هطول أمطار.`;
  if (rain > 0) return `${outlook}، مع احتمال ضعيف لهطول أمطار.`;
  return `${outlook}، ولا أمطار متوقعة.`;
}

export function renderWeatherCard(element: HTMLElement | null, cityKey: string): void {
  if (!element) return;
  const location = places.get(element.dataset.weatherPlace ?? '');

  element.innerHTML = '<p class="m-0 text-sm text-baha-royal">جارٍ تحميل حالة الطقس…</p>';
  forecast(cityKey, location).then((data) => {
    if (!element.isConnected) return;
    if (!data) {
      element.innerHTML = '<p class="m-0 text-sm text-baha-royal">حالة الطقس غير متاحة حاليًا.</p>';
      return;
    }

    const { current, hours } = data;
    const currentHour = Date.parse(`${current.time.slice(0, 13)}:00:00+03:00`);
    const next = hours.find(({ time }) => Date.parse(`${time}:00+03:00`) === currentHour + 3_600_000);

    element.innerHTML = `
      <div class="place-weather-summary grid grid-cols-1 items-center gap-3 rounded-baha border border-solid border-slate-200 bg-gradient-to-br from-emerald-50 to-blue-50 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-5">
        <div class="grid gap-1 sm:border-e sm:border-solid sm:border-slate-200 sm:pe-5">
          <span class="text-sm font-semibold text-baha-royal">درجة الحرارة الآن</span>
          <strong class="font-heading text-[clamp(1.65rem,2.6vw,2.25rem)] font-bold leading-tight tabular-nums text-baha-royalDeep"><bdi dir="ltr">${Math.round(current.temperature_2m)}°C</bdi></strong>
        </div>
        <div class="grid min-w-0 gap-1 border-t border-solid border-slate-200 pt-3 sm:border-t-0 sm:pt-0">
          <span class="text-sm font-semibold text-baha-royal">خلال الساعة القادمة</span>
          <p class="m-0 text-[0.9375rem] leading-relaxed text-baha-royalDeep">${next ? describeForecastHour(next) : 'التوقعات غير متاحة حاليًا.'}</p>
        </div>
      </div>`;
  });
}

export function localWeatherMarkup(
  cityKey: string,
  id: string,
  currentSeason: SeasonKey,
  _selectedSeason: SeasonKey
): string {
  return `<section class="place-weather-strip" aria-labelledby="weatherTitle">
    <div class="place-weather-head">
      <div class="place-weather-title">
        <h2 id="weatherTitle">${glyph('weather', 'ic place-weather-ic')}<span>الأحوال والطقس (${seasons[currentSeason].name})</span></h2>
      </div>
      <div class="seraj-city-actions">
        <button type="button" class="btn btn-dark" data-weather-plan="${cityKey}" data-visit-id="${id}">خطّط حسب الأجواء ${glyph('route')}</button>
      </div>
    </div>
    <div class="place-weather-body">
      <div id="placeWeather" data-weather-place="${id}" aria-live="polite"></div>
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
