import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Lookbook, HeroSlide } from '@/types';
import { resolveHeroSlides } from '@/data/heroSlides';
import {
  Sparkles,
  ArrowRight,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Tag,
} from 'lucide-react';

interface HeroProps {
  lookbooks: Lookbook[];
  slides?: HeroSlide[];
  onOpenLook: (look: Lookbook) => void;
  onNavigateToShop: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  lookbooks,
  slides,
  onOpenLook,
  onNavigateToShop,
}) => {
  const activeSlideList = useMemo(() => {
    // The CMS data store is authoritative — never fall back to a hard-coded
    // array. If there are no published slides, the empty-state placeholder is
    // shown instead of silently re-serving stale defaults.
    return resolveHeroSlides(slides);
  }, [slides]);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Per-slide image resolution: primary image -> fallbackImage -> placeholder.
  // Tracked separately per slide so a broken URL never blanks the carousel and
  // the two <img> elements (foreground + blurred fill) always agree.
  const [imgSrcOverride, setImgSrcOverride] = useState<Record<string, string>>({});
  const [imgBroken, setImgBroken] = useState<Record<string, boolean>>({});

  // Swipe & Drag Gesture State
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const dragStartX = useRef<number>(0);

  // Auto-play interval
  useEffect(() => {
    if (isPaused || activeSlideList.length <= 1) return;

    timerRef.current = window.setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % activeSlideList.length);
    }, 5500);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPaused, activeSlideList.length]);

  // Ensure currentSlide is within bounds if slide count changes
  useEffect(() => {
    if (currentSlide >= activeSlideList.length) {
      setCurrentSlide(0);
    }
  }, [activeSlideList.length, currentSlide]);

  const activeSlide =
    activeSlideList[currentSlide] || activeSlideList[0];

  const matchedLook =
    lookbooks.find(l => l.id === activeSlide?.lookId) || lookbooks[0];

  /** Resolves one slide's image, inserting its fallback on error and finally
   *  marking it broken when nothing usable remains. */
  const handleImageError = (slide: HeroSlide, img: HTMLImageElement) => {
    const current = imgSrcOverride[slide.id] || slide.image || '';
    const fallback =
      slide.fallbackImage && slide.fallbackImage !== current
        ? slide.fallbackImage
        : '';
    if (fallback) {
      setImgSrcOverride(prev => ({ ...prev, [slide.id]: fallback }));
      return;
    }
    setImgBroken(prev => ({ ...prev, [slide.id]: true }));
    // Hide the element immediately so the fallback/placeholder renders cleanly.
    img.style.visibility = 'hidden';
  };

  const handleNext = () => {
    if (activeSlideList.length === 0) return;
    setCurrentSlide(prev => (prev + 1) % activeSlideList.length);
  };

  const handlePrev = () => {
    if (activeSlideList.length === 0) return;
    setCurrentSlide(
      prev =>
        (prev - 1 + activeSlideList.length) %
        activeSlideList.length
    );
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;

    // Detect predominantly horizontal swipe
    if (
      Math.abs(diffX) > Math.abs(diffY) &&
      Math.abs(diffX) > 35
    ) {
      if (diffX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  // Mouse drag handlers for desktop swipe
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;

    isDragging.current = false;

    const diffX = dragStartX.current - e.clientX;

    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    setIsPaused(false);
  };

  return (
    <section
      className="relative pt-5 pb-10 sm:pt-6 sm:pb-12 md:py-16 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">

        {/* Horizontal Responsive Hero Slide */}
        <div className="relative">

          <div
            className="
              relative
              mx-auto
              w-full
              max-w-[840px]

              /* A single deliberate 4:3 presentation frame at every breakpoint:
                 the constant ratio keeps the Hero height identical across slides
                 no matter the source image's aspect ratio (2:3 portrait, 1:1
                 square, 3:2 / 4:3 / 16:9 landscape, …). The foreground image
                 below uses object-contain — shown ENTIRELY, never cropped,
                 never stretched — and the blurred fill covers any unused
                 space. */
              aspect-[4/3]

              rounded-3xl
              overflow-hidden
              bg-[#f4efe9]
              border
              border-[#e8e2dc]
              shadow-2xl
              group/card
              cursor-grab
              active:cursor-grabbing
              select-none
              touch-pan-y
            "
            role="group"
            aria-roledescription="carousel"
            aria-label="Featured looks carousel"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >

            {/* Slides Container */}
            {activeSlideList.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                <div className="max-w-xs">
                  <p className="text-sm font-semibold text-[#6e6761]">
                    No published hero slides yet.
                  </p>
                  <p className="text-xs text-[#a0958c] mt-1">
                    Add a slide in Admin Studio and it will appear here.
                  </p>
                </div>
              </div>
            ) : (
              activeSlideList.map((slide, idx) => {
                const isActive = idx === currentSlide;
                const isBroken = Boolean(imgBroken[slide.id]);
                const currentSrc = imgSrcOverride[slide.id] || slide.image || '';

                return (
                <div
                  key={slide.id || idx}
                  className={`
                    absolute
                    inset-0
                    transition-all
                    duration-700
                    ease-out
                    ${
                      isActive
                        ? 'opacity-100 scale-100 z-10'
                        : 'opacity-0 scale-105 z-0 pointer-events-none'
                    }
                  `}
                >

                  {/*
                    Blurred, full-bleed background fill. Decorative only: it keeps
                    the 4:3 frame looking intentional for any source ratio while
                    the foreground image below is always shown whole.
                  */}
                  {!isBroken && (
                    <img
                      src={currentSrc}
                      alt=""
                      aria-hidden="true"
                      onError={(e) => handleImageError(slide, e.currentTarget)}
                      referrerPolicy="no-referrer"
                      loading={isActive ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={isActive ? 'high' : 'low'}
                      className="
                        absolute
                        inset-0
                        w-full
                        h-full
                        object-cover
                        object-center
                        blur-2xl
                        scale-110
                        pointer-events-none
                      "
                    />
                  )}

                  {/*
                    Actual hero image — object-contain: a 2:3 portrait, square
                    or landscape source is shown ENTIRELY inside the 4:3 frame,
                    never cropped and never stretched.
                  */}
                  {!isBroken && (
                    <img
                      src={currentSrc}
                      alt={slide.title}
                      onError={(e) => handleImageError(slide, e.currentTarget)}
                      referrerPolicy="no-referrer"
                      loading={isActive ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={isActive ? 'high' : 'low'}
                      className="
                        absolute
                        inset-0
                        w-full
                        h-full
                        object-contain
                        object-center
                        pointer-events-none
                        z-0
                      "
                    />
                  )}

                  {/* Neutral placeholder when both image and fallback fail —
                      visually consistent with the frame, keeps text legible. */}
                  {isBroken && (
                    <div
                      aria-hidden="true"
                      className="
                        absolute
                        inset-0
                        z-0
                        flex
                        flex-col
                        items-center
                        justify-center
                        gap-2
                        p-8
                        text-center
                        bg-[#f4efe9]
                      "
                    >
                      <span className="px-3 py-1 rounded-full bg-[#181512]/80 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-wider">
                        {slide.category || 'MUIRO Edit'}
                      </span>
                      <p className="text-sm font-semibold text-[#6e6761]">{slide.title}</p>
                    </div>
                  )}

                  {/* Subtle aesthetic gradient overlay. Explicit z-index keeps it
                      ABOVE the foreground image: the image stays inside its own
                      4:3 region (object-contain) while title, tags, and buttons
                      are always painted on top and stay clickable. */}
                  <div
                    className="
                      absolute
                      inset-0
                      z-10
                      bg-gradient-to-t
                      from-black/90
                      via-black/35
                      to-black/15
                      flex
                      flex-col
                      justify-between
                      p-4
                      sm:p-5
                      md:p-6
                      text-white
                    "
                  >

                    {/* Top bar with category & look tag */}
                    <div className="flex items-center justify-between">

                      <span
                        className="
                          inline-flex
                          items-center
                          gap-1.5
                          px-2.5
                          py-1
                          sm:px-3
                          sm:py-1
                          rounded-full
                          bg-black/60
                          backdrop-blur-md
                          text-white
                          border
                          border-white/20
                          text-[10px]
                          sm:text-[11px]
                          font-bold
                          uppercase
                          tracking-wider
                        "
                      >
                        <Sparkles className="w-3 h-3 text-white" />

                        <span>{slide.category}</span>
                      </span>

                      <span
                        className="
                          inline-flex
                          text-[10px]
                          sm:text-[11px]
                          font-medium
                          text-white/90
                          bg-black/50
                          backdrop-blur-md
                          px-2.5
                          py-0.5
                          rounded-full
                          border
                          border-white/10
                        "
                      >
                        Look {idx + 1} of {activeSlideList.length}
                      </span>
                    </div>

                    {/* Floating Key Pieces Hotspots */}
                    <div className="space-y-1.5 my-auto hidden sm:block">

                      {(slide.keyPieces || []).map((piece, pIdx) => (
                        <div
                          key={pIdx}
                          className="
                            inline-flex
                            items-center
                            gap-1.5
                            px-3
                            py-1.5
                            rounded-full
                            bg-white/95
                            text-[#181512]
                            text-xs
                            font-semibold
                            backdrop-blur-md
                            shadow-md
                            mr-2
                            hover:bg-white
                            transition
                            cursor-pointer
                          "
                          onClick={() =>
                            matchedLook &&
                            onOpenLook(matchedLook)
                          }
                        >
                          <Tag className="w-3 h-3 text-[#181512]" />

                          <span>{piece}</span>
                        </div>
                      ))}

                    </div>

                    {/* Bottom Info & Action */}
                    <div className="space-y-2.5 sm:space-y-3">

                      <div>

                        <h2
                          className="
                            text-xl
                            sm:text-2xl
                            md:text-3xl
                            font-bold
                            font-casual
                            text-white
                            leading-tight
                            mb-1
                          "
                        >
                          {slide.title}
                        </h2>

                        <p
                          className="
                            text-[11px]
                            sm:text-xs
                            md:text-sm
                            text-white/80
                            font-casual
                            line-clamp-2
                          "
                        >
                          {slide.tagline}
                        </p>

                      </div>

                      <button
                        onClick={() =>
                          matchedLook &&
                          onOpenLook(matchedLook)
                        }
                        className="
                          w-full
                          py-3
                          sm:py-3.5
                          px-4
                          sm:px-5
                          rounded-2xl
                          bg-white
                          text-[#181512]
                          text-[11px]
                          sm:text-xs
                          font-bold
                          uppercase
                          tracking-wider
                          hover:bg-[#f4efe9]
                          active:scale-95
                          transition
                          flex
                          items-center
                          justify-center
                          gap-2
                          shadow-xl
                          cursor-pointer
                        "
                      >
                        <span>
                          Shop This Look (
                          {matchedLook?.pieces?.length || 4}
                          {' '}Pieces)
                        </span>

                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                    </div>
                  </div>
                </div>
              );
              })
            )}

            {/* Prev / Next Slide Navigation Controls */}
            <div
              className="
                absolute
                inset-y-0
                left-2
                right-2
                flex
                items-center
                justify-between
                pointer-events-none
                z-20
              "
            >

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="
                  pointer-events-auto
                  w-8
                  h-8
                  sm:w-9
                  sm:h-9
                  md:w-10
                  md:h-10
                  rounded-full
                  bg-black/40
                  hover:bg-black/70
                  backdrop-blur-md
                  text-white
                  flex
                  items-center
                  justify-center
                  transition-all
                  opacity-80
                  hover:opacity-100
                  hover:scale-105
                  cursor-pointer
                  shadow-md
                "
                aria-label="Previous Slide"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="
                  pointer-events-auto
                  w-8
                  h-8
                  sm:w-9
                  sm:h-9
                  md:w-10
                  md:h-10
                  rounded-full
                  bg-black/40
                  hover:bg-black/70
                  backdrop-blur-md
                  text-white
                  flex
                  items-center
                  justify-center
                  transition-all
                  opacity-80
                  hover:opacity-100
                  hover:scale-105
                  cursor-pointer
                  shadow-md
                "
                aria-label="Next Slide"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </button>

            </div>

            {/* Slide Progress & Indicator Pills */}
            <div
              className="
                absolute
                bottom-2
                inset-x-6
                z-20
                flex
                items-center
                justify-center
                gap-2
                pb-2
              "
            >
              {activeSlideList.map((_, idx) => {
                const isActive = idx === currentSlide;

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`
                      h-1.5
                      rounded-full
                      transition-all
                      duration-300
                      cursor-pointer
                      ${
                        isActive
                          ? 'w-8 bg-white'
                          : 'w-2 bg-white/40 hover:bg-white/70'
                      }
                    `}
                    aria-label={`Go to slide ${idx + 1}`}
                    aria-current={isActive ? 'true' : 'false'}
                  />
                );
              })}
            </div>

          </div>

          {/* Hero Actions - Below Hero Slides */}
          <div
            className="
              flex
              flex-col
              sm:flex-row
              items-stretch
              sm:items-center
              justify-center
              gap-2.5
              sm:gap-4
              mt-5
              sm:mt-6
            "
          >

            <button
              id="hero-explore-looks-btn"
              onClick={() =>
                matchedLook &&
                onOpenLook(matchedLook)
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2.5
                px-6
                py-3
                sm:px-8
                sm:py-4
                rounded-full
                bg-[#181512]
                text-white
                text-[11px]
                sm:text-xs
                font-bold
                uppercase
                tracking-widest
                hover:bg-black
                active:scale-[0.98]
                transition
                shadow-md
                group
                cursor-pointer
              "
            >
              <span>Discover the Look</span>

              <ArrowRight
                className="
                  w-4
                  h-4
                  md:w-5
                  md:h-5
                  group-hover:translate-x-1
                  transition-transform
                "
              />
            </button>

            <button
              id="hero-shop-all-btn"
              onClick={onNavigateToShop}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                px-6
                py-3
                sm:px-8
                sm:py-4
                rounded-full
                bg-white
                border-2
                border-[#181512]
                text-[#181512]
                text-[11px]
                sm:text-xs
                font-bold
                uppercase
                tracking-widest
                hover:bg-[#181512]
                hover:text-white
                active:scale-[0.98]
                transition
                shadow-sm
                cursor-pointer
              "
            >
              <ShoppingBag className="w-4 h-4" />

              <span>Explore the Collection</span>
            </button>

          </div>
        </div>
      </div>
    </section>
  );
};