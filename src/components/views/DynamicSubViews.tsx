import { FaqPageView } from '@/components/views/FaqPageView';

interface DynamicSubViewsProps {
  initialView?: 'home' | 'faq';
}

export function DynamicSubViews({ initialView = 'home' }: DynamicSubViewsProps) {
  return (
    <>
      <article id="placeView" className="place-view" aria-labelledby="placeTitle" hidden />
      <article id="tourGuideView" className="tour-guide" aria-labelledby="tourGuideTitle" hidden />
      <FaqPageView initialHidden={initialView !== 'faq'} />
    </>
  );
}
