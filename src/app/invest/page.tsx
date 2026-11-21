import type { Metadata } from 'next';
import { AlBahaPortalClient } from '@/components/AlBahaPortalClient';

export const metadata: Metadata = {
  title: 'الاستثمار في منطقة الباحة | بوابة منطقة الباحة',
  description:
    'استكشف الفرص الاستثمارية البلدية والسياحية والمشاريع التنموية في منطقة الباحة عبر بوابة أمانة منطقة الباحة ومنصة فرص.',
};

export default function InvestPage() {
  return <AlBahaPortalClient initialView="invest" />;
}
