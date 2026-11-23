import {
  geo,
  heroPhotos,
  images,
  places,
  stops,
  terrainProjection,
  toLngLat,
} from './portalStaticData';
import type { MapLibreNamespace, StopBase } from './portalTypes';

export const byId = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

export const qsAll = <T extends Element = HTMLElement>(selector: string): T[] =>
  Array.from(document.querySelectorAll<T>(selector));

const enNumberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
export const formatNum = (value: number): string => enNumberFormat.format(value);

export const glyph = (key: string, classes = 'ic'): string =>
  `<svg class="${classes}" aria-hidden="true"><use href="#i-${key}"/></svg>`;

export const normalizeAr = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u0640\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (char) => htmlEscapes[char]);

export const guideKey = (value: unknown): string =>
  String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ar')
    .replace(/[\u0640\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export function clock(minutes: number): string {
  const part = (val: number) => String(val).padStart(2, '0');
  return `${part(Math.floor(minutes / 60))}:${part(minutes % 60)}`;
}

export function durationLabel(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return [
    hours ? `${formatNum(hours)} س` : '',
    minutes || !hours ? `${formatNum(minutes)} د` : '',
  ]
    .filter(Boolean)
    .join(' و');
}

const arMonthFormat = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
  month: 'long',
  timeZone: 'UTC',
});
export const monthName = (month: number): string =>
  arMonthFormat.format(new Date(Date.UTC(2026, month - 1, 1)));

export const wrap = (value: number, length: number): number =>
  ((value % length) + length) % length;

export function tripDistance(a: Pick<StopBase, 'lat' | 'lng'>, b: Pick<StopBase, 'lat' | 'lng'>): number {
  const latitude = ((a.lat + b.lat) * Math.PI) / 360;
  return 111.2 * Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos(latitude));
}

export function tripLeg(a: StopBase, b: StopBase): { min: number; km: number | null; estimated: boolean } {
  const known = geo.routes[`${a.id}-${b.id}`];
  if (known) return { min: known.min, km: known.km, estimated: false };
  const km = tripDistance(a, b);
  return {
    min: Math.max(10, Math.ceil((5 + km * 2.15) / 5) * 5),
    km: null,
    estimated: true,
  };
}

export function nearbyOrder<T extends Pick<StopBase, 'lat' | 'lng'>>(
  list: T[],
  first: T = list[0]
): T[] {
  if (!list.length) return [];
  const remaining = list.filter((stop) => stop !== first);
  const ordered: T[] = [first];
  while (remaining.length) {
    const previous = ordered[ordered.length - 1];
    let nearest = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (tripDistance(previous, remaining[i]) < tripDistance(previous, remaining[nearest])) {
        nearest = i;
      }
    }
    ordered.push(...remaining.splice(nearest, 1));
  }
  return ordered;
}

export function pathFrom(points: [number, number][]): string {
  return 'M' + points.map((point) => point.join(',')).join('L');
}

export function gentleRouteCurve(
  first: [number, number],
  last: [number, number],
  geographic = false
): [number, number][] {
  const x1 = first[0];
  const y1 = first[1];
  const x2 = last[0];
  const y2 = last[1];
  const xWeight = geographic ? Math.cos((((y1 + y2) / 2) * Math.PI) / 180) : 1;
  const dx = (x2 - x1) * xWeight;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  if (distance < (geographic ? 0.0015 : 3)) return [first, last];
  const normalX = -dy / distance;
  const normalY = dx / distance;
  return Array.from({ length: 23 }, (_, index) => {
    const at = index / 22;
    const wave = 0.044 * Math.sin(2 * Math.PI * at) + 0.018 * Math.sin(4 * Math.PI * at);
    const offset = distance * wave;
    return [
      x1 + (x2 - x1) * at + (normalX * offset) / xWeight,
      y1 + (y2 - y1) * at + normalY * offset,
    ];
  });
}

