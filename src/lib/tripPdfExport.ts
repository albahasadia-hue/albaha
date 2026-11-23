import {
  durationLabel,
  formatNum,
  getSegment,
  loadMapLibreLibrary,
  places,
  projectSvgGeo,
  routePath,
  STREET_MAP_STYLE,
} from './portalHelpers';
import {
  climateCities,
  conciergeDays,
  domMedia,
  geo,
  images,
  stationPhotoInfo,
} from './portalStaticData';
import type { ApprovedTrip, MapLibreMapInstance } from './portalTypes';

type MapPoint = [number, number];

async function captureStreetMap(
  width: number,
  height: number,
  pixelRatio: number,
  pins: MapPoint[],
  legs: ReturnType<typeof getSegment>[]
) {
  let container: HTMLDivElement | undefined;
  let map: MapLibreMapInstance | undefined;
  try {
    const library = await loadMapLibreLibrary();
    container = document.createElement('div');
    container.setAttribute('aria-hidden', 'true');
    Object.assign(container.style, {
      position: 'fixed', top: '0', left: '-10000px', width: `${width}px`,
      height: `${height}px`, pointerEvents: 'none',
    });
    document.body.append(container);
    const streetMap = new library.Map({
      container,
      style: STREET_MAP_STYLE,
      center: pins[0],
      zoom: 13,
      interactive: false,
      attributionControl: false,
      renderWorldCopies: false,
      fadeDuration: 0,
      pixelRatio,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map = streetMap;

    if (pins.length > 1) {
      const bounds = new library.LngLatBounds();
      for (const point of [...pins, ...legs.flatMap((leg) => leg.coordinates)]) bounds.extend(point);
      streetMap.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
    }
    const ready = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 15000);
      streetMap.once('idle', () => {
        window.clearTimeout(timeout);
        resolve(streetMap.queryRenderedFeatures().some((feature) => feature.source === 'openmaptiles'));
      });
    });
    if (!ready) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(streetMap.getCanvas(), 0, 0, canvas.width, canvas.height);
    const project = (point: MapPoint): MapPoint => {
      const { x, y } = streetMap.project(point);
      return [x, y];
    };
    return {
      canvas,
      pins: pins.map(project),
      legs: legs.map((leg) => ({ ...leg, points: leg.coordinates.map(project) })),
    };
  } catch {
    return null;
  } finally {
    try {
      map?.remove();
    } finally {
      container?.remove();
    }
  }
}

