import { Lookbook, Product, Testimonial, AnalyticsStats, SiteSettings, HeroSlide, AffiliateProgram, Merchant } from '@/types';
import { hasBackend, readOrSnapshot, STATIC_WRITE_ERROR } from './staticData';
import { imageSource, heroFallbackSource, testimonialAvatarSource } from './imageModel';

// ---------------------------------------------------------------------------
// Admin session handling
//
// The server is authoritative: every mutating request carries a signed Bearer
// token issued by POST /api/admin/verify. The browser only mirrors UI state,
// and any 401 drops the token and notifies the shell so it re-prompts instead
// of showing an admin view that can no longer write.
// ---------------------------------------------------------------------------
const TOKEN_KEY = 'muiro_admin_token';

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private browsing) */
  }
}

/** Wraps fetch with the session token and broadcasts expiry to the shell. */
async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {  const token = getAdminToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    setAdminToken(null);
    try {
      sessionStorage.removeItem('muiro_admin_auth');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('muiro:unauthorized'));
  }
  return res;
}

/**
 * Guards every mutating request. A static host has no API, and its SPA
 * fallback answers unknown paths with index.html + 200, so without this check
 * writes would either 401-loop or throw an unreadable JSON parse error.
 * Rejections surface through the admin panel's existing error display.
 */
async function requireWriteBackend(): Promise<void> {
  if (!(await hasBackend())) throw new Error(STATIC_WRITE_ERROR);
}

/** Last server-provided reason from a failed /api/admin/verify attempt. */
let lastVerifyError: string | null = null;
export function getLastVerifyError(): string | null {
  return lastVerifyError;
}
export function clearLastVerifyError(): void {
  lastVerifyError = null;
}

/** Parses a JSON body, or null when the response is not JSON (e.g. an SPA
 *  fallback serving index.html for an unknown/old route). */
async function parseJsonSafe(res: Response): Promise<any | null> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Reads a File as a base64 string with the data URL prefix stripped. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.onabort = () => reject(new Error('File reading was aborted'));
    reader.readAsDataURL(file);
  });
}

/** True when a user-supplied image value is a site-relative path or an
 *  http(s) URL. Anything else (e.g. a Windows path like `C:\Users\...`) fails
 *  validation and is surfaced as an error state in the Admin UI. */
