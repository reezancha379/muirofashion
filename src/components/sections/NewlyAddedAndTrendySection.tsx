import React, { useRef, useState } from 'react';
import { Lookbook, Product } from '@/types';
import { Sparkles, ExternalLink, Heart, Eye, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { beginAffiliateNavigation } from '@/lib/affiliate';

interface NewlyAddedAndTrendyProps {
  lookbooks: Lookbook[];
  products: Product[];
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
  onOpenLook: (look: Lookbook) => void;
  onInspect: (src: string, alt: string) => void;
  onNavigateToShop: () => void;
}

type TabType = 'all' | 'new_looks' | 'trending_looks' | 'new_pieces' | 'trending_pieces';

export const NewlyAddedAndTrendySection: React.FC<NewlyAddedAndTrendyProps> = ({
  lookbooks,
  products,
  wishlist,
  onToggleWishlist,
  onOpenLook,
  onInspect,
  onNavigateToShop
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const sliderRef = useRef<HTMLDivElement>(null);

  // Swipe & Touch State
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  // Drag-to-scroll for desktop mouse
  const isMouseDown = useRef<boolean>(false);
  const mouseStartX = useRef<number>(0);
  const scrollLeftStart = useRef<number>(0);

  const scroll = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const cardWidth = window.innerWidth < 640 ? 300 : 340;
      const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Filter items based on active tab
  const newlyAddedLooks = lookbooks.filter(l => l.isNewlyAdded);
  const trendingLooks = lookbooks.filter(l => l.isTrending);
  const newlyAddedProducts = products.filter(p => p.isNewlyAdded);
  const trendingProducts = products.filter(p => p.isTrending);

  // Unified items list for the slider
  type SliderItem =
    | { type: 'look'; data: Lookbook }
    | { type: 'product'; data: Product };

  let items: SliderItem[] = [];

  if (activeTab === 'all') {
    newlyAddedLooks.forEach(l => items.push({ type: 'look', data: l }));
    newlyAddedProducts.forEach(p => items.push({ type: 'product', data: p }));
    trendingLooks.forEach(l => {
      if (!items.some(i => i.type === 'look' && i.data.id === l.id)) {
        items.push({ type: 'look', data: l });
      }
    });
    trendingProducts.forEach(p => {
      if (!items.some(i => i.type === 'product' && i.data.id === p.id)) {
        items.push({ type: 'product', data: p });
      }
    });
  } else if (activeTab === 'new_looks') {
    items = newlyAddedLooks.map(l => ({ type: 'look', data: l }));
  } else if (activeTab === 'trending_looks') {
    items = trendingLooks.map(l => ({ type: 'look', data: l }));
  } else if (activeTab === 'new_pieces') {
    items = newlyAddedProducts.map(p => ({ type: 'product', data: p }));
  } else if (activeTab === 'trending_pieces') {
    items = trendingProducts.map(p => ({ type: 'product', data: p }));
  }

  // Mobile Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    isSwiping.current = false;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;

    // Only register horizontal swipes (prevent intercepting vertical scroll)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX > 0) {
        // Swiped left -> move right
        scroll('right');
      } else {
        // Swiped right -> move left
        scroll('left');
      }
    }
  };

  // Desktop Mouse Drag to Swipe
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    isMouseDown.current = true;
    mouseStartX.current = e.pageX - sliderRef.current.offsetLeft;
    scrollLeftStart.current = sliderRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - mouseStartX.current) * 1.5;
    sliderRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDown.current = false;
  };

  const handleProductClick = async (p: Product) => {
    // Claim the tab during the click gesture, before any await.
    const navigate = beginAffiliateNavigation();
    try {
      const result = await api.handleAffiliateClick(p.id, undefined, 'new_and_trending_slider');
      navigate(result.safeUrl);
    } catch {
      navigate(p.affiliateUrl);
    }
  };

  return (
    <section className="py-12 sm:py-16 bg-[#fcfbf9] border-y border-[#e8e2dc] relative overflow-hidden font-casual">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Clean Black & White Badges */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#e8e2dc] text-[#181512] text-xs font-bold uppercase tracking-wider mb-2 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The MUIRO Edit</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-normal font-serif-editorial text-[#181512] tracking-tight">
            The season, in motion.
          </h2>
          <p className="text-sm text-[#6e6761] mt-1 max-w-xl">
            New arrivals, enduring favourites, and the pieces shaping the mood.
          </p>
        </div>

        {/* Filter Pills Tabs (Monochrome Minimalist) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#181512] text-white shadow-xs'
                : 'bg-white text-[#6e6761] border border-[#e8e2dc] hover:text-[#181512] hover:border-[#181512]'
            }`}
          >
            The Edit ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('new_looks')}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition cursor-pointer ${
              activeTab === 'new_looks'
                ? 'bg-[#181512] text-white shadow-xs'
                : 'bg-white text-[#6e6761] border border-[#e8e2dc] hover:text-[#181512] hover:border-[#181512]'
            }`}
          >
            New Looks ({newlyAddedLooks.length})
          </button>
          <button
            onClick={() => setActiveTab('trending_looks')}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition cursor-pointer ${
              activeTab === 'trending_looks'
                ? 'bg-[#181512] text-white shadow-xs'
                : 'bg-white text-[#6e6761] border border-[#e8e2dc] hover:text-[#181512] hover:border-[#181512]'
            }`}
          >
            In Focus ({trendingLooks.length})
          </button>
          <button
            onClick={() => setActiveTab('new_pieces')}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition cursor-pointer ${
              activeTab === 'new_pieces'
                ? 'bg-[#181512] text-white shadow-xs'
                : 'bg-white text-[#6e6761] border border-[#e8e2dc] hover:text-[#181512] hover:border-[#181512]'
            }`}
          >
            New Pieces ({newlyAddedProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('trending_pieces')}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition cursor-pointer ${
              activeTab === 'trending_pieces'
                ? 'bg-[#181512] text-white shadow-xs'
                : 'bg-white text-[#6e6761] border border-[#e8e2dc] hover:text-[#181512] hover:border-[#181512]'
            }`}
          >
            Trending Pieces ({trendingProducts.length})
          </button>
        </div>

        {/* Sliding Track with Mobile Touch-Swipe & Desktop Drag */}
        <div
          ref={sliderRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="slider-container flex gap-5 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth cursor-grab active:cursor-grabbing select-none"
          style={{
            scrollbarWidth: 'thin',
            touchAction: 'pan-y pinch-zoom'
          }}
        >
          {items.map((item) => {
            if (item.type === 'look') {
              const look = item.data;
              return (
                <div
                  key={`slide_look_${look.id}`}
                  className="snap-start shrink-0 w-[290px] sm:w-[320px] bg-white rounded-2xl overflow-hidden border border-[#e8e2dc] shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group"
                >
                  {/* Image Container with Zoom & Minimalist Badges */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#f4efe9]">
                    <img
                      src={look.cover}
                      alt={look.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                    />

                    {/* Status Tags */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <div className="flex gap-1.5 flex-wrap">
                        {look.isNewlyAdded && (
                          <span className="px-2.5 py-1 rounded-full bg-[#181512] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            New Look
                          </span>
                        )}
                        {look.isTrending && (
                          <span className="px-2.5 py-1 rounded-full bg-white text-[#181512] border border-[#e8e2dc] text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            Trending
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspect(look.cover, look.title);
                        }}
                        className="p-1.5 rounded-full bg-white/95 text-[#181512] backdrop-blur-md shadow-sm hover:bg-white transition cursor-pointer"
                        title="Inspect image"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Category pill at bottom */}
                    <div className="absolute bottom-3 left-3 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-full bg-[#181512]/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                        {look.category}
                      </span>
                    </div>
                  </div>

                  {/* Content & Action */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-base text-[#181512] line-clamp-1 mb-1 group-hover:underline">
                        {look.title}
                      </h3>
                      <p className="text-xs text-[#6e6761] line-clamp-2 leading-relaxed mb-3">
                        {look.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#f4efe9] flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#6B6569]">
                        {look.pieces?.length || 4} Curated Pieces
                      </span>

                      <button
                        onClick={() => onOpenLook(look)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181512] text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition cursor-pointer"
                      >
                        <span>Shop Look</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            } else {
              const product = item.data;
              const isSaved = wishlist.includes(product.id);
              return (
                <div
                  key={`slide_prod_${product.id}`}
                  className="snap-start shrink-0 w-[260px] sm:w-[280px] bg-white rounded-2xl overflow-hidden border border-[#e8e2dc] shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group"
                >
                  {/* Image Container */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#f4efe9]">
                    <img
                      src={product.image}
                      alt={product.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                    />

                    {/* Top Action / Status */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <div className="flex gap-1.5 flex-wrap">
                        {product.isNewlyAdded && (
                          <span className="px-2 py-0.5 rounded-full bg-[#181512] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                            New Piece
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onToggleWishlist(product.id)}
                        className={`p-1.5 rounded-full backdrop-blur-md transition cursor-pointer shadow-sm ${
                          isSaved ? 'bg-red-50 text-red-500' : 'bg-white/95 text-[#181512] hover:bg-white'
                        }`}
                        aria-label="Save item"
                      >
                        <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Info & Buy CTA */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B6569] mb-0.5">
                        {product.category || 'Wardrobe Essential'}
                      </div>
                      <h3 className="font-semibold text-sm text-[#181512] line-clamp-1 mb-2">
                        {product.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleProductClick(product)}
                      className="w-full py-2 px-3 rounded-xl bg-[#181512] hover:bg-black text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Shop at {product.merchant}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </section>
  );
};