export function saveTripFile(file: Blob, filename: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

interface PdfPagePayload {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export function makeTripPdf(pages: PdfPagePayload[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let size = 0;

  function append(value: string | Uint8Array) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    chunks.push(bytes);
    size += bytes.length;
  }

  function object(id: number, contents: string, stream?: Uint8Array) {
    offsets[id] = size;
    append(id + ' 0 obj\n' + contents);
    if (stream) {
      append('\nstream\n');
      append(stream);
      append('\nendstream');
    }
    append('\nendobj\n');
  }

  append('%PDF-1.4\n');
  append(new Uint8Array([37, 226, 227, 207, 211, 10]));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const ids = pages.map((_, index) => 3 + index * 3);
  object(
    2,
    '<< /Type /Pages /Count ' +
      pages.length +
      ' /Kids [' +
      ids.map((id) => id + ' 0 R').join(' ') +
      '] >>'
  );
  pages.forEach(({ bytes, width, height }, index) => {
    const page = ids[index];
    const drawing = encoder.encode('q 595.28 0 0 841.89 0 0 cm /PageImage Do Q\n');
    object(
      page,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /PageImage ' +
        (page + 1) +
        ' 0 R >> >> /Contents ' +
        (page + 2) +
        ' 0 R >>'
    );
    object(
      page + 1,
      '<< /Type /XObject /Subtype /Image /Width ' +
        width +
        ' /Height ' +
        height +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
        bytes.length +
        ' >>',
      bytes
    );
    object(page + 2, '<< /Length ' + drawing.length + ' >>', drawing);
  });

  const xref = size;
  append('xref\n0 ' + offsets.length + '\n0000000000 65535 f \n');
  append(
    offsets
      .slice(1)
      .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
      .join('')
  );
  append(
    'trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'
  );
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export async function createTripPdf(
  trip: ApprovedTrip,
  mapExtent: { left: number; right: number; top: number; bottom: number }
): Promise<Blob> {
  await document.fonts?.ready;
  const width = 840;
  const height = 1188;
  const resolution = 2;
  const margin = 46;
  const right = width - margin;
  const inner = right - margin;

  // Official Al-Baha Visual Identity Palette
  const navyDeep = '#061A33';
  const navyMid = '#0A2E5C';
  const emerald = '#006C35';
  const emeraldSoft = '#EEF7F2';
  const gold = '#C89D54';
  const goldBright = '#F3D089';
  const paper = '#FCFBF7';
  const ice = '#F3F8FC';
  const border = '#D3E1EE';
  const muted = '#4B657A';

  const rows = trip.stations
    .map((row, index) => ({ ...row, number: index + 1 }))
    .filter((row) => places.has(row.id));
  if (!rows.length) throw new Error('No stations to export');

  const uniqueActiveDays = Array.from(new Set(rows.map((r) => r.day))).sort((a, b) => a - b);

  const itineraryTop = 176;
  const itineraryBottom = 1116;
  const dayHeaderSpace = 44;
  const cardHeight = 182;
  const cardGap = 12;
  let pageY = itineraryTop;
  const sheets: Array<{ days: Set<number>; continued: boolean; rows: typeof rows }> = [];
  for (const row of rows) {
    const current = sheets[sheets.length - 1];
    const previousDay = current?.rows.at(-1)?.day;
    const headerSpace = previousDay === row.day ? 0 : dayHeaderSpace;
    if (current && pageY + headerSpace + cardHeight <= itineraryBottom) {
      current.days.add(row.day);
      current.rows.push(row);
      pageY += headerSpace + cardHeight + cardGap;
    } else {
      sheets.push({
        days: new Set([row.day]),
        continued: previousDay === row.day,
        rows: [row],
      });
      pageY = itineraryTop + dayHeaderSpace + cardHeight + cardGap;
    }
  }

  const pages: PdfPagePayload[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * resolution);
  canvas.height = Math.round(height * resolution);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(resolution, resolution);

  const roundPath = (x: number, y: number, w: number, h: number, r: number) => {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  };

  const roundedBox = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string | CanvasGradient,
    stroke?: string,
    shadow = false
  ) => {
    ctx.save();
    if (shadow) {
      ctx.shadowColor = 'rgba(6, 26, 51, 0.08)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
    }
    roundPath(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    if (stroke) {
      ctx.save();
      roundPath(x, y, w, h, r);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  };

  const text = (
    value: string | number,
    x: number,
    y: number,
    size: number,
    {
      color = navyDeep,
      weight = 500,
      direction = 'rtl',
      align,
      display = false,
    }: {
      color?: string;
      weight?: number;
      direction?: CanvasDirection;
      align?: CanvasTextAlign;
      display?: boolean;
    } = {}
  ) => {
    ctx.fillStyle = color;
    const fam = display
      ? '"Noto Kufi Arabic", "Alexandria", "Cairo", sans-serif'
      : '"Alexandria", "Cairo", sans-serif';
    ctx.font = `${weight} ${size}px ${fam}`;
    ctx.direction = direction;
    ctx.textAlign = align || (direction === 'rtl' ? 'right' : 'left');
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x, y);
  };

  const paragraph = (
    value: string,
    x: number,
    y: number,
    size: number,
    maxWidth: number,
    { color = muted, weight = 400, lineHeight = size * 1.55, maxLines = 3 } = {}
  ) => {
    ctx.font = `${weight} ${size}px "Alexandria", "Cairo", sans-serif`;
    let line = '';
    let drawn = 0;
    const words = value.split(/\s+/);
    for (let wi = 0; wi < words.length; wi += 1) {
      const word = words[wi];
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        drawn += 1;
        const isLast = drawn >= maxLines;
        text(isLast ? `${line}...` : line, x, y, size, { color, weight });
        if (isLast) return;
        y += lineHeight;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) text(line, x, y, size, { color, weight });
  };

  const imageFrom = (src?: string | null): Promise<HTMLImageElement | null> => {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  };

  const imageCoverRounded = (
    image: HTMLImageElement | null,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.save();
    roundPath(x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = ice;
    ctx.fillRect(x, y, w, h);
    if (image && image.naturalWidth && image.naturalHeight) {
      const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
      const sw = w / scale;
      const sh = h / scale;
      ctx.drawImage(
        image,
        (image.naturalWidth - sw) / 2,
        (image.naturalHeight - sh) / 2,
        sw,
        sh,
        x,
        y,
        w,
        h
      );
    }
    ctx.restore();
  };

  const drawHeritageTrim = (y: number, h = 6) => {
    const grad = ctx.createLinearGradient(0, y, width, y);
    grad.addColorStop(0, '#0A2444');
    grad.addColorStop(0.35, emerald);
    grad.addColorStop(0.5, gold);
    grad.addColorStop(0.65, emerald);
    grad.addColorStop(1, '#0A2444');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, width, h);
    // Subtle woven geometric diamond accents
    ctx.fillStyle = 'rgba(243, 208, 137, 0.55)';
    for (let dx = 18; dx < width; dx += 28) {
      ctx.beginPath();
      ctx.moveTo(dx, y + 1);
      ctx.lineTo(dx + 4, y + h / 2);
      ctx.lineTo(dx, y + h - 1);
      ctx.lineTo(dx - 4, y + h / 2);
      ctx.closePath();
      ctx.fill();
    }
  };

  const goldLogoImg = await imageFrom(domMedia.goldLogo);

  const totalPages = sheets.length + 1;

  const pageBase = (page: number, title: string, subtitle: string) => {
    // Crisp warm paper canvas
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);

    // Executive Royal Navy -> Emerald Gradient Header
    const headerH = 148;
    const hGrad = ctx.createLinearGradient(0, 0, width, headerH);
    hGrad.addColorStop(0, navyDeep);
    hGrad.addColorStop(0.62, navyMid);
    hGrad.addColorStop(1, emerald);
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, width, headerH);

    // Subtle decorative radial sheen
    const glow = ctx.createRadialGradient(width - 90, 20, 10, width - 90, 20, 260);
    glow.addColorStop(0, 'rgba(243, 208, 137, 0.14)');
    glow.addColorStop(1, 'rgba(243, 208, 137, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, headerH);

    // Gold Al-Baha Emblem on Top-Right
    let titleRight = right;
    if (goldLogoImg && goldLogoImg.naturalWidth) {
      const logoH = 74;
      const logoW = (goldLogoImg.naturalWidth / goldLogoImg.naturalHeight) * logoH;
      ctx.drawImage(goldLogoImg, right - logoW, 34, logoW, logoH);
      titleRight = right - logoW - 18;
    }

    // Header Kicker, Title & Subtitle
    text('بوابة منطقة الباحة الرسمية  ·  برنامج الرحلة المعتمد', titleRight, 42, 14, {
      color: goldBright,
      weight: 700,
    });
    text(title, titleRight, 80, 31, { color: '#FFFFFF', weight: 700, display: true });
    text(subtitle, titleRight, 114, 15, { color: '#DDEBF5', weight: 500 });

    // Top-Left Page Pill in Header
    roundedBox(margin, 32, 86, 30, 15, 'rgba(255, 255, 255, 0.14)', 'rgba(243, 208, 137, 0.45)');
    text(`${formatNum(page)} / ${formatNum(totalPages)}`, margin + 43, 47, 13, {
      color: goldBright,
      weight: 700,
      direction: 'ltr',
      align: 'center',
    });

    // Signature Woven Gold Heritage Trim
    drawHeritageTrim(headerH, 6);

    // Clean Official Footer
    ctx.fillStyle = border;
    ctx.fillRect(margin, 1134, inner, 1);
    text('أمانة منطقة الباحة  ·  جميع المواعيد بتوقيت المملكة العربية السعودية', right, 1158, 13, {
      color: muted,
      weight: 500,
    });
    text(`صفحة ${formatNum(page)} من ${formatNum(totalPages)}`, margin, 1158, 13, {
      color: emerald,
      weight: 700,
      align: 'left',
    });
  };

  const addPage = () => {
    const jpeg = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
    pages.push({
      bytes: Uint8Array.from(atob(jpeg), (char) => char.charCodeAt(0)),
      width: canvas.width,
      height: canvas.height,
    });
  };

  // ================= PAGE 1: Executive Overview + Route Map =================
  const pins = rows.map((row) => geo.stations[row.id]);
  const legs = rows
    .slice(1)
    .map((row, i) => getSegment(places.get(rows[i].id)!, places.get(row.id)!));
  const mapY = 314;
  const mapHeight = 464;
  const streetMap = await captureStreetMap(
    inner,
    mapHeight,
    resolution,
    rows.map(({ id }) => {
      const { lng, lat } = places.get(id)!;
      return [lng, lat];
    }),
    legs
  );

  pageBase(
    1,
    'مخطط رحلتك في الباحة',
    `${trip.region_name}  ·  ${conciergeDays[String(trip.days)] || `${formatNum(uniqueActiveDays.length)} أيام`}  ·  ${trip.style_name}`
  );

  // 4 Executive KPI Cards
  const kpiY = 174;
  const kpiGap = 12;
  const kpiW = (inner - kpiGap * 3) / 4;
  const kpiH = 68;
  const kpiItems = [
    { label: 'النطاق الجغرافي', value: trip.region_name },
    {
      label: 'الأيام الفعّالة',
      value: `${formatNum(uniqueActiveDays.length)} ${uniqueActiveDays.length === 1 ? 'يوم' : 'أيام'}`,
    },
    {
      label: 'إجمالي المحطات',
      value: `${formatNum(rows.length)} ${rows.length === 1 ? 'محطة' : 'محطات'}`,
    },
    { label: 'وقت الزيارة', value: durationLabel(trip.visit_minutes) },
  ];
  kpiItems.forEach((item, idx) => {
    const kx = right - (idx + 1) * kpiW - idx * kpiGap;
    roundedBox(kx, kpiY, kpiW, kpiH, 12, '#FFFFFF', border, true);
    roundedBox(kx + kpiW - 4, kpiY + 12, 4, kpiH - 24, 2, idx % 2 === 0 ? emerald : navyMid);
    text(item.label, kx + kpiW - 14, kpiY + 22, 12, { color: emerald, weight: 700 });
    text(item.value, kx + kpiW - 14, kpiY + 46, 15, { color: navyDeep, weight: 700, display: true });
  });

  // Map Card Title
  text('خريطة المسار ومحطات الرحلة', right, 272, 19, { color: navyDeep, weight: 700, display: true });
  text(
    streetMap ? 'ترتيب المحطات المعتمدة عبر منطقة الباحة' : 'خريطة تضاريس تقريبية للمسار والمحطات',
    right,
    296,
    13,
    { color: muted }
  );

  roundedBox(margin, mapY, inner, mapHeight, 16, '#EBF2F7', border, true);
  ctx.save();
  roundPath(margin + 1, mapY + 1, inner - 2, mapHeight - 2, 15);
  ctx.clip();

  let mapPins: MapPoint[];
  let mapLegs: typeof legs;
  if (streetMap) {
    ctx.drawImage(streetMap.canvas, margin, mapY, inner, mapHeight);
    mapPins = streetMap.pins.map(([x, y]) => [margin + x, mapY + y]);
    mapLegs = streetMap.legs.map((leg) => ({
      ...leg,
      points: leg.points.map(([x, y]) => [margin + x, mapY + y]),
    }));
  } else {
    const terrain = await imageFrom(
      document.getElementById('terrainRelief')?.getAttribute('href') || domMedia.terrainRelief
    );
    const points = [...pins, ...legs.flatMap((leg) => leg.points)];
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scale = Math.min(
      (inner - 96) / Math.max(maxX - minX, 230),
      (mapHeight - 96) / Math.max(maxY - minY, 220)
    );
    const mapX = margin + inner / 2 - ((minX + maxX) / 2) * scale;
    const mapTop = mapY + mapHeight / 2 - ((minY + maxY) / 2) * scale;
    const project = ([x, y]: MapPoint): MapPoint => [mapX + x * scale, mapTop + y * scale];

    ctx.fillStyle = '#EAF1F5';
    ctx.fillRect(margin, mapY, inner, mapHeight);
    if (terrain) {
      ctx.drawImage(
        terrain,
        mapX + mapExtent.left * scale,
        mapTop + mapExtent.top * scale,
        (mapExtent.right - mapExtent.left) * scale,
        (mapExtent.bottom - mapExtent.top) * scale
      );
      ctx.fillStyle = 'rgba(248, 252, 250, .35)';
      ctx.fillRect(margin, mapY, inner, mapHeight);
    }

    mapPins = pins.map(project);
    mapLegs = legs.map((leg) => ({ ...leg, points: leg.points.map(project) }));
    for (const city of Object.values(climateCities)) {
      const { x, y } = projectSvgGeo(city.lat, city.lng);
      const [px, py] = project([x, y]);
      if (px < margin + 70 || px > right - 70 || py < mapY + 20 || py > mapY + mapHeight - 20) {
        continue;
      }
      if (mapPins.some(([pinX, pinY]) => Math.abs(px - pinX) < 68 && Math.abs(py - pinY) < 25)) {
        continue;
      }
      roundedBox(px - 60, py - 11, 120, 22, 7, '#F7FBFB');
      text(city.name, px, py, 12, { align: 'center', weight: 600 });
    }
  }

  const path = routePath(mapLegs);
  if (path) {
    const route = new Path2D(path);
    ctx.save();
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 8.5;
    ctx.stroke(route);
    ctx.strokeStyle = streetMap ? '#1666BF' : emerald;
    ctx.lineWidth = 4.2;
    ctx.stroke(route);
    ctx.restore();
  }

  // Numbered Navy-Gold Markers
  const badges: [number, number][] = [];
  for (const [index, [px, py]] of mapPins.entries()) {
    const shifts: [number, number][] = [
      [0, 0],
      [30, 0],
      [-30, 0],
      [0, -30],
      [0, 30],
      [30, -30],
      [-30, 30],
    ];
    const [dx, dy] =
      shifts.find(([sx, sy]) =>
        badges.every(([bx, by]) => Math.hypot(px + sx - bx, py + sy - by) >= 30)
      ) || [0, 0];
    const bx = px + dx;
    const by = py + dy;
    badges.push([bx, by]);
    if (dx || dy) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = navyMid;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(bx, by, 14, 0, Math.PI * 2);
    ctx.fillStyle = navyDeep;
    ctx.fill();
    ctx.strokeStyle = goldBright;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    text(formatNum(index + 1), bx, by + 0.5, 13, {
      align: 'center',
      direction: 'ltr',
      color: '#FFFFFF',
      weight: 700,
    });
  }
  if (streetMap) {
    const attribution = '© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap';
    roundedBox(margin + 8, mapY + mapHeight - 26, 340, 20, 5, '#FFFFFF');
    text(attribution, margin + 15, mapY + mapHeight - 16, 10, {
      direction: 'ltr',
      color: muted,
    });
  }
  ctx.restore();

  // Station Directory Card at Bottom of Page 1
  const dirY = 796;
  const dirH = 316;
  roundedBox(margin, dirY, inner, dirH, 16, '#FFFFFF', border, true);
  text('فهرس المحطات المجدولة', right - 18, dirY + 26, 17, {
    color: navyDeep,
    weight: 700,
    display: true,
  });
  ctx.fillStyle = border;
  ctx.fillRect(margin + 18, dirY + 46, inner - 36, 1);

  const colW = (inner - 48) / 2;
  const maxPerCol = 7;
  for (const row of rows.slice(0, maxPerCol * 2)) {
    const colIdx = Math.floor((row.number - 1) / maxPerCol);
    const rowIdx = (row.number - 1) % maxPerCol;
    const itemRight = right - 18 - colIdx * (colW + 12);
    const itemY = dirY + 68 + rowIdx * 34;

    roundedBox(itemRight - 24, itemY - 12, 24, 24, 7, emeraldSoft, 'rgba(0,108,53,0.22)');
    text(formatNum(row.number), itemRight - 12, itemY, 12, {
      color: emerald,
      weight: 700,
      direction: 'ltr',
      align: 'center',
    });
    text(row.name, itemRight - 32, itemY, 13.5, { color: navyDeep, weight: 700 });

    const metaLeft = itemRight - colW + 4;
    roundedBox(metaLeft, itemY - 10, 56, 20, 10, ice, border);
    text(`اليوم ${formatNum(row.day)}`, metaLeft + 28, itemY, 10.5, {
      color: navyMid,
      weight: 700,
      align: 'center',
    });
    text(row.starts_at, metaLeft + 64, itemY, 11, {
      color: muted,
      weight: 600,
      direction: 'ltr',
      align: 'left',
    });
  }
  addPage();

  // ================= PAGE 2+: Architectural Station Cards =================
  for (const [index, sheet] of sheets.entries()) {
    const photos = await Promise.all(
      sheet.rows.map((row) => imageFrom(images[places.get(row.id)!.image]))
    );
    const daysArr = Array.from(sheet.days);
    const title = daysArr.length === 1 ? `برنامج اليوم ${formatNum(daysArr[0])}` : 'برنامج الرحلة';
    const subtitle = daysArr.length === 1
      ? 'تفاصيل الزيارات والمواعيد والانتقالات حسب الترتيب'
      : `الأيام ${daysArr.map(formatNum).join('، ')}  ·  الزيارات والمواعيد والانتقالات`;
    pageBase(index + 2, title, subtitle);

    let y = itineraryTop;
    let previousDay = 0;
    for (const [i, row] of sheet.rows.entries()) {
      const stop = places.get(row.id)!;
      if (row.day !== previousDay) {
        const dayGrad = ctx.createLinearGradient(margin, y, right, y);
        dayGrad.addColorStop(0, emerald);
        dayGrad.addColorStop(0.55, navyMid);
        dayGrad.addColorStop(1, navyDeep);
        roundedBox(margin, y, inner, 34, 10, dayGrad);
        text(
          `اليوم ${formatNum(row.day)}${!i && sheet.continued ? '  ·  استكمال' : ''}`,
          right - 16,
          y + 17,
          15,
          { color: '#FFFFFF', weight: 700, display: true }
        );
        const dayStopsCount = rows.filter((r) => r.day === row.day).length;
        text(
          `${formatNum(dayStopsCount)} ${dayStopsCount === 1 ? 'محطة' : 'محطات'}`,
          margin + 16,
          y + 17,
          12.5,
          { color: goldBright, weight: 700, align: 'left' }
        );
        y += dayHeaderSpace;
        previousDay = row.day;
      }

      const cardH = cardHeight;
      roundedBox(margin, y, inner, cardH, 14, '#FFFFFF', border, true);

      // Emerald-Gold Right Accent Strip
      const accentGrad = ctx.createLinearGradient(0, y, 0, y + cardH);
      accentGrad.addColorStop(0, emerald);
      accentGrad.addColorStop(1, gold);
      roundedBox(right - 6, y + 14, 6, cardH - 28, 3, accentGrad);

      // Rounded Destination Photo on Left
      const photoW = 242;
      const photoH = cardH - 20;
      imageCoverRounded(photos[i], margin + 10, y + 10, photoW, photoH, 11);

      const photoNote = stationPhotoInfo[row.id];
      if (photoNote?.context) {
        roundedBox(margin + 16, y + cardH - 42, photoW - 12, 26, 8, 'rgba(6, 26, 51, 0.78)');
        text(photoNote.caption.slice(0, 36), margin + photoW - 2, y + cardH - 29, 11, {
          color: '#FFFFFF',
          weight: 600,
        });
      }

      const contentRight = right - 22;
      const maxTextW = inner - photoW - 44;

      // Step Pill + Tag Pill
      roundedBox(contentRight - 64, y + 16, 64, 24, 12, emeraldSoft, 'rgba(0,108,53,0.22)');
      text(`محطة ${formatNum(row.number)}`, contentRight - 32, y + 28, 12, {
        color: emerald,
        weight: 700,
        align: 'center',
      });
      text(stop.tag, contentRight - 74, y + 28, 13, { color: gold, weight: 700 });

      // Bold Station Title
      text(row.name, contentRight, y + 60, 22, { color: navyDeep, weight: 700, display: true });

      // Crisp Time + Visit + Drive Metadata Pills
      const timePillW = 128;
      roundedBox(contentRight - timePillW, y + 82, timePillW, 26, 8, ice, border);
      text(`${row.starts_at} – ${row.ends_at}`, contentRight - timePillW / 2, y + 95, 13.5, {
        direction: 'ltr',
        align: 'center',
        color: navyMid,
        weight: 700,
      });

      const metaStr = `زيارة ${durationLabel(row.visit_minutes)}${
        row.drive_minutes ? `   ·   انتقال ${durationLabel(row.drive_minutes)}` : ''
      }`;
      text(metaStr, contentRight - timePillW - 12, y + 95, 13, { color: emerald, weight: 700 });

      // Clean Description Paragraph
      paragraph(stop.desc, contentRight, y + 128, 13.5, maxTextW, {
        color: muted,
        lineHeight: 20,
        maxLines: 3,
      });

      y += cardH + cardGap;
    }
    addPage();
  }

  canvas.width = canvas.height = 1;
  return makeTripPdf(pages);
}
