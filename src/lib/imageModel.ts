/**
 * Shared image normalization layer.
 *
 * Every MUIRO entity stores its image in ONE canonical field:
 *
 *   Product.image | Lookbook.cover | HeroSlide.image | Testimonial.avatar
 *
 * The same value is what Admin Studio writes and every public renderer reads.
 * Legacy / hand-edited JSON records (or past versions) may carry alternates
 * such as `imageUrl`, `image_url`, `coverImage`, `coverImageUrl`,
 * `thumbnail`, `src`, or `hero`. These helpers map all of them onto the
 * canonical field when loading, so a single rule ("read field X") applies
 * everywhere and old records are never broken by a rename.
 */

type ImageAliasRecord = {
  image?: string;
  imageUrl?: string;
  image_url?: string;
  coverImage?: string;
  coverImageUrl?: string;
  thumbnail?: string;
  src?: string;
  cover?: string;
  hero?: string;
} | null | undefined;

/** Canonical image value for Product / Lookbook / HeroSlide entities. */
export function imageSource(raw: ImageAliasRecord): string {
  if (!raw) return '';
  const candidates = [
    raw.image,
    raw.cover,
    raw.src,
    raw.imageUrl,
    raw.coverImage,
    raw.coverImageUrl,
    raw.image_url,
    raw.thumbnail,
    raw.hero
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/** Canonical fallback image value for Hero slides (fallbackImage). */
export function heroFallbackSource(raw: { fallbackImage?: string; fallback?: string } | null | undefined): string {
  if (!raw) return '';
  for (const c of [raw.fallbackImage, raw.fallback]) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/** Canonical avatar value for Testimonials (avatar). */
export function testimonialAvatarSource(raw: { avatar?: string; avatarUrl?: string } | null | undefined): string {
  if (!raw) return '';
  for (const c of [raw.avatar, raw.avatarUrl]) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}
