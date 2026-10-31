import React from 'react';
import { Lookbook, Product } from '@/types';
import { X, ZoomIn, ArrowLeft, Heart, Sparkles } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard';
import { LookDetailSkeleton } from '@/components/lookbook/LookbookSkeletonGrid';
import { ShareButton } from '@/components/common/ShareButton';

interface LookDetailModalProps {
  look: Lookbook | null;
  allProducts: Product[];
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
  onClose: () => void;
  onInspect: (src: string, alt: string) => void;
}

export const LookDetailModal: React.FC<LookDetailModalProps> = ({
  look,
  allProducts,
  wishlist,
  onToggleWishlist,
  onClose,
  onInspect
}) => {
  if (!look) return null;

  // Find assigned pieces
  const pieces = look.pieces
    .map(pId => allProducts.find(p => p.id === pId))
    .filter((p): p is Product => Boolean(p));

  return (
    <div
      id="look-detail-overlay"
      className="fixed inset-0 z-40 bg-[#181512]/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="min-h-screen px-4 py-8 md:py-12 flex justify-center items-start">
        <div className="bg-[#fcfbf9] w-full max-w-5xl rounded-2xl shadow-2xl border border-[#e8e2dc] overflow-hidden relative">
          {/* Top Bar Navigation */}
          <div className="sticky top-0 z-30 bg-[#fcfbf9]/90 backdrop-blur-md px-6 py-4 border-b border-[#e8e2dc] flex items-center justify-between">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#181512] hover:opacity-75 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Lookbooks</span>
            </button>

            <div className="flex items-center gap-3">
              <ShareButton
                resource="lookbook"
                resourceId={look.id}
                title={look.title}
                description={look.description}
                label="Share"
                className="rounded-lg bg-[#f4efe9] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#181512] hover:bg-[#e8e2dc]"
              />
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-[#181512] text-white hover:bg-black flex items-center justify-center transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pieces still resolving from the products fetch -> skeleton. */}
          {look.pieces.length > 0 && pieces.length === 0 ? (
            <LookDetailSkeleton pieces={look.pieces.length} />
          ) : (
          <>
          {/* Main Look Story */}
          <div className="p-6 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
              {/* Cover Column */}
              <div className="md:col-span-5 relative group">
                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#f4efe9] border border-[#e8e2dc] shadow-md relative">
                  <img
                    src={look.cover}
                    alt={look.title}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => onInspect(look.cover, look.title)}
                    className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md text-[#181512] text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-lg opacity-90 hover:opacity-100 hover:scale-105 transition"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Zoom In</span>
                  </button>
                </div>
                {look.videoUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[#e8e2dc] bg-black">
                    <video controls preload="none" playsInline poster={look.cover} aria-label={`${look.title} outfit video`} className="block w-full aspect-video">
                      <source src={look.videoUrl} />
                      {look.videoCaptionsUrl && <track kind="captions" src={look.videoCaptionsUrl} srcLang="en" label="English" default />}
                    </video>
                  </div>
                )}
              </div>

              {/* Story Details Column */}
              <div className="md:col-span-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#6e6761]">
                      {look.board || 'Editorial Curated Look'}
                    </span>
                    <span className="text-[#e8e2dc]">•</span>
                    <span className="text-xs font-medium text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
                      {look.category}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-5xl font-normal font-serif-editorial text-[#181512] leading-[1.1] mb-5">
                    {look.title}
                  </h1>

                  <p className="text-base text-[#6e6761] leading-relaxed mb-6">
                    {look.description}
                  </p>

                  {look.authorNote && (
                    <div className="bg-[#f4efe9] border-l-2 border-[#181512] p-4 rounded-r-lg mb-6">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#181512] mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                        <span>Stylist Recommendation</span>
                      </div>
                      <p className="text-sm text-[#4a4540] italic">
                        "{look.authorNote}"
                      </p>
                    </div>
                  )}

                </div>

                {/* Bundle Summary Banner */}
                {pieces.length > 0 && (
                  <div className="bg-white p-4 rounded-xl border border-[#e8e2dc] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div>
                      <div className="text-xs text-[#6e6761] uppercase tracking-wider">
                        The Full Look
                      </div>
                      <div className="text-base font-medium text-[#181512]">
                        {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'} in this look
                      </div>
                    </div>

                    <a
                      href="#pieces-grid"
                      className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-[#181512] text-white hover:bg-black text-xs font-bold uppercase tracking-wider transition"
                    >
                      <span>Shop the Look</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Shoppable Pieces Grid Section */}
            <section id="pieces-grid" className="mt-14 pt-10 border-t border-[#e8e2dc]">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-[#6e6761] mb-1">
                    The Pieces
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif-editorial text-[#181512]">
                    The Wardrobe
                  </h2>
                </div>
                <div className="text-xs font-medium text-[#6e6761]">
                  
                </div>
              </div>

              {pieces.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {pieces.map(product => (
                    <ProductCard
                      key={product.id}
                      product={{ ...product, image: look.pieceCovers?.[product.id] || product.image }}
                      lookId={look.id}
                      isSaved={wishlist.includes(product.id)}
                      onToggleSave={onToggleWishlist}
                      onInspect={onInspect}
                      sourceContext={`look_${look.id}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-[#e8e2dc] rounded-xl text-[#6e6761]">
                  No products linked yet for this look. Link products in Admin CMS.
                </div>
              )}
            </section>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};
