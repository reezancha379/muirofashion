import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import net from 'net';
import { createServer as createViteServer } from 'vite';
import { store } from './server/database/dataStore';
import {
  extractClientMetadata,
  checkRateLimit,
  sanitizeAffiliateUrl,
  isCrawlerOrBot
} from './server/security/affiliateSecurity';
import {
  verifyPin,
  signSessionToken,
  verifySessionToken,
  extractBearerToken,
  getAuthLockoutSeconds,
  recordAuthFailure,
  clearAuthFailures,
  SESSION_TTL_MS
} from './server/auth/auth';

const DEFAULT_PORT = 3000;

/**
 * Checks whether a TCP port is actually free on the address that `localhost`
 * resolves to. This matters because another process can hold `127.0.0.1:3000`
 * while `0.0.0.0:3000` still binds successfully -- and on Windows the more
 * specific `127.0.0.1` binding wins for `localhost` requests, silently hijacking
 * every browser request away from this server.
 */
function isPortFreeOnLocalhost(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
}

/**
 * Resolves a usable port. If the preferred port is squatted (commonly by the
 * VS Code Live Preview extension, which serves raw .tsx source as text/plain and
 * breaks ES module loading), fall back to the next free port and say so loudly.
 */
async function resolvePort(preferred: number, allowFallback: boolean): Promise<number> {
  if (await isPortFreeOnLocalhost(preferred)) return preferred;

  if (!allowFallback) {
    throw new Error(
      `Port ${preferred} is already in use on 127.0.0.1 (often VS Code Live Preview). ` +
        `Close that server, or run with PORT=<other-port>.`
    );
  }

  console.warn(
    `\n[port] WARNING: 127.0.0.1:${preferred} is already in use by another process ` +
      `(usually the VS Code "Live Preview" extension).\n` +
      `[port] That server serves raw .tsx files as "text/plain", which makes the browser reject ` +
      `module scripts.\n[port] Falling back to the next free port.\n`
  );

  for (let candidate = preferred + 1; candidate <= preferred + 20; candidate++) {
    if (await isPortFreeOnLocalhost(candidate)) return candidate;
  }

  throw new Error(`No free port found in range ${preferred}-${preferred + 20}.`);
}

