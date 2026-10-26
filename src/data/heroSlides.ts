import { HeroSlide } from '@/types';

/**
 * Client-side hero slide resolution.
 *
 * IMPORTANT: this module intentionally contains NO hard-coded slide data.
 * The server data store (`data/store.json`) is the single source of truth for
 * hero slides — the admin panel edits them and the public Hero renders the
 * exact same persisted records. Static seed data lives server-side in
 * `server/database/dataStore.ts::INITIAL_HERO_SLIDES` and is only used on first
 * run / when no CMS slides exist.
 */

/**
 * True when a slide has enough persisted content to render (a title + an
 * image or fallback). Slides missing both are filtered out.
 */
export const isRenderableHeroSlide = (slide?: HeroSlide | null): boolean =>
  Boolean(slide && slide.title && (slide.image || slide.fallbackImage));

/**
 * Normalizes/filters a slide list from the CMS:
 *  1. drops records with no renderable content,
 *  2. prefers active slides, and
 *  3. orders by the persisted `order` field.
 * No hard-coded defaults are merged in, so CMS content is never silently
 * overwritten by this module.
 */
export const resolveHeroSlides = (slides?: HeroSlide[]): HeroSlide[] => {
  const source = Array.isArray(slides) ? slides : [];
  const renderable = source.filter(isRenderableHeroSlide);
  const active = renderable.filter(s => s.isActive !== false);
  const chosen = active.length > 0 ? active : renderable;
  return [...chosen].sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
  );
};
