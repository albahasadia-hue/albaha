import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';
import '../styles/globals.scss';

export const metadata: Metadata = {
  title: 'البوابة الرسمية لمنطقة الباحة | التنمية والسياحة والخدمات الرقمية',
  description:
    'اكتشف طبيعة الباحة وتراثها وخطط لرحلتك على خريطة تفاعلية بين الجبال والقرى.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#0B4F6C',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Readex+Pro:wght@400;500;600;700&family=Alexandria:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