export interface RouteSegment {
  approximate: boolean;
  points: [number, number][];
  coordinates: [number, number][];
}

export function getSegment(start: StopBase, stop: StopBase): RouteSegment {
  const road = geo.routes[`${start.id}-${stop.id}`];
  const intermediate = road ? road.points.slice(1, -1) : [];
  const approximate = intermediate.length === 0;
  const begin = geo.stations[start.id];
  const end = geo.stations[stop.id];
  return {
    approximate,
    points: approximate ? gentleRouteCurve(begin, end) : [begin, ...intermediate, end],
    coordinates: approximate
      ? gentleRouteCurve([start.lng, start.lat], [stop.lng, stop.lat], true)
      : [[start.lng, start.lat], ...intermediate.map(toLngLat), [stop.lng, stop.lat]],
  };
}

export function routePath(legs: RouteSegment[]): string {
  return legs
    .map((leg) => {
      const points = leg.points;
      if (!points.length) return '';
      if (!leg.approximate || points.length > 2) return pathFrom(points);
      const [[x1, y1], [x2, y2]] = points;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const swing = Math.min(24, Math.hypot(dx, dy) * 0.1);
      const length = Math.max(1, Math.hypot(dx, dy));
      const cx = (x1 + x2) / 2 - (dy / length) * swing;
      const cy = (y1 + y2) / 2 + (dx / length) * swing;
      return `M${x1},${y1}Q${cx},${cy} ${x2},${y2}`;
    })
    .join('');
}

export function projectSvgGeo(lat: number, lng: number): { x: number; y: number } {
  return {
    x: terrainProjection.x + (lng - terrainProjection.lng) * terrainProjection.xScale,
    y: terrainProjection.y - (lat - terrainProjection.lat) * terrainProjection.yScale,
  };
}

export function gallerySource(key: string): string {
  return key.startsWith('hero-') ? heroPhotos[key.slice(5)]?.wide || '' : images[key] || '';
}

export const subpageSvgMap: Record<string, string> = {
  clock:
    '<svg class="card-ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  mountain:
    '<svg class="card-ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 19 6-10 4 6 3-4 5 8H3Z"/><path d="m14 9 1-2"/></svg>',
  spark:
    '<svg class="card-ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 3v3M20.5 4.5h-3"/></svg>',
  area:
    '<svg class="card-ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  amenities:
    '<svg class="card-ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
  footsteps:
    '<svg class="card-ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="17" r="2.2"/><circle cx="18" cy="7" r="2.2"/><path d="M8.2 17H13a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h4.8"/></svg>',
  book:
    '<svg class="card-ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M8 7h8M8 11h6"/></svg>',
  compass:
    '<svg class="card-ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5"/></svg>',
};

export const cardHead = (iconHtml: string, label: string): string =>
  `<span class="card-ic-head"><span class="card-ic-badge" aria-hidden="true">${iconHtml}</span><span>${label}</span></span>`;

export function guideFactIcon(label: string): string {
  const s = String(label || '');
  if (/المحافظة|المنطقة|المدينة|الموقع|النطاق|الوصول/.test(s)) return glyph('pin', 'card-ic-svg');
  if (/الارتفاع|جبل/.test(s)) return subpageSvgMap.mountain;
  if (/ساعات|الوقت|الموعد|مدة/.test(s)) return subpageSvgMap.clock;
  if (/العمارة|تراث|حجر|مسرح|المقتنيات|القلعة/.test(s)) return glyph('heritage', 'card-ic-svg');
  if (/المساحة|المسطحات|ممرات|الجلسات|البحيرة|ألعاب/.test(s)) return subpageSvgMap.area;
  if (/المرجع|المصدر|التصنيف/.test(s)) return subpageSvgMap.book;
  if (/التجربة|التجارب|المعروضات/.test(s)) return subpageSvgMap.spark;
  if (/المرافق|الخدمات|مواقف/.test(s)) return subpageSvgMap.amenities;
  return subpageSvgMap.compass;
}

