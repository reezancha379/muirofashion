import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { Lookbook, Product, Testimonial, SiteSettings, HeroSlide } from '@/types';
import { api } from '@/lib/api';
import { beginAffiliateNavigation } from '@/lib/affiliate';
import { Navbar } from '@/components/layout/Navbar';
import { Hero } from '@/components/sections/Hero';
import { NewlyAddedAndTrendySection } from '@/components/sections/NewlyAddedAndTrendySection';
import { LookbookCard } from '@/components/lookbook/LookbookCard';
import { ProductCard } from '@/components/product/ProductCard';
import { AboutSection } from '@/components/sections/AboutSection';
import { LookDetailModal } from '@/components/lookbook/LookDetailModal';
import { ImageInspectorModal } from '@/components/common/ImageInspectorModal';
import { ShopView } from '@/components/product/ShopView';
import { WishlistDrawer } from '@/components/search/WishlistDrawer';
import { SearchAndFilterModal, FilterState } from '@/components/search/SearchAndFilterModal';
import { LookbookSkeletonGrid } from '@/components/lookbook/LookbookSkeletonGrid';
import {
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Heart,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Star,
  Plus,
  Clock,
  TrendingUp,
  Filter,
  Lock,
  Layers,
  Search,
  SlidersHorizontal,
  X,
  RotateCcw
} from 'lucide-react';
const AnalyticsDashboard = lazy(() => import('@/components/admin/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const AdminManager = lazy(() => import('@/components/admin/AdminManager').then(m => ({ default: m.AdminManager })));
const AdminAuthModal = lazy(() => import('@/components/admin/AdminAuthModal').then(m => ({ default: m.AdminAuthModal })));

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'collections' | 'analytics' | 'admin'>('home');
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Admin / Owner Security State (Admin is strictly hidden until 6s hold on MUIRO)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('muiro_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [authModalTarget, setAuthModalTarget] = useState<'admin' | 'analytics' | null>(null);

  // Search & Filter State
  const [isSearchFilterModalOpen, setIsSearchFilterModalOpen] = useState(false);
  const [searchFilterInitialMode, setSearchFilterInitialMode] = useState<'search' | 'filter'>('search');
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    category: 'all',
    status: 'all',
    merchant: 'all',
    sortBy: 'newest'
  });

  // Lookbooks Pagination State (Handles large collections)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(6); // 6 per page default

  // Modals & Drawers
  const [activeLook, setActiveLook] = useState<Lookbook | null>(null);
  const [inspectorImage, setInspectorImage] = useState<{ src: string; alt: string } | null>(null);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [sharedProductId, setSharedProductId] = useState<string | null>(null);

  // Wishlist persisted in localStorage
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('muiro_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  /**
   * Loads every public collection independently so a single failing or slow
   * endpoint can never blank the whole storefront:
   *   - each fetch is wrapped: a failure keeps the previously loaded content
   *     (and records the section so the banner can name it),
   *   - the whole batch is raced against a hard timeout so `isLoading` is
   *     guaranteed to resolve even if a request hangs (no permanently stuck
   *     skeleton),
   *   - success, partial-failure and total-timeout are handled separately.
   */
  const loadData = async () => {
    setIsLoading(true);
    setDataError(null);
    const failedSections: string[] = [];
    const params = new URLSearchParams(window.location.search);

    const safeLoad = async <T,>(label: string, loader: () => Promise<T>, keep: () => T): Promise<T> => {
      try {
        return await loader();
      } catch (err) {
        console.error(`[MUIRO] Failed to load ${label}:`, err);
        failedSections.push(label);
        return keep();
      }
    };

    const TIMEOUT_MS = 20000;
    let timedOut = false;
    const withTimeout = async <T,>(work: Promise<T>): Promise<T> =>
      Promise.race([
        work,
        new Promise<T>((_, reject) => {
          const timer = window.setTimeout(() => {
            window.clearTimeout(timer);
            reject(new Error('timeout'));
          }, TIMEOUT_MS);
        }),
      ]);

    try {
      const [lbs, prods, tests, st, hSlides] = await withTimeout(
        Promise.all([
          safeLoad('lookbooks', api.getLookbooks, () => lookbooks),
          safeLoad('products', api.getProducts, () => products),
          safeLoad('testimonials', api.getTestimonials, () => testimonials),
          safeLoad('settings', api.getSettings, () => settings),
          safeLoad('hero slides', api.getHeroSlides, () => heroSlides),
        ])
      );
      setLookbooks(lbs);
      setProducts(prods);
      setTestimonials(tests);
      if (st) setSettings(st);
      if (hSlides && hSlides.length > 0) setHeroSlides(hSlides);

      // Share URLs use query parameters so they work on a static host. The path
      // form remains supported for previously copied `/lookbook/:id` links.
      const legacyLookPath = window.location.pathname.match(/^\/lookbook\/([^/]+)\/?$/)?.[1];
      let pathLookParam: string | null = null;
      try { pathLookParam = legacyLookPath ? decodeURIComponent(legacyLookPath) : null; } catch { /* Ignore malformed legacy links. */ }
      const lookParam = params.get('look') || pathLookParam;
      if (lookParam) {
        const found = lbs.find(l => l.id === lookParam);
        if (found) setActiveLook(found);
      }
      const productParam = params.get('product');
      if (params.get('view') === 'collections' || params.get('view') === 'shop' || productParam) setCurrentView('collections');
      if (productParam) setSharedProductId(productParam);
      if (params.get('view') === 'analytics' && sessionStorage.getItem('muiro_admin_auth') === 'true') {
        setCurrentView('analytics');
      }
      if (params.get('view') === 'admin' && sessionStorage.getItem('muiro_admin_auth') === 'true') {
        setCurrentView('admin');
      }
    } catch (err) {
      timedOut = err instanceof Error && err.message === 'timeout';
      console.error('Error loading MUIRO data:', err);
    } finally {
      setIsLoading(false);
    }

    if (timedOut) {
      setDataError(
        'The server is taking too long to respond — the connection may be down. Your saved content is still shown below; check that the MUIRO server is running, then retry.'
      );
    } else if (failedSections.length > 0) {
      setDataError(
        `Some content could not be refreshed right now (${failedSections.join(', ')}). Showing the latest data we already have — you can retry.`
      );
    }
  };

  useEffect(() => {
    loadData();
    api.recordImpression();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentView !== 'collections' || !sharedProductId || products.length === 0) return;
    requestAnimationFrame(() => {
      document.getElementById(`product-card-${sharedProductId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [currentView, sharedProductId, products]);

  const handleToggleWishlist = (id: string) => {
    setWishlist(prev => {
      const exists = prev.includes(id);
      const updated = exists ? prev.filter(item => item !== id) : [...prev, id];
      try {
        localStorage.setItem('muiro_wishlist', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  const handleOpenLook = (look: Lookbook) => {
    setActiveLook(look);
    api.recordImpression(look.id);
  };

  const handleInspect = (src: string, alt: string) => {
    setInspectorImage({ src, alt });
  };

  // Protected View Handler (Triggered only after 6-second hold on MUIRO)
  const handleProtectedViewRequest = (view: 'admin' | 'analytics') => {
    if (isAdminAuthenticated) {
      setCurrentView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setAuthModalTarget(view);
    }
  };

  const handleAuthSuccess = () => {
    setIsAdminAuthenticated(true);
    setCurrentView('admin');
    setAuthModalTarget(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLockAdmin = () => {
    try {
      sessionStorage.removeItem('muiro_admin_auth');
    } catch {}
    setIsAdminAuthenticated(false);
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The server is the authority on whether we are signed in: revalidate any
  // stored session on boot instead of trusting the sessionStorage flag, and
  // drop the shell out of the studio whenever an API call reports 401
  // (expired or revoked token) so the UI never advertises write access it
  // no longer has.
  useEffect(() => {
    let cancelled = false;

    api
      .getSessionStatus()
      .then((valid) => {
        if (cancelled || valid) return;
        setIsAdminAuthenticated(false);
        try {
          sessionStorage.removeItem('muiro_admin_auth');
        } catch {}
      })
      .catch(() => {
        /* keep current UI state on network errors */
      });

    const onUnauthorized = () => {
      setIsAdminAuthenticated(false);
      setAuthModalTarget(null);
      setCurrentView('home');
    };
    window.addEventListener('muiro:unauthorized', onUnauthorized);

    return () => {
      cancelled = true;
      window.removeEventListener('muiro:unauthorized', onUnauthorized);
    };
  }, []);

  // Distinct Lookbook categories for filtering
  const lookbookCategories = useMemo(() => {
    const cats = new Set<string>();
    lookbooks.forEach(l => {
      if (l.category) cats.add(l.category);
    });
    return Array.from(cats);
  }, [lookbooks]);

  // Comprehensive Search, Filter & Sort for Lookbooks
  const filteredAndSortedLookbooks = useMemo(() => {
    let result = [...lookbooks];

    // Search query filter
    if (filterState.searchQuery.trim()) {
      const q = filterState.searchQuery.toLowerCase().trim();
      result = result.filter(l => {
        const inTitle = l.title.toLowerCase().includes(q);
        const inDesc = l.description.toLowerCase().includes(q);
        const inCat = l.category && l.category.toLowerCase().includes(q);
        const inNote = l.authorNote && l.authorNote.toLowerCase().includes(q);
        
        // Also check if any associated product matches query
        const hasMatchingProduct = l.pieces.some(pId => {
          const prod = products.find(p => p.id === pId);
          return prod && (
            prod.title.toLowerCase().includes(q) ||
            prod.category.toLowerCase().includes(q) ||
            prod.merchant.toLowerCase().includes(q)
          );
        });

        return inTitle || inDesc || inCat || inNote || hasMatchingProduct;
      });
    }

    // Category filter
    if (filterState.category !== 'all') {
      result = result.filter(l => l.category === filterState.category);
    }

    // Status filter
    if (filterState.status === 'new') {
      result = result.filter(l => l.isNewlyAdded);
    } else if (filterState.status === 'trending') {
      result = result.filter(l => l.isTrending);
    }

    // Merchant filter
    if (filterState.merchant !== 'all') {
      result = result.filter(l =>
        l.pieces.some(pId => {
          const prod = products.find(p => p.id === pId);
          return prod && prod.merchant === filterState.merchant;
        })
      );
    }

    // Sort order
    if (filterState.sortBy === 'newest') {
      result.sort((a, b) => (b.isNewlyAdded ? 1 : 0) - (a.isNewlyAdded ? 1 : 0));
    } else if (filterState.sortBy === 'trending') {
      result.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0) || (b.likes + b.views) - (a.likes + a.views));
    } else if (filterState.sortBy === 'pieces') {
      result.sort((a, b) => b.pieces.length - a.pieces.length);
    } else if (filterState.sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [lookbooks, products, filterState]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterState, itemsPerPage]);

  // Paginated Lookbooks slice
  const totalLookbooks = filteredAndSortedLookbooks.length;
  const totalPages = Math.max(1, Math.ceil(totalLookbooks / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLookbooks = useMemo(() => {
    return filteredAndSortedLookbooks.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedLookbooks, startIndex, itemsPerPage]);

  const activeFilterCount =
    (filterState.category !== 'all' ? 1 : 0) +
    (filterState.status !== 'all' ? 1 : 0) +
    (filterState.merchant !== 'all' ? 1 : 0) +
    (filterState.sortBy !== 'newest' ? 1 : 0) +
    (filterState.searchQuery ? 1 : 0);

  const resetAllFilters = () => {
    setFilterState({
      searchQuery: '',
      category: 'all',
      status: 'all',
      merchant: 'all',
      sortBy: 'newest'
    });
    setCurrentPage(1);
  };

  // True once ANY real content has loaded. Once true, the skeleton is never
  // shown over existing content again — reloads keep the page on screen and
  // the data-error banner (with Retry) communicates failures instead.
  const hasContent =
    lookbooks.length > 0 || products.length > 0 || testimonials.length > 0 || heroSlides.length > 0;

  return (
    <div className="min-h-screen bg-white text-[#181512] font-casual selection:bg-[#181512] selection:text-white flex flex-col justify-between">
      {/* Top Navbar with Search, Filter & Secret MUIRO Hold Gateway */}
      <Navbar
        currentView={currentView}
        onChangeView={(view) => {
          if (view === 'admin' || view === 'analytics') {
            handleProtectedViewRequest(view);
          } else {
            setCurrentView(view);
          }
        }}
        wishlistCount={wishlist.length}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        isAdminAuthenticated={isAdminAuthenticated}
        onAdminAuthRequest={handleProtectedViewRequest}
        onLockAdmin={handleLockAdmin}
        onOpenSearch={() => {
          setSearchFilterInitialMode('search');
          setIsSearchFilterModalOpen(true);
        }}
        onOpenFilter={() => {
          setSearchFilterInitialMode('filter');
          setIsSearchFilterModalOpen(true);
        }}
        activeFilterCount={activeFilterCount}
      />

      <main className="flex-1">
        {/* Error / partial-refresh banner. Shown whenever a reload could not
            fully refresh, while the last good content stays on screen (with a
            manual Retry so a bad response never strands the page). */}
        {dataError && (
          <div role="alert" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-sm">
              <div className="flex items-start gap-2 min-w-0">
                <RotateCcw className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <span className="leading-snug">{dataError}</span>
              </div>
              <button
                onClick={loadData}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#181512] text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {isLoading && !hasContent ? (
          <LookbookSkeletonGrid />
        ) : (
          <>
            {/* VIEW: HOME / LANDING */}
            {currentView === 'home' && (
              <>
                {/* 1. Hero Section */}
                <Hero
                  lookbooks={lookbooks}
                  slides={heroSlides}
                  onOpenLook={handleOpenLook}
                  onNavigateToShop={() => {
                    setCurrentView('collections');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />

                {/* 2. Newly Added & Trendy Clothes Section (With Touch Swipe Features for Mobile) */}
                <NewlyAddedAndTrendySection
                  lookbooks={lookbooks}
                  products={products}
                  wishlist={wishlist}
                  onToggleWishlist={handleToggleWishlist}
                  onOpenLook={handleOpenLook}
                  onInspect={handleInspect}
                  onNavigateToShop={() => {
                    setCurrentView('collections');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />

                {/* 3. Lookbooks Grid with Scalable Pagination, Search & Small Filter Button */}
                <section id="lookbooks-grid" className="py-16 sm:py-24 bg-[#fcfbf9] border-t border-[#e8e2dc]">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header with Title, Count and Small Filter Button */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-[#6e6761] mb-1 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[#181512]" />
                          <span>The MUIRO Edit</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold font-display text-[#181512] tracking-tight">
                          The Lookbook
                        </h2>
                        <p className="text-sm text-[#6e6761] mt-1 max-w-xl">
                          A study in style, gathered season by season.
                        </p>
                      </div>

                      {/* Right controls: Active Filters Pill + Small Filter Button */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-xs font-semibold text-[#6e6761]">
                          Showing <strong className="text-[#181512]">{totalLookbooks > 0 ? `${startIndex + 1}–${Math.min(startIndex + itemsPerPage, totalLookbooks)}` : 0}</strong> of {totalLookbooks} looks
                        </div>

                        {/* Small Filter Button at Right Side of Header */}
                        <button
                          id="section-filter-btn"
                          onClick={() => {
                            setSearchFilterInitialMode('filter');
                            setIsSearchFilterModalOpen(true);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                            activeFilterCount > 0
                              ? 'bg-[#181512] text-white shadow-xs'
                              : 'bg-white border border-[#e8e2dc] text-[#181512] hover:bg-[#f4efe9]'
                          }`}
                          title="Open filter options"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Filter & Sort</span>
                          {activeFilterCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-white text-[#181512] text-[10px] font-bold flex items-center justify-center">
                              {activeFilterCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Active Filter Tags Indicator (if applied) */}
                    {activeFilterCount > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-white rounded-2xl border border-[#e8e2dc]">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#6e6761] mr-1 flex items-center gap-1">
                          <Filter className="w-3 h-3 text-[#181512]" />
                          <span>Active Filters:</span>
                        </span>

                        {filterState.searchQuery && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f4efe9] text-xs font-semibold text-[#181512]">
                            <span>Search: &quot;{filterState.searchQuery}&quot;</span>
                            <button
                              onClick={() => setFilterState(prev => ({ ...prev, searchQuery: '' }))}
                              className="hover:text-black"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}

                        {filterState.category !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f4efe9] text-xs font-semibold text-[#181512]">
                            <span>Category: {filterState.category}</span>
                            <button
                              onClick={() => setFilterState(prev => ({ ...prev, category: 'all' }))}
                              className="hover:text-black"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}

                        {filterState.status !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f4efe9] text-xs font-semibold text-[#181512]">
                            <span>Status: {filterState.status === 'new' ? 'Newly Added' : 'Trending'}</span>
                            <button
                              onClick={() => setFilterState(prev => ({ ...prev, status: 'all' }))}
                              className="hover:text-black"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}

                        {filterState.merchant !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f4efe9] text-xs font-semibold text-[#181512]">
                            <span>Retailer: {filterState.merchant}</span>
                            <button
                              onClick={() => setFilterState(prev => ({ ...prev, merchant: 'all' }))}
                              className="hover:text-black"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}

                        <button
                          onClick={resetAllFilters}
                          className="ml-auto inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#6e6761] hover:text-[#181512] transition cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Clear All</span>
                        </button>
                      </div>
                    )}

                    {/* Quick Category Filter Pills (Monochrome B&W) */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
                      <button
                        onClick={() => setFilterState(prev => ({ ...prev, category: 'all', status: 'all' }))}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${
                          filterState.category === 'all' && filterState.status === 'all'
                            ? 'bg-[#181512] text-white shadow-xs'
                            : 'bg-white text-[#6e6761] border border-[#e8e2dc] hover:text-[#181512] hover:border-[#181512]'
                        }`}
                      >
                        All Lookbooks
                      </button>

                      <button
                        onClick={() => setFilterState(prev => ({ ...prev, status: prev.status === 'new' ? 'all' : 'new' }))}
                        className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${
                          filterState.status === 'new'
                            ? 'bg-[#181512] text-white shadow-xs'
                            : 'bg-white text-[#6e6761] border border-[#e8e2dc] hover:text-[#181512] hover:border-[#181512]'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Newly Added ({lookbooks.filter(l => l.isNewlyAdded).length})</span>
                      </button>

                      <button
                        onClick={() => setFilterState(prev => ({ ...prev, status: prev.status === 'trending' ? 'all' : 'trending' }))}
                        className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${
                          filterState.status === 'trending'
                            ? 'bg-[#181512] text-white shadow-xs'
                            : 'bg-white text-[#6e6761] border border-[#e8e2dc] hover:text-[#181512] hover:border-[#181512]'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Trending ({lookbooks.filter(l => l.isTrending).length})</span>
                      </button>

                      {lookbookCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setFilterState(prev => ({ ...prev, category: prev.category === cat ? 'all' : cat }))}
                          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${
                            filterState.category === cat
                              ? 'bg-[#181512] text-white shadow-xs'
                              : 'bg-white text-[#6e6761] border border-[#e8e2dc] hover:text-[#181512] hover:border-[#181512]'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Lookbooks Grid */}
                    {paginatedLookbooks.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                          {paginatedLookbooks.map(look => (
                            <LookbookCard
                              key={look.id}
                              look={look}
                              allProducts={products}
                              onOpenLook={handleOpenLook}
                              onInspect={handleInspect}
                            />
                          ))}
                        </div>

                        {/* Large Collection Pagination & Per-Page Controls */}
                        {totalPages > 1 && (
                          <div className="mt-12 pt-8 border-t border-[#e8e2dc] flex flex-col sm:flex-row items-center justify-between gap-4">
                            {/* Items Per Page Selector */}
                            <div className="flex items-center gap-2 text-xs text-[#6e6761]">
                              <span>Per page:</span>
                              {[6, 9, 12].map(num => (
                                <button
                                  key={num}
                                  onClick={() => setItemsPerPage(num)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    itemsPerPage === num
                                      ? 'bg-[#181512] text-white'
                                      : 'bg-white border border-[#e8e2dc] hover:bg-[#f4efe9]'
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>

                            {/* Numbered Page Navigation */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  if (currentPage > 1) {
                                    setCurrentPage(prev => prev - 1);
                                    document.getElementById('lookbooks-grid')?.scrollIntoView({ behavior: 'smooth' });
                                  }
                                }}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl border border-[#e8e2dc] bg-white text-[#181512] hover:bg-[#f4efe9] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                                aria-label="Previous page"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>

                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                <button
                                  key={pageNum}
                                  onClick={() => {
                                    setCurrentPage(pageNum);
                                    document.getElementById('lookbooks-grid')?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  className={`w-9 h-9 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                                    currentPage === pageNum
                                      ? 'bg-[#181512] text-white shadow-xs'
                                      : 'bg-white border border-[#e8e2dc] text-[#181512] hover:bg-[#f4efe9]'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              ))}

                              <button
                                onClick={() => {
                                  if (currentPage < totalPages) {
                                    setCurrentPage(prev => prev + 1);
                                    document.getElementById('lookbooks-grid')?.scrollIntoView({ behavior: 'smooth' });
                                  }
                                }}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl border border-[#e8e2dc] bg-white text-[#181512] hover:bg-[#f4efe9] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                                aria-label="Next page"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-[#e8e2dc]">
                        <p className="text-sm text-[#6e6761]">No lookbooks found matching this criteria.</p>
                        <button
                          onClick={resetAllFilters}
                          className="mt-3 px-5 py-2 rounded-full bg-[#181512] text-white text-xs font-bold cursor-pointer hover:bg-black transition"
                        >
                          Reset Filters & View All
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {/* 4. Trending Shoppable Pieces Section */}
                <section className="py-14 sm:py-20 bg-white border-t border-[#e8e2dc]">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-[#6e6761] mb-1">
                          The Current Edit
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold font-display text-[#181512]">
                          Pieces in Rotation
                        </h2>
                      </div>

                      <button
                        onClick={() => {
                          setCurrentView('collections');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#181512] hover:underline cursor-pointer"
                      >
                        <span>View Collections ({products.length} pieces)</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                      {products.slice(0, 8).map(product => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          isSaved={wishlist.includes(product.id)}
                          onToggleSave={handleToggleWishlist}
                          onInspect={(src, alt) => handleInspect(src, alt)}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* 5. Editorial About Section & Minimal Affiliate Disclosure */}
                <AboutSection settings={settings} />
              </>
            )}

            {/* VIEW: COLLECTIONS DIRECTORY */}
            {currentView === 'collections' && (
              <ShopView
                products={products}
                loading={isLoading}
                wishlist={wishlist}
                onToggleWishlist={handleToggleWishlist}
                onInspect={handleInspect}
              />
            )}

            {/* VIEW: ANALYTICS (Owner Protected) */}
            {(currentView === 'analytics' || currentView === 'admin') && (
              <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-sm text-[#6e6761]">Loading MUIRO Studio…</div>}>
                {currentView === 'analytics' ? (
                  <AnalyticsDashboard />
                ) : (
                  <AdminManager
                    lookbooks={lookbooks}
                    products={products}
                    testimonials={testimonials}
                    heroSlides={heroSlides}
                    onRefreshData={loadData}
                    onLockSession={handleLockAdmin}
                  />
                )}
              </Suspense>
            )}
          </>
        )}
      </main>

      {/* Floating Mobile Quick Action Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#e8e2dc] p-3 flex items-center justify-between gap-3 shadow-xl">
        <button
          onClick={() => {
            if (lookbooks.length > 0) handleOpenLook(lookbooks[0]);
          }}
          className="flex-1 py-3 px-4 rounded-xl bg-[#181512] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Shop Featured Look</span>
        </button>

        <button
          onClick={() => setIsWishlistOpen(true)}
          className="p-3 rounded-xl border border-[#e8e2dc] text-[#181512] relative cursor-pointer"
          aria-label="Open Wishlist"
        >
          <Heart className="w-5 h-5" />
          {wishlist.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#181512] text-white text-[10px] font-bold flex items-center justify-center">
              {wishlist.length}
            </span>
          )}
        </button>
      </div>

      {/* Lookbook Detail Overlay Modal */}
      <LookDetailModal
        look={activeLook}
        allProducts={products}
        wishlist={wishlist}
        onToggleWishlist={handleToggleWishlist}
        onClose={() => setActiveLook(null)}
        onInspect={handleInspect}
      />

      {/* High-Resolution Image Inspector Modal */}
      <ImageInspectorModal
        isOpen={Boolean(inspectorImage)}
        imageSrc={inspectorImage?.src || null}
        imageAlt={inspectorImage?.alt || 'MUIRO Detail'}
        onClose={() => setInspectorImage(null)}
      />

      {/* Wishlist Slideout Drawer */}
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        wishlistIds={wishlist}
        products={products}
        onRemoveItem={handleToggleWishlist}
        onInspect={handleInspect}
      />

      {/* Search & Filter Modal Component */}
      <SearchAndFilterModal
        isOpen={isSearchFilterModalOpen}
        initialMode={searchFilterInitialMode}
        onClose={() => setIsSearchFilterModalOpen(false)}
        lookbooks={lookbooks}
        products={products}
        filterState={filterState}
        onUpdateFilters={(newFilters) => setFilterState(newFilters)}
        onSelectLook={handleOpenLook}
        onSelectProduct={async (p) => {
          // Claim the tab during the click gesture, before any await.
          const navigate = beginAffiliateNavigation();
          try {
            const result = await api.handleAffiliateClick(p.id, undefined, 'search_modal');
            navigate(result.safeUrl);
          } catch {
            navigate(p.affiliateUrl);
          }
        }}
      />

      {/* Admin Authentication Modal (Triggered ONLY via 6-second hold on MUIRO) */}
      {authModalTarget !== null && (
        <Suspense fallback={null}>
          <AdminAuthModal
            isOpen
            onClose={() => setAuthModalTarget(null)}
            onSuccess={handleAuthSuccess}
          />
        </Suspense>
      )}

      {/* Editorial Footer (Admin/Analytics links strictly hidden for shoppers) */}
      <footer className="bg-[#fcfbf9] border-t border-[#e8e2dc] py-14 mt-16 font-casual">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pb-10 border-b border-[#e8e2dc]">
            <div>
              <div className="text-3xl font-bold font-sans tracking-tight text-[#181512] mb-1">
                MUIRO
              </div>
              <p className="text-xs text-[#6e6761] max-w-md leading-relaxed">
                A visual fashion destination for considered style and lasting inspiration.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-bold uppercase tracking-widest text-[#181512]">
              <button onClick={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:underline transition cursor-pointer">
                Lookbooks
              </button>
              <button onClick={() => { setCurrentView('collections'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:underline transition cursor-pointer">
                Collections
              </button>
              <a href="#about" onClick={() => { if (currentView !== 'home') setCurrentView('home'); }} className="hover:underline transition cursor-pointer">
                About
              </a>
              <a
                href="https://www.pinterest.com/muirofashion/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline transition flex items-center gap-1 cursor-pointer"
              >
                <span>Pinterest</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="pt-8 text-center text-[11px] text-[#8c827a] leading-relaxed">
            A quiet note from MUIRO: some of the pieces you discover here are linked to our retail partners. If you choose to shop through one of those links, we may receive a small commission — at no extra cost to you.
          </div>
        </div>
      </footer>
    </div>
  );
}
