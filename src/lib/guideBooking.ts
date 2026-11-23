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
const riyadhDisplayTime = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
  timeZone: 'Asia/Riyadh',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function guideBookingType(category: string, hasBookingLink: boolean): 'stay' | 'visit' | null {
  if (lodgingCategories.has(category)) return 'stay';
  return diningCategories.has(category) || hasBookingLink ? 'visit' : null;
}

export function guideBookingMarkup(safePlaceName: string, placeHref: string, type: 'stay' | 'visit'): string {
  const stay = type === 'stay';
  const field = (icon: string, label: string, input: string, full = false) =>
    `<label class="service-form-field${full ? ' service-form-full' : ''}"><span class="service-form-label">${glyph(icon, 'ic tiny')}<span>${label}</span></span>${input}</label>`;
  const receiptDetail = (name: string, label: string, dir = 'auto') =>
    `<div><dt>${label}</dt><dd><bdi dir="${dir}" data-receipt-value="${name}"></bdi></dd></div>`;

  return `<div class="container guide-booking-page"><div class="guide-booking service-form-layout">
    <a class="tour-guide-back service-form-back" href="${placeHref}">${glyph('arrow', 'ic tiny')} العودة إلى تفاصيل المكان</a>
    <header class="service-form-hero">
      <span class="service-form-hero-icon">${glyph(stay ? 'directory-hotel' : 'city-calendar')}</span>
      <div class="service-form-hero-copy">
        <h1 id="guideBookingTitle" tabindex="-1">${stay ? 'حجز إقامة' : 'حجز موعد'}</h1>
        <p title="${safePlaceName}">${safePlaceName}</p>
      </div>
    </header>
    <form class="service-form-card service-form-fields" data-booking-form aria-labelledby="guideBookingTitle" aria-describedby="guideBookingNotice">
      ${field('form-user', 'الاسم الكامل', '<input name="guest" autocomplete="name" placeholder="الاسم الأول والعائلة" maxlength="80" required>', true)}
      ${field('foot-phone', 'رقم الجوال', '<input name="phone" type="tel" dir="ltr" autocomplete="tel" placeholder="05XXXXXXXX" maxlength="26" required>')}
      ${field('foot-mail', 'البريد الإلكتروني', '<input name="email" type="email" dir="ltr" autocomplete="email" placeholder="name@example.com" maxlength="254" required>')}
      ${field('city-calendar', stay ? 'تاريخ الوصول' : 'التاريخ', '<input name="date" type="date" aria-describedby="guideBookingTimeHint" required>')}
      ${field('clock', stay ? 'وقت الوصول' : 'الوقت', '<input name="time" type="time" aria-describedby="guideBookingTimeHint" required>')}
      <p class="guide-booking-time-hint service-form-full" id="guideBookingTimeHint">
        <span>الموعد بتوقيت السعودية.</span>
        <span>الساعة الآن <bdi data-booking-current-time></bdi></span>
      </p>
      ${stay ? field('city-calendar', 'تاريخ المغادرة', '<input name="departure" type="date" required>') : ''}
      ${field('family', 'عدد الضيوف', '<input name="guests" type="number" min="1" max="999" step="1" placeholder="1" required>', !stay)}
      <p class="guide-booking-error service-form-full" data-booking-error role="alert" hidden></p>
      <div class="service-form-footer service-form-full">
        <p class="service-form-notice" id="guideBookingNotice">${glyph('info', 'ic tiny')} حجز تجريبي. لا يُرسل الطلب إلى المنشأة.</p>
        <button type="submit" class="btn btn-dark service-form-cta">${glyph('city-calendar', 'ic tiny')} حجز</button>
      </div>
    </form>
    <section class="guide-booking-ticket" data-booking-ticket aria-labelledby="guideBookingReceiptTitle" hidden>
      <header class="service-form-hero">
        <span class="service-form-hero-icon">${glyph('check')}</span>
        <div>
          <h1 id="guideBookingReceiptTitle" tabindex="-1">تم الحجز التجريبي</h1>
          <p>${safePlaceName}</p>
        </div>
      </header>
      <div class="guide-booking-ticket-body">
        <div class="guide-booking-ticket-details">
          <dl class="guide-booking-ticket-summary">
            ${receiptDetail('appointment', stay ? 'الوصول بتوقيت السعودية' : 'الموعد بتوقيت السعودية', 'ltr')}
            ${stay ? receiptDetail('departure', 'المغادرة', 'ltr') : ''}
            ${receiptDetail('guests', 'عدد الضيوف')}
          </dl>
          <dl class="guide-booking-ticket-contact">
            ${receiptDetail('guest', 'اسم الضيف')}
            ${receiptDetail('phone', 'رقم الجوال', 'ltr')}
            ${receiptDetail('email', 'البريد الإلكتروني', 'ltr')}
          </dl>
        </div>
        <div class="guide-booking-ticket-code">
          <img alt="رمز QR للحجز التجريبي" width="600" height="600">
          <a class="btn btn-dark service-form-cta" download="albaha-demo-booking.png">${glyph('download', 'ic tiny')} تحميل رمز الحجز</a>
        </div>
      </div>
    </section>
  </div></div>`;
}

export function bindGuideBooking(root: HTMLElement, place: { id: string; name: string }, signal: AbortSignal): void {
  const form = root.querySelector<HTMLFormElement>('[data-booking-form]');
  const ticket = root.querySelector<HTMLElement>('[data-booking-ticket]');
  if (!form || !ticket) return;

  const dateInput = form.elements.namedItem('date') as HTMLInputElement;
  const timeInput = form.elements.namedItem('time') as HTMLInputElement;
  const departureInput = form.elements.namedItem('departure') as HTMLInputElement | null;
  const error = form.querySelector<HTMLElement>('[data-booking-error]')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const currentTime = form.querySelector<HTMLElement>('[data-booking-current-time]')!;
  const refreshTime = () => { currentTime.textContent = riyadhDisplayTime.format(new Date()); };
  refreshTime();
  const clock = window.setInterval(refreshTime, 15_000);
  signal.addEventListener('abort', () => window.clearInterval(clock), { once: true });
  dateInput.min = riyadhDate.format(new Date());
  if (departureInput) departureInput.min = dateInput.min;

  dateInput.addEventListener('input', () => {
    if (departureInput) departureInput.min = dateInput.value || dateInput.min;
    refreshTime();
  }, { signal });
  timeInput.addEventListener('focus', refreshTime, { signal });

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
    refreshTime();
    error.hidden = true;
    if (!guest || !email || !date || !time || !Number.isInteger(guests) || guests < 1) {
      error.textContent = 'أكمل بيانات الحجز.';
    } else if (!/^[+()\s\d٠-٩۰-۹.-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      error.textContent = 'أدخل رقم جوال صالحًا.';
    } else if (date < today || (date === today && time < riyadhTime.format(now))) {
      error.textContent = `الموعد المحدد قد مضى. الساعة الآن في السعودية ${riyadhDisplayTime.format(now)}. اختر موعدًا لاحقًا.`;
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

        const values = { appointment: `${date} · ${time}`, departure, guests, guest, phone, email };
        for (const [name, value] of Object.entries(values)) {
          const field = ticket.querySelector<HTMLElement>(`[data-receipt-value="${name}"]`);
          if (field) field.textContent = String(value);
        }
        ticket.querySelector('img')!.src = imageUrl;
        ticket.querySelector('a')!.href = imageUrl;
        form.reset();
        form.hidden = true;
        window.clearInterval(clock);
        ticket.hidden = false;
        ticket.querySelector('h1')?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'instant' });
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
