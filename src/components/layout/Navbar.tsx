import React, { useState, useRef, useEffect } from 'react';
import { Heart, Menu, X, ShoppingBag, BookOpen, ShieldCheck, Search, SlidersHorizontal, Lock, LogOut } from 'lucide-react';

interface NavbarProps {
  currentView: 'home' | 'collections' | 'analytics' | 'admin';
  onChangeView: (view: 'home' | 'collections' | 'analytics' | 'admin') => void;
  wishlistCount: number;
  onOpenWishlist: () => void;
  isAdminAuthenticated: boolean;
  onAdminAuthRequest: (targetView: 'admin' | 'analytics') => void;
  onLockAdmin: () => void;
  onOpenSearch: () => void;
  onOpenFilter: () => void;
  activeFilterCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onChangeView,
  wishlistCount,
  onOpenWishlist,
  isAdminAuthenticated,
  onAdminAuthRequest,
  onLockAdmin,
  onOpenSearch,
  onOpenFilter,
  activeFilterCount
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Secret 6-Second Hold after Double Tap/Click on "MUIRO"
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<string>('6.0');
  
  const tapCountRef = useRef<number>(0);
  const tapResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartTimeRef = useRef<number>(0);
  const singleClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const HOLD_DURATION_MS = 6000; // 6 seconds

