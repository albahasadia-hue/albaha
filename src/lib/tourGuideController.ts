import type {
  GuideCategory,
  GuideRecord,
  IndexedGuideRecord,
  MapLibreMapInstance,
  MapLibreMarkerInstance,
  MapLibreNamespace,
  MediaShowcaseItem,
  StopBase,
} from './portalTypes';
import {
  alBahaRegionsSvg,
  createGuideRecordIndex,
  directoryAdvice,
  directoryMediaSets,
  domMedia,
  geo,
  images,
  places,
  tourGuide,
  tourGuideArtMap,
  tourGuideCategoryIcons,
  tourGuideCategoryMedia,
  tourGuideShortSubtitles,
} from './portalStaticData';
import {
  byId,
  cardHead,
  formatNum,
  glyph,
  guideFactIcon,
  guideKey,
  loadMapLibreLibrary,
  pathFrom,
  projectSvgGeo,
  subpageSvgMap,
} from './portalHelpers';
import { bindMediaShowcase, mediaShowcaseMarkup, openUnifiedLightbox } from './weatherAndShowcase';
import {
  getGuide144ById,
  getGuide144ByTourGuideId,
  NEUTRAL_PLACEHOLDER_IMAGE,
  type EnrichedGuide144Item,
} from './guideCatalog144';

export interface TourGuideFilterState {
  category: string;
  district: string;
  query: string;
  view: 'list' | 'map';
  limit: number;
}

export interface TourGuideControllerDeps {
  signal: AbortSignal;
  getChoices: () => Set<string>;
  getLastHash: () => string;
  getScrollBehavior: () => ScrollBehavior;
  toggleStop: (stop: StopBase) => void;
}

export interface TourGuideFilterOptions {
  category?: string;
  district?: string;
  query?: string;
  view?: 'list' | 'map';
}

export interface TourGuideController {
  filter: TourGuideFilterState;
  getGuideRecords: () => IndexedGuideRecord[];
  hasPlace: (id: string) => boolean;
  showTourGuide: (id?: string) => void;
  openFiltered: (opts?: TourGuideFilterOptions) => void;
  refreshTourGuide: () => void;
  updateTourGuideTrip: () => void;
  destroyGuideLiveMap: () => void;
  cleanupView: () => void;
}

interface GuideMapNode {
  place: GuideRecord;
  lat: number;
  lng: number;
  x: number;
  y: number;
}

interface SvgViewBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const guideEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const guideText = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => guideEscapes[char]);

const guideTermStems: Record<string, string[]> = {
  متنزه: ['منتزه', 'متنزه', 'حديق'],
  منتزه: ['منتزه', 'متنزه', 'حديق'],
  متنزهات: ['منتزه', 'متنزه'],
  منتزهات: ['منتزه', 'متنزه'],
  فنادق: ['فندق', 'منتجع'],
  فندق: ['فندق', 'منتجع'],
  شاليهات: ['شاليه', 'منتجع'],
  شاليه: ['شاليه', 'منتجع'],
  مطاعم: ['مطعم'],
  مقاهي: ['مقهي', 'قهوه', 'كوفي', 'كافيه'],
  مقهي: ['مقهي', 'قهوه', 'كوفي', 'كافيه'],
  كافيه: ['مقهي', 'كافيه', 'قهوه'],
  كافيهات: ['مقهي', 'كافيه', 'قهوه'],
  كوفي: ['مقهي', 'كوفي', 'قهوه'],
  كوفيهات: ['مقهي', 'كوفي', 'قهوه'],
  مولات: ['مول', 'سوق'],
  اسواق: ['سوق'],
  مزارع: ['مزرع'],
  شلالات: ['شلال'],
  اوديه: ['وادي'],
  حدائق: ['حديق'],
  متاحف: ['متحف'],
  قري: ['قريه'],
  حديقه: ['حديقه', 'حديق'],
};

function guideTermVariants(rawTerm: string): string[] {
  const out = new Set([rawTerm]);
  if (rawTerm.startsWith('ال') && rawTerm.length >= 4) out.add(rawTerm.slice(2));
  for (const candidate of [...out]) {
    if (guideTermStems[candidate]) guideTermStems[candidate].forEach((v) => out.add(v));
    if (candidate.endsWith('ات') && candidate.length >= 5) out.add(candidate.slice(0, -2));
  }
  return [...out];
}

const guideSearchStopWords = new Set(['في', 'من', 'علي', 'الي', 'عن', 'مع']);

function guideQueryTerms(query: string): string[] {
  const raw = guideKey(query).split(' ').filter(Boolean);
  const meaningful = raw.filter((t) => !guideSearchStopWords.has(t));
  return meaningful.length ? meaningful : raw;
}

const tourGuideHref = (place: { id: string }): string => `#guide/place/${place.id}`;

function guideCardBrief(place: GuideRecord): string {
  if (tourGuideShortSubtitles[place.id]) return tourGuideShortSubtitles[place.id];
  const cleanAddr =
    place.address
      .split(/\s+[·–-]\s+/)
      .filter((part) => guideKey(part) !== guideKey(place.name))
      .join(' · ') || place.address;
  let raw = (place.description || cleanAddr || place.district || '').trim();
  raw = raw.split(/[.؛\n]/)[0].trim();
  if (raw.length > 32 && raw.includes('،')) raw = raw.split('،')[0].trim();
  if (raw.length > 32) {
    const words = raw.split(/\s+/);
    let out = '';
    for (const word of words) {
      const candidate = out ? `${out} ${word}` : word;
      if (candidate.length > 32) break;
      out = candidate;
    }
    raw = (out || words[0] || '')
      .replace(/\s+(?:و|في|من|على|عن|إلى|مع|أو|بين|تضم|يضم|حول)$/u, '')
      .trim();
  }
  return raw.replace(/[.,،؛…]+$/gu, '').trim();
}

function guideTrail(place?: GuideRecord | null): string {
  return `<nav class="place-trail" aria-label="مسار الصفحة"><a href="#home">الرئيسية</a><span aria-hidden="true">/</span>${
    place
      ? `<a href="#guide">الدليل</a><span aria-hidden="true">/</span><span aria-current="page">${guideText(place.name)}</span>`
      : '<span aria-current="page">الدليل السياحي</span>'
  }</nav>`;
}

function directoryMedia(place: GuideRecord): Array<{ key: string; real: boolean }> {
  const used = new Set<string>();
  const out: Array<{ key: string; real: boolean }> = [];
  const add = (key: string | undefined, real: boolean) => {
    if (!key || used.has(key)) return;
    used.add(key);
    out.push({ key, real });
  };
  if (place.photo) add(place.photo, true);
  for (const key of directoryMediaSets[place.category] || directoryMediaSets.parks) {
    add(key, false);
  }
  return out.slice(0, 5);
}

function tourGuideSourceLabel(source = ''): string {
  if (source.includes('bso.gov.sa')) return 'المكتب الاستراتيجي لتطوير منطقة الباحة';
  if (source.includes('visitsaudi.com')) return 'دليل صيف السعودية';
  if (source.includes('saudipedia.com')) return 'سعوديبيديا';
  if (source.includes('gamramountainresort.com')) return 'منتجع قمرة الجبلي';
  return 'أمانة منطقة الباحة';
}

function prepareGuideMapNodes(pinned: GuideRecord[]): GuideMapNode[] {
  const placed: Array<{ lat0: number; lng0: number }> = [];
  return pinned.map((place) => {
    const [lat0, lng0] = place.coordinates!;
    const nearby = placed.filter((p) => Math.hypot(p.lat0 - lat0, p.lng0 - lng0) < 0.0007).length;
    let lat = lat0;
    let lng = lng0;
    if (nearby > 0) {
      const angle = nearby * 2.1;
      lat = lat0 + Math.sin(angle) * 0.0012;
      lng = lng0 + Math.cos(angle) * 0.0015;
    }
    placed.push({ lat0, lng0 });
    const pt = projectSvgGeo(lat, lng);
    return { place, lat, lng, x: pt.x, y: pt.y };
  });
}