export function isValidImageUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('./')) return false;
  if (value.startsWith('/')) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export const api = {
  /**
   * Uploads an image file to the server and returns its public URL plus
   * metadata. The file is base64-transported so no additional multipart
   * dependency is needed; the server validates the actual bytes.
   */
  async uploadImage(file: File): Promise<{ url: string; name: string; mime: string; size: number }> {
    await requireWriteBackend();
    const base64 = await readFileAsBase64(file);
    const res = await authFetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: base64, filename: file.name, mimeType: file.type })
    });
    const body = await parseJsonSafe(res);
    if (!res.ok) throw new Error(body?.error || 'Failed to upload image');
    return body;
  },

  // Hero Slides
  async getHeroSlides(): Promise<HeroSlide[]> {
    const slides = await readOrSnapshot<HeroSlide[]>(() => authFetch('/api/hero-slides'), (s) => s.heroSlides, 'Failed to fetch hero slides');
    return (slides || []).map((s) => ({
      ...s,
      image: imageSource(s) || s.image || '',
      fallbackImage: heroFallbackSource(s) || s.fallbackImage || undefined
    }));
  },

  async createHeroSlide(data: Partial<HeroSlide>): Promise<HeroSlide> {
    await requireWriteBackend();
    const res = await authFetch('/api/hero-slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create hero slide');
    }
    return res.json();
  },

  async updateHeroSlide(id: string, data: Partial<HeroSlide>): Promise<HeroSlide> {
    await requireWriteBackend();
    const res = await authFetch(`/api/hero-slides/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update hero slide');
    }
    return res.json();
  },

  async deleteHeroSlide(id: string): Promise<void> {
    await requireWriteBackend();
    const res = await authFetch(`/api/hero-slides/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete hero slide');
  },

  async updateAllHeroSlides(slides: HeroSlide[]): Promise<HeroSlide[]> {
    await requireWriteBackend();
    const res = await authFetch('/api/hero-slides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides })
    });
    if (!res.ok) throw new Error('Failed to save slides order');
    return res.json();
  },

  // Admin PIN & Security
  // NOTE: the server never returns the PIN itself. Reports only whether a
  // passcode is configured and how long it is -- never the value.
  async getAdminPinStatus(): Promise<{ configured: boolean; length: number }> {
    try {
      const res = await authFetch('/api/admin/pin');
      if (res.ok) {
        const data = await res.json();
        return { configured: Boolean(data.configured), length: Number(data.length) || 0 };
      }
    } catch {
      // fall through to a neutral default
    }
    return { configured: true, length: 0 };
  },

  /** Revalidates a stored token on boot; false means the shell must log out. */
  async getSessionStatus(): Promise<boolean> {
    if (!getAdminToken()) return false;
    try {
      const res = await authFetch('/api/admin/session');
      return res.ok;
    } catch {
      // Network error: keep the current UI state rather than force-logout.
      return true;
    }
  },

  /**
   * Exchanges a credential for a signed session token.
   * Deliberately uses plain fetch: a wrong passcode is a 401 and must not be
   * mistaken for an expired session (which would broadcast a spurious logout).
   */
  async verifyAdminCredential(credential: string): Promise<boolean> {
    lastVerifyError = null;
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });
      const data = await parseJsonSafe(res);
      if (res.ok && data?.success && data.token) {
        setAdminToken(data.token);
        sessionStorage.setItem('muiro_admin_auth', 'true');
        return true;
      }
      // Capture the server's reason so the UI can surface it instead of
      // throwing a generic message.
      if (data?.error) lastVerifyError = data.error;
      // No offline fallback: the server is the only authority.
      return false;
    } catch {
      // Network unavailable -- never accept a credential offline.
      return false;
    }
  },

  async updateAdminPin(newPin: string): Promise<void> {    const res = await authFetch('/api/admin/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin })
    });
    const data = await res.json().catch(() => ({} as { error?: string; token?: string }));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update admin PIN');
    }
    // The server rotates its signing secret, so adopt the freshly issued token
    // instead of holding one that has just been revoked.
    if (data.token) setAdminToken(data.token);
  },

  async resetAdminPinWithAuth(authCodeOrKey: string, newPin: string): Promise<void> {
    const res = await authFetch('/api/admin/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authCodeOrKey, newPin })
    });
    const data = await res.json().catch(() => ({} as { error?: string; token?: string }));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset admin PIN. Invalid Authenticator code.');
    }
    if (data?.token) {
      setAdminToken(data.token);
      sessionStorage.setItem('muiro_admin_auth', 'true');
    }
  },

  // Authenticator (phone app / TOTP)
  // The secret is never cached in the browser: it is admin-only server state
  // and is fetched (authenticated) only when the security panel is open.
  async getAuthenticatorConfig(): Promise<{ secret: string; enabled: boolean; account: string; issuer: string }> {
    const res = await authFetch('/api/admin/authenticator');
    if (!res.ok) {
      throw new Error('Could not load authenticator configuration');
    }
    return res.json();
  },

  async updateAuthenticatorConfig(secret: string, enabled = true): Promise<{ success: boolean; secret: string; enabled: boolean }> {
    const res = await authFetch('/api/admin/authenticator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, enabled })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update authenticator configuration');
    }
    const data = await res.json();
    // Server rotated its signing secret -- adopt the replacement token.
    if (data?.token) setAdminToken(data.token);
    return data;
  },

  async resetAuthenticatorConfig(): Promise<{ success: boolean; secret: string; enabled: boolean }> {
    const res = await authFetch('/api/admin/authenticator/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset authenticator configuration');
    const data = await res.json();
    if (data?.token) setAdminToken(data.token);
    return data;
  },

  // Site Settings (About & Affiliate Disclosure)
  async getSettings(): Promise<SiteSettings> {
    return readOrSnapshot<SiteSettings>(() => authFetch('/api/settings'), (s) => s.settings, 'Failed to fetch site settings');
  },

  async updateSettings(data: Partial<SiteSettings>): Promise<SiteSettings> {
    await requireWriteBackend();
    const res = await authFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update site settings');
    }
    return res.json();
  },

  // Affiliate programs & merchants
  async getAffiliatePrograms(): Promise<AffiliateProgram[]> {
    return readOrSnapshot<AffiliateProgram[]>(() => authFetch('/api/affiliate-programs'), () => undefined, 'Failed to fetch affiliate programs');
  },
  async createAffiliateProgram(data: Omit<AffiliateProgram, 'id'>): Promise<AffiliateProgram> {
    await requireWriteBackend();
    const res = await authFetch('/api/affiliate-programs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await parseJsonSafe(res);
    if (!res.ok) throw new Error(body?.error || 'Failed to create affiliate program');
    return body;
  },
  async updateAffiliateProgram(id: string, data: Partial<AffiliateProgram>): Promise<AffiliateProgram> {
    await requireWriteBackend();
    const res = await authFetch(`/api/affiliate-programs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await parseJsonSafe(res);
    if (!res.ok) throw new Error(body?.error || 'Failed to update affiliate program');
    return body;
  },
  async deleteAffiliateProgram(id: string): Promise<void> {
    await requireWriteBackend();
    const res = await authFetch(`/api/affiliate-programs/${id}`, { method: 'DELETE' });
    const body = await parseJsonSafe(res);
    if (!res.ok) throw new Error(body?.error || 'Cannot delete affiliate program');
  },
  async getMerchants(): Promise<Merchant[]> {
    return readOrSnapshot<Merchant[]>(() => authFetch('/api/merchants'), () => undefined, 'Failed to fetch merchants');
  },
  async createMerchant(data: Omit<Merchant, 'id'>): Promise<Merchant> {
    await requireWriteBackend();
    const res = await authFetch('/api/merchants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await parseJsonSafe(res);
    if (!res.ok) throw new Error(body?.error || 'Failed to create merchant');
    return body;
  },
  async updateMerchant(id: string, data: Partial<Merchant>): Promise<Merchant> {
    await requireWriteBackend();
    const res = await authFetch(`/api/merchants/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await parseJsonSafe(res);
    if (!res.ok) throw new Error(body?.error || 'Failed to update merchant');
    return body;
  },
  async deleteMerchant(id: string): Promise<void> {
    await requireWriteBackend();
    const res = await authFetch(`/api/merchants/${id}`, { method: 'DELETE' });
    const body = await parseJsonSafe(res);
    if (!res.ok) throw new Error(body?.error || 'Cannot delete merchant');
  },

  // Lookbooks
  async getLookbooks(): Promise<Lookbook[]> {
    const list = await readOrSnapshot<Lookbook[]>(() => authFetch('/api/lookbooks'), (s) => s.lookbooks, 'Failed to fetch lookbooks');
    return (list || []).map((l) => ({ ...l, cover: imageSource(l) || l.cover || '' }));
  },

  async createLookbook(data: Partial<Lookbook>): Promise<Lookbook> {
    await requireWriteBackend();
    const res = await authFetch('/api/lookbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create lookbook');
    }
    return res.json();
  },

  async updateLookbook(id: string, data: Partial<Lookbook>): Promise<Lookbook> {
    await requireWriteBackend();
    const res = await authFetch(`/api/lookbooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update lookbook');
    }
    return res.json();
  },

  async deleteLookbook(id: string): Promise<void> {
    await requireWriteBackend();
    const res = await authFetch(`/api/lookbooks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete lookbook');
  },

  // Products
  async getProducts(): Promise<Product[]> {
    const list = await readOrSnapshot<Product[]>(() => authFetch('/api/products'), (s) => s.products, 'Failed to fetch products');
    return (list || []).map((p) => ({ ...p, image: imageSource(p) || p.image || '' }));
  },

  async createProduct(data: Partial<Product>): Promise<Product> {
    await requireWriteBackend();
    const res = await authFetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create product');
    }
    return res.json();
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    await requireWriteBackend();
    const res = await authFetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update product');
    }
    return res.json();
  },

  async deleteProduct(id: string): Promise<void> {
    await requireWriteBackend();
    const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete product');
  },

  // Testimonials
  async getTestimonials(): Promise<Testimonial[]> {
    const list = await readOrSnapshot<Testimonial[]>(() => authFetch('/api/testimonials'), (s) => s.testimonials, 'Failed to fetch testimonials');
    return (list || []).map((t) => ({ ...t, avatar: testimonialAvatarSource(t) || t.avatar || '' }));
  },

  async createTestimonial(data: Partial<Testimonial>): Promise<Testimonial> {
    await requireWriteBackend();
    const res = await authFetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create testimonial');
    }
    return res.json();
  },

  async updateTestimonial(id: string, data: Partial<Testimonial>): Promise<Testimonial> {
    await requireWriteBackend();
    const res = await authFetch(`/api/testimonials/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update testimonial');
    }
    return res.json();
  },

  async deleteTestimonial(id: string): Promise<void> {
    await requireWriteBackend();
    const res = await authFetch(`/api/testimonials/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete testimonial');
  },

  // Impression Tracker
  async recordImpression(lookId?: string): Promise<void> {
    try {
      await fetch('/api/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookId })
      });
    } catch {
      // Non-blocking
    }
  },

  // Secure Affiliate Click Handler
  async handleAffiliateClick(productId: string, lookId?: string, source = 'web_lookbook'): Promise<{ safeUrl: string; clickId: string; merchant: string }> {
    const res = await authFetch('/api/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, lookId, source })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to verify secure link');
    }
    return res.json();
  },

  // Analytics Stats
  async getAnalytics(): Promise<AnalyticsStats> {
    return readOrSnapshot<AnalyticsStats>(() => authFetch('/api/stats'), (s) => s.stats, 'Failed to fetch analytics');
  },

  // Reset Demo
  async resetDemo(): Promise<void> {
    await requireWriteBackend();
    const res = await authFetch('/api/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset demo data');
  }
};