export const supportsMotion = (): boolean =>
  typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

export const isMotionPaused = (): boolean =>
  document.documentElement.classList.contains('motion-paused');

export const motionAllowed = (): boolean =>
  supportsMotion() && !isMotionPaused() && !document.hidden;

export function isInViewport(element: Element): boolean {
  const { top, bottom, height, left, right } = element.getBoundingClientRect();
  return (
    height > 0 &&
    bottom > 0 &&
    top < window.innerHeight &&
    right > 0 &&
    left < window.innerWidth
  );
}

export function stopAnimations(animations: Animation[]): void {
  animations.forEach((animation) => animation.cancel());
}

export function enterMotion(
  elements: Iterable<Element>,
  { delay = 0, step = 105, direction = 0, duration = 760 } = {}
): Animation[] {
  if (!motionAllowed()) return [];
  return Array.from(elements, (element, index) => {
    const x = direction ? direction * (index === 1 ? 17 : 9) : 0;
    const y = x ? 12 : 24;
    return element.animate(
      [
        { opacity: 0, translate: `${x}px ${y}px`, transform: 'scale(0.985)', filter: 'blur(2px)' },
        { opacity: 1, translate: '0 0', transform: 'scale(1)', filter: 'blur(0)' },
      ],
      {
        duration,
        delay: delay + index * step,
        easing: 'cubic-bezier(.22, 1, .36, 1)',
        fill: 'backwards',
      }
    );
  });
}

export function crossfadePhotos(
  previous: HTMLElement,
  next: HTMLElement,
  direction: number,
  duration: number
): Animation[] {
  const shift = Math.sign(direction) * 2.4;
  const timing: KeyframeAnimationOptions = {
    duration,
    easing: 'cubic-bezier(.33, .03, .24, 1)',
  };
  return [
    previous.animate(
      [{ transform: 'scale(1)' }, { transform: `translateX(${-shift * 0.8}%) scale(1.07)` }],
      timing
    ),
    next.animate(
      [
        { opacity: 0, transform: `translateX(${shift}%) scale(1.095)` },
        { opacity: 1, transform: 'scale(1)' },
      ],
      timing
    ),
  ];
}

export function makePhotoSwitcher(
  photo: HTMLImageElement,
  signal: AbortSignal
): (src: string, alt: string, direction?: number) => void {
  const underlay = photo.cloneNode(false) as HTMLImageElement;
  underlay.removeAttribute('id');
  underlay.removeAttribute('loading');
  underlay.alt = '';
  underlay.setAttribute('aria-hidden', 'true');
  underlay.classList.add('photo-underlay');
  underlay.hidden = true;
  photo.before(underlay);

  let sequence = 0;
  let animations: Animation[] = [];

  const clearUnderlay = () => {
    underlay.hidden = true;
    underlay.removeAttribute('src');
  };

  signal.addEventListener(
    'abort',
    () => {
      stopAnimations(animations);
      animations = [];
      underlay.remove();
    },
    { once: true }
  );

  window.addEventListener(
    'albaha:motion-change',
    () => {
      if (!isMotionPaused()) return;
      stopAnimations(animations);
      animations = [];
      clearUnderlay();
    },
    { signal }
  );

  return (src: string, alt: string, direction = 1) => {
    if (signal.aborted) return;
    const request = ++sequence;
    const previous = photo.getAttribute('src');
    const canFade = () =>
      motionAllowed() && isInViewport(photo) && Boolean(previous) && photo.complete && photo.naturalWidth > 0;

    const commit = () => {
      if (request !== sequence || signal.aborted) return;
      if (src === previous) {
        photo.alt = alt;
        return;
      }
      stopAnimations(animations);
      animations = [];
      const fade = canFade();
      if (fade && previous) {
        underlay.src = previous;
        underlay.hidden = false;
      } else {
        clearUnderlay();
      }
      photo.src = src;
      photo.alt = alt;
      if (!fade) return;
      animations = crossfadePhotos(underlay, photo, direction, 480);
      if (animations[1]) animations[1].onfinish = clearUnderlay;
    };

    if (src !== previous && canFade() && 'decode' in photo) {
      const preload = new Image();
      preload.src = src;
      preload.decode().then(commit, commit);
    } else {
      commit();
    }
  };
}