async function startServer() {
  const app = express();

  // Never trust X-Forwarded-For unless MUIRO is actually behind a trusted
  // reverse proxy. This keeps rate limiting and analytics IP attribution from
  // being trivially spoofed by clients.
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

  // --- Admin session state -------------------------------------------------
  // Declared ahead of every route so all guards can reference it.
  let sessionSecret = store.getSessionSecret();

  /**
   * Rotating the signing secret invalidates every token issued so far, so a
   * passcode change or authenticator re-pair immediately logs out all other
   * sessions without needing a server-side session table.
   */
  function invalidateAllSessions(): void {
    sessionSecret = store.rotateSessionSecret();
  }

  /**
   * Session guard applied to every mutating admin route.
   * Returns 401 with a stable `code` so the client can discard its token and
   * re-prompt instead of failing silently.
   */
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_SESSION' });
    }
    if (!verifySessionToken(sessionSecret, token)) {
      return res.status(401).json({ error: 'Session expired or invalid', code: 'SESSION_INVALID' });
    }
    next();
  };

  // Middleware
  app.use(express.json());

  // Security Headers for API and Redirects
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // --- API: Affiliate Programs & Merchants ---
  app.get('/api/affiliate-programs', (req, res) => {
    res.json(store.getAffiliatePrograms());
  });
  app.post('/api/affiliate-programs', requireAdmin, (req, res) => {
    const { name, network, website, defaultCommissionRate, disclosure, status } = req.body || {};
    if (!name || !network || !website) return res.status(400).json({ error: 'Name, network, and website are required' });
    try { new URL(website); } catch { return res.status(400).json({ error: 'Website must be a valid URL' }); }
    const created = store.addAffiliateProgram({
      name: String(name).trim(),
      network: String(network).trim(),
      website: String(website).trim(),
      defaultCommissionRate: Number(defaultCommissionRate) || 0,
      disclosure: String(disclosure || '').trim(),
      status: status === 'inactive' ? 'inactive' : 'active'
    });
    res.status(201).json(created);
  });
  app.put('/api/affiliate-programs/:id', requireAdmin, (req, res) => {
    const updates = { ...req.body };
    if (updates.website) { try { new URL(updates.website); } catch { return res.status(400).json({ error: 'Website must be a valid URL' }); } }
    const updated = store.updateAffiliateProgram(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'Affiliate program not found' });
    res.json(updated);
  });
  app.delete('/api/affiliate-programs/:id', requireAdmin, (req, res) => {
    if (!store.deleteAffiliateProgram(req.params.id)) return res.status(409).json({ error: 'Program not found or still assigned to a merchant' });
    res.json({ success: true });
  });

  app.get('/api/merchants', (req, res) => {
    res.json(store.getMerchants());
  });
  app.post('/api/merchants', requireAdmin, (req, res) => {
    const { name, website, affiliateProgramId, status } = req.body || {};
    if (!name || !website) return res.status(400).json({ error: 'Name and website are required' });
    try { new URL(website); } catch { return res.status(400).json({ error: 'Website must be a valid URL' }); }
    if (affiliateProgramId && !store.getAffiliatePrograms().some(p => p.id === affiliateProgramId)) {
      return res.status(400).json({ error: 'Affiliate program not found' });
    }
    const created = store.addMerchant({ name: String(name).trim(), website: String(website).trim(), affiliateProgramId, status: status === 'inactive' ? 'inactive' : 'active' });
    res.status(201).json(created);
  });
  app.put('/api/merchants/:id', requireAdmin, (req, res) => {
    const updates = { ...req.body };
    if (updates.website) { try { new URL(updates.website); } catch { return res.status(400).json({ error: 'Website must be a valid URL' }); } }
    if (updates.affiliateProgramId && !store.getAffiliatePrograms().some(p => p.id === updates.affiliateProgramId)) {
      return res.status(400).json({ error: 'Affiliate program not found' });
    }
    const updated = store.updateMerchant(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'Merchant not found' });
    res.json(updated);
  });
  app.delete('/api/merchants/:id', requireAdmin, (req, res) => {
    if (!store.deleteMerchant(req.params.id)) return res.status(409).json({ error: 'Merchant not found or still assigned to products' });
    res.json({ success: true });
  });

  // --- API: Lookbooks ---
  app.get('/api/lookbooks', (req, res) => {
    res.json(store.getLookbooks());
  });

  app.post('/api/lookbooks', requireAdmin, (req, res) => {
    const { title, board, category, cover, description, authorNote, pieces, featured, isNewlyAdded, isTrending, season } = req.body;
    if (!title || !cover) {
      return res.status(400).json({ error: 'Title and cover URL are required' });
    }
    const created = store.addLookbook({
      title,
      board: board || 'Editorial Lookbook',
      category: category || 'Fashion',
      cover,
      frame: '2-3',
      description: description || '',
      authorNote: authorNote || '',
      pieces: Array.isArray(pieces) ? pieces : [],
      featured: Boolean(featured),
      isNewlyAdded: isNewlyAdded !== undefined ? Boolean(isNewlyAdded) : true,
      isTrending: Boolean(isTrending),
      season: season || 'All-Season'
    });
    res.status(201).json(created);
  });

  app.put('/api/lookbooks/:id', requireAdmin, (req, res) => {
    const updated = store.updateLookbook(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Lookbook not found' });
    }
    res.json(updated);
  });

  app.delete('/api/lookbooks/:id', requireAdmin, (req, res) => {
    const success = store.deleteLookbook(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Lookbook not found' });
    }
    res.json({ success: true });
  });

  // --- API: Products ---
  app.get('/api/products', (req, res) => {
    res.json(store.getProducts());
  });

  app.post('/api/products', requireAdmin, (req, res) => {
    const { title, price, board, category, image, description, affiliateUrl, merchantId, affiliateProgramId, commissionRate, badge } = req.body || {};
    if (!title || !image || !affiliateUrl || !merchantId || !affiliateProgramId) {
      return res.status(400).json({ error: 'Title, image, affiliateUrl, merchant, and affiliate program are required' });
    }

    const { valid, safeUrl, reason } = sanitizeAffiliateUrl(affiliateUrl);
    if (!valid) {
      return res.status(400).json({ error: `Invalid affiliate URL: ${reason}` });
    }

    const merchantRecord = store.getMerchants().find(m => m.id === merchantId);
    if (!merchantRecord) return res.status(400).json({ error: 'Merchant not found' });

    const programRecord = store.getAffiliatePrograms().find(p => p.id === affiliateProgramId);
    if (!programRecord) return res.status(400).json({ error: 'Affiliate program not found' });

    const parsedPrice = parseFloat(String(price ?? '').replace(/[^0-9.]/g, ''));
    const numericPrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;
    const formattedPrice = numericPrice > 0 ? (String(price).startsWith('$') ? String(price) : `$${numericPrice.toFixed(2)}`) : '';

    const created = store.addProduct({
      title: String(title).trim(),
      price: formattedPrice,
      numericPrice,
      board: board || 'Curated Edit',
      category: category || 'Fashion',
      image: String(image).trim(),
      description: String(description || ''),
      affiliateUrl: safeUrl,
      merchant: merchantRecord.name,
      merchantId: merchantRecord.id,
      affiliateProgramId: programRecord.id,
      commissionRate: Number(commissionRate) || programRecord.defaultCommissionRate || 8.0,
      badge: badge || 'Verified Link',
      rating: 5.0,
      reviewCount: 1,
      featured: Boolean(req.body.featured),
      isNewlyAdded: req.body.isNewlyAdded !== undefined ? Boolean(req.body.isNewlyAdded) : true,
      isTrending: Boolean(req.body.isTrending)
    });
    res.status(201).json(created);
  });

  app.put('/api/products/:id', requireAdmin, (req, res) => {
    const updates = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(updates, 'affiliateUrl')) {
      const { valid, safeUrl, reason } = sanitizeAffiliateUrl(updates.affiliateUrl);
      if (!valid) return res.status(400).json({ error: `Invalid affiliate URL: ${reason}` });
      updates.affiliateUrl = safeUrl;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'merchantId')) {
      const merchantRecord = store.getMerchants().find(m => m.id === updates.merchantId);
      if (!merchantRecord) return res.status(400).json({ error: 'Merchant not found' });
      updates.merchantId = merchantRecord.id;
      updates.merchant = merchantRecord.name;
      if (!Object.prototype.hasOwnProperty.call(updates, 'affiliateProgramId') && merchantRecord.affiliateProgramId) {
        updates.affiliateProgramId = merchantRecord.affiliateProgramId;
      }
    } else if (Object.prototype.hasOwnProperty.call(updates, 'merchant')) {
      const merchantRecord = store.getMerchants().find(m => m.name.toLowerCase() === String(updates.merchant).trim().toLowerCase());
      if (!merchantRecord) return res.status(400).json({ error: 'Merchant not found' });
      updates.merchantId = merchantRecord.id;
      updates.merchant = merchantRecord.name;
      if (!Object.prototype.hasOwnProperty.call(updates, 'affiliateProgramId') && merchantRecord.affiliateProgramId) {
        updates.affiliateProgramId = merchantRecord.affiliateProgramId;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'affiliateProgramId')) {
      const programRecord = store.getAffiliatePrograms().find(p => p.id === updates.affiliateProgramId);
      if (!programRecord) return res.status(400).json({ error: 'Affiliate program not found' });
      updates.affiliateProgramId = programRecord.id;
    }

    if (updates.price) {
      const num = parseFloat(String(updates.price).replace(/[^0-9.]/g, ''));
      updates.numericPrice = Number.isFinite(num) ? num : 0;
      updates.price = updates.numericPrice > 0 ? (String(updates.price).startsWith('$') ? updates.price : `$${updates.numericPrice.toFixed(2)}`) : '';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
      updates.description = String(updates.description ?? '');
    }

    const updated = store.updateProduct(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(updated);
  });

  app.delete('/api/products/:id', requireAdmin, (req, res) => {
    const success = store.deleteProduct(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true });
  });

  // --- API: Hero Slides ---
  app.get('/api/hero-slides', (req, res) => {
    res.json(store.getHeroSlides());
  });

  app.post('/api/hero-slides', requireAdmin, (req, res) => {
    const { title, tagline, category, image, fallbackImage, lookId, keyPieces, isActive, order } = req.body;
    if (!title || !image) {
      return res.status(400).json({ error: 'Title and image are required' });
    }
    const created = store.addHeroSlide({
      title,
      tagline: tagline || '',
      category: category || 'Curated Edit',
      image,
      fallbackImage: fallbackImage || image,
      lookId: lookId || undefined,
      keyPieces: Array.isArray(keyPieces) ? keyPieces : [],
      isActive: isActive !== false,
      order: order ? Number(order) : undefined
    });
    res.status(201).json(created);
  });

  app.put('/api/hero-slides/:id', requireAdmin, (req, res) => {
    const updated = store.updateHeroSlide(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Hero slide not found' });
    }
    res.json(updated);
  });

  app.delete('/api/hero-slides/:id', requireAdmin, (req, res) => {
    const success = store.deleteHeroSlide(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Hero slide not found' });
    }
    res.json({ success: true });
  });

  app.put('/api/hero-slides', requireAdmin, (req, res) => {
    const { slides } = req.body;
    if (!Array.isArray(slides)) {
      return res.status(400).json({ error: 'Slides array is required' });
    }
    const saved = store.setHeroSlides(slides);
    res.json(saved);
  });

  // --- Helper: Server-side TOTP Verification ---
  function base32ToBuffer(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = base32.toUpperCase().replace(/[\s=-]/g, '');
    let bits = '';
    for (let i = 0; i < cleaned.length; i++) {
      const val = alphabet.indexOf(cleaned[i]);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }

  /**
   * Emergency recovery override. Only the PIN-reset flow may present it.
   * Overridable via env so it is not a fixed constant baked into every build;
   * the client bundle no longer contains it (an admin reads it from the
   * authenticated /api/admin/authenticator response instead).
   */
  const MASTER_RECOVERY_KEY = process.env.MUIRO_MASTER_KEY?.trim() || '';

  /**
   * RFC 6238 TOTP with a +/-2 step (60s) drift window.
   *
   * Earlier revisions accepted three hardcoded backdoors as credentials
   * (`2026`, `MUIRO-RESET`, and the literal TOTP secret), which meant changing
   * the passcode never actually revoked access. Those are gone; the master
   * recovery key is now reachable only via `allowMasterRecovery`, used
   * exclusively by the identity-verified PIN reset.
   */
  function verifyTotpServer(token: string, secret: string, allowMasterRecovery = false): boolean {
    const cleanToken = token.trim();
    if (!cleanToken) return false;

    if (allowMasterRecovery && MASTER_RECOVERY_KEY && cleanToken.toUpperCase() === MASTER_RECOVERY_KEY.toUpperCase()) {
      return true;
    }

    if (!/^\d{6}$/.test(cleanToken)) return false;

    const cleanSecret = secret.toUpperCase().replace(/\s+/g, '');
    const keyBuffer = base32ToBuffer(cleanSecret);
    if (keyBuffer.length === 0) return false;

    const epoch = Math.floor(Date.now() / 1000);
    const currentStep = Math.floor(epoch / 30);

    for (let offset = -2; offset <= 2; offset++) {
      const step = currentStep + offset;
      const buf = Buffer.alloc(8);
      buf.writeBigUInt64BE(BigInt(step), 0);

      const hmac = crypto.createHmac('sha1', keyBuffer);
      hmac.update(buf);
      const digest = hmac.digest();

      const o = digest[digest.length - 1] & 0x0f;
      const code =
        (((digest[o] & 0x7f) << 24) |
          ((digest[o + 1] & 0xff) << 16) |
          ((digest[o + 2] & 0xff) << 8) |
          (digest[o + 3] & 0xff)) %
        1000000;

      if (code.toString().padStart(6, '0') === cleanToken) {
        return true;
      }
    }
    return false;
  }

  // --- API: Admin Authentication & Security ---
  const AUTH_FLOOD_LIMIT = 10; // credential attempts per IP per minute
  const AUTH_FLOOD_WINDOW = 60_000;

  // Lightweight session probe so the SPA can rehydrate its auth state on load
  // instead of trusting a stale sessionStorage flag.
  app.get('/api/admin/session', requireAdmin, (req, res) => {
    const payload = verifySessionToken(sessionSecret, extractBearerToken(req.header('authorization')));
    res.json({ valid: true, expiresAt: payload ? payload.exp * 1000 : null });
  });

  app.post('/api/admin/verify', (req, res) => {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Credential is required' });
    }

    const meta = extractClientMetadata(req);
    const lockKey = `auth:${meta.ipHash}`;

    // Brute-force protection: failure lockout first, then a per-IP flood cap.
    const lockedFor = getAuthLockoutSeconds(lockKey);
    if (lockedFor > 0) {
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${lockedFor} second(s).`,
        retryAfter: lockedFor
      });
    }
    if (!checkRateLimit(lockKey, AUTH_FLOOD_LIMIT, AUTH_FLOOD_WINDOW).allowed) {
      return res.status(429).json({
        error: 'Too many attempts. Please wait a minute before trying again.',
        retryAfter: 60
      });
    }

    const cred = credential.trim();
    const authConfig = store.getAuthenticatorConfig();

    const pinOk = verifyPin(store.getAdminPin(), cred);
    const totpOk = authConfig.enabled !== false && verifyTotpServer(cred, authConfig.secret);

    if (!pinOk && !totpOk) {
      const retryAfter = recordAuthFailure(lockKey);
      if (retryAfter > 0) {
        return res.status(429).json({
          error: `Too many failed attempts. Locked for ${retryAfter} seconds.`,
          retryAfter
        });
      }
      return res.status(401).json({ error: 'Invalid credentials. If you used your authenticator app, enter the code currently displayed on your phone (it refreshes every 30 seconds) and make sure your phone clock is set to automatic.' });
    }

    clearAuthFailures(lockKey);
    const token = signSessionToken(sessionSecret);
    return res.json({
      success: true,
      verifiedBy: pinOk ? 'pin' : 'authenticator',
      token,
      expiresIn: SESSION_TTL_MS / 1000
    });
  });

  app.get('/api/admin/pin-status', requireAdmin, (req, res) => {
    // Only status is ever returned -- never the passcode itself.
    res.json({ configured: true, length: store.getAdminPinLength() });
  });

  // The client calls GET /api/admin/pin from the admin panel. Never leak the
  // PIN; report only that a passcode is configured and how long it is.
  app.get('/api/admin/pin', requireAdmin, (req, res) => {
    res.json({ configured: true, length: store.getAdminPinLength() });
  });


  app.post('/api/admin/pin', requireAdmin, (req, res) => {
    const { newPin } = req.body;
    if (!newPin || typeof newPin !== 'string' || newPin.trim().length < 4) {
      return res.status(400).json({ error: 'Passcode must be at least 4 characters long' });
    }
    store.setAdminPin(newPin);
    // Changing the passcode revokes every other session token; issue a fresh
    // one for this client so it does not log itself out mid-flow.
    invalidateAllSessions();
    res.json({ success: true, token: signSessionToken(sessionSecret) });
  });

  // Recovery path for a forgotten passcode: deliberately reachable without a
  // session (that is its purpose), but it still demands a valid authenticator
  // code or the master recovery key, and it is rate limited + lockout protected.
  app.post('/api/admin/reset-pin', (req, res) => {
    const { authCodeOrKey, newPin } = req.body;
    const authConfig = store.getAuthenticatorConfig();

    const meta = extractClientMetadata(req);
    const lockKey = `reset:${meta.ipHash}`;
    const lockedFor = getAuthLockoutSeconds(lockKey);
    if (lockedFor > 0) {
      return res.status(429).json({ error: `Too many failed attempts. Try again in ${lockedFor}s.`, retryAfter: lockedFor });
    }
    if (!checkRateLimit(lockKey, 5, 60_000).allowed) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a minute.', retryAfter: 60 });
    }

    if (!authCodeOrKey || !verifyTotpServer(String(authCodeOrKey), authConfig.secret, true)) {
      const retryAfter = recordAuthFailure(lockKey);
      if (retryAfter > 0) {
        return res.status(429).json({ error: `Too many failed attempts. Locked for ${retryAfter}s.`, retryAfter });
      }
      return res.status(403).json({
        error: 'Unauthorized. You must provide a valid 6-digit Authenticator code from your paired app to reset the passcode.'
      });
    }

    clearAuthFailures(lockKey);
    const targetPin = (newPin && typeof newPin === 'string' && newPin.trim().length >= 4)
      ? newPin.trim()
      : null;
    if (!targetPin) {
      return res.status(400).json({ error: 'A new passcode of at least 4 characters is required.' });
    }

    store.setAdminPin(targetPin);
    invalidateAllSessions();
    res.json({ success: true, token: signSessionToken(sessionSecret) });
  });

  // The TOTP secret must never be readable unauthenticated: possession of it
  // would let anyone mint valid codes and bypass 2FA entirely.
  app.get('/api/admin/authenticator', requireAdmin, (req, res) => {
    const config = store.getAuthenticatorConfig();
    res.json({
      ...config,
      account: 'admin',
      issuer: 'MUIRO'
    });
  });

  app.post('/api/admin/authenticator', requireAdmin, (req, res) => {
    const { secret, enabled } = req.body;
    if (!secret || typeof secret !== 'string') {
      return res.status(400).json({ error: 'Authenticator secret is required' });
    }
    const updated = store.setAuthenticatorConfig(secret, enabled);
    invalidateAllSessions();
    res.json({ success: true, ...updated, token: signSessionToken(sessionSecret) });
  });

  app.post('/api/admin/authenticator/reset', requireAdmin, (req, res) => {
    const resetConfig = store.resetAuthenticatorConfig();
    invalidateAllSessions();
    res.json({ success: true, ...resetConfig, token: signSessionToken(sessionSecret) });
  });

  // --- API: Testimonials ---
  app.get('/api/testimonials', (req, res) => {
    res.json(store.getTestimonials());
  });

  app.post('/api/testimonials', requireAdmin, (req, res) => {
    const { author, location, avatar, rating, outfitTitle, comment, verified, featured } = req.body;
    if (!author || !comment) {
      return res.status(400).json({ error: 'Author and comment are required' });
    }
    const created = store.addTestimonial({
      author,
      location: location || 'Verified Shopper',
      avatar: avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80`,
      rating: Number(rating) || 5,
      outfitTitle: outfitTitle || 'Curated Look',
      comment,
      verified: verified !== false,
      featured: Boolean(featured)
    });
    res.status(201).json(created);
  });

  app.put('/api/testimonials/:id', requireAdmin, (req, res) => {
    const updated = store.updateTestimonial(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }
    res.json(updated);
  });

  app.delete('/api/testimonials/:id', requireAdmin, (req, res) => {
    const success = store.deleteTestimonial(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }
    res.json({ success: true });
  });

  // --- API: Impressions Tracker ---
  app.post('/api/impression', (req, res) => {
    const { lookId } = req.body || {};
    const total = store.recordImpression(lookId);
    res.json({ success: true, impressions: total });
  });

  // --- API: Secure Affiliate Click & Redirect Handler ---
  app.post('/api/click', (req: Request, res: Response) => {
    const { productId, lookId, source } = req.body;
    const meta = extractClientMetadata(req);

    // Check rate limit per IP hash
    const limitCheck = checkRateLimit(meta.ipHash);
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }

    const product = store.getProduct(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { valid, safeUrl } = sanitizeAffiliateUrl(product.affiliateUrl);
    if (!valid) {
      return res.status(400).json({ error: 'Security verification failed for destination link' });
    }

    const commissionRate = product.commissionRate || 8.0;
    const estCommission = Number(((product.numericPrice * commissionRate) / 100).toFixed(2));

    // Log the click event securely
    const clickEvent = store.recordClick({
      productId: product.id,
      productTitle: product.title,
      lookId: lookId || undefined,
      merchant: product.merchant,
      device: meta.device,
      referrer: meta.referrer,
      utmSource: source || meta.utmSource || 'web_lookbook',
      utmCampaign: meta.utmCampaign || 'organic',
      ipHash: meta.ipHash,
      isBot: meta.isBot,
      estimatedCommission: estCommission
    });

    res.json({
      success: true,
      safeUrl,
      clickId: clickEvent.id,
      merchant: product.merchant,
      estimatedCommission: estCommission
    });
  });

  // Secure External Redirect Gateway: /r/:productId
  // Allows the site owner to post clean links on Pinterest, TikTok bios, or newsletters (e.g., https://site.run.app/r/p001)
  app.get('/r/:productId', (req: Request, res: Response) => {
    const product = store.getProduct(req.params.productId);
    if (!product) {
      return res.redirect('/?error=product_not_found');
    }

    const meta = extractClientMetadata(req);
    const limitCheck = checkRateLimit(meta.ipHash);

    if (!limitCheck.allowed) {
      return res.status(429).send('Too many requests. Please wait a moment.');
    }

    const { valid, safeUrl } = sanitizeAffiliateUrl(product.affiliateUrl);
    if (!valid) {
      return res.redirect('/?error=invalid_target');
    }

    const commissionRate = product.commissionRate || 8.0;
    const estCommission = Number(((product.numericPrice * commissionRate) / 100).toFixed(2));

    // Only log analytics if it's not a search engine bot
    if (!meta.isBot) {
      store.recordClick({
        productId: product.id,
        productTitle: product.title,
        lookId: typeof req.query.look === 'string' ? req.query.look : undefined,
        merchant: product.merchant,
        device: meta.device,
        referrer: meta.referrer,
        utmSource: meta.utmSource || 'external_link',
        utmCampaign: meta.utmCampaign || 'direct_share',
        ipHash: meta.ipHash,
        isBot: false,
        estimatedCommission: estCommission
      });
    }

    // High security headers for safe affiliate redirect
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.redirect(302, safeUrl);
  });

  // --- API: Site Settings (About & Affiliate Disclosure) ---
  app.get('/api/settings', (req, res) => {
    res.json(store.getSettings());
  });

  app.put('/api/settings', requireAdmin, (req, res) => {
    const updated = store.updateSettings(req.body);
    res.json(updated);
  });

  // --- API: Analytics Dashboard Stats ---
  app.get('/api/stats', (req, res) => {
    res.json(store.getAnalytics());
  });

  // --- API: Reset Demo ---
  app.post('/api/reset', requireAdmin, (req, res) => {
    store.resetDemo();
    res.json({ success: true, message: 'Reset to initial curated data' });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const requestedPort = Number(process.env.PORT) || DEFAULT_PORT;
  const allowFallback = process.env.STRICT_PORT !== 'true';
  const PORT = await resolvePort(requestedPort, allowFallback);

  const server = http.createServer(app);

  // Friendly, actionable error instead of an unhandled EADDRINUSE crash.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[port] ERROR: ${PORT} is already in use.\n` +
          `[port] Stop the other process (often the VS Code Live Preview extension) or run: PORT=5174 npm run dev\n`
      );
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n  MUIRO Lookbook & Affiliate Server running on ${url}`);
    if (PORT !== requestedPort) {
      console.log(`  (port ${requestedPort} was busy -- open ${url}, not ${requestedPort})`);
    }
    console.log('');
  });
}

startServer();
