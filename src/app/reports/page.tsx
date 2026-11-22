import type { Metadata } from 'next';
import { AlBahaPortalClient } from '@/components/AlBahaPortalClient';

export const metadata: Metadata = {
  title: 'البلاغات والشكاوى | بوابة منطقة الباحة',
  description: 'نموذج البلاغات والشكاوى في بوابة منطقة الباحة.',
};

export default function ReportsPage() {
  return <AlBahaPortalClient initialView="reports" />;
}
