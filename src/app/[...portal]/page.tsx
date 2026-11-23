import { notFound } from 'next/navigation';
import { AlBahaPortalClient } from '@/components/AlBahaPortalClient';
import { isPortalPath } from '@/lib/portalNavigation';

export default async function PortalPage({ params }: { params: Promise<{ portal: string[] }> }) {
  const { portal } = await params;
  if (!isPortalPath(`/${portal.join('/')}`)) notFound();
  return <AlBahaPortalClient />;
}
