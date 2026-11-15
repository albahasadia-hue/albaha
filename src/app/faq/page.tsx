import type { Metadata } from 'next';
import { AlBahaPortalClient } from '@/components/AlBahaPortalClient';

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة | بوابة منطقة الباحة',
  description:
    'إجابات منظمة حول الوصول والمطار والطقس وأفضل المواسم والوجهات السياحية ومخطط الرحلة في منطقة الباحة.',
};

export default function FaqPage() {
  return <AlBahaPortalClient initialView="faq" />;
}
