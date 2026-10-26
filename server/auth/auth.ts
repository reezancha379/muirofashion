import crypto from 'crypto';

/**
 * Admin authentication primitives:
 *   - scrypt PIN hashing (never store or compare a raw passcode)
 *   - HMAC-signed, stateless session tokens (no server-side session table)
 *   - failure-based lockout for credential endpoints
 *
 * Deliberately free of any data-store import so it stays trivially testable.
 */

// ---------------------------------------------------------------------------
// Constant-time string comparison
// ---------------------------------------------------------------------------
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Burn a comparison of equal-length buffers so callers still cost something.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// PIN hashing (scrypt + per-pin salt)
// ---------------------------------------------------------------------------
const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = { N: 16384, r: 8, p: 1 };

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .scryptSync(pin.normalize(), salt, SCRYPT_KEYLEN, { ...SCRYPT_COST, maxmem: 64 * 1024 * 1024 })
    .toString('hex');
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

export function isHashedPin(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith(`${SCRYPT_PREFIX}$`);
}

/**
 * Verifies a candidate passcode against a stored credential.
 * Supports the legacy plaintext form so an existing `adminPin` keeps working
 * until `migratePinAtRest` rewrites it on first boot.
 */
export function verifyPin(stored: string, candidate: string): boolean {
  if (!stored || typeof candidate !== 'string' || candidate.length === 0) return false;

  if (isHashedPin(stored)) {
    const [, salt, expected] = stored.split('$');
    if (!salt || !expected) return false;
    const actual = crypto
      .scryptSync(candidate.normalize(), salt, SCRYPT_KEYLEN, { ...SCRYPT_COST, maxmem: 64 * 1024 * 1024 })
      .toString('hex');
    return timingSafeEqualString(actual, expected);
  }

  // Legacy plaintext credential stored by an older build.
  return timingSafeEqualString(stored, candidate);
}

// ---------------------------------------------------------------------------
// HMAC-signed session tokens
// ---------------------------------------------------------------------------
export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
  jti: string;
}

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours, per spec

export function generateSessionSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * A random Base32 secret for TOTP authenticators.
 *
 * The previous install shipped a fixed public default that was also compiled
 * into the browser bundle, which meant anyone could compute a valid login
 * code from downloaded JavaScript. A per-install random value removes that
 * entire attack surface: the secret only ever lives in the server-side store.
 *
 * Uses rejection sampling (bytes 0-247 map onto 32 symbols with no bias).
 */
export function generateTotpSecret(length: number = 32): string {
  let out = '';
  while (out.length < length) {
    const batch = crypto.randomBytes(length);
    for (const byte of batch) {
      if (byte < 248) {
        out += BASE32_ALPHABET[byte % 32];
        if (out.length === length) break;
      }
    }
  }
  return out;
}

function hmac(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function signSessionToken(secret: string, ttlMs: number = SESSION_TTL_MS): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: 'admin',
    iat: now,
    exp: now + Math.floor(ttlMs / 1000),
    jti: crypto.randomBytes(8).toString('hex'),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${hmac(secret, body)}`;
}

/**
 * Validates a token. Returns the decoded payload, or null when the signature
 * does not match, the payload is malformed, or the token has expired.
 */
export function verifySessionToken(secret: string, token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  if (!timingSafeEqualString(hmac(secret, body), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload || typeof payload.exp !== 'number') return null;
    if (payload.sub !== 'admin') return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extracts a Bearer token from an Authorization header. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Credential-endpoint lockout (brute force protection)
// ---------------------------------------------------------------------------
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES_PER_WINDOW = 10;

interface FailureBucket {
  count: number;
  windowStart: number;
  lockedUntil: number;
}

const failures = new Map<string, FailureBucket>();

// Prune stale buckets; unref so a pending timer never keeps the process alive.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of failures) {
    if (now > bucket.windowStart + AUTH_WINDOW_MS && now > bucket.lockedUntil) {
      failures.delete(key);
    }
  }
}, 60 * 1000);
sweeper.unref?.();

export function getAuthLockoutSeconds(key: string): number {
  const bucket = failures.get(key);
  if (!bucket) return 0;
  const now = Date.now();
  if (bucket.lockedUntil > now) return Math.ceil((bucket.lockedUntil - now) / 1000);
  if (now > bucket.windowStart + AUTH_WINDOW_MS) {
    failures.delete(key);
    return 0;
  }
  return 0;
}

/** Records a failed credential attempt. Returns remaining lockout seconds. */
export function recordAuthFailure(key: string): number {
  const now = Date.now();
  let bucket = failures.get(key);

  if (!bucket || now > bucket.windowStart + AUTH_WINDOW_MS) {
    bucket = { count: 0, windowStart: now, lockedUntil: 0 };
    failures.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count >= MAX_FAILURES_PER_WINDOW) {
    bucket.lockedUntil = bucket.windowStart + AUTH_WINDOW_MS;
    failures.delete(key);
    failures.set(key, { ...bucket });
    return Math.ceil(AUTH_WINDOW_MS / 1000);
  }
  return 0;
}

export function clearAuthFailures(key: string): void {
  failures.delete(key);
}
