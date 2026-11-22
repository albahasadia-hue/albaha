'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { SupportRequestKind } from '@/lib/portalTypes';
import styles from './SupportRequestPageView.module.scss';

const requestPages = {
  reports: {
    title: 'البلاغات والشكاوى',
    description: 'أرسل بلاغًا عن مخالفة أو شكوى حول إحدى الخدمات في منطقة الباحة.',
    icon: '#i-foot-headset',
    options: [
      { value: 'violation', label: 'بلاغ عن مخالفة' },
      { value: 'complaint', label: 'شكوى' },
    ],
    detailsLabel: 'تفاصيل البلاغ أو الشكوى',
    submitLabel: 'إرسال البلاغ أو الشكوى',
    referencePrefix: 'BLG',
  },
  feedback: {
    title: 'الملاحظات والاقتراحات',
    description: 'شاركنا ملاحظتك أو اقتراحك لتطوير الخدمات في منطقة الباحة.',
    icon: '#i-foot-message',
    options: [
      { value: 'note', label: 'ملاحظة' },
      { value: 'suggestion', label: 'اقتراح' },
    ],
    detailsLabel: 'تفاصيل الملاحظة أو الاقتراح',
    submitLabel: 'إرسال الملاحظة أو الاقتراح',
    referencePrefix: 'FDB',
  },
};

const maxImageSize = 10 * 1024 * 1024;

const issueCategories = [
  { value: 'municipal-violation', label: 'مخالفات بلدية' },
  { value: 'cleanliness', label: 'النظافة والنفايات' },
  { value: 'roads', label: 'الطرق والأرصفة' },
  { value: 'lighting', label: 'الإنارة واللوحات الإرشادية' },
  { value: 'parks', label: 'الحدائق والمرافق العامة' },
  { value: 'environmental-health', label: 'الإصحاح البيئي' },
  { value: 'utility-networks', label: 'شبكات الخدمات العامة' },
  { value: 'service-quality', label: 'جودة الخدمة والتعامل' },
  { value: 'other', label: 'أخرى' },
];

function clearValidation(event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) {
  event.currentTarget.setCustomValidity('');
}

