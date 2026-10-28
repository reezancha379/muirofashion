const VITE_ENV = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
const SUPABASE_URL = (VITE_ENV.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY = (
  VITE_ENV.VITE_SUPABASE_PUBLISHABLE_KEY ||
  VITE_ENV.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export function isSupabaseBackendConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function isSupabaseProjectUrlConfigured(): boolean {
  return Boolean(SUPABASE_URL);
}

export function canSendPublicEvents(): boolean {
  const staticBuild = VITE_ENV.VITE_STATIC_PUBLIC === 'true' ||
    (globalThis as typeof globalThis & { __MUIRO_STATIC_PUBLIC__?: boolean }).__MUIRO_STATIC_PUBLIC__ === true;
  return isSupabaseBackendConfigured() || !staticBuild;
}

function endpoint(path: string): string {
  if (!isSupabaseBackendConfigured()) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SUPABASE_URL}/functions/v1/muiro-api${normalized}`;
}

/**
 * Shared transport for both the local Express API and Supabase Edge Function.
 * The Supabase publishable key identifies the project; the custom MUIRO HMAC
 * session is deliberately sent in x-muiro-session, never as a gateway JWT.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  adminToken?: string | null,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (isSupabaseBackendConfigured()) {
    headers.set('apikey', SUPABASE_PUBLISHABLE_KEY);
    if (adminToken) headers.set('x-muiro-session', adminToken);
  } else if (adminToken) {
    // Local Express keeps its existing same-origin Bearer-token contract.
    headers.set('Authorization', `Bearer ${adminToken}`);
  }
  return fetch(endpoint(path), { ...init, headers });
}