export interface SwipeOptions {
  start?: () => void;
  move?: (delta: number) => void;
  end: (delta: number) => void;
  release?: () => void;
  axis?: 'x' | 'y';
  canStart?: (event: PointerEvent) => boolean;
}

export function bindSwipe(
  element: HTMLElement,
  { start, move, end, release, axis: swipeAxis = 'x', canStart = () => true }: SwipeOptions,
  signal: AbortSignal
): void {
  let pointer: { id: number; x: number; y: number; axis: 'x' | 'y' | null } | null = null;
  let suppressClick = false;

  element.addEventListener('dragstart', (event) => event.preventDefault(), { signal });
  element.addEventListener(
    'pointerdown',
    (event) => {
      if (pointer || !event.isPrimary || event.button !== 0) return;
      suppressClick = false;
      if (!canStart(event)) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
      (event.target as Element)?.setPointerCapture?.(event.pointerId);
    },
    { signal }
  );
  element.addEventListener(
    'pointermove',
    (event) => {
      if (pointer?.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 9) {
        pointer.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (pointer.axis === swipeAxis) start?.();
      }
      if (pointer.axis === swipeAxis) move?.(swipeAxis === 'y' ? dy : dx);
    },
    { signal }
  );

  const finish = (event: PointerEvent) => {
    if (pointer?.id !== event.pointerId) return;
    const { x, y, axis } = pointer;
    pointer = null;
    if (axis === swipeAxis) {
      suppressClick = true;
      const delta = swipeAxis === 'y' ? event.clientY - y : event.clientX - x;
      end(event.type === 'pointerup' ? delta : 0);
    }
    release?.();
  };

  element.addEventListener('pointerup', finish, { signal });
  element.addEventListener('pointercancel', finish, { signal });
  element.addEventListener('lostpointercapture', finish, { signal });
  element.addEventListener(
    'click',
    (event) => {
      if (!suppressClick || !event.detail) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true, signal }
  );
}

const mapLibreRoot = 'https://cdn.jsdelivr.net/npm/maplibre-gl@6.17.0/dist/';
export const STREET_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
let mapLibrePromise: Promise<MapLibreNamespace> | null = null;

export function loadMapLibreLibrary(): Promise<MapLibreNamespace> {
  if (mapLibrePromise) return mapLibrePromise;

  const existingLink = document.querySelector<HTMLLinkElement>(
    `link[href="${mapLibreRoot}maplibre-gl.css"]`
  );
  const stylesheet = existingLink || document.createElement('link');
  const styleLoaded = existingLink
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
        stylesheet.onload = () => resolve();
        stylesheet.onerror = () => reject(new Error('MapLibre CSS error'));
      });

  if (!existingLink) {
    stylesheet.rel = 'stylesheet';
    stylesheet.href = mapLibreRoot + 'maplibre-gl.css';
    document.head.append(stylesheet);
  }

  const runtimeImport = (import(
    /* webpackIgnore: true */ mapLibreRoot + 'maplibre-gl.mjs'
  ) as Promise<MapLibreNamespace>);

  mapLibrePromise = Promise.race([
    Promise.all([runtimeImport, styleLoaded]).then(([library]) => library),
    new Promise<MapLibreNamespace>((_, reject) =>
      setTimeout(() => reject(new Error('MapLibre timeout')), 7000)
    ),
  ]).catch((err) => {
    if (!existingLink) stylesheet.remove();
    mapLibrePromise = null;
    throw err;
  });

  return mapLibrePromise;
}

export function allStopIds(): Set<string> {
  return new Set(stops.map((s) => s.id));
}

export { places };
