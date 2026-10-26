import React from 'react';
import { Product } from '@/types';
import { X, Heart, ExternalLink, Trash2, ShoppingBag } from 'lucide-react';
import { api } from '@/lib/api';
import { beginAffiliateNavigation } from '@/lib/affiliate';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistIds: string[];
  products: Product[];
  onRemoveItem: (id: string) => void;
  onInspect: (src: string, alt: string) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  wishlistIds,
  products,
  onRemoveItem,
  onInspect
}) => {
  if (!isOpen) return null;

  const savedProducts = wishlistIds
    .map(id => products.find(p => p.id === id))
    .filter((p): p is Product => Boolean(p));

  const handleShopProduct = async (product: Product) => {
    // Claim the tab during the click gesture, before any await.
    const navigate = beginAffiliateNavigation();
    try {
      const res = await api.handleAffiliateClick(product.id, undefined, 'wishlist_drawer');
      navigate(res.safeUrl);
    } catch {
      navigate(product.affiliateUrl);
    }
  };

  return (
    <div
      id="wishlist-drawer-backdrop"
      className="fixed inset-0 z-50 bg-[#181512]/50 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#e8e2dc] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 fill-[#181512] text-[#181512]" />
            <h2 className="text-xl font-serif-editorial text-[#181512]">
              Saved Wishlist ({savedProducts.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f4efe9] text-[#181512] flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#e8e2dc]/70">
          {savedProducts.length > 0 ? (
            savedProducts.map(product => (
              <div key={product.id} className="py-4 flex items-start gap-4">
                <img
                  src={product.image}
                  alt={product.title}
                  onClick={() => onInspect(product.image, product.title)}
                  className="w-16 h-20 object-cover rounded-lg bg-[#f4efe9] border border-[#e8e2dc] cursor-zoom-in shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-[#181512] line-clamp-1 mb-1">
                    {product.title}
                  </h3>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleShopProduct(product)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#181512] text-white text-[11px] font-bold uppercase tracking-wider hover:bg-black transition"
                    >
                      <span>Shop at {product.merchant}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onRemoveItem(product.id)}
                      className="p-1.5 text-[#6e6761] hover:text-rose-600 rounded transition"
                      title="Remove from wishlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 text-[#6e6761]">
              <Heart className="w-12 h-12 text-[#e8e2dc] mb-3" />
              <p className="text-base font-medium text-[#181512] mb-1">Your wishlist is empty</p>
              <p className="text-xs max-w-xs">
                Tap the heart icon on any piece or lookbook to save it for quick reference later.
              </p>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {savedProducts.length > 0 && (
          <div className="p-6 border-t border-[#e8e2dc] bg-[#fcfbf9]">
            <p className="text-[11px] text-[#6e6761] text-center leading-relaxed">
              Current prices and availability are set by each merchant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
