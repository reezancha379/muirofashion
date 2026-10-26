import React from 'react';

/**
 * Loading skeletons for MUIRO. Every block below mirrors a real component's
 * exact outer box (radius, border, aspect ratio, padding) so swapping in live
 * content causes zero layout shift. Only the inner text/image is a shimmer.
 */

const Bar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`shimmer-box rounded-md ${className}`} />
);

/* Mirrors LookbookCard: white card, 2:3 cover, two pills, p-5 body. */
export const LookbookCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-[#e8e2dc] overflow-hidden flex flex-col">
    <div className="relative aspect-[2/3] shimmer-box">
      <div className="absolute top-3 left-3 w-20 h-6 rounded-full bg-white/70" />
      <div className="absolute top-3 right-3 w-16 h-6 rounded-full bg-white/70" />
    </div>
    <div className="p-5 flex-1 flex flex-col gap-2">
      <Bar className="w-24 h-3" />
      <Bar className="w-4/5 h-5" />
      <Bar className="w-full h-3" />
      <Bar className="w-2/3 h-3" />
      <div className="mt-auto pt-3 border-t border-[#e8e2dc]/80 flex items-center justify-between">
        <Bar className="w-14 h-3" />
        <Bar className="w-16 h-5 rounded-full" />
      </div>
    </div>
  </div>
);

/* Mirrors ProductCard: 3:4 image, two circular buttons, rating row, dark CTA. */
export const ProductSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-[#e8e2dc] overflow-hidden flex flex-col">
    <div className="relative aspect-[3/4] shimmer-box">
      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <div className="w-9 h-9 rounded-full bg-white/70" />
        <div className="w-9 h-9 rounded-full bg-white/70" />
      </div>
    </div>
    <div className="p-4 flex-1 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Bar className="w-20 h-3" />
        <Bar className="w-8 h-3" />
      </div>
      <Bar className="w-4/5 h-4" />
      <Bar className="w-3/5 h-3" />
      <div className="mt-auto pt-3 border-t border-[#e8e2dc]/70">
        <Bar className="w-full h-9 rounded-lg" />
      </div>
    </div>
  </div>
);

/* Mirrors Hero: max-w-[840px] 4:3 rounded-3xl frame, gradient overlay,
   bottom-aligned caption stack, nav arrows and dot indicators. */
export const HeroSkeleton: React.FC = () => (
  <section className="relative pt-5 pb-10 sm:pt-6 sm:pb-12 md:py-16 overflow-hidden">
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[840px] aspect-[4/3] rounded-3xl overflow-hidden bg-[#f4efe9] border border-[#e8e2dc] relative">
        <div className="absolute inset-0 shimmer-box" />
        <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-28 h-6 rounded-full bg-white/70" />
            <div className="w-20 h-6 rounded-full bg-white/50" />
          </div>
          <div className="w-3/4 h-7 sm:h-9 rounded-lg bg-white/70" />
          <div className="w-1/2 h-4 rounded bg-white/50" />
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="w-40 h-11 rounded-full bg-white/70" />
            <div className="w-32 h-11 rounded-full bg-white/40" />
          </div>
        </div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/60" />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/60" />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-white/60" />
          ))}
        </div>
      </div>
    </div>
  </section>
);

/* Mirrors NewlyAddedAndTrendySection + the lookbook grid header. */
export const SectionHeaderSkeleton: React.FC = () => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e8e2dc] pb-6">
    <div className="space-y-2">
      <Bar className="w-28 h-3.5" />
      <Bar className="w-72 h-8" />
    </div>
    <div className="flex items-center gap-2 overflow-hidden">
      {['w-16', 'w-24', 'w-28', 'w-20'].map(w => (
        <div key={w} className={`${w} h-8 rounded-full shimmer-box shrink-0`} />
      ))}
    </div>
  </div>
);

/* Full page replacement while first load is in flight. */
export const LookbookSkeletonGrid: React.FC = () => (
  <div className="w-full animate-in fade-in duration-300">
    <HeroSkeleton />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <SectionHeaderSkeleton />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <LookbookCardSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
);

/* Collections view: filter bar + 4-up product grid. */
export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
    <div className="space-y-3">
      <Bar className="w-28 h-3" />
      <Bar className="w-56 h-9" />
      <Bar className="w-72 h-4" />
    </div>
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e8e2dc] space-y-4">
      <div className="flex flex-col md:flex-row gap-3 justify-between">
        <Bar className="w-full md:max-w-md h-10 rounded-full" />
        <div className="flex gap-2">
          {['w-28', 'w-24', 'w-20'].map(w => (
            <div key={w} className={`${w} h-9 rounded-full shimmer-box`} />
          ))}
        </div>
      </div>
      <div className="pt-3 border-t border-[#e8e2dc]/60 flex gap-2 flex-wrap">
        {['w-24', 'w-20', 'w-28', 'w-16'].map(w => (
          <div key={w} className={`${w} h-7 rounded-lg shimmer-box`} />
        ))}
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  </div>
);

/* Look detail modal: cover column + story column + pieces grid. */
export const LookDetailSkeleton: React.FC<{ pieces?: number }> = ({ pieces = 3 }) => (
  <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
    <div className="md:col-span-5 aspect-[2/3] rounded-2xl shimmer-box" />
    <div className="md:col-span-7 space-y-4">
      <Bar className="w-32 h-3.5" />
      <Bar className="w-4/5 h-8" />
      <Bar className="w-full h-4" />
      <Bar className="w-11/12 h-4" />
      <Bar className="w-2/3 h-4" />
      <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {Array.from({ length: pieces }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
);

/* Analytics dashboard: KPI tiles + chart panels. */
export const AnalyticsSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
    <div className="space-y-3">
      <Bar className="w-40 h-9" />
      <Bar className="w-64 h-4" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl shimmer-box" />
      ))}
    </div>
    <div className="h-72 rounded-xl shimmer-box" />
    <div className="h-96 rounded-xl shimmer-box" />
  </div>
);
