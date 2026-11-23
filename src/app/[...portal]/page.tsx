import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlBahaPortalClient } from '@/components/AlBahaPortalClient';
import { isPortalPath } from '@/lib/portalNavigation';
import { cityStories, climateCities, places } from '@/lib/portalStaticData';

type PortalPageProps = { params: Promise<{ portal: string[] }> };

export async function generateMetadata({ params }: PortalPageProps): Promise<Metadata> {
  const [view, id, section, storyId] = await params.then(({ portal }) => portal);
  if (view === 'city' && Object.hasOwn(climateCities, id)) {
    const story = section === 'stories' && cityStories.find((item) => item.id === storyId);
    return { title: `${story ? story.title : climateCities[id].name} | اكتشف الباحة` };
  }
  if (view === 'place') {
    const place = places.get(id);
    if (place) return { title: `${place.name} | اكتشف الباحة` };
  }
  if (view === 'guide') return { title: 'الدليل السياحي | اكتشف الباحة' };
  return {};
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { portal } = await params;
  if (!isPortalPath(`/${portal.join('/')}`)) notFound();
  return <AlBahaPortalClient />;
}
