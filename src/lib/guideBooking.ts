import { glyph } from './portalHelpers';

const lodgingCategories = new Set(['hotels', 'chalets']);
const diningCategories = new Set(['restaurants', 'cafes']);
const riyadhDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Riyadh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const riyadhTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Riyadh',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function guideBookingType(category: string, hasBookingLink: boolean): 'stay' | 'visit' | null {
  if (lodgingCategories.has(category)) return 'stay';
  return diningCategories.has(category) || hasBookingLink ? 'visit' : null;
}

export function guideBookingMarkup(safePlaceName: string, placeHref: string, type: 'stay' | 'visit'): string {
  const stay = type === 'stay';
  return `<div class="container guide-booking-page"><section class="guide-booking" aria-labelledby="guideBookingTitle">
    <a class="tour-guide-back" href="${placeHref}">${glyph('arrow', 'ic tiny')} العودة إلى تفاصيل المكان</a>
    <header class="guide-booking-header">
      <h1 id="guideBookingTitle" tabindex="-1">حجز في ${safePlaceName}</h1>
    </header>
    <p class="guide-booking-notice" id="guideBookingNotice">حجز تجريبي لأغراض العرض. لا يُرسل الطلب إلى المنشأة.</p>
    <form class="guide-booking-form" data-booking-form aria-describedby="guideBookingNotice">
      <label class="guide-booking-wide">الاسم الكامل<input name="guest" autocomplete="name" maxlength="80" required></label>
      <label>رقم الجوال<input name="phone" type="tel" dir="ltr" autocomplete="tel" maxlength="26" required></label>
      <label>البريد الإلكتروني<input name="email" type="email" dir="ltr" autocomplete="email" maxlength="254" required></label>
      <label>${stay ? 'تاريخ الوصول' : 'التاريخ'}<input name="date" type="date" required></label>
      <label>${stay ? 'وقت الوصول' : 'الوقت'}<input name="time" type="time" required></label>
      ${stay ? '<label>تاريخ المغادرة<input name="departure" type="date" required></label>' : ''}
      <label>عدد الضيوف<input name="guests" type="number" min="1" max="999" step="1" required></label>
      <p class="guide-booking-error guide-booking-wide" data-booking-error role="alert" hidden></p>
      <button type="submit" class="btn btn-dark guide-booking-wide">حجز</button>
    </form>
    <section class="guide-booking-ticket" data-booking-ticket hidden>
      <h2 tabindex="-1">تم الحجز التجريبي</h2>
      <dl></dl>
      <img alt="رمز QR لبطاقة الحجز التجريبي" width="240" height="240">
      <a class="btn btn-dark" download="albaha-demo-booking.png">تحميل رمز الحجز</a>
    </section>
  </section></div>`;
}

export function bindGuideBooking(root: HTMLElement, place: { id: string; name: string }, signal: AbortSignal): void {
  const form = root.querySelector<HTMLFormElement>('[data-booking-form]');
  const ticket = root.querySelector<HTMLElement>('[data-booking-ticket]');
  if (!form || !ticket) return;

  const dateInput = form.elements.namedItem('date') as HTMLInputElement;
  const departureInput = form.elements.namedItem('departure') as HTMLInputElement | null;
  const error = form.querySelector<HTMLElement>('[data-booking-error]')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  dateInput.min = riyadhDate.format();
  if (departureInput) departureInput.min = dateInput.min;

  dateInput.addEventListener('input', () => {
    if (departureInput) departureInput.min = dateInput.value || dateInput.min;
  }, { signal });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled || form.hidden) return;
    const fields = new FormData(form);
    const read = (field: string) => String(fields.get(field) ?? '').trim();
    const guest = read('guest');
    const phone = read('phone');
    const email = read('email');
    const phoneDigits = phone.replace(/[^0-9٠-٩۰-۹]/g, '');
    const date = read('date');
    const time = read('time');
    const departure = read('departure');
    const guests = Number(read('guests'));
    const now = new Date();
    const today = riyadhDate.format(now);
    error.hidden = true;
    if (!guest || !email || !date || !time || !Number.isInteger(guests) || guests < 1) {
      error.textContent = 'أكمل بيانات الحجز.';
    } else if (!/^[+()\s\d٠-٩۰-۹.-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      error.textContent = 'أدخل رقم جوال صالحًا.';
    } else if (date < today || (date === today && time < riyadhTime.format(now))) {
      error.textContent = 'اختر موعدًا في المستقبل بتوقيت السعودية.';
    } else if (departureInput && (!departure || departure <= date)) {
      error.textContent = 'اختر تاريخ مغادرة بعد تاريخ الوصول.';
    } else {
      const payload = {
        demo: true,
        placeId: place.id,
        place: place.name,
        guest,
        phone,
        email,
        guests,
        date,
        time,
        timeZone: 'Asia/Riyadh',
        ...(departure ? { departure } : {}),
      };
      submit.disabled = true;
      try {
        const { toDataURL } = await import('qrcode');
        const imageUrl = await toDataURL(JSON.stringify(payload), { width: 600, margin: 4 });
        if (signal.aborted) return;

        const details = ticket.querySelector('dl')!;
        details.replaceChildren();
        const rows = [
          { label: 'الاسم', value: guest },
          { label: 'رقم الجوال', value: phone, dir: 'ltr' },
          { label: 'البريد الإلكتروني', value: email, dir: 'ltr' },
          { label: 'عدد الضيوف', value: String(guests) },
          { label: 'الموعد بتوقيت السعودية', value: `${date} · ${time}`, dir: 'ltr' },
          ...(departure ? [{ label: 'المغادرة', value: departure, dir: 'ltr' }] : []),
        ];
        for (const { label, value, dir } of rows) {
          const name = document.createElement('dt');
          const detail = document.createElement('dd');
          name.textContent = label;
          detail.textContent = value;
          if (dir) detail.dir = dir;
          details.append(name, detail);
        }
        ticket.querySelector('img')!.src = imageUrl;
        ticket.querySelector('a')!.href = imageUrl;
        form.reset();
        form.hidden = true;
        ticket.hidden = false;
        ticket.querySelector('h2')?.focus();
        return;
      } catch {
        if (signal.aborted) return;
        error.textContent = 'تعذّر إنشاء الرمز. حاول مرة أخرى.';
      } finally {
        submit.disabled = false;
      }
    }
    error.hidden = false;
  }, { signal });
}