function svgBboxForNodes(nodes: GuideMapNode[]): SvgViewBox {
  const xs = nodes.map((item) => item.x);
  const ys = nodes.map((item) => item.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(460, maxX - minX + 200, (maxY - minY + 150) * 1.85);
  const height = width / 1.85;
  return {
    left: (minX + maxX - width) / 2,
    top: (minY + maxY - height) / 2,
    width,
    height,
  };
}

export function createTourGuideController(deps: TourGuideControllerDeps): TourGuideController {
  const { signal } = deps;
  const tourGuideView = byId('tourGuideView');
  const tourGuideCategories = new Map<string, GuideCategory>(
    tourGuide.categories.map((category) => [category.id, category])
  );
  const tourGuidePlaces = new Map<string, GuideRecord>(
    tourGuide.records.map((place) => [place.id, place])
  );

  function map144CategoryToGuideCategory(catKey: string): string {
    switch (catKey) {
      case 'hotels_resorts':
        return 'hotels';
      case 'restaurants_cafes':
        return 'restaurants';
      case 'forests_parks_waterfalls':
        return 'parks';
      case 'heritage_villages_museums':
        return 'heritage';
      case 'souqs_shopping_entertainment':
        return 'malls';
      case 'farms_local_products':
        return 'farms';
      default:
        return 'parks';
    }
  }

  function resolveGuidePlaceById(id: string): { place: GuideRecord; item144: EnrichedGuide144Item | null } | null {
    const existing = tourGuidePlaces.get(id);
    if (existing) {
      return { place: existing, item144: getGuide144ByTourGuideId(id) || null };
    }
    const dynMatch = id.match(/^g-(\d+)$/);
    if (dynMatch) {
      const item144 = getGuide144ById(Number(dynMatch[1]));
      if (item144) {
        const synthetic: GuideRecord = {
          id,
          name: item144.name,
          category: map144CategoryToGuideCategory(item144.categoryKey),
          district: item144.governorate,
          address: item144.address || item144.governorate,
          description: item144.description,
          coordinates: item144.coordinates || undefined,
          trip: item144.stopId || undefined,
          phone: item144.phones[0]?.display,
          url: item144.officialWebsite?.url || item144.bookingLink?.url,
          source: item144.sourceLink?.url || item144.officialWebsite?.url || tourGuide.source,
          sourceLabel: item144.sourceLink?.label || 'دليل منطقة الباحة السياحي',
          facts: [
            ...(item144.type ? [['النوع', item144.type] as [string, string]] : []),
            ...(item144.ratingRaw ? [['التقييم في الدليل', item144.ratingRaw] as [string, string]] : []),
            ...(item144.priceRange ? [['نطاق الأسعار التقريبي', item144.priceRange] as [string, string]] : []),
            ...(item144.contactAndBooking ? [['التواصل والحجز', item144.contactAndBooking] as [string, string]] : []),
          ],
        };
        return { place: synthetic, item144 };
      }
    }
    return null;
  }
  const tourGuideDistricts = [...new Set(tourGuide.records.map((place) => place.district))].sort(
    (a, b) => a.localeCompare(b, 'ar')
  );
  const tourGuideDistrictCounts = new Map(
    tourGuideDistricts.map((d) => [
      d,
      tourGuide.records.filter((place) => place.district === d).length,
    ])
  );
  const tourGuideCategoryCounts = new Map(
    tourGuide.categories.map((category) => [
      category.id,
      tourGuide.records.filter((place) => place.category === category.id).length,
    ])
  );

  const filter: TourGuideFilterState = {
    category: '',
    district: '',
    query: '',
    view: 'list',
    limit: 12,
  };

  let tourGuideListScroll = 0;
  let tourGuideCategoryOffset = 0;
  let guideSuggestOpen = false;
  let guideLiveMap: {
    map: MapLibreMapInstance;
    library: MapLibreNamespace;
    markers: MapLibreMarkerInstance[];
  } | null = null;
  let guideMapGen = 0;
  let viewAbortController: AbortController | null = null;

  const roadsPath = Object.entries(geo.routes)
    .filter(([id]) => {
      const [first, last] = id.split('-');
      return first < last || !geo.routes[`${last}-${first}`];
    })
    .map(([, road]) => pathFrom(road.points))
    .join('');

  const tourGuideSearchIndex = new Map<string, string>(
    tourGuide.records.map((place) => [
      place.id,
      guideKey(
        [
          place.name,
          place.address,
          place.district,
          tourGuideCategories.get(place.category)?.label || '',
          place.description || '',
          (place.facts || []).flat().join(' '),
          place.id === 'hotels-06' ? 'الفندقية' : '',
          place.id === 'restaurants-02' ? 'البستان' : '',
        ].join(' ')
      ),
    ])
  );

  const indexedGuideRecords: IndexedGuideRecord[] = createGuideRecordIndex(guideKey);

  const fallbackGuideImage = images.parks || '/media/photo-parks.webp';
  const tourGuideImageUrls = new Map<string, string>();
  function tourGuideImageUrl(key: string): string {
    if (!tourGuideImageUrls.has(key)) {
      const rawSrc = tourGuideArtMap[key] || images[key] || fallbackGuideImage;
      if (!rawSrc.startsWith('data:')) {
        tourGuideImageUrls.set(key, rawSrc);
      } else {
        const [header, encoded] = rawSrc.split(',', 2);
        const raw = atob(encoded);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const type = header.slice(5, header.indexOf(';'));
        tourGuideImageUrls.set(key, URL.createObjectURL(new Blob([bytes], { type })));
      }
    }
    return tourGuideImageUrls.get(key) || fallbackGuideImage;
  }

  function tourGuidePlaceImage(place: GuideRecord): string {
    if (place.photo) return tourGuideImageUrl(place.photo);
    const variants = tourGuideCategoryMedia[place.category] || tourGuideCategoryMedia.parks;
    const index = Number(place.id.match(/-(\d+)$/)?.[1] || 0);
    return tourGuideImageUrl(variants[index % variants.length]);
  }

  const guideCategoryIcon = (category: GuideCategory): string =>
    tourGuideCategoryIcons[category.id] || category.icon;

  function guideMatchesRecord(place: GuideRecord, state: TourGuideFilterState): boolean {
    if (state.category && state.category !== place.category) return false;
    if (state.district && state.district !== place.district) return false;
    const terms = guideQueryTerms(state.query);
    if (!terms.length) return true;
    const blob = tourGuideSearchIndex.get(place.id) || '';
    return terms.every((term) => guideTermVariants(term).some((variant) => blob.includes(variant)));
  }

  function guideShowcaseItems(place: GuideRecord): MediaShowcaseItem[] {
    const category = tourGuideCategories.get(place.category)!;
    return directoryMedia(place).map((photo) => ({
      src: tourGuideImageUrl(photo.key),
      caption: `${place.name} · ${place.district || category.label}`,
      alt: place.name,
    }));
  }

  function cleanupView(): void {
    destroyGuideLiveMap();
    viewAbortController?.abort();
    viewAbortController = null;
  }

  function newViewSignal(): AbortSignal {
    cleanupView();
    const controller = new AbortController();
    viewAbortController = controller;
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }

  function destroyGuideLiveMap(): void {
    guideMapGen += 1;
    if (guideLiveMap) {
      try {
        guideLiveMap.markers?.forEach((m) => m.remove());
        guideLiveMap.map?.remove();
      } catch {
        // Ignore teardown errors when container detaches
      }
      guideLiveMap = null;
    }
  }

  function renderGuideFallbackSvg(nodes: GuideMapNode[], box: SvgViewBox): string {
    const terrainHref = byId('terrainRelief')?.getAttribute('href') || domMedia.terrainRelief;
    const dotR = Math.max(4.5, box.width / 115);
    const fontSize = Math.max(8, box.width / 68);
    const pillH = fontSize * 1.95;
    const placedBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = nodes.map((nd) => ({
      x1: nd.x - dotR - 2,
      y1: nd.y - dotR - 2,
      x2: nd.x + dotR + 2,
      y2: nd.y + dotR + 2,
    }));

    const fitsBox = (c: { x1: number; y1: number; x2: number; y2: number }) =>
      !placedBoxes.some((b) => !(c.x2 < b.x1 || c.x1 > b.x2 || c.y2 < b.y1 || c.y1 > b.y2)) &&
      c.x1 >= box.left + 8 &&
      c.x2 <= box.left + box.width - 8 &&
      c.y1 >= box.top + 48 &&
      c.y2 <= box.top + box.height - 10;

    // Place pinned location labels FIRST so search results are always clearly named on the map
    const pinsHtml = nodes
      .map(({ place, x, y }) => {
        const label = guideText(place.name);
        const textW = Math.max(54, label.length * fontSize * 0.62);
        const pillW = textW + fontSize * 1.5;
        const gap = dotR * 1.5;
        const slots: Array<[number, number]> = [
          [x + gap, y - pillH / 2],
          [x - gap - pillW, y - pillH / 2],
          [x - pillW / 2, y - gap - pillH],
          [x - pillW / 2, y + gap],
        ];
        let chosen: { x1: number; y1: number; x2: number; y2: number; rx: number; ry: number } | null =
          null;
        for (const [rx, ry] of slots) {
          const cand = {
            x1: rx - 2,
            y1: ry - 2,
            x2: rx + pillW + 2,
            y2: ry + pillH + 2,
            rx,
            ry,
          };
          if (fitsBox(cand)) {
            chosen = cand;
            break;
          }
        }
        if (chosen) placedBoxes.push(chosen);
        const [rx, ry] = chosen ? [chosen.rx, chosen.ry] : slots[0];
        const ty = ry + pillH / 2;
        const pillGroup = `<g class="guide-svg-pill"><rect class="guide-svg-pill-bg" x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH.toFixed(1)}" rx="${(fontSize * 0.45).toFixed(1)}"/><text class="guide-svg-pill-txt" x="${(rx + pillW / 2).toFixed(1)}" y="${ty.toFixed(1)}" font-size="${fontSize.toFixed(1)}">${label}</text></g>`;
        return `<a href="${tourGuideHref(place)}" class="guide-svg-pin${chosen ? '' : ' is-compact'}" data-guide-pin-id="${place.id}" aria-label="${label}"><circle class="guide-svg-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotR.toFixed(1)}"/>${pillGroup}</a>`;
      })
      .join('');

    // Place regional / governorate city names in remaining free pockets
    const townsHtml = alBahaRegionsSvg
      .map((t) => {
        const p = projectSvgGeo(t.lat, t.lng);
        return { ...t, x: p.x, y: p.y };
      })
      .map((t) => {
        const cand = { x1: t.x - 42, y1: t.y - 12, x2: t.x + 42, y2: t.y + 12 };
        if (!fitsBox(cand)) return '';
        placedBoxes.push(cand);
        return `<g class="guide-svg-town${t.major ? ' is-major' : ''}"><text x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}">${t.name}</text></g>`;
      })
      .join('');

    return `<svg id="guideFallbackSvg" class="guide-fallback-svg" viewBox="${box.left.toFixed(1)} ${box.top.toFixed(1)} ${box.width.toFixed(1)} ${box.height.toFixed(1)}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="خريطة أماكن الدليل ومناطق الباحة">
      <rect x="${box.left - box.width}" y="${box.top - box.height}" width="${box.width * 3}" height="${box.height * 3}" fill="#eef4f0"/>
      <image class="guide-svg-relief" href="${terrainHref}" x="-1200" y="-1200" width="3050" height="3050"/>
      <path class="guide-svg-road-casing" d="${roadsPath}"/>
      <path class="guide-svg-road" d="${roadsPath}"/>
      <g class="guide-svg-towns">${townsHtml}</g>
      <g class="guide-svg-pins">${pinsHtml}</g>
    </svg>`;
  }

  function tourGuideMap(pinned: GuideRecord[]): string {
    const nodes = prepareGuideMapNodes(pinned);
    const box = svgBboxForNodes(nodes);
    const districts = [...new Set(pinned.map((p) => p.district).filter(Boolean))];
    const districtBar =
      districts.length > 1
        ? `<div class="guide-map-districts" role="group" aria-label="تركيز على المنطقة"><button type="button" class="guide-map-district-btn" data-guide-district="" aria-pressed="true">الكل (${formatNum(pinned.length)})</button>${districts.map((d) => `<button type="button" class="guide-map-district-btn" data-guide-district="${guideText(d)}" aria-pressed="false">${guideText(d)}</button>`).join('')}</div>`
        : '';
    return `<div class="tour-guide-map-layout">
      <figure class="tour-guide-map" id="guideMapPanel" data-guide-map-shell>
        <div class="guide-map-stage">
          <div class="guide-street-map" id="guideStreetMap" role="region" aria-label="خريطة شوارع ومعالم منطقة الباحة التفاعلية"></div>
          ${renderGuideFallbackSvg(nodes, box)}
          <div class="guide-map-topbar">
            <span class="guide-map-status" id="guideMapStatus">${glyph('map', 'ic tiny')} <span>${formatNum(pinned.length)} موقع على الخريطة</span></span>
            ${districtBar}
          </div>
          <div class="guide-map-controls" role="group" aria-label="التحكم في الخريطة">
            <button type="button" data-guide-map-fit aria-label="عرض جميع المواقع">${glyph('compass')}</button>
            <button type="button" data-guide-map-in aria-label="تكبير الخريطة">${glyph('plus')}</button>
            <button type="button" data-guide-map-out aria-label="تصغير الخريطة">${glyph('minus')}</button>
          </div>
          <div class="guide-map-card" id="guideMapCard" hidden role="region" aria-live="polite" aria-label="تفاصيل الموقع المحدد"></div>
        </div>
        <figcaption>
          <span>اضغط على أي موقع على الخريطة لعرض بطاقته والتفاصيل الكاملة</span>
          <span>© OpenStreetMap · © OpenMapTiles · OpenFreeMap</span>
        </figcaption>
      </figure>
    </div>`;
  }

  async function initGuideMap(pinned: GuideRecord[]): Promise<void> {
    const gen = ++guideMapGen;
    const panel = byId('guideMapPanel');
    const streetEl = byId('guideStreetMap');
    const fallbackSvg = byId('guideFallbackSvg');
    const cardEl = byId('guideMapCard');
    const statusEl = byId('guideMapStatus');
    const activeSignal = viewAbortController?.signal || signal;
    if (!panel || !streetEl || !pinned.length) return;

    const nodes = prepareGuideMapNodes(pinned);
    const byIdMap = new Map(nodes.map((node) => [node.place.id, node]));
    const baseBox = svgBboxForNodes(nodes);
    let svgViewBox = { ...baseBox };
    let activeDistrict = '';
    let activePinId = '';
    let syncPinLabels = () => {};

    const applySvgViewBox = (box: SvgViewBox) => {
      svgViewBox = box;
      fallbackSvg?.setAttribute(
        'viewBox',
        `${box.left.toFixed(1)} ${box.top.toFixed(1)} ${box.width.toFixed(1)} ${box.height.toFixed(1)}`
      );
    };

    const zoomSvgBox = (factor: number) => {
      const nw = Math.max(120, Math.min(2400, svgViewBox.width * factor));
      const nh = nw / 1.85;
      const cx = svgViewBox.left + svgViewBox.width / 2;
      const cy = svgViewBox.top + svgViewBox.height / 2;
      applySvgViewBox({ left: cx - nw / 2, top: cy - nh / 2, width: nw, height: nh });
    };

    const selectGuidePin = (id: string) => {
      const node = byIdMap.get(id);
      if (!node || !cardEl) return;
      activePinId = id;
      panel.querySelectorAll<HTMLElement>('[data-guide-pin-id]').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.guidePinId === id);
      });
      const place = node.place;
      const cat = tourGuideCategories.get(place.category)!;
      const mapUrl = guideText(
        place.map ||
          place.accessMap ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address} الباحة`)}`
      );
      cardEl.innerHTML = `
        <div class="guide-map-card-head">
          <div class="guide-map-card-badges">
            <span class="place-cat-pill">${glyph(guideCategoryIcon(cat), 'ic tiny')} ${guideText(cat.label)}</span>
            ${place.district ? `<span class="place-area-pill">${glyph('pin', 'ic tiny')} ${guideText(place.district)}</span>` : ''}
          </div>
          <button type="button" class="guide-map-card-close" id="guideMapCardClose" aria-label="إغلاق البطاقة">${glyph('x', 'ic tiny')}</button>
        </div>
        <h3>${guideText(place.name)}</h3>
        <p class="guide-map-card-addr">${glyph('pin', 'ic tiny')} ${guideText(place.address)}</p>
        <div class="guide-map-card-actions">
          <a class="btn btn-dark" href="${tourGuideHref(place)}">عرض التفاصيل ${glyph('arrow', 'ic tiny')}</a>
          <a class="btn btn-soft" href="${mapUrl}" target="_blank" rel="noopener">الخرائط ${glyph('external', 'ic tiny')}</a>
        </div>`;
      cardEl.hidden = false;
      syncPinLabels();
      byId('guideMapCardClose')?.addEventListener(
        'click',
        () => {
          cardEl.hidden = true;
          activePinId = '';
          panel
            .querySelectorAll('[data-guide-pin-id].is-active')
            .forEach((el) => el.classList.remove('is-active'));
          syncPinLabels();
        },
        { signal: activeSignal }
      );
      if (guideLiveMap?.map && panel.classList.contains('is-live-map')) {
        const m = guideLiveMap.map;
        if (!m.getBounds().contains([node.lng, node.lat])) {
          m.easeTo({ center: [node.lng, node.lat], duration: 350 });
        }
      }
    };

    const fitNodes = (subset: GuideMapNode[], animate = true) => {
      if (!subset.length) return;
      if (guideLiveMap?.map) {
        const { map, library } = guideLiveMap;
        if (subset.length === 1) {
          map.easeTo({
            center: [subset[0].lng, subset[0].lat],
            zoom: 14.5,
            duration: animate ? 420 : 0,
          });
        } else {
          const bounds = new library.LngLatBounds();
          subset.forEach((item) => bounds.extend([item.lng, item.lat]));
          map.fitBounds(bounds, {
            padding: { top: 72, right: 56, bottom: 56, left: 56 },
            maxZoom: 14,
            duration: animate ? 420 : 0,
          });
        }
      } else {
        applySvgViewBox(svgBboxForNodes(subset));
      }
    };

    panel.querySelectorAll<HTMLElement>('.guide-svg-pin').forEach((link) => {
      link.addEventListener(
        'click',
        (event) => {
          const id = link.dataset.guidePinId || '';
          if (activePinId !== id) {
            event.preventDefault();
            selectGuidePin(id);
          }
        },
        { signal: activeSignal }
      );
    });

    panel.querySelectorAll<HTMLElement>('[data-guide-district]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          activeDistrict = btn.dataset.guideDistrict || '';
          panel
            .querySelectorAll('[data-guide-district]')
            .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          const subset = activeDistrict
            ? nodes.filter((item) => item.place.district === activeDistrict)
            : nodes;
          fitNodes(subset, true);
          if (subset.length === 1) selectGuidePin(subset[0].place.id);
        },
        { signal: activeSignal }
      );
    });

    panel.querySelector('[data-guide-map-fit]')?.addEventListener(
      'click',
      () => {
        const subset = activeDistrict
          ? nodes.filter((item) => item.place.district === activeDistrict)
          : nodes;
        fitNodes(subset, true);
      },
      { signal: activeSignal }
    );
    panel.querySelector('[data-guide-map-in]')?.addEventListener(
      'click',
      () => {
        if (guideLiveMap?.map) guideLiveMap.map.zoomIn({ duration: 240 });
        else zoomSvgBox(0.74);
      },
      { signal: activeSignal }
    );
    panel.querySelector('[data-guide-map-out]')?.addEventListener(
      'click',
      () => {
        if (guideLiveMap?.map) guideLiveMap.map.zoomOut({ duration: 240 });
        else zoomSvgBox(1.35);
      },
      { signal: activeSignal }
    );

    if (nodes.length === 1) selectGuidePin(nodes[0].place.id);

    let map: MapLibreMapInstance | undefined;
    try {
      const library = await loadMapLibreLibrary();
      if (gen !== guideMapGen || !streetEl.isConnected || activeSignal.aborted) return;
      map = new library.Map({
        container: streetEl,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [41.44, 20.01],
        zoom: 11,
        minZoom: 7,
        maxZoom: 18,
        attributionControl: false,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
      });
      map.touchZoomRotate.disableRotation();

      const markers = nodes.map((node) => {
        const cat = tourGuideCategories.get(node.place.category)!;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'guide-street-pin';
        btn.dataset.guidePinId = node.place.id;
        btn.setAttribute(
          'aria-label',
          `${guideText(node.place.name)} — ${guideText(node.place.district || '')}`
        );
        btn.innerHTML = `<span class="guide-street-pin-inner"><span class="guide-street-pin-dot" aria-hidden="true">${glyph(guideCategoryIcon(cat), 'ic tiny')}</span><span class="guide-street-pin-name" dir="rtl">${guideText(node.place.name)}</span></span>`;
        btn.addEventListener('click', () => selectGuidePin(node.place.id), {
          signal: activeSignal,
        });
        const marker = new library.Marker({ element: btn, anchor: 'center' })
          .setLngLat([node.lng, node.lat])
          .addTo(map!);
        return { marker, btn, node };
      });

      const layoutStreetLabels = () => {
        if (!map || gen !== guideMapGen) return;
        const cw = streetEl.clientWidth || 800;
        const ch = streetEl.clientHeight || 500;
        const projected = markers.map((item) => {
          const pt = map!.project([item.node.lng, item.node.lat]);
          const labelW = Math.min(
            160,
            Math.max(66, guideText(item.node.place.name).length * 7.1 + 22)
          );
          return { item, x: pt.x, y: pt.y, labelW, labelH: 25 };
        });
        const dotBoxes = projected.map((e) => ({
          e,
          x1: e.x - 14,
          y1: e.y - 14,
          x2: e.x + 14,
          y2: e.y + 14,
        }));
        const kept: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
        const overlapsRect = (
          a: { x1: number; y1: number; x2: number; y2: number },
          b: { x1: number; y1: number; x2: number; y2: number }
        ) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
        const ordered = [...projected].sort(
          (a, b) =>
            (b.item.node.place.id === activePinId ? 1 : 0) -
            (a.item.node.place.id === activePinId ? 1 : 0)
        );
        for (const entry of ordered) {
          const { item, x, y, labelW, labelH } = entry;
          const isActive = item.node.place.id === activePinId;
          const candidates = [
            { pos: 'top', x1: x - labelW / 2, y1: y - 17 - labelH, x2: x + labelW / 2, y2: y - 17 },
            { pos: 'right', x1: x + 17, y1: y - labelH / 2, x2: x + 17 + labelW, y2: y + labelH / 2 },
            { pos: 'left', x1: x - 17 - labelW, y1: y - labelH / 2, x2: x - 17, y2: y + labelH / 2 },
            { pos: 'bottom', x1: x - labelW / 2, y1: y + 17, x2: x + labelW / 2, y2: y + 17 + labelH },
          ];
          const chosen = candidates.find(
            (c) =>
              c.x1 >= 50 &&
              c.x2 <= cw - 12 &&
              c.y1 >= 58 &&
              c.y2 <= ch - 12 &&
              !kept.some((b) => overlapsRect(c, b)) &&
              !dotBoxes.some((d) => d.e !== entry && overlapsRect(c, d))
          );
          if (chosen) {
            item.btn.dataset.pinPos = chosen.pos;
            item.btn.classList.remove('is-compact');
            kept.push({
              x1: chosen.x1 - 3,
              y1: chosen.y1 - 3,
              x2: chosen.x2 + 3,
              y2: chosen.y2 + 3,
            });
          } else if (isActive) {
            item.btn.dataset.pinPos = 'top';
            item.btn.classList.remove('is-compact');
            kept.push(candidates[0]);
          } else {
            item.btn.dataset.pinPos = 'top';
            item.btn.classList.add('is-compact');
          }
        }
      };

      guideLiveMap = { map, library, markers: markers.map((m) => m.marker) };
      syncPinLabels = layoutStreetLabels;
      fitNodes(nodes, false);
      layoutStreetLabels();
      map.on('zoomend', layoutStreetLabels);
      map.on('moveend', layoutStreetLabels);

      map.once('load', () => {
        if (gen === guideMapGen) map?.resize();
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          map?.off('idle', ready);
          reject(new Error('Map tiles timeout'));
        }, 12000);
        const onAbort = () => {
          window.clearTimeout(timeout);
          map?.off('idle', ready);
          resolve();
        };
        activeSignal.addEventListener('abort', onAbort, { once: true });
        const ready = () => {
          if (gen !== guideMapGen || activeSignal.aborted) {
            window.clearTimeout(timeout);
            map?.off('idle', ready);
            resolve();
            return;
          }
          if (map!.areTilesLoaded() && map!.queryRenderedFeatures().some((f) => f.source)) {
            window.clearTimeout(timeout);
            map!.off('idle', ready);
            resolve();
          }
        };
        map!.on('idle', ready);
      });
      if (gen !== guideMapGen || !streetEl.isConnected || activeSignal.aborted) {
        map.remove();
        return;
      }
      panel.classList.add('is-live-map');
      map.resize();
      fitNodes(
        activeDistrict ? nodes.filter((i) => i.place.district === activeDistrict) : nodes,
        false
      );
      layoutStreetLabels();
      if (statusEl) {
        statusEl.innerHTML = `${glyph('map', 'ic tiny')} <span>${formatNum(pinned.length)} موقع على خريطة الشوارع</span>`;
      }
    } catch {
      try {
        map?.remove();
      } catch {
        // Ignore cleanup failure
      }
      if (guideLiveMap?.map === map) guideLiveMap = null;
    }
  }

  function syncGuideDistrictPicker(district = filter.district): void {
    const picker = byId('tourGuideDistrictPicker');
    const select = byId('tourGuideDistrict') as HTMLSelectElement | null;
    const text = byId('tourGuideDistrictText');
    const badge = byId('tourGuideDistrictBadge');
    const menu = byId('tourGuideDistrictMenu');
    if (select) select.value = district || '';
    if (!picker) return;
    picker.classList.toggle('is-filtered', Boolean(district));
    if (text) text.textContent = district || 'كل المحافظات والمناطق';
    if (badge) {
      badge.textContent = formatNum(
        district ? tourGuideDistrictCounts.get(district) || 0 : tourGuide.records.length
      );
    }
    menu?.querySelectorAll<HTMLElement>('[data-district-value]').forEach((option) => {
      option.setAttribute(
        'aria-selected',
        String((option.dataset.districtValue || '') === (district || ''))
      );
    });
  }

  function setGuideDistrictMenuOpen(open: boolean): void {
    const picker = byId('tourGuideDistrictPicker');
    const trigger = byId('tourGuideDistrictTrigger');
    const menu = byId('tourGuideDistrictMenu');
    if (!picker || !trigger || !menu) return;
    const next = Boolean(open);
    picker.classList.toggle('is-open', next);
    trigger.setAttribute('aria-expanded', String(next));
    menu.hidden = !next;
  }

  function hideGuideSuggest(): void {
    guideSuggestOpen = false;
    const suggest = byId('tourGuideSuggest');
    if (suggest) suggest.hidden = true;
  }

  function renderGuideSuggest(matched: GuideRecord[], state: TourGuideFilterState): void {
    const suggest = byId('tourGuideSuggest');
    const clearBtn = byId('tourGuideSearchClear');
    if (clearBtn) clearBtn.hidden = !state.query.trim();
    if (!suggest) return;
    const q = state.query.trim();
    if (!q || !guideSuggestOpen) {
      suggest.hidden = true;
      return;
    }
    const itemsHtml = matched.length
      ? matched
          .slice(0, 6)
          .map((place) => {
            const cat = tourGuideCategories.get(place.category)!;
            return `<a class="tour-guide-suggest-item" role="option" href="${tourGuideHref(place)}">
            <img src="${tourGuidePlaceImage(place)}" alt="" loading="lazy" decoding="async">
            <span class="tour-guide-suggest-copy">
              <strong>${guideText(place.name)}</strong>
              <small>${guideText(place.district || 'الباحة')} · ${guideText(cat.label)}</small>
            </span>
            ${glyph('arrow', 'ic tiny')}
          </a>`;
          })
          .join('')
      : '<div class="tour-guide-suggest-empty">لا توجد نتائج مطابقة لهذا البحث، جرّب كلمة أخرى أو امسح الفلاتر.</div>';
    suggest.innerHTML = `<div class="tour-guide-suggest-head">
        <span>نتائج مطابقة: <strong>${formatNum(matched.length)}</strong> من ${formatNum(tourGuide.records.length)}</span>
        ${matched.length ? '<button type="button" class="tour-guide-suggest-jump" data-guide-jump-results>عرض في الصفحة ↓</button>' : ''}
      </div>
      <div class="tour-guide-suggest-list">${itemsHtml}</div>`;
    suggest.hidden = false;
  }

  function tourGuideCard(place: GuideRecord): string {
    const category = tourGuideCategories.get(place.category)!;
    const secondary = guideCardBrief(place);
    return `<a class="tour-guide-card" href="${tourGuideHref(place)}">
      <div class="tour-guide-card-media">
        <img src="${tourGuidePlaceImage(place)}" alt="" loading="lazy" decoding="async">
      </div>
      <div class="tour-guide-card-top">
        <span class="tour-guide-card-meta">${glyph('pin', 'ic tiny')} ${guideText(place.district || 'الباحة')} · ${guideText(category.label)}</span>
      </div>
      <div class="tour-guide-card-body">
        <div class="tour-guide-card-copy">
          <h3>${guideText(place.name)}</h3>
          <p>${guideText(secondary)}</p>
        </div>
        <span class="tour-guide-card-arrow" aria-hidden="true">${glyph('arrow', 'ic tiny')}</span>
      </div>
    </a>`;
  }

  function tourGuideList(): string {
    const coordCount = tourGuide.records.filter(
      (r) => Array.isArray(r.coordinates) && r.coordinates.length === 2
    ).length;
    const coverSlides: MediaShowcaseItem[] = [
      {
        src: tourGuideImageUrl('parks'),
        caption: 'غابات ومنتزهات منطقة الباحة',
        alt: 'غابات منطقة الباحة',
      },
      {
        src: tourGuideImageUrl('villages'),
        caption: 'القرى والحصون التراثية',
        alt: 'القرى التراثية في الباحة',
      },
      {
        src: tourGuideImageUrl('terraces'),
        caption: 'المدرجات والمزارع الريفية',
        alt: 'المدرجات الزراعية في الباحة',
      },
      {
        src: tourGuideImageUrl('mountainCover'),
        caption: 'إطلالات جبال السروات',
        alt: 'جبال السروات في الباحة',
      },
    ];
    return `<div class="container">
      ${guideTrail()}
      <section class="tour-guide-cover" aria-labelledby="tourGuideTitle">
        <div class="tour-guide-intro">
          <span class="tour-guide-kicker">${glyph('section-guide', 'ic tiny')}<span>دليل الزائر الرسمي · منطقة الباحة</span></span>
          <h1 class="tour-guide-title" id="tourGuideTitle" tabindex="-1">الدليل السياحي لمنطقة الباحة</h1>
          <p>استكشف المنتزهات الوطنية، القرى التراثية، الشلالات، المزارع الريفية، وخيارات الضيافة والمطاعم في مختلف محافظات الباحة.</p>
          <div class="tour-guide-stats">
            <span><strong>${formatNum(tourGuide.records.length)}</strong> معلم ووجهة</span>
            <span><strong>${formatNum(tourGuide.categories.length)}</strong> فئات متنوعة</span>
            <span><strong>${formatNum(coordCount)}</strong> موقع على الخريطة</span>
          </div>
        </div>
        <div class="tour-guide-cover-media">
          ${mediaShowcaseMarkup({ id: 'guideCoverShowcase', items: coverSlides, title: 'معالم منطقة الباحة' })}
        </div>
        <svg class="tour-guide-trim" aria-hidden="true" focusable="false"><rect width="100%" height="100%" fill="url(#woven-band)"/></svg>
      </section>

      <div class="tour-guide-controls tour-guide-jump-target" id="tourGuideFilters" tabindex="-1" role="search" aria-label="البحث في الدليل السياحي">
        <div class="tour-guide-field tour-guide-query">
          <label for="tourGuideSearch">ابحث باسم المعلم أو النشاط أو المحافظة</label>
          <span class="tour-guide-input">
            ${glyph('search')}
            <input type="search" id="tourGuideSearch" value="${guideText(filter.query)}" placeholder="مثال: رغدان، قرية ذي عين، الأبنوي، فندق..." autocomplete="off" aria-controls="tourGuideSuggest">
            <button type="button" class="tour-guide-input-clear" id="tourGuideSearchClear" aria-label="مسح نص البحث"${filter.query.trim() ? '' : ' hidden'}>${glyph('x', 'ic tiny')}</button>
            <button type="button" class="tour-guide-search-btn" id="tourGuideSearchGo">بحث</button>
          </span>
          <div class="tour-guide-suggest" id="tourGuideSuggest" role="listbox" aria-label="نتائج البحث الفوري" hidden></div>
        </div>
        <div class="tour-guide-field tour-guide-district-field">
          <span id="tourGuideDistrictLabel">المحافظة أو النطاق</span>
          <div class="guide-district-picker${filter.district ? ' is-filtered' : ''}" id="tourGuideDistrictPicker">
            <select id="tourGuideDistrict" class="guide-native-select-sr" tabindex="-1" aria-hidden="true"><option value="">كل المحافظات والمناطق</option>${tourGuideDistricts.map((district) => `<option value="${guideText(district)}"${filter.district === district ? ' selected' : ''}>${guideText(district)}</option>`).join('')}</select>
            <button type="button" class="guide-district-trigger" id="tourGuideDistrictTrigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="tourGuideDistrictLabel tourGuideDistrictText">
              <span class="guide-district-trigger-main">
                ${glyph('pin', 'ic tiny guide-district-pin')}
                <span id="tourGuideDistrictText">${guideText(filter.district || 'كل المحافظات والمناطق')}</span>
              </span>
              <span class="guide-district-trigger-end">
                <span class="guide-district-count" id="tourGuideDistrictBadge">${formatNum(filter.district ? tourGuideDistrictCounts.get(filter.district) || 0 : tourGuide.records.length)}</span>
                ${glyph('chevron', 'ic tiny guide-district-chev')}
              </span>
            </button>
            <div class="guide-district-menu" id="tourGuideDistrictMenu" role="listbox" aria-labelledby="tourGuideDistrictLabel" hidden>
              <button type="button" class="guide-district-option is-all" role="option" data-district-value="" aria-selected="${!filter.district}">
                <span class="guide-district-option-label">${glyph('map', 'ic tiny')}<span>كل المحافظات والمناطق</span></span>
                <span class="guide-district-option-meta"><small>${formatNum(tourGuide.records.length)}</small>${glyph('check', 'ic tiny guide-district-check')}</span>
              </button>
              <div class="guide-district-divider" role="separator"></div>
              ${tourGuideDistricts
                .map(
                  (district) => `<button type="button" class="guide-district-option" role="option" data-district-value="${guideText(district)}" aria-selected="${filter.district === district}">
                <span class="guide-district-option-label">${glyph('pin', 'ic tiny')}<span>${guideText(district)}</span></span>
                <span class="guide-district-option-meta"><small>${formatNum(tourGuideDistrictCounts.get(district) || 0)}</small>${glyph('check', 'ic tiny guide-district-check')}</span>
              </button>`
                )
                .join('')}
            </div>
          </div>
        </div>
        <button class="tour-guide-reset tour-guide-reset-pill" type="button" data-guide-clear>${glyph('x', 'ic tiny')}<span>مسح الفلاتر</span></button>
      </div>
      <section aria-labelledby="tourGuideCategoriesTitle">
        <div class="tour-guide-rowhead">
          <h2 id="tourGuideCategoriesTitle">تصفّح حسب الفئة</h2>
          <div class="tour-guide-category-actions">
            <div class="tour-guide-category-nav" role="group" aria-label="التنقل بين الفئات">
              <button type="button" data-guide-category-step="-1" aria-controls="tourGuideCategoryRail" aria-label="الفئات السابقة" disabled>${glyph('arrow', 'ic tiny')}</button>
              <button type="button" data-guide-category-step="1" aria-controls="tourGuideCategoryRail" aria-label="الفئات التالية">${glyph('arrow', 'ic tiny')}</button>
            </div>
          </div>
        </div>
        <div class="tour-guide-categories" id="tourGuideCategoryRail">
          ${tourGuide.categories
            .map(
              (category) => `<button type="button" class="tour-guide-category" data-guide-category="${category.id}" aria-pressed="${category.id === filter.category}">
            <img src="${tourGuideImageUrl((tourGuideCategoryMedia[category.id] || tourGuideCategoryMedia.parks)[0])}" alt="" loading="eager" decoding="async">
            <span class="tour-guide-category-badge" aria-hidden="true">${glyph(guideCategoryIcon(category), 'ic tiny')}</span>
            <span class="tour-guide-category-name"><span>${guideText(category.label)}</span></span>
            <small>${formatNum(tourGuideCategoryCounts.get(category.id) || 0)}</small>
          </button>`
            )
            .join('')}
        </div>
      </section>
      <section aria-labelledby="tourGuideResultsTitle">
        <div class="tour-guide-rowhead tour-guide-results-head tour-guide-jump-target" id="tourGuideResultsHead" tabindex="-1">
          <div><h2 id="tourGuideResultsTitle"></h2><p class="tour-guide-count" id="tourGuideCount" role="status"></p><p class="tour-guide-context" id="tourGuideContext" hidden></p></div>
          <div class="tour-guide-results-tools">
            <button type="button" class="tour-guide-reset" data-guide-filters>${glyph('search', 'ic tiny')} الفلاتر</button>
            <div class="tour-guide-switch" role="group" aria-label="طريقة العرض">
              <button type="button" data-guide-mode="list" aria-pressed="${filter.view === 'list'}">${glyph('section-summary', 'ic tiny')} البطاقات</button>
              <button type="button" data-guide-mode="map" aria-pressed="${filter.view === 'map'}">${glyph('map', 'ic tiny')} الخريطة</button>
            </div>
          </div>
        </div>
        <div id="tourGuideResults"></div>
        <div class="tour-guide-more" id="tourGuideMore" hidden><button class="btn btn-soft" type="button" data-guide-more>عرض المزيد ${glyph('chevron', 'ic tiny')}</button></div>
      </section>
      <p class="tour-guide-directory-source"><a class="tour-guide-source" id="tourGuideSource" href="${tourGuide.source}" target="_blank" rel="noopener">دليل أمانة منطقة الباحة ${glyph('external', 'ic tiny')}</a></p>
    </div>`;
  }

  function tourGuideDetail(place: GuideRecord, item144: EnrichedGuide144Item | null = null): string {
    const category = tourGuideCategories.get(place.category) || tourGuide.categories[0];
    const details = place.facts || [];
    const advice = directoryAdvice[place.category] || directoryAdvice.parks;
    const showcaseItems: MediaShowcaseItem[] =
      item144 && item144.imageIsFallback && item144.image === NEUTRAL_PLACEHOLDER_IMAGE
        ? [
            {
              src: NEUTRAL_PLACEHOLDER_IMAGE,
              caption: `${place.name} · ${place.district || category.label}`,
              alt: place.name,
            },
          ]
        : guideShowcaseItems(place);
    const search = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address} الباحة`)}`;
    const mapLabel = place.map
      ? 'الموقع على الخريطة'
      : place.accessMap
        ? 'نقطة الوصول المنشورة'
        : 'ابحث عنه في الخرائط';
    const summary =
      item144?.description ||
      place.description ||
      `هذا المكان مُدرج في دليل منطقة الباحة ضمن فئة ${category.label}، ويقع ضمن نطاق ${place.district || 'منطقة الباحة'}.`;
    const contactActions: string[] = [];
    if (item144?.phones.length) {
      const primaryPhone = item144.phones[0];
      contactActions.push(
        `<a class="btn btn-soft" href="${guideText(primaryPhone.telHref)}">اتصال: <bdi dir="ltr">${guideText(primaryPhone.display)}</bdi></a>`
      );
    }
    if (item144?.whatsappUrl) {
      contactActions.push(
        `<a class="btn btn-soft" href="${guideText(item144.whatsappUrl)}" target="_blank" rel="noopener noreferrer">واتساب ${glyph('external', 'ic tiny')}</a>`
      );
    }
    if (item144?.bookingLink) {
      contactActions.push(
        `<a class="btn btn-dark" href="${guideText(item144.bookingLink.url)}" target="_blank" rel="noopener noreferrer">${guideText(item144.bookingLink.label)} ${glyph('external', 'ic tiny')}</a>`
      );
    }
    if (item144?.officialWebsite && item144.officialWebsite.url !== item144.bookingLink?.url) {
      contactActions.push(
        `<a class="btn btn-soft" href="${guideText(item144.officialWebsite.url)}" target="_blank" rel="noopener noreferrer">${guideText(item144.officialWebsite.label)} ${glyph('external', 'ic tiny')}</a>`
      );
    }
    const extraFacts: [string, string][] = [...details];
    if (item144?.ratingRaw && !extraFacts.some(([k]) => /تقييم/.test(k))) {
      extraFacts.push(['التقييم في الدليل', item144.ratingRaw]);
    }
    if (item144?.priceRange && !extraFacts.some(([k]) => /سعر|أسعار/.test(k))) {
      extraFacts.push(['نطاق الأسعار التقريبي', item144.priceRange]);
    }
    return `<div class="container">
      <div class="tour-guide-detail-nav">${guideTrail(place)}<a class="tour-guide-back" href="#guide">${glyph('arrow', 'ic tiny')} العودة للدليل</a></div>
      <section class="tour-guide-detail">
        <div class="directory-intro-copy">
          <div class="place-kicker-row">
            <span class="place-cat-pill">${glyph(guideCategoryIcon(category), 'ic tiny')} ${guideText(item144?.categoryAr || category.label)}</span>
            <span class="place-area-pill">${glyph('pin', 'ic tiny')} ${guideText(place.district || 'الباحة')}</span>
          </div>
          <h1 class="tour-guide-title" id="tourGuideTitle" tabindex="-1">${guideText(place.name)}</h1>
          <p class="tour-guide-address">${glyph('pin', 'ic tiny')} ${guideText(place.address)}</p>
          <p class="lead">${guideText(summary)}</p>
          <p class="directory-category-summary">${guideText(advice.intro)}</p>
          <div class="directory-meta-grid"><div><small>${cardHead(glyph(guideCategoryIcon(category), 'card-ic-svg'), 'التصنيف')}</small><strong>${guideText(item144?.type || category.label)}</strong></div><div><small>${cardHead(glyph('pin', 'card-ic-svg'), 'المحافظة')}</small><strong>${guideText(place.district || 'الباحة')}</strong></div><div><small>${cardHead(subpageSvgMap.spark, 'التقييم')}</small><strong>${guideText(item144?.ratingRaw || advice.kind)}</strong></div></div>
          <div class="place-actions">
            ${contactActions.join('')}
            <a class="btn ${contactActions.some((c) => c.includes('btn-dark')) ? 'btn-soft' : 'btn-dark'}" href="${guideText(place.map || place.accessMap || search)}" target="_blank" rel="noopener noreferrer">${glyph('map')} ${mapLabel}</a>
            ${place.trip ? `<button class="btn btn-soft" type="button" data-guide-trip="${place.trip}"></button>` : ''}
            <a class="btn btn-soft" href="#guide">${glyph('section-guide', 'ic tiny')} تصفّح أماكن أخرى</a>
          </div>
        </div>
        <div class="directory-gallery">
          <div class="directory-feature-photo">
            ${mediaShowcaseMarkup({ id: 'directoryShowcase', items: showcaseItems, title: place.name })}
          </div>
          ${
            showcaseItems.length > 1
              ? `<div class="directory-thumbnails" id="directoryThumbnails" role="group" aria-label="صور ${guideText(place.name)}">${showcaseItems.map((item, i) => `<button type="button" data-showcase-thumb="${i}" aria-current="${i === 0}" aria-label="عرض الصورة ${formatNum(i + 1)}"><img src="${item.src}" alt="" loading="eager" decoding="async"></button>`).join('')}</div>`
              : ''
          }
        </div>
      </section>
      ${extraFacts.length ? `<section class="tour-guide-facts" aria-labelledby="tourGuideFactsTitle"><div class="tour-guide-rowhead"><h2 id="tourGuideFactsTitle">معلومات منشورة عن المكان</h2></div><dl data-cols="${extraFacts.length <= 4 ? extraFacts.length : 3}">${extraFacts.map(([label, value]) => `<div><dt>${cardHead(guideFactIcon(label), guideText(label))}</dt><dd>${guideText(value)}</dd></div>`).join('')}</dl></section>` : ''}
      <section class="directory-visit-guide" aria-label="نصائح التخطيط للزيارة">
        <div><span class="directory-eyebrow">قبل الزيارة</span><h2>إرشادات الزيارة والتنظيم</h2><p>${guideText(advice.intro)}</p></div>
        <ol>${advice.tips.map((tip, i) => `<li><span>${formatNum(i + 1)}</span><p>${guideText(tip)}</p></li>`).join('')}</ol>
      </section>
      <div class="tour-guide-credits"><a class="tour-guide-source" href="${guideText(place.source || tourGuide.source)}" target="_blank" rel="noopener noreferrer">المصدر | ${guideText(place.sourceLabel || tourGuideSourceLabel(place.source))} ${glyph('external', 'ic tiny')}</a><a class="tour-guide-source" href="#guide">العودة إلى الدليل</a></div>
    </div>`;
  }

  function refreshTourGuide(): void {
    if (!tourGuideView) return;
    destroyGuideLiveMap();
    const matched = tourGuide.records.filter((place) => guideMatchesRecord(place, filter));
    const category = tourGuideCategories.get(filter.category);
    const mapped = filter.view === 'map';
    const pinned = mapped ? matched.filter((place) => place.coordinates) : [];
    const resultsTitle = byId('tourGuideResultsTitle');
    if (resultsTitle) resultsTitle.textContent = category?.label || 'أماكن الدليل';
    const contextEl = byId('tourGuideContext');
    if (contextEl) {
      contextEl.textContent = [
        filter.district,
        filter.query.trim() ? `بحث عن «${filter.query.trim()}»` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      contextEl.hidden = !contextEl.textContent;
    }
    const countEl = byId('tourGuideCount');
    if (countEl) {
      countEl.textContent = mapped
        ? `${formatNum(pinned.length)} على الخريطة من ${formatNum(matched.length)} نتيجة`
        : `عرض ${formatNum(Math.min(filter.limit, matched.length))} من ${formatNum(matched.length)} سجلًا`;
    }
    const sourceEl = byId('tourGuideSource') as HTMLAnchorElement | null;
    if (sourceEl) sourceEl.href = category?.source || tourGuide.source;
    const moreEl = byId('tourGuideMore');
    if (moreEl) moreEl.hidden = mapped || matched.length <= filter.limit;
    tourGuideView.querySelectorAll<HTMLElement>('[data-guide-category]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.guideCategory === filter.category));
    });
    tourGuideView
      .querySelectorAll<HTMLElement>('.tour-guide-switch [data-guide-mode]')
      .forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.guideMode === filter.view));
      });
    syncGuideDistrictPicker(filter.district);
    renderGuideSuggest(matched, filter);
    const results = byId('tourGuideResults');
    if (!results) return;
    if (!matched.length) {
      results.innerHTML =
        '<div class="tour-guide-empty"><p>لا توجد نتائج تطابق البحث الحالي.</p><button class="tour-guide-reset" type="button" data-guide-clear>مسح الفلاتر</button></div>';
    } else if (mapped) {
      if (pinned.length) {
        results.innerHTML = tourGuideMap(pinned);
        void initGuideMap(pinned);
      } else {
        results.innerHTML =
          '<div class="tour-guide-empty"><p>لا توجد نتائج بإحداثيات موثّقة في هذا الاختيار.</p><button class="tour-guide-reset" type="button" data-guide-mode="list">عرض النتائج في القائمة</button></div>';
      }
    } else {
      results.innerHTML = `<div class="tour-guide-grid">${matched.slice(0, filter.limit).map(tourGuideCard).join('')}</div>`;
    }
  }

  function updateTourGuideTrip(): void {
    if (!tourGuideView) return;
    const button = tourGuideView.querySelector<HTMLElement>('[data-guide-trip]');
    if (!button) return;
    const tripId = button.dataset.guideTrip || '';
    const selected = deps.getChoices().has(tripId);
    button.setAttribute('aria-pressed', String(selected));
    button.innerHTML = selected
      ? `${glyph('check')} أُضيفت إلى رحلتي`
      : `${glyph('plus')} أضف إلى رحلتي`;
  }

  function syncTourGuideCategoryNav(): void {
    const rail = byId('tourGuideCategoryRail');
    if (!rail || !tourGuideView) return;
    const offset = Math.max(0, -rail.scrollLeft);
    const prevBtn = tourGuideView.querySelector<HTMLButtonElement>('[data-guide-category-step="-1"]');
    const nextBtn = tourGuideView.querySelector<HTMLButtonElement>('[data-guide-category-step="1"]');
    if (prevBtn) prevBtn.disabled = offset < 2;
    if (nextBtn) nextBtn.disabled = rail.scrollWidth - rail.clientWidth - offset < 2;
  }

  function jumpInTourGuide(id: string): void {
    const target = byId(id);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: deps.getScrollBehavior(), block: 'start' });
  }

  function showTourGuide(id?: string): void {
    if (!tourGuideView) return;
    const lastHash = deps.getLastHash();
    if (id && lastHash === '#guide') tourGuideListScroll = window.scrollY;
    if (lastHash !== '#guide' && !lastHash.startsWith('#guide/place/')) tourGuideListScroll = 0;
    const viewSignal = newViewSignal();
    const resolved = id ? resolveGuidePlaceById(id) : null;
    const place = resolved?.place || null;
    const item144 = resolved?.item144 || null;
    tourGuideView.innerHTML = id
      ? place
        ? tourGuideDetail(place, item144)
        : `<div class="container">${guideTrail()}<div class="tour-guide-empty"><h1 id="tourGuideTitle" class="tour-guide-title" tabindex="-1" style="font-size:2rem;text-shadow:none">المكان غير متاح</h1><a class="tour-guide-source" href="#guide">العودة إلى الدليل</a></div></div>`
      : tourGuideList();
    tourGuideView.hidden = false;
    let focusTarget: HTMLElement | null = byId('tourGuideTitle');
    if (!id) {
      bindMediaShowcase(
        byId('guideCoverShowcase'),
        [
          {
            src: tourGuideImageUrl('parks'),
            caption: 'غابات ومنتزهات منطقة الباحة',
            alt: 'غابات منطقة الباحة',
          },
          {
            src: tourGuideImageUrl('villages'),
            caption: 'القرى والحصون التراثية',
            alt: 'القرى التراثية في الباحة',
          },
          {
            src: tourGuideImageUrl('terraces'),
            caption: 'المدرجات والمزارع الريفية',
            alt: 'المدرجات الزراعية في الباحة',
          },
          {
            src: tourGuideImageUrl('mountainCover'),
            caption: 'إطلالات جبال السروات',
            alt: 'جبال السروات في الباحة',
          },
        ],
        {
          title: 'الدليل السياحي لمنطقة الباحة',
          interval: 4200,
          openLightboxOnZoom: false,
          signal: viewSignal,
        }
      );
      refreshTourGuide();
      const rail = byId('tourGuideCategoryRail');
      if (rail) {
        rail.scrollLeft = tourGuideCategoryOffset;
        rail.addEventListener(
          'scroll',
          () => {
            tourGuideCategoryOffset = rail.scrollLeft;
            syncTourGuideCategoryNav();
          },
          { passive: true, signal: viewSignal }
        );
      }
      syncTourGuideCategoryNav();
      const returningPlace =
        lastHash.startsWith('#guide/place/') && tourGuidePlaces.get(lastHash.slice(13));
      if (returningPlace) {
        focusTarget =
          byId('tourGuideResults')?.querySelector<HTMLElement>(
            `a[href="${tourGuideHref(returningPlace)}"]`
          ) || focusTarget;
      }
    } else if (place) {
      const showcaseItems: MediaShowcaseItem[] =
        item144 && item144.imageIsFallback && item144.image === NEUTRAL_PLACEHOLDER_IMAGE
          ? [
              {
                src: NEUTRAL_PLACEHOLDER_IMAGE,
                caption: `${place.name} · ${place.district || ''}`,
                alt: place.name,
              },
            ]
          : guideShowcaseItems(place);
      bindMediaShowcase(byId('directoryShowcase'), showcaseItems, {
        thumbsEl: byId('directoryThumbnails'),
        title: place.name,
        interval: 3600,
        openLightboxOnZoom: true,
        signal: viewSignal,
      });
    }
    updateTourGuideTrip();
    document.title = `${place?.name || 'الدليل السياحي'} | اكتشف الباحة`;
    focusTarget?.focus({ preventScroll: true });
    window.scrollTo({ top: id ? 0 : tourGuideListScroll, behavior: 'instant' });
  }

  tourGuideView?.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.fallbackApplied === '1') return;
      img.dataset.fallbackApplied = '1';
      if (!img.getAttribute('src') || !img.getAttribute('src')!.endsWith('photo-parks.webp')) {
        img.src = fallbackGuideImage;
      }
    },
    { capture: true, signal }
  );

  tourGuideView?.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      const btn = target?.closest<HTMLElement>('[data-directory-photo]');
      if (!btn || btn.closest('[data-showcase]')) return;
      event.preventDefault();
      const place = tourGuidePlaces.get(btn.dataset.directoryPhoto || '');
      if (place) {
        openUnifiedLightbox(
          place.name,
          guideShowcaseItems(place),
          Number(btn.dataset.directoryIndex || 0),
          viewAbortController?.signal || signal
        );
      }
    },
    { signal }
  );

  window.addEventListener('resize', syncTourGuideCategoryNav, { passive: true, signal });

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!tourGuideView || tourGuideView.hidden) return;
      const target = event.target as Element | null;
      if (!target?.closest('#tourGuideDistrictPicker')) setGuideDistrictMenuOpen(false);
      if (!target?.closest('.tour-guide-query')) hideGuideSuggest();
    },
    { signal }
  );

  tourGuideView?.addEventListener(
    'focusin',
    (event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.id === 'tourGuideSearch' && target.value.trim()) {
        setGuideDistrictMenuOpen(false);
        guideSuggestOpen = true;
        const matched = tourGuide.records.filter((place) => guideMatchesRecord(place, filter));
        renderGuideSuggest(matched, filter);
      }
    },
    { signal }
  );

  tourGuideView?.addEventListener(
    'keydown',
    (event) => {
      const target = event.target as HTMLElement | null;
      const picker = byId('tourGuideDistrictPicker');
      const menu = byId('tourGuideDistrictMenu');
      if (target?.closest('#tourGuideDistrictPicker') && picker && menu) {
        const options = Array.from(menu.querySelectorAll<HTMLElement>('[data-district-value]'));
        if (event.key === 'Escape') {
          setGuideDistrictMenuOpen(false);
          byId('tourGuideDistrictTrigger')?.focus();
          return;
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          if (menu.hidden) setGuideDistrictMenuOpen(true);
          const curIdx =
            document.activeElement instanceof HTMLElement
              ? options.indexOf(document.activeElement)
              : -1;
          let nextIdx = 0;
          if (event.key === 'ArrowDown') {
            nextIdx =
              curIdx < 0
                ? Math.max(
                    0,
                    options.findIndex((o) => o.getAttribute('aria-selected') === 'true')
                  )
                : (curIdx + 1) % options.length;
          } else if (event.key === 'ArrowUp') {
            nextIdx =
              curIdx < 0
                ? Math.max(
                    0,
                    options.findIndex((o) => o.getAttribute('aria-selected') === 'true')
                  )
                : (curIdx - 1 + options.length) % options.length;
          } else if (event.key === 'End') {
            nextIdx = options.length - 1;
          }
          options[nextIdx]?.focus();
          return;
        }
      }
      if (target?.id === 'tourGuideSearch') {
        if (event.key === 'Enter') {
          event.preventDefault();
          hideGuideSuggest();
          jumpInTourGuide('tourGuideResultsHead');
        } else if (event.key === 'Escape') {
          hideGuideSuggest();
        } else if (event.key === 'ArrowDown') {
          const firstSuggest = byId('tourGuideSuggest')?.querySelector<HTMLElement>(
            '.tour-guide-suggest-item'
          );
          if (firstSuggest) {
            event.preventDefault();
            firstSuggest.focus();
          }
        }
      } else if (target?.closest('#tourGuideSuggest')) {
        const suggest = byId('tourGuideSuggest');
        const items = suggest
          ? Array.from(suggest.querySelectorAll<HTMLElement>('.tour-guide-suggest-item'))
          : [];
        if (event.key === 'Escape') {
          hideGuideSuggest();
          byId('tourGuideSearch')?.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const currentEl = target.closest<HTMLElement>('.tour-guide-suggest-item');
          const cur = currentEl ? items.indexOf(currentEl) : -1;
          const nxt =
            event.key === 'ArrowDown'
              ? (cur + 1) % items.length
              : (cur - 1 + items.length) % items.length;
          items[nxt]?.focus();
        }
      }
    },
    { signal }
  );

  tourGuideView?.addEventListener(
    'input',
    (event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.id !== 'tourGuideSearch') return;
      filter.query = target.value;
      filter.limit = 12;
      guideSuggestOpen = Boolean(target.value.trim());
      setGuideDistrictMenuOpen(false);
      refreshTourGuide();
    },
    { signal }
  );

  tourGuideView?.addEventListener(
    'change',
    (event) => {
      const target = event.target as HTMLSelectElement | null;
      if (target?.id !== 'tourGuideDistrict') return;
      filter.district = target.value;
      filter.limit = 12;
      refreshTourGuide();
    },
    { signal }
  );

  tourGuideView?.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      if (target?.closest('.tour-guide-suggest-item')) {
        hideGuideSuggest();
        return;
      }
      const button = target?.closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.id === 'tourGuideDistrictTrigger') {
        hideGuideSuggest();
        setGuideDistrictMenuOpen(Boolean(byId('tourGuideDistrictMenu')?.hidden));
        return;
      }
      if ('districtValue' in button.dataset) {
        filter.district = button.dataset.districtValue || '';
        filter.limit = 12;
        setGuideDistrictMenuOpen(false);
        refreshTourGuide();
        byId('tourGuideDistrictTrigger')?.focus();
        return;
      }
      if (button.id === 'tourGuideSearchClear') {
        filter.query = '';
        filter.limit = 12;
        const searchInput = byId('tourGuideSearch') as HTMLInputElement | null;
        if (searchInput) searchInput.value = '';
        hideGuideSuggest();
        refreshTourGuide();
        searchInput?.focus();
        return;
      }
      if (button.id === 'tourGuideSearchGo' || 'guideJumpResults' in button.dataset) {
        hideGuideSuggest();
        setGuideDistrictMenuOpen(false);
        jumpInTourGuide('tourGuideResultsHead');
        return;
      }
      if (button.dataset.guideCategoryStep) {
        const rail = byId('tourGuideCategoryRail');
        if (rail) {
          rail.scrollBy({
            left: -Number(button.dataset.guideCategoryStep) * Math.round(rail.clientWidth * 0.8),
            behavior: deps.getScrollBehavior(),
          });
        }
        return;
      }
      if ('guideFilters' in button.dataset) {
        jumpInTourGuide('tourGuideFilters');
        return;
      }
      if (button.dataset.guideTrip) {
        const stop = places.get(button.dataset.guideTrip);
        if (stop) deps.toggleStop(stop);
        updateTourGuideTrip();
        return;
      }
      if ('guideMore' in button.dataset) {
        const previousLimit = filter.limit;
        filter.limit += 12;
        refreshTourGuide();
        byId('tourGuideResults')
          ?.querySelectorAll<HTMLElement>('.tour-guide-card')
          [previousLimit]?.focus();
        return;
      }
      if ('guideClear' in button.dataset) {
        Object.assign(filter, { category: '', district: '', query: '' });
        const searchInput = byId('tourGuideSearch') as HTMLInputElement | null;
        const districtSelect = byId('tourGuideDistrict') as HTMLSelectElement | null;
        if (searchInput) searchInput.value = '';
        if (districtSelect) districtSelect.value = '';
        hideGuideSuggest();
        setGuideDistrictMenuOpen(false);
      } else if (button.dataset.guideCategory) {
        const category = button.dataset.guideCategory;
        filter.category = filter.category === category ? '' : category;
      } else if (button.dataset.guideMode) {
        filter.view = button.dataset.guideMode === 'map' ? 'map' : 'list';
      } else {
        return;
      }
      filter.limit = 12;
      refreshTourGuide();
      if (button.dataset.guideCategory) jumpInTourGuide('tourGuideResultsHead');
      else if (!button.isConnected) byId('tourGuideSearch')?.focus({ preventScroll: true });
    },
    { signal }
  );

  signal.addEventListener(
    'abort',
    () => {
      cleanupView();
      for (const url of tourGuideImageUrls.values()) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
      tourGuideImageUrls.clear();
    },
    { once: true }
  );

  function openFiltered(opts: TourGuideFilterOptions = {}): void {
    filter.category = opts.category || '';
    filter.district = opts.district || '';
    filter.query = opts.query || '';
    filter.view = opts.view || 'list';
    filter.limit = 12;
    guideSuggestOpen = false;
    setGuideDistrictMenuOpen(false);
    const searchInput = byId('tourGuideSearch') as HTMLInputElement | null;
    const districtSelect = byId('tourGuideDistrict') as HTMLSelectElement | null;
    if (searchInput) searchInput.value = filter.query;
    if (districtSelect) districtSelect.value = filter.district;
    if (window.location.hash !== '#guide') {
      window.location.hash = 'guide';
    } else {
      showTourGuide();
    }
    window.setTimeout(() => {
      jumpInTourGuide('tourGuideResultsHead');
    }, 60);
  }

  return {
    filter,
    getGuideRecords: () => indexedGuideRecords,
    hasPlace: (id: string) => Boolean(resolveGuidePlaceById(id)),
    showTourGuide,
    openFiltered,
    refreshTourGuide,
    updateTourGuideTrip,
    destroyGuideLiveMap,
    cleanupView,
  };
}
