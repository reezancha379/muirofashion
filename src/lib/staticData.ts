import { Lookbook, Product, Testimonial, SiteSettings, HeroSlide, AnalyticsStats, AffiliateProgram, Merchant } from '@/types';

/**
 * Static-host support (Netlify and friends).
 *
 * The full-stack build serves JSON from Express at /api/*. A static host has
 * no server, and its SPA fallback answers every unknown path -- including
 * /api/* -- with index.html and status 200. So "did the request succeed" is
 * NOT a usable signal there; only the response *shape* is. We probe once for a
 * JSON health check and remember the answer for the lifetime of the page.
 *
 * When no backend is present, reads fall back to a build-time snapshot of the
 * content (public/content-snapshot.json) so the storefront still renders real
 * lookbooks and products instead of an empty screen. Writes are impossible
 * without a server and report that plainly rather than failing cryptically.
 */

export interface StaticSnapshot {
  lookbooks: Lookbook[];
  products: Product[];
  testimonials: Testimonial[];
  heroSlides: HeroSlide[];
  settings: SiteSettings;
  stats: AnalyticsStats;
  affiliatePrograms: AffiliateProgram[];
  merchants: Merchant[];
}

/** Message shown when someone tries to edit from a static deployment. */
export const STATIC_WRITE_ERROR =
  'Content editing needs the MUIRO server. This deployment is static (no backend), so saves are unavailable. Run "node --import tsx server.ts" locally to edit.';

let backendProbe: Promise<boolean> | null = null;

/** True when a real JSON API is reachable; memoised after the first call. */
export function hasBackend(): Promise<boolean> {
  if (!backendProbe) {
    backendProbe = fetch('/api/health', { cache: 'no-store' })
      .then(async (res) => {
        const text = await res.text().catch(() => '');
        // Static hosts return index.html with 200 for unknown paths, so require
        // both a 2xx status and a JSON body.
        return res.ok && /^\s*\{/.test(text);
      })
      .catch(() => false);
  }
  return backendProbe;
}

let snapshotPromise: Promise<StaticSnapshot | null> | null = null;

/** Loads the build-time content snapshot, or null when none was shipped. */
export function loadStaticSnapshot(): Promise<StaticSnapshot | null> {
  if (!snapshotPromise) {
    snapshotPromise = fetch('./content-snapshot.json', { cache: 'no-cache' })
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        if (!/^\s*\{/.test(text)) return null; // got index.html back instead
        return JSON.parse(text) as StaticSnapshot;
      })
      .catch(() => null);
  }
  return snapshotPromise;
}

/**
 * Resolves a read against the API, falling back to the snapshot when there is
 * no backend. `pick` selects this endpoint's slice of the snapshot.
 */
export async function readOrSnapshot<T>(
  request: () => Promise<Response>,
  pick: (snap: StaticSnapshot) => T | undefined,
  errorMessage: string
): Promise<T> {
  if (await hasBackend()) {
    const res = await request();
    if (res.ok) return (await res.json()) as T;
    throw new Error(errorMessage);
  }

  const snap = await loadStaticSnapshot();
  const value = snap ? pick(snap) : undefined;
  if (value !== undefined) return value;
  throw new Error(errorMessage);
}
