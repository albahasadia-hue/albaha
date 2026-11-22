import { FaqPageView } from '@/components/views/FaqPageView';
import { InvestPageView } from '@/components/views/InvestPageView';
import { SupportRequestPageView } from '@/components/views/SupportRequestPageView';
import type { PortalInitialView } from '@/lib/portalTypes';

interface DynamicSubViewsProps {
  initialView?: PortalInitialView;
}

export function DynamicSubViews({ initialView = 'home' }: DynamicSubViewsProps) {
  return (
    <>
      <article id="placeView" className="place-view" aria-labelledby="placeTitle" hidden />
      <article id="tourGuideView" className="tour-guide" aria-labelledby="tourGuideTitle" hidden />
      <FaqPageView initialHidden={initialView !== 'faq'} />
      <InvestPageView initialHidden={initialView !== 'invest'} />
      {(initialView === 'reports' || initialView === 'feedback') && <SupportRequestPageView kind={initialView} />}
    </>
  );
}
