import { Lookbook, Product, ProductCategory, Testimonial, SiteSettings, HeroSlide, AnalyticsStats, AffiliateProgram, Merchant } from '@/types';
import { apiFetch, canSendPublicEvents, isSupabaseBackendConfigured } from './apiTransport';

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
  categories?: ProductCategory[];
  testimonials: Testimonial[];
  heroSlides: HeroSlide[];
  settings: SiteSettings;
  stats: AnalyticsStats;
  affiliatePrograms: AffiliateProgram[];
  merchants: Merchant[];
}

/** Message shown when someone tries to edit from a static deployment. */
export const STATIC_WRITE_ERROR =
  'Content editing needs the MUIRO Supabase backend. This static deployment has no configured admin API, so saves are unavailable.';

let backendProbe: Promise<boolean> | null = null;

/** True when a real JSON API is reachable; memoised after the first call. */
export function hasBackend(): Promise<boolean> {
  if (isSupabaseBackendConfigured()) return Promise.resolve(true);
  if (!canSendPublicEvents()) return Promise.resolve(false);
  if (!backendProbe) {
    backendProbe = apiFetch('/api/health', { cache: 'no-store' })
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

const STATIC_PUBLIC_BUILD = Boolean((globalThis as any).__MUIRO_STATIC_PUBLIC__) ||
  Boolean((import.meta as any).env?.VITE_STATIC_PUBLIC);
function hasAdminSession(): boolean {
  try { return Boolean(sessionStorage.getItem('muiro_admin_token')); } catch { return false; }
}

/** Loads the build-time content snapshot, or null when none was shipped. */
export function loadStaticSnapshot(): Promise<StaticSnapshot | null> {
  if (!snapshotPromise) {
    snapshotPromise = fetch('/content-snapshot.json', { cache: 'no-cache' })
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
 * Resolves a public read against the API, falling back to the shipped snapshot
 * when there is no backend or a configured API is temporarily unavailable.
 * `pick` selects this endpoint's slice of the snapshot.
 */
export async function readOrSnapshot<T>(
  request: () => Promise<Response>,
  pick: (snap: StaticSnapshot) => T | undefined,
  errorMessage: string
): Promise<T> {
  if (STATIC_PUBLIC_BUILD && !hasAdminSession()) {
    const snap = await loadStaticSnapshot();
    const value = snap ? pick(snap) : undefined;
    if (value !== undefined) return value;
    throw new Error(errorMessage);
  }
  if (await hasBackend()) {
    try {
      const res = await request();
      if (res.ok) return (await res.json()) as T;
    } catch {
      // Keep the public storefront readable from its last published snapshot.
    }
  }

  const snap = await loadStaticSnapshot();
  const value = snap ? pick(snap) : undefined;
  if (value !== undefined) return value;
  throw new Error(errorMessage);
}
