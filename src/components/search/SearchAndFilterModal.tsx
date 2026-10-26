import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, ArrowUpRight, Sparkles, Filter, Check, RotateCcw } from 'lucide-react';
import { Lookbook, Product } from '@/types';

export interface FilterState {
  searchQuery: string;
  category: string;
  status: 'all' | 'new' | 'trending';
  merchant: string;
  sortBy: 'newest' | 'trending' | 'pieces' | 'title';
}

interface SearchAndFilterModalProps {
  isOpen: boolean;
  initialMode: 'search' | 'filter';
  onClose: () => void;
  lookbooks: Lookbook[];
  products: Product[];
  filterState: FilterState;
  onUpdateFilters: (filters: FilterState) => void;
  onSelectLook: (look: Lookbook) => void;
  onSelectProduct: (product: Product) => void;
}

export const SearchAndFilterModal: React.FC<SearchAndFilterModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  lookbooks,
  products,
  filterState,
  onUpdateFilters,
  onSelectLook,
  onSelectProduct,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'filter'>(initialMode);
  const [localFilters, setLocalFilters] = useState<FilterState>(filterState);

  // Sync initialMode when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setLocalFilters(filterState);
    }
  }, [isOpen, initialMode, filterState]);

  // Filter options are scoped to Lookbooks because those are the results the
  // filter state controls. This prevents product-only categories/merchants
  // from appearing as filters that can never change the Lookbook results.
  const categories = useMemo(() => {
    return Array.from(new Set(lookbooks.map(l => l.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [lookbooks]);

  const merchants = useMemo(() => {
    const lookbookProductIds = new Set(lookbooks.flatMap(l => l.pieces));
    return Array.from(
      new Set(
        products
          .filter(p => lookbookProductIds.has(p.id))
          .map(p => p.merchant)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [lookbooks, products]);

  // Real-time search query results
  const searchResults = useMemo(() => {
    const query = localFilters.searchQuery.trim().toLowerCase();
    if (!query) return { matchedLookbooks: [], matchedProducts: [] };

    const matchedLookbooks = lookbooks.filter(l =>
      l.title.toLowerCase().includes(query) ||
      l.description.toLowerCase().includes(query) ||
      (l.category && l.category.toLowerCase().includes(query)) ||
      (l.authorNote && l.authorNote.toLowerCase().includes(query))
    );

    const matchedProducts = products.filter(p =>
      p.title.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.merchant.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    );

    return { matchedLookbooks, matchedProducts };
  }, [localFilters.searchQuery, lookbooks, products]);

  if (!isOpen) return null;

  const handleApply = () => {
    onUpdateFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetState: FilterState = {
      searchQuery: '',
      category: 'all',
      status: 'all',
      merchant: 'all',
      sortBy: 'newest',
    };
    setLocalFilters(resetState);
    onUpdateFilters(resetState);
  };

  const activeFilterCount =
    (localFilters.category !== 'all' ? 1 : 0) +
    (localFilters.status !== 'all' ? 1 : 0) +
    (localFilters.merchant !== 'all' ? 1 : 0) +
    (localFilters.sortBy !== 'newest' ? 1 : 0) +
    (localFilters.searchQuery ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto font-casual">
      <div className="bg-white rounded-3xl w-full max-w-2xl border border-[#e8e2dc] shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header Tabs (Black & White Minimalist) */}
        <div className="flex items-center justify-between border-b border-[#e8e2dc] px-6 py-4 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-[#181512] text-white shadow-xs'
                  : 'bg-[#f4efe9] text-[#6e6761] hover:text-[#181512]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Catalog</span>
            </button>

            <button
              onClick={() => setActiveTab('filter')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                activeTab === 'filter'
                  ? 'bg-[#181512] text-white shadow-xs'
                  : 'bg-[#f4efe9] text-[#6e6761] hover:text-[#181512]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#6e6761] hover:text-[#181512] rounded-full hover:bg-[#f4efe9] transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {activeTab === 'search' ? (
            <div className="space-y-6">
              {/* Search Bar Input */}
              <div className="relative">
                <Search className="w-5 h-5 text-[#8c7b6d] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={localFilters.searchQuery}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
                  }
                  placeholder="Search aesthetics, outfit titles, knits, blazers, boots..."
                  className="w-full pl-12 pr-10 py-3.5 bg-[#fcfbf9] border border-[#e8e2dc] rounded-2xl text-sm text-[#181512] placeholder-[#8c7b6d] focus:outline-none focus:border-[#181512] focus:bg-white transition"
                />
                {localFilters.searchQuery && (
                  <button
                    onClick={() =>
                      setLocalFilters((prev) => ({ ...prev, searchQuery: '' }))
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#8c7b6d] hover:text-[#181512] rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Suggestion Pills */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#6e6761] mb-2.5">
                  Popular Aesthetic Searches
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Minimalist', 'Old Money', 'Streetwear', 'Autumn Knits', 'Blazer', 'Loafers', 'Cardigan', 'Linen'].map(
                    (tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          setLocalFilters((prev) => ({ ...prev, searchQuery: tag }))
                        }
                        className="px-3 py-1.5 rounded-full bg-[#f4efe9] hover:bg-[#181512] hover:text-white text-xs text-[#181512] transition cursor-pointer"
                      >
                        {tag}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Real-time Search Results */}
              {localFilters.searchQuery.trim() && (
                <div className="space-y-5 pt-2 max-h-[50vh] overflow-y-auto">
                  {/* Matched Lookbooks */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#181512] mb-3 flex items-center justify-between">
                      <span>Matching Lookbooks ({searchResults.matchedLookbooks.length})</span>
                    </div>

                    {searchResults.matchedLookbooks.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResults.matchedLookbooks.map((look) => (
                          <div
                            key={look.id}
                            onClick={() => {
                              onSelectLook(look);
                              onClose();
                            }}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-[#e8e2dc] bg-white hover:border-[#181512] cursor-pointer transition group"
                          >
                            <img
                              src={look.cover}
                              alt={look.title}
                              referrerPolicy="no-referrer"
                              className="w-14 h-16 object-cover rounded-lg shrink-0 bg-[#f4efe9]"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-[#181512] truncate group-hover:underline">
                                {look.title}
                              </h4>
                              <p className="text-[11px] text-[#6e6761] truncate mt-0.5">
                                {look.category} • {look.pieces.length} Pieces
                              </p>
                              <span className="text-[10px] font-bold text-[#181512] uppercase tracking-wider flex items-center gap-1 mt-1">
                                <span>Inspect Look</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#8c7b6d] py-2">No matching lookbooks found.</p>
                    )}
                  </div>

                  {/* Matched Products */}
                  <div className="pt-2 border-t border-[#e8e2dc]">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#181512] mb-3">
                      Matching Garments & Pieces ({searchResults.matchedProducts.length})
                    </div>

                    {searchResults.matchedProducts.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResults.matchedProducts.slice(0, 6).map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => {
                              onSelectProduct(prod);
                              onClose();
                            }}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-[#e8e2dc] bg-white hover:border-[#181512] cursor-pointer transition group"
                          >
                            <img
                              src={prod.image}
                              alt={prod.title}
                              referrerPolicy="no-referrer"
                              className="w-14 h-16 object-cover rounded-lg shrink-0 bg-[#f4efe9]"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-[#181512] truncate group-hover:underline">
                                {prod.title}
                              </h4>
                              <p className="text-[11px] text-[#6e6761] truncate mt-0.5">
                                
                              </p>
                              <span className="text-[10px] font-bold text-[#181512] uppercase tracking-wider flex items-center gap-1 mt-1">
                                <span>Shop at {prod.merchant}</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#8c7b6d] py-2">No individual garments matching query.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Filter Tab */
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              {/* Status Filter (New / Trending) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#181512] mb-2.5">
                  Collection Status
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'all', label: 'All Looks' },
                    { id: 'new', label: '✨ Newly Added' },
                    { id: 'trending', label: '🔥 Trending Now' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() =>
                        setLocalFilters((prev) => ({
                          ...prev,
                          status: st.id as 'all' | 'new' | 'trending',
                        }))
                      }
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                        localFilters.status === st.id
                          ? 'border-[#181512] bg-[#181512] text-white shadow-xs'
                          : 'border-[#e8e2dc] bg-[#fcfbf9] text-[#6e6761] hover:border-[#181512] hover:text-[#181512]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#181512] mb-2.5">
                  Aesthetic Category
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setLocalFilters((prev) => ({ ...prev, category: 'all' }))
                    }
                    className={`px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                      localFilters.category === 'all'
                        ? 'bg-[#181512] text-white'
                        : 'bg-[#f4efe9] text-[#6e6761] hover:bg-[#e8e2dc]'
                    }`}
                  >
                    All Categories
                  </button>

                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        setLocalFilters((prev) => ({ ...prev, category: cat }))
                      }
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                        localFilters.category === cat
                          ? 'bg-[#181512] text-white'
                          : 'bg-[#f4efe9] text-[#6e6761] hover:bg-[#e8e2dc]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retailer / Merchant Filter */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#181512] mb-2.5">
                  Partner Retailer
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setLocalFilters((prev) => ({ ...prev, merchant: 'all' }))
                    }
                    className={`px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                      localFilters.merchant === 'all'
                        ? 'bg-[#181512] text-white'
                        : 'bg-[#f4efe9] text-[#6e6761] hover:bg-[#e8e2dc]'
                    }`}
                  >
                    All Retailers
                  </button>
                  {merchants.map((m) => (
                    <button
                      key={m}
                      onClick={() =>
                        setLocalFilters((prev) => ({ ...prev, merchant: m }))
                      }
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                        localFilters.merchant === m
                          ? 'bg-[#181512] text-white'
                          : 'bg-[#f4efe9] text-[#6e6761] hover:bg-[#e8e2dc]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#181512] mb-2.5">
                  Sort Lookbooks By
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'newest', label: 'Newest First' },
                    { id: 'trending', label: 'Trending' },
                    { id: 'pieces', label: 'Most Pieces' },
                    { id: 'title', label: 'Title (A-Z)' },
                  ].map((sort) => (
                    <button
                      key={sort.id}
                      onClick={() =>
                        setLocalFilters((prev) => ({
                          ...prev,
                          sortBy: sort.id as any,
                        }))
                      }
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer text-center ${
                        localFilters.sortBy === sort.id
                          ? 'border-[#181512] bg-[#181512] text-white'
                          : 'border-[#e8e2dc] bg-[#fcfbf9] text-[#6e6761] hover:text-[#181512]'
                      }`}
                    >
                      {sort.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#fcfbf9] border-t border-[#e8e2dc] flex items-center justify-between">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6e6761] hover:text-[#181512] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-full border border-[#e8e2dc] text-xs font-bold uppercase tracking-wider text-[#6e6761] hover:text-[#181512] hover:bg-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2.5 rounded-full bg-[#181512] text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition cursor-pointer shadow-md"
            >
              Apply Filter Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