  const cleanupHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
    setRemainingSeconds('6.0');
  };

  const startHoldTimer = () => {
    cleanupHold();
    setIsHolding(true);
    holdStartTimeRef.current = Date.now();

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      const remaining = Math.max(0, (HOLD_DURATION_MS - elapsed) / 1000).toFixed(1);
      
      setHoldProgress(progress);
      setRemainingSeconds(remaining);

      if (elapsed >= HOLD_DURATION_MS) {
        // Success! 6 seconds reached after double tap
        cleanupHold();
        tapCountRef.current = 0;
        
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([80, 40, 100]);
          } catch {
            // Ignore
          }
        }
        
        onAdminAuthRequest('admin');
      }
    }, 50);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Check if double tap condition is met
    if (tapCountRef.current >= 1) {
      // User tapped/clicked once and is now pressing down for the second tap/click
      startHoldTimer();
    }
  };

  const handlePointerUpOrCancel = () => {
    cleanupHold();
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    tapCountRef.current += 1;

    // Reset tap count after 800ms if not held
    if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
    tapResetTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 800);

    // If it's a single click and user didn't hold, navigate to home after 350ms
    if (tapCountRef.current === 1) {
      if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = setTimeout(() => {
        if (!isHolding) {
          handleNavClick('home');
        }
      }, 350);
    } else if (tapCountRef.current >= 2) {
      // Cancel single click navigation since double tap occurred
      if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupHold();
      if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
      if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);
    };
  }, []);

  const handleNavClick = (view: 'home' | 'collections' | 'analytics' | 'admin') => {
    onChangeView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e8e2dc] transition-all font-casual">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Desktop Navigation Links (Left) */}
            <nav className="hidden md:flex items-center gap-7">
              <button
                onClick={() => handleNavClick('home')}
                className={`text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  currentView === 'home'
                    ? 'text-[#181512] border-b-2 border-[#181512] pb-0.5'
                    : 'text-[#6e6761] hover:text-[#181512]'
                }`}
              >
                Lookbooks
              </button>

              <button
                onClick={() => handleNavClick('collections')}
                className={`text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  currentView === 'collections'
                    ? 'text-[#181512] border-b-2 border-[#181512] pb-0.5'
                    : 'text-[#6e6761] hover:text-[#181512]'
                }`}
              >
                Collections
              </button>

              <a
                href="#about"
                onClick={() => {
                  if (currentView !== 'home') onChangeView('home');
                }}
                className="text-xs font-bold uppercase tracking-widest text-[#6e6761] hover:text-[#181512] transition-all cursor-pointer"
              >
                About
              </a>
            </nav>

            {/* Mobile Hamburger (Left) */}
            <div className="flex md:hidden items-center">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 -ml-2 text-[#181512] hover:opacity-75 focus:outline-none cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            {/* Centered Brand Logo with Secret 6-Second Hold Gateway */}
            <div className="relative flex flex-col items-center justify-center select-none py-1">
              <div
                id="brand-logo-muiro"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUpOrCancel}
                onPointerCancel={handlePointerUpOrCancel}
                onPointerLeave={handlePointerUpOrCancel}
                onClick={handleLogoClick}
                className="relative px-3 py-1 cursor-pointer transition-transform active:scale-95 flex items-center justify-center"
                title="MUIRO"
              >
                <span className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181512]">
                  MUIRO
                </span>

                {/* Circular SVG / Underline Hold Progress Ring */}
                {isHolding && (
                  <div className="absolute inset-0 -m-1 rounded-xl border border-[#181512]/30 pointer-events-none flex items-center justify-center">
                    <div
                      className="absolute bottom-0 left-0 h-1 bg-[#181512] rounded-full transition-all duration-75"
                      style={{ width: `${holdProgress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Discreet Countdown Tooltip during Hold */}
              {isHolding && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-[#181512] text-white text-[10px] font-mono tracking-wider shadow-md pointer-events-none animate-in fade-in">
                  Admin Gateway: {remainingSeconds}s
                </div>
              )}
            </div>

            {/* Right Actions: Search + Filter + Wishlist (+ Exit Admin if unlocked) */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {/* Search Button at the Top */}
              <button
                id="top-search-btn"
                onClick={onOpenSearch}
                className="p-2.5 rounded-full hover:bg-[#f4efe9] text-[#181512] transition flex items-center justify-center cursor-pointer"
                title="Search Lookbooks & Clothes"
                aria-label="Search"
              >
                <Search className="w-4.5 h-4.5" />
              </button>

              {/* Small Filter Button at the Right Side */}
              <button
                id="top-filter-btn"
                onClick={onOpenFilter}
                className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  activeFilterCount > 0
                    ? 'bg-[#181512] text-white shadow-xs'
                    : 'bg-[#f4efe9] hover:bg-[#e8e2dc] text-[#181512]'
                }`}
                title="Filter Aesthetics, Categories & Retailers"
                aria-label="Filter"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    activeFilterCount > 0 ? 'bg-white text-[#181512]' : 'bg-[#181512] text-white'
                  }`}>
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Wishlist Button */}
              <button
                id="top-wishlist-btn"
                onClick={onOpenWishlist}
                className="relative p-2.5 rounded-full hover:bg-[#f4efe9] text-[#181512] transition flex items-center justify-center cursor-pointer"
                aria-label={`Wishlist with ${wishlistCount} items`}
                title="Saved Wishlist"
              >
                <Heart className="w-4.5 h-4.5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#181512] text-white text-[10px] font-bold flex items-center justify-center animate-in zoom-in-50">
                    {wishlistCount}
                  </span>
                )}
              </button>

              {/* If Admin is Authenticated and Active: Exit Admin Button */}
              {isAdminAuthenticated && currentView === 'admin' && (
                <button
                  onClick={onLockAdmin}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs ml-1"
                  title="Lock Admin & Return to Public Storefront"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit Admin</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer (Minimalist Black & White) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden flex justify-start animate-in fade-in duration-200">
          <div className="w-4/5 max-w-sm bg-white h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-300">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-[#e8e2dc]">
                <span className="font-display text-2xl font-bold text-[#181512]">
                  MUIRO
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-[#181512] hover:bg-[#f4efe9] rounded-full cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-6 flex flex-col gap-4 font-casual">
                <button
                  onClick={() => handleNavClick('home')}
                  className={`text-left text-base font-semibold py-2 flex items-center justify-between cursor-pointer ${
                    currentView === 'home' ? 'text-[#181512] font-bold' : 'text-[#6e6761]'
                  }`}
                >
                  <span>The Lookbooks</span>
                  <BookOpen className="w-4 h-4 text-[#8c7b6d]" />
                </button>

                <button
                  onClick={() => handleNavClick('collections')}
                  className={`text-left text-base font-semibold py-2 flex items-center justify-between cursor-pointer ${
                    currentView === 'collections' ? 'text-[#181512] font-bold' : 'text-[#6e6761]'
                  }`}
                >
                  <span>Collections</span>
                  <ShoppingBag className="w-4 h-4 text-[#8c7b6d]" />
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenSearch();
                  }}
                  className="text-left text-base font-semibold py-2 flex items-center justify-between text-[#6e6761] hover:text-[#181512] cursor-pointer"
                >
                  <span>Search Outfits & Pieces</span>
                  <Search className="w-4 h-4 text-[#8c7b6d]" />
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenFilter();
                  }}
                  className="text-left text-base font-semibold py-2 flex items-center justify-between text-[#6e6761] hover:text-[#181512] cursor-pointer"
                >
                  <span>Filter Lookbooks</span>
                  <SlidersHorizontal className="w-4 h-4 text-[#8c7b6d]" />
                </button>

                <a
                  href="#about"
                  onClick={() => {
                    if (currentView !== 'home') onChangeView('home');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left text-base font-semibold py-2 flex items-center justify-between text-[#6e6761] hover:text-[#181512] cursor-pointer"
                >
                  <span>About</span>
                  <ShieldCheck className="w-4 h-4 text-[#8c7b6d]" />
                </a>

                {/* If Admin is Authenticated, show option to exit */}
                {isAdminAuthenticated && (
                  <div className="pt-4 border-t border-[#e8e2dc] flex flex-col gap-2">
                    <button
                      onClick={() => {
                        onLockAdmin();
                        setMobileMenuOpen(false);
                      }}
                      className="text-left text-xs py-2 text-rose-600 font-bold flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Lock & Hide Admin Session</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-[#e8e2dc] text-xs text-[#6e6761] font-casual">
              <div className="font-bold text-[#181512] mb-1">MUIRO Editorial Edit</div>
              <p>Quietly considered. Distinctly MUIRO.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
