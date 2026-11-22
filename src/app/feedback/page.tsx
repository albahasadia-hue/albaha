import type { Metadata } from 'next';
import { AlBahaPortalClient } from '@/components/AlBahaPortalClient';

export const metadata: Metadata = {
  title: 'الملاحظات والاقتراحات | بوابة منطقة الباحة',
  description: 'نموذج الملاحظات والاقتراحات في بوابة منطقة الباحة.',
};

export default function FeedbackPage() {
  return <AlBahaPortalClient initialView="feedback" />;
}
