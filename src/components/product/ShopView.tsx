import React, { useState, useMemo } from 'react';
import { Product } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/lookbook/LookbookSkeletonGrid';
import { Search, SlidersHorizontal, Heart, Sparkles, TrendingUp, Clock, X, Check } from 'lucide-react';

interface ShopViewProps {
  products: Product[];
  loading?: boolean;
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
  onInspect: (src: string, alt: string) => void;
}

export const ShopView: React.FC<ShopViewProps> = ({
  products,
  loading = false,
  wishlist,
  onToggleWishlist,
  onInspect
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeMerchant, setActiveMerchant] = useState('All');
  const [showOnlySaved, setShowOnlySaved] = useState(false);
  const [showOnlyNewlyAdded, setShowOnlyNewlyAdded] = useState(false);
  const [showOnlyTrending, setShowOnlyTrending] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'rating' | 'popular'>('featured');

  // Collect unique categories & merchants
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  const merchants = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.merchant).filter(Boolean)))], [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        if (showOnlySaved && !wishlist.includes(p.id)) return false;
        if (showOnlyNewlyAdded && !p.isNewlyAdded) return false;
        if (showOnlyTrending && !p.isTrending) return false;
        if (activeCategory !== 'All' && p.category !== activeCategory) return false;
        if (activeMerchant !== 'All' && p.merchant !== activeMerchant) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = p.title.toLowerCase().includes(q);
          const matchBoard = (p.board || '').toLowerCase().includes(q);
          const matchCat = (p.category || '').toLowerCase().includes(q);
          const matchMerchant = (p.merchant || '').toLowerCase().includes(q);
          const matchDescription = (p.description || '').toLowerCase().includes(q);
          return matchTitle || matchBoard || matchCat || matchMerchant || matchDescription;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return (b.isNewlyAdded ? 1 : 0) - (a.isNewlyAdded ? 1 : 0);
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'popular') return (b.clicks || 0) - (a.clicks || 0);
        return 0; // Default featured
      });
  }, [
    products,
    searchQuery,
    activeCategory,
    activeMerchant,
    showOnlySaved,
    showOnlyNewlyAdded,
    showOnlyTrending,
    sortBy,
    wishlist
  ]);

  const hasActiveFilters =
    searchQuery ||
    activeCategory !== 'All' ||
    activeMerchant !== 'All' ||
    showOnlySaved ||
    showOnlyNewlyAdded ||
    showOnlyTrending ||
    sortBy !== 'featured';

  const clearAllFilters = () => {
    setSearchQuery('');
    setActiveCategory('All');
    setActiveMerchant('All');
    setShowOnlySaved(false);
    setShowOnlyNewlyAdded(false);
    setShowOnlyTrending(false);
    setSortBy('featured');
  };

  if (loading && products.length === 0) return <ProductGridSkeleton />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-widest text-[#6e6761] mb-1">
          MUIRO / Collections
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-casual text-[#181512] mb-3">
          Collections
        </h1>
        <p className="text-[#6e6761] font-casual text-base max-w-2xl leading-relaxed">
          A considered edit of pieces, ready to discover.
        </p>
      </div>

      {/* Filter and Search Bar Container */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e8e2dc] shadow-xs mb-8 space-y-4">
        {/* Row 1: Search, Sort & Quick Toggles */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-[#6e6761] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search pieces or merchant..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#fcfbf9] border border-[#e8e2dc] rounded-full text-xs sm:text-sm font-casual focus:outline-none focus:border-[#181512] transition"
            />
          </div>

          {/* Quick Filter Buttons & Sort */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
            <button
              onClick={() => setShowOnlyNewlyAdded(!showOnlyNewlyAdded)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold font-casual transition cursor-pointer ${
                showOnlyNewlyAdded
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'bg-[#f4efe9] text-[#181512] hover:bg-[#e8e2dc]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Newly Added</span>
            </button>

            <button
              onClick={() => setShowOnlyTrending(!showOnlyTrending)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold font-casual transition cursor-pointer ${
                showOnlyTrending
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-[#f4efe9] text-[#181512] hover:bg-[#e8e2dc]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Trending Now</span>
            </button>

            <button
              onClick={() => setShowOnlySaved(!showOnlySaved)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold font-casual transition cursor-pointer ${
                showOnlySaved
                  ? 'bg-[#181512] text-white shadow-sm'
                  : 'bg-[#f4efe9] text-[#181512] hover:bg-[#e8e2dc]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${showOnlySaved ? 'fill-white' : ''}`} />
              <span>Saved ({wishlist.length})</span>
            </button>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3.5 py-2 bg-[#f4efe9] border border-[#e8e2dc] rounded-full text-xs font-semibold font-casual text-[#181512] focus:outline-none cursor-pointer"
            >
              <option value="featured">Featured Picks</option>
              <option value="newest">Newest Drops First</option>
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Row 2: Merchant Filter Pills */}
        <div className="pt-3 border-t border-[#e8e2dc]/60 flex flex-wrap items-center justify-between gap-3">
          {/* Merchant Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6e6761] mr-1">
              Merchant:
            </span>
            {merchants.map(m => (
              <button
                key={m}
                onClick={() => setActiveMerchant(m)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold font-casual transition cursor-pointer ${
                  activeMerchant === m
                    ? 'bg-[#181512] text-white'
                    : 'bg-[#f4efe9] text-[#6e6761] hover:text-[#181512]'
                }`}
              >
                {m === 'All' ? 'All Retailers' : m}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-2 border-t border-[#e8e2dc]/40">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6e6761] mr-1 shrink-0">
            Category:
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold font-casual whitespace-nowrap transition cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#181512] text-white'
                  : 'bg-[#f4efe9] text-[#6e6761] hover:text-[#181512]'
              }`}
            >
              {cat}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Indicator */}
      <div className="flex items-center justify-between mb-6 text-xs text-[#6e6761] font-casual">
        <span>
          Showing <strong>{filteredProducts.length}</strong> matching wardrobe pieces
        </span>
        {hasActiveFilters && (
          <span className="text-amber-800 font-semibold">
            Filtered view active
          </span>
        )}
      </div>

      {/* Product Results Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              isSaved={wishlist.includes(product.id)}
              onToggleSave={onToggleWishlist}
              onInspect={onInspect}
              sourceContext="shop_gallery"
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-[#e8e2dc]">
          <Sparkles className="w-8 h-8 text-[#6e6761] mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-bold font-casual text-[#181512] mb-1">
            No products match your filter criteria
          </h3>
          <p className="text-xs text-[#6e6761] font-casual max-w-sm mx-auto mb-4">
            Try adjusting your search, category, merchant, or edit filters.
          </p>
          <button
            onClick={clearAllFilters}
            className="px-5 py-2.5 rounded-full bg-[#181512] text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
};
