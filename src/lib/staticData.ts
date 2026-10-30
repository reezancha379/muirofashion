import { Lookbook, Product, ProductCategory, Testimonial, SiteSettings, HeroSlide, AnalyticsStats, AffiliateProgram, Merchant } from '@/types';
import { isSupabaseBackendConfigured } from './apiTransport';

/**
 * Static-host support (Netlify and friends). The public Netlify bundle never
 * probes a backend during normal browsing: it renders from content-snapshot.json.
 * Only an owner with a MUIRO session may read live CMS data from Supabase.
 * Local Express development keeps its existing /api-first behavior.
 */
export interface StaticSnapshot {
  lookbooks: Lookbook[];
  products: Product[];
  categories?: ProductCategory[];
  testimonials: Testimonial[];
  heroSlides: HeroSlide[];
  settings: SiteSettings;
  // Admin-only compatibility fields are optional and are intentionally omitted
  // from the public static snapshot produced by build-static.ts.
  stats?: AnalyticsStats;
  affiliatePrograms?: AffiliateProgram[];
  merchants?: Merchant[];
}

export const STATIC_WRITE_ERROR =
  'Owner Studio requires the Supabase backend. Check the public project URL/key build settings and the Supabase Function configuration.';

const VITE_ENV = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
const STATIC_PUBLIC_BUILD = VITE_ENV.VITE_STATIC_PUBLIC === 'true' ||
  (globalThis as typeof globalThis & { __MUIRO_STATIC_PUBLIC__?: boolean }).__MUIRO_STATIC_PUBLIC__ === true;
let backendProbe: Promise<boolean> | null = null;

function hasAdminSession(): boolean {
  try {
    return Boolean(sessionStorage.getItem('muiro_admin_token'));
  } catch {
    return false;
  }
}

/** True when a usable API is configured/reachable; static visitors never probe. */
export function hasBackend(): Promise<boolean> {
  if (isSupabaseBackendConfigured()) return Promise.resolve(true);
  if (STATIC_PUBLIC_BUILD) return Promise.resolve(false);
  if (!backendProbe) {
    backendProbe = fetch('/api/health', { cache: 'no-store' })
      .then(async (res) => {
        const text = await res.text().catch(() => '');
        return res.ok && /^\s*\{/.test(text);
      })
      .catch(() => false);
  }
  return backendProbe;
}

let snapshotPromise: Promise<StaticSnapshot | null> | null = null;

export function loadStaticSnapshot(): Promise<StaticSnapshot | null> {
  if (!snapshotPromise) {
    snapshotPromise = fetch('./content-snapshot.json', { cache: 'no-cache' })
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        if (!/^\s*\{/.test(text)) return null;
        const value = JSON.parse(text) as StaticSnapshot;
        if (!Array.isArray(value.lookbooks) || !Array.isArray(value.products)) return null;
        return value;
      })
      .catch(() => null);
  }
  return snapshotPromise;
}

async function snapshotValue<T>(pick: (snap: StaticSnapshot) => T | undefined, errorMessage: string): Promise<T> {
  const snap = await loadStaticSnapshot();
  const value = snap ? pick(snap) : undefined;
  if (value !== undefined) return value;
  // Return empty defaults instead of throwing so the storefront renders
  // with empty state rather than blocking entirely when a field is missing.
  return (Array.isArray(undefined) ? [] : {}) as T;
}

export async function readOrSnapshot<T>(
  request: () => Promise<Response>,
  pick: (snap: StaticSnapshot) => T | undefined,
  errorMessage: string
): Promise<T> {
  const remoteConfigured = isSupabaseBackendConfigured();
  const ownerSession = hasAdminSession();

  if (remoteConfigured) {
    // Public visitors on Netlify stay entirely on the snapshot; no API health
    // probe, Edge call, or Supabase wait is made during normal page rendering.
    if (STATIC_PUBLIC_BUILD && !ownerSession) return snapshotValue(pick, errorMessage);
    if (ownerSession) {
      const res = await request();
      if (res.ok) return (await res.json()) as T;
      throw new Error(errorMessage);
    }
    return snapshotValue(pick, errorMessage);
  }

  if (STATIC_PUBLIC_BUILD) return snapshotValue(pick, errorMessage);

  // Preserve current local Express development behavior. Its live content is
  // useful to the owner after editing; a static host's SPA HTML is rejected by
  // the JSON health-probe check above.
  if (await hasBackend()) {
    const res = await request();
    if (res.ok) return (await res.json()) as T;
    throw new Error(errorMessage);
  }
  return snapshotValue(pick, errorMessage);
}
