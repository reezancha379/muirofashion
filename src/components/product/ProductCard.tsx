import React, { useState } from 'react';
import { Product } from '@/types';
import { Heart, ExternalLink, ZoomIn, Star, Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import { beginAffiliateNavigation } from '@/lib/affiliate';

interface ProductCardProps {
  product: Product;
  lookId?: string;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  onInspect: (imageSrc: string, alt: string) => void;
  sourceContext?: string;
}

function copyProductLink(productId: string) {
  const url = `${window.location.origin}/collection/${productId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  lookId,
  isSaved,
  onToggleSave,
  onInspect,
  sourceContext = 'product_card'
}) => {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleShopClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isRedirecting) return;

    // Claim the new tab while the click gesture is still live and navigate from
    // the already-sanitized public snapshot. Tracking never holds up shoppers.
    const navigate = beginAffiliateNavigation();
    setIsRedirecting(true);
    navigate(product.affiliateUrl);
    void api.handleAffiliateClick(product.id, lookId, sourceContext, product.affiliateUrl)
      .catch((err) => console.warn('Affiliate tracking unavailable:', err));
    setTimeout(() => setIsRedirecting(false), 1200);
  };

  return (
    <article
      id={`product-card-${product.id}`}
      className="group bg-white rounded-xl border border-[#e8e2dc] overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-[#181512]/30"
    >
      {/* Image container */}
      <div className="relative aspect-[3/4] bg-[#f4efe9] overflow-hidden">
        {product.videoUrl ? (
          <video
            controls
            preload="none"
            playsInline
            poster={product.image}
            aria-label={`${product.title} product video`}
            className="w-full h-full object-cover object-top"
          >
            <source src={product.videoUrl} />
            {product.videoCaptionsUrl && <track kind="captions" src={product.videoCaptionsUrl} srcLang="en" label="English" default />}
          </video>
        ) : (
          <img
            src={product.image}
            alt={product.imageAlt?.trim() || product.title}
            loading="lazy"
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        )}

        {/* Action icons on image hover/top */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            onClick={() => onToggleSave(product.id)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-md backdrop-blur-md ${
              isSaved
                ? 'bg-plum text-white'
                : 'bg-white/85 text-[#181512] hover:bg-white hover:scale-105'
            }`}
            aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
            title={isSaved ? 'In wishlist' : 'Save piece'}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-white' : ''}`} />
          </button>

          <button
            onClick={() => onInspect(product.image, product.imageAlt?.trim() || product.title)}
            className="w-9 h-9 rounded-full bg-white/85 hover:bg-white hover:scale-105 text-[#181512] flex items-center justify-center transition shadow-md backdrop-blur-md opacity-80 group-hover:opacity-100"
            title="Inspect fabric & details"
            aria-label="Inspect fabric"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); copyProductLink(product.id); }}
            className="w-9 h-9 rounded-full bg-white/85 hover:bg-white hover:scale-105 text-[#181512] flex items-center justify-center transition shadow-md backdrop-blur-md opacity-80 group-hover:opacity-100"
            title="Copy product link"
            aria-label="Copy product link"
          >
            <Link2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Product Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-[#6e6761] uppercase tracking-wider mb-1">
            <span>{product.category || product.board}</span>
            {product.rating && (
              <span className="flex items-center gap-1 font-semibold text-[#181512]">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                {product.rating.toFixed(1)}
              </span>
            )}
          </div>

          <h3 className="font-medium text-[#181512] text-[15px] line-clamp-2 leading-snug mb-1 group-hover:text-black">
            {product.title}
          </h3>

          {product.description && (
            <p className="text-xs text-[#6e6761] line-clamp-2 mb-3 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* Dynamic CTA Button */}
        <div className="pt-2 border-t border-[#e8e2dc]/70 flex items-center gap-2">
          <button
            onClick={handleShopClick}
            disabled={isRedirecting}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              isRedirecting
                ? 'bg-plum/90 text-white cursor-wait'
                : 'bg-crimson text-white hover:bg-plum active:scale-[0.98] shadow-sm hover:shadow'
            }`}
          >
            {isRedirecting ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Redirecting...</span>
              </span>
            ) : (
              <>
                <span>Shop at {product.merchant}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
