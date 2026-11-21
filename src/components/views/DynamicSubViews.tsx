import { FaqPageView } from '@/components/views/FaqPageView';
import { InvestPageView } from '@/components/views/InvestPageView';

interface DynamicSubViewsProps {
  initialView?: 'home' | 'faq' | 'invest';
}

export function DynamicSubViews({ initialView = 'home' }: DynamicSubViewsProps) {
  return (
    <>
      <article id="placeView" className="place-view" aria-labelledby="placeTitle" hidden />
      <article id="tourGuideView" className="tour-guide" aria-labelledby="tourGuideTitle" hidden />
      <FaqPageView initialHidden={initialView !== 'faq'} />
      <InvestPageView initialHidden={initialView !== 'invest'} />
    </>
  );
}
