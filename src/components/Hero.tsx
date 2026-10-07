import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroSlide {
  id: string;
  title: string;
  tagline?: string;
  image: string;
  fallbackImage?: string;
  isActive?: boolean;
  order?: number;
}

export default function Hero() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to load from API first, fall back to snapshot
    const loadSlides = async () => {
      try {
        // First try content-snapshot.json (static build)
        const response = await fetch('/content-snapshot.json');
        if (response.ok) {
          const data = await response.json();
          const activeSlides = (data.heroSlides || [])
            .filter((s: HeroSlide) => s.isActive !== false)
            .sort((a: HeroSlide, b: HeroSlide) => (a.order || 0) - (b.order || 0));
          setSlides(activeSlides);
        } else {
          // Fall back to API
          const apiRes = await fetch('/api/hero-slides');
          if (apiRes.ok) {
            const data = await apiRes.json();
            const activeSlides = (data || [])
              .filter((s: HeroSlide) => s.isActive !== false)
              .sort((a: HeroSlide, b: HeroSlide) => (a.order || 0) - (b.order || 0));
            setSlides(activeSlides);
          }
        }
      } catch (error) {
        console.error('Failed to load hero slides:', error);
        setSlides([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSlides();
  }, []);

  // Auto-rotate slides every 5 seconds
  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]);

  if (isLoading || slides.length === 0) {
    return (
      <section className="w-full bg-[#e0dcd8] h-96 md:h-[500px] flex items-center justify-center">
        <div className="text-center text-[#666]">
          <p className="text-lg font-medium">Loading hero content...</p>
        </div>
      </section>
    );
  }

  const slide = slides[currentSlide];

  return (
    <section className="relative w-full overflow-hidden">
      <div className="aspect-video md:aspect-auto md:h-[500px] relative">
        {/* Hero Image */}
        <img
          src={slide.image || slide.fallbackImage}
          alt={slide.title}
          className="w-full h-full object-cover"
          loading="eager"
        />

        {/* Overlay Content */}
        {(slide.title || slide.tagline) && (
          <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center text-center text-white px-4">
            {slide.tagline && <p className="text-sm md:text-base mb-2 opacity-90">{slide.tagline}</p>}
            {slide.title && <h2 className="text-3xl md:text-5xl font-bold">{slide.title}</h2>}
          </div>
        )}

        {/* Navigation Arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/80 hover:bg-white text-[#181512] p-2 rounded-full transition-all"
              aria-label="Previous slide"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/80 hover:bg-white text-[#181512] p-2 rounded-full transition-all"
              aria-label="Next slide"
            >
              <ChevronRight size={24} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentSlide ? 'bg-white w-8' : 'bg-white/50'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
