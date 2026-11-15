import {
  durationLabel,
  formatNum,
  getSegment,
  places,
  routePath,
} from './portalHelpers';
import {
  conciergeDays,
  domMedia,
  geo,
  images,
  stationPhotoInfo,
} from './portalStaticData';
import type { ApprovedTrip } from './portalTypes';

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
  const resolution = 1.8;
  const margin = 52;
  const right = width - margin;
  const inner = right - margin;
  const ink = '#0f293a';
  const plum = '#006c35';
  const muted = '#476273';
  const gold = '#e6b25f';

  const rows = trip.stations
    .map((row, index) => ({ ...row, number: index + 1 }))
    .filter((row) => places.has(row.id));
  if (!rows.length) throw new Error('No stations to export');

  const sheets: Array<{ days: Set<number>; continued: boolean; rows: typeof rows }> = [];
  for (const row of rows) {
    const current = sheets[sheets.length - 1];
    if (current && current.rows.length < 4 && (current.days.size < 2 || current.days.has(row.day))) {
      current.days.add(row.day);
      current.rows.push(row);
    } else {
      sheets.push({
        days: new Set([row.day]),
        continued: current?.rows[current.rows.length - 1]?.day === row.day,
        rows: [row],
      });
    }
  }

  const pages: PdfPagePayload[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * resolution);
  canvas.height = Math.round(height * resolution);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(resolution, resolution);

  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  };

  const text = (
    value: string | number,
    x: number,
    y: number,
    size: number,
    {
      color = ink,
      weight = 400,
      direction = 'rtl',
      align,
    }: {
      color?: string;
      weight?: number;
      direction?: CanvasDirection;
      align?: CanvasTextAlign;
    } = {}
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px "Alexandria", "Cairo", sans-serif`;
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
    { color = muted, weight = 400, lineHeight = size * 1.55 } = {}
  ) => {
    ctx.font = `${weight} ${size}px "Alexandria", "Cairo", sans-serif`;
    let line = '';
    for (const word of value.split(/\s+/)) {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        text(line, x, y, size, { color, weight });
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
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  };

  const imageCover = (
    image: HTMLImageElement | null,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    if (!image || !image.naturalWidth || !image.naturalHeight) return;
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
  };

  const pageBase = (page: number, title: string, subtitle: string) => {
    box(0, 0, width, height, '#FCFBF7');
    box(0, 0, width, 162, '#061A33');
    box(right - 36, 38, 36, 3, gold);
    text('اكتشف الباحة  |  مخطط الرحلة', right - 50, 39, 20, { color: '#f4d69e', weight: 600 });
    text(title, right, 91, 43, { color: '#fff', weight: 600 });
    text(subtitle, right, 132, 20, { color: '#f3e4ef' });
    box(margin, 1129, inner, 1, '#e2d5e0');
    text('أوقات الزيارة بتوقيت السعودية  |  راجع ساعات العمل قبل الانطلاق', right, 1154, 16, {
      color: muted,
    });
    text(`${page} / ${sheets.length + 1}`, margin, 1154, 16, {
      color: plum,
      direction: 'ltr',
      weight: 600,
    });
  };

  const addPage = () => {
    const jpeg = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    pages.push({
      bytes: Uint8Array.from(atob(jpeg), (char) => char.charCodeAt(0)),
      width: canvas.width,
      height: canvas.height,
    });
  };

  const terrainHref =
    document.getElementById('terrainRelief')?.getAttribute('href') || domMedia.terrainRelief;
  const terrain = await imageFrom(terrainHref);
  const pins = rows.map((row) => geo.stations[row.id]);
  const legs = rows
    .slice(1)
    .map((row, i) => getSegment(places.get(rows[i].id)!, places.get(row.id)!));
  const points = [...pins, ...legs.flatMap((leg) => leg.points)];
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const mapY = 250;
  const mapHeight = 566;
  const scale = Math.min(
    (inner - 100) / Math.max(maxX - minX, 230),
    (mapHeight - 100) / Math.max(maxY - minY, 220)
  );
  const mapX = margin + inner / 2 - ((minX + maxX) / 2) * scale;
  const mapTop = mapY + mapHeight / 2 - ((minY + maxY) / 2) * scale;

  pageBase(
    1,
    'رحلتك في الباحة',
    `${trip.region_name}  |  ${conciergeDays[String(trip.days)] || ''}  |  ${trip.style_name}`
  );
  text('المسار العام للرحلة', right, 202, 29, { weight: 600 });
  text('ترتيب المحطات والتضاريس  |  مسار إرشادي غير مخصص للملاحة', right, 230, 17, {
    color: muted,
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(margin, mapY, inner, mapHeight);
  ctx.clip();
  box(margin, mapY, inner, mapHeight, '#f2ebe6');
  if (terrain) {
    ctx.drawImage(
      terrain,
      mapX + mapExtent.left * scale,
      mapTop + mapExtent.top * scale,
      (mapExtent.right - mapExtent.left) * scale,
      (mapExtent.bottom - mapExtent.top) * scale
    );
  }
  const path = routePath(legs);
  if (path) {
    const route = new Path2D(path);
    ctx.save();
    ctx.translate(mapX, mapTop);
    ctx.scale(scale, scale);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8 / scale;
    ctx.stroke(route);
    ctx.strokeStyle = plum;
    ctx.lineWidth = 4 / scale;
    ctx.stroke(route);
    ctx.restore();
  }

  const badges: [number, number][] = [];
  for (const [index, [x, y]] of pins.entries()) {
    const px = mapX + x * scale;
    const py = mapTop + y * scale;
    const shifts: [number, number][] = [
      [0, 0],
      [31, 0],
      [-31, 0],
      [0, -31],
      [0, 31],
      [31, -31],
      [-31, 31],
    ];
    const [dx, dy] =
      shifts.find(([sx, sy]) =>
        badges.every(([bx, by]) => Math.hypot(px + sx - bx, py + sy - by) >= 31)
      ) || [0, 0];
    const bx = px + dx;
    const by = py + dy;
    badges.push([bx, by]);
    if (dx || dy) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = plum;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(bx, by, 13.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = plum;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(index + 1, bx, by + 0.5, 16, {
      align: 'center',
      direction: 'ltr',
      color: plum,
      weight: 600,
    });
  }
  ctx.restore();

  text('© OpenStreetMap | Mapzen / SRTM', margin, 834, 13, { direction: 'ltr', color: muted });
  text('دليل المحطات', right, 873, 24, { weight: 600 });
  const column = inner / 2;
  for (const row of rows) {
    const x = right - Math.floor((row.number - 1) / 6) * column;
    const y = 908 + ((row.number - 1) % 6) * 27;
    text(row.number, x, y, 17, { color: plum, weight: 600 });
    text(row.name, x - 32, y, 18);
  }
  text('استخدم تطبيق ملاحة لتحديد الطرق ومواعيد الوصول الفعلية.', right, 1100, 17, {
    color: muted,
  });
  addPage();

  for (const [index, sheet] of sheets.entries()) {
    const photos = await Promise.all(
      sheet.rows.map((row) => imageFrom(images[places.get(row.id)!.image]))
    );
    const [firstDay, lastDay] = Array.from(sheet.days);
    const title = lastDay ? `اليومان ${formatNum(firstDay)} و${formatNum(lastDay)}` : `اليوم ${formatNum(firstDay)}`;
    pageBase(index + 2, title, 'برنامج الزيارة حسب ترتيب المحطات');
    let y = 186;
    let previousDay = 0;
    for (const [i, row] of sheet.rows.entries()) {
      const stop = places.get(row.id)!;
      if (row.day !== previousDay) {
        box(margin, y, inner, 29, '#f1e4ef');
        text(
          `اليوم ${formatNum(row.day)}${!i && sheet.continued ? ' | متابعة' : ''}`,
          right - 14,
          y + 14,
          17,
          { color: plum, weight: 600 }
        );
        y += 37;
        previousDay = row.day;
      }
      box(margin, y, inner, 192, '#fff');
      box(margin, y, 236, 192, '#eee3ec');
      imageCover(photos[i], margin, y, 236, 192);
      const photoNote = stationPhotoInfo[row.id];
      if (photoNote?.context) {
        box(margin, y + 147, 236, 45, '#3d2236');
        paragraph(photoNote.caption, margin + 226, y + 162, 13, 214, {
          color: '#fff',
          lineHeight: 16,
        });
      }
      box(right - 5, y, 5, 192, '#0f766e');
      const x = right - 22;
      text(`المحطة ${formatNum(row.number)}  |  ${stop.tag}`, x, y + 23, 16, {
        color: plum,
        weight: 600,
      });
      text(row.name, x, y + 51, 29, { weight: 600 });
      text(`${row.starts_at} - ${row.ends_at}`, x, y + 84, 22, {
        direction: 'ltr',
        align: 'right',
        color: plum,
        weight: 600,
      });
      text(
        `مدة الزيارة ${durationLabel(row.visit_minutes)}${
          row.drive_minutes
            ? `  |  الانتقال ${durationLabel(row.drive_minutes)}${row.drive_estimated ? ' تقريبًا' : ''}`
            : ''
        }`,
        x,
        y + 111,
        16,
        { color: muted }
      );
      paragraph(stop.desc, x, y + 139, 17, inner - 275, { lineHeight: 21 });
      y += 207;
    }
    addPage();
  }

  canvas.width = canvas.height = 1;
  return makeTripPdf(pages);
}
