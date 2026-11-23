'use client';

import { useEffect } from 'react';
import { initAlBahaPortal } from '@/lib/initAlBahaPortal';
import type { PortalInitialView } from '@/lib/portalTypes';
import { SkipLink } from '@/components/common/SkipLink';
import { SvgSpriteDefs } from '@/components/common/SvgSpriteDefs';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { HeroSection } from '@/components/home/HeroSection';
import { DiscoverIntroSection } from '@/components/home/DiscoverIntroSection';
import { OfficialPortalSection } from '@/components/home/OfficialPortalSection';
import { ExperiencesSection } from '@/components/home/ExperiencesSection';
import { DestinationsCarouselSection } from '@/components/home/DestinationsCarouselSection';
import { DestinationDirectorySection } from '@/components/home/DestinationDirectorySection';
import { StorySection } from '@/components/home/StorySection';
import { GallerySection } from '@/components/home/GallerySection';
import { VisitGuideSection } from '@/components/home/VisitGuideSection';
import { VisitSeasonSection } from '@/components/home/VisitSeasonSection';
import { TripPlannerSection } from '@/components/home/TripPlannerSection';
import { AppPromoSection } from '@/components/home/AppPromoSection';
import { FaqTeaserSection } from '@/components/home/FaqTeaserSection';
import { DynamicSubViews } from '@/components/views/DynamicSubViews';
import { SirajLauncher } from '@/components/overlays/SirajLauncher';
import { MenuDialog } from '@/components/overlays/MenuDialog';
import { SearchDialog } from '@/components/overlays/SearchDialog';
import { ConciergeDialog } from '@/components/overlays/ConciergeDialog';
import { ToastBanner } from '@/components/overlays/ToastBanner';

/**
 * Interactive client root for the Al Baha Regional Portal.
 * Renders the exact section, subview, and dialog hierarchy from R15 and mounts
 * the portal's StrictMode-safe imperative runtime on hydration.
 */
interface AlBahaPortalClientProps {
  initialView?: PortalInitialView;
}

export function AlBahaPortalClient({ initialView = 'home' }: AlBahaPortalClientProps) {
  useEffect(() => {
    return initAlBahaPortal(initialView);
  }, [initialView]);

  return (
    <>
      <SvgSpriteDefs />
      <SkipLink />
      <SiteHeader />
      <main id="content" tabIndex={-1}>
        <div id="homeView" hidden={initialView !== 'home'}>
          <HeroSection />
          <DiscoverIntroSection />
          <ExperiencesSection />
          <DestinationsCarouselSection />
          <TripPlannerSection />
          <DestinationDirectorySection />
          <StorySection />
          <GallerySection />
          <VisitGuideSection />
          <VisitSeasonSection />
          <AppPromoSection />
          <div className="official-faq-band">
            <OfficialPortalSection />
            <FaqTeaserSection />
          </div>
        </div>
        <DynamicSubViews initialView={initialView} />
      </main>
      <SiteFooter />
      <SirajLauncher />
      <MenuDialog />
      <SearchDialog />
      <ConciergeDialog />
      <ToastBanner />
    </>
  );
}