export function SupportRequestPageView({ kind }: { kind: SupportRequestKind }) {
  const page = requestPages[kind];
  const [ready, setReady] = useState(false);
  const [requestType, setRequestType] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [reference, setReference] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const receipt = useRef<HTMLDialogElement>(null);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!attachment) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(attachment);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  useEffect(() => {
    const dialog = receipt.current;
    if (reference && dialog && !dialog.open) dialog.showModal();
  }, [reference]);

  function selectAttachment(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    let error = '';
    if (file && !file.type.startsWith('image/') && (file.type || !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))) {
      error = 'اختر ملف صورة صالحًا.';
    } else if (file && file.size > maxImageSize) {
      error = 'اختر صورة بحجم 10 ميجابايت أو أقل.';
    }
    input.setCustomValidity(error);
    setAttachmentError(error);
    setAttachment(error ? null : file ?? null);
  }

  function removeAttachment() {
    const input = fileInput.current;
    if (!input) return;
    input.value = '';
    input.setCustomValidity('');
    setAttachment(null);
    setAttachmentError('');
    input.focus();
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fullName = form.elements.namedItem('fullName') as HTMLInputElement;
    const phone = form.elements.namedItem('phone') as HTMLInputElement;
    const details = form.elements.namedItem('details') as HTMLTextAreaElement;
    const digits = phone.value.replace(/[^0-9٠-٩۰-۹]/g, '');

    fullName.setCustomValidity(fullName.value.trim() ? '' : 'أدخل اسمك الكامل.');
    phone.setCustomValidity(
      /^[+()\s\d٠-٩۰-۹.-]+$/.test(phone.value) && digits.length >= 7 && digits.length <= 15
        ? ''
        : 'أدخل رقم هاتف أو واتساب صالحًا.'
    );
    details.setCustomValidity(details.value.trim() ? '' : 'أدخل تفاصيل الطلب.');
    if (!form.reportValidity()) return;

    setReference(`${page.referencePrefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
    form.reset();
    setRequestType('');
    setAttachment(null);
    setAttachmentError('');
  }

  return (
    <article id="supportRequestView" className={styles.page} aria-labelledby="supportRequestTitle">
      <div className="container">
        <div className={styles.layout}>
          <nav className="place-trail" aria-label="مسار الصفحة">
            <a href="/#home">الرئيسية</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{page.title}</span>
          </nav>
          <header className={styles.header}>
            <span className={styles.headerIcon}>
              <svg className="ic" aria-hidden="true"><use href={page.icon} /></svg>
            </span>
            <div>
              <h1 id="supportRequestTitle" tabIndex={-1}>{page.title}</h1>
              <p>{page.description}</p>
            </div>
          </header>

          <form className={styles.form} method="post" onSubmit={submitRequest} aria-describedby="supportDemoNotice">
            <fieldset className={styles.fields} disabled={!ready}>
              <label>
                نوع الطلب
                <select name="type" required value={requestType} onChange={(event) => setRequestType(event.currentTarget.value)}>
                  <option value="" disabled>اختر نوع الطلب</option>
                  {page.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {kind === 'reports' && (
                <label>
                  تصنيف المشكلة
                  <select name="category" required defaultValue="">
                    <option value="" disabled>اختر تصنيف المشكلة</option>
                    {issueCategories.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                الاسم الكامل
                <input name="fullName" autoComplete="name" required maxLength={100} onInput={clearValidation} />
              </label>
              <label>
                رقم الهاتف أو واتساب
                <input name="phone" type="tel" dir="ltr" autoComplete="tel" required maxLength={26} onInput={clearValidation} />
              </label>
              <label>
                <span>البريد الإلكتروني <small>(اختياري)</small></span>
                <input name="email" type="email" dir="ltr" autoComplete="email" maxLength={254} />
              </label>
              {requestType === 'complaint' && (
                <label>
                  <span>الجهة أو مقدم الخدمة <small>(اختياري)</small></span>
                  <input name="organization" maxLength={120} />
                </label>
              )}
              <label className={styles.fullWidth}>
                {page.detailsLabel}
                <textarea name="details" rows={4} required maxLength={2000} onInput={clearValidation} />
              </label>
              {kind === 'reports' && (
                <div className={`${styles.attachment} ${styles.fullWidth}`}>
                  <label htmlFor="reportPhoto">
                    <span>صورة للمخالفة <small>(اختياري)</small></span>
                    <input
                      ref={fileInput}
                      id="reportPhoto"
                      name="photo"
                      type="file"
                      accept="image/*"
                      aria-describedby="reportPhotoHint"
                      onChange={selectAttachment}
                    />
                  </label>
                  <small id="reportPhotoHint">صورة واحدة بحد أقصى 10 ميجابايت.</small>
                  {attachmentError && <p className={styles.error} role="alert">{attachmentError}</p>}
                  {(attachment || attachmentError) && (
                    <div className={styles.attachmentSummary}>
                      {attachment && previewUrl && (
                        // Local object URLs already point at the user's original file.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={previewUrl} src={previewUrl} alt="معاينة الصورة المرفقة" onError={(event) => {
                          event.currentTarget.hidden = true;
                        }} />
                      )}
                      {attachment && <bdi>{attachment.name}</bdi>}
                      <button type="button" className="btn btn-soft" onClick={removeAttachment}>إزالة الصورة</button>
                    </div>
                  )}
                </div>
              )}
              <div className={`${styles.formFooter} ${styles.fullWidth}`}>
                <p id="supportDemoNotice">إرسال تجريبي. تبقى البيانات والمرفقات داخل هذه الصفحة.</p>
                <button className="btn btn-dark" type="submit">{page.submitLabel}</button>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
      <dialog ref={receipt} className={styles.receipt} aria-labelledby="supportReceiptTitle" onClose={() => setReference('')}>
        <div className={styles.receiptContent}>
          <span className={styles.receiptIcon}>
            <svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>
          </span>
          <h2 id="supportReceiptTitle">تم استلام طلبك تجريبيًا</h2>
          <p>رقم الطلب التجريبي</p>
          <bdi className={styles.reference}>{reference}</bdi>
          <p>هذه محاكاة للإرسال. لم تُرسل بياناتك إلى الأمانة.</p>
          <button type="button" className="btn btn-dark" onClick={() => receipt.current?.close()}>تم</button>
        </div>
      </dialog>
    </article>
  );
}
