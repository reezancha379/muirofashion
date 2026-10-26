/**
 * Static-host E2E: proves the built site/ works with NO backend.
 *
 * Starts a file server that mimics Netlify (static files + SPA fallback that
 * answers unknown paths with index.html + 200, which is exactly the behaviour
 * that used to break API calls), then drives the REAL src/lib/api.ts against
 * it and checks the storefront reads fall back to content-snapshot.json while
 * writes report a clear error instead of failing cryptically.
 *
 * Run:  node --import tsx static-e2e.test.ts
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.join(root, '..', 'site');
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

let failures = 0;
const mark = (ok: boolean, msg: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures++;
};

function startStaticServer(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.join(siteDir, urlPath);

    // Netlify-like: any path that is not a real file falls back to index.html.
    if (!filePath.startsWith(siteDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(siteDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

// --- Browser globals the client code touches ---------------------------------
const store = new Map<string, string>();
const sessionStoragePolyfill = {
  getItem: (k: string): string | null => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string): void => void store.set(k, String(v)),
  removeItem: (k: string): void => void store.delete(k),
  clear: (): void => store.clear(),
  get length(): number {
    return store.size;
  }
};
const localStoragePolyfill = {
  getItem: (): string | null => null,
  setItem: (): void => {},
  removeItem: (): void => {}
};
(globalThis as unknown as { sessionStorage: typeof sessionStoragePolyfill }).sessionStorage = sessionStoragePolyfill;
(globalThis as unknown as { localStorage: typeof localStoragePolyfill }).localStorage = localStoragePolyfill;
(globalThis as unknown as { window: unknown }).window = {
  dispatchEvent: (): boolean => true,
  addEventListener: (): void => {},
  removeEventListener: (): void => {},
  open: (): null => null,
  location: { href: BASE + '/', origin: BASE, search: '', pathname: '/' },
  scrollTo: (): void => {}
};

// Node's fetch needs absolute URLs; the browser resolves both '/abs' and
// './rel' against the page origin. Mirror that so the client code under test
// keeps working exactly as it does in the browser (the app fetches the
// snapshot with a relative './content-snapshot.json' path).
const nativeFetch = globalThis.fetch.bind(globalThis) as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
(globalThis as unknown as { fetch: typeof nativeFetch }).fetch = (input, init) => {
  if (typeof input === 'string') {
    return nativeFetch(new URL(input, BASE + '/').href, init);
  }
  return nativeFetch(input, init);
};

async function main(): Promise<void> {
  if (!fs.existsSync(path.join(siteDir, 'index.html'))) {
    console.error('FATAL: site/ not built. Run `node --import tsx build-static.ts` first.');
    process.exit(1);
  }

  const server = await startStaticServer();

  try {
    console.log('=== A. the static host behaves like Netlify ===\n');
    const health = await nativeFetch(`${BASE}/api/health`);
    const healthBody = await health.text();
    mark(health.status === 200, `unknown path /api/health -> HTTP ${health.status} (SPA fallback)`);
    mark(/^\s*</.test(healthBody), 'SPA fallback returns index.html, NOT JSON (proves a real API is absent)');

    const index = await nativeFetch(`${BASE}/`);
    const html = await index.text();
    // The build uses base './' for drag-and-drop/Netlify compat, so the module
    // reference may be absolute (`/assets/…`) or relative (`./assets/…`).
    const jsRef = (html.match(/<script[^>]*src="((?:\/|\.\/)assets\/[^"]+\.js)"/) || [])[1];
    mark(!!jsRef, `index.html references hashed module ${jsRef}`);

    if (jsRef) {
      const jsUrl = jsRef.replace(/^\.\//, '');
      const js = await nativeFetch(`${BASE}/${jsUrl}`);
      mark((js.headers.get('content-type') || '').includes('javascript'), `module script served as [${js.headers.get('content-type')}] (strict MIME OK)`);
      const cssRef = (html.match(/href="((?:\/|\.\/)assets\/[^"]+\.css)"/) || [])[1];
      const cssUrl = (cssRef || '').replace(/^\.\//, '');
      const css = await nativeFetch(`${BASE}/${cssUrl}`);
      mark((css.headers.get('content-type') || '').includes('text/css'), `stylesheet served as [${css.headers.get('content-type')}]`);
      const fav = await nativeFetch(`${BASE}/favicon.png`);
      mark(fav.status === 200, `favicon -> HTTP ${fav.status} (was 404 before)`);
      const font = await nativeFetch(`${BASE}/fonts/fonts.css`);
      const fontBody = await font.text();
      mark(font.status === 200 && fontBody.includes('@font-face'), `self-hosted fonts -> HTTP ${font.status} (${(fontBody.match(/@font-face/g) || []).length} faces, no googleapis request)`);
      const snap = await nativeFetch(`${BASE}/content-snapshot.json`);
      mark(snap.status === 200, `content-snapshot.json -> HTTP ${snap.status}`);
    }

    console.log('\n=== B. real client code reads content with NO backend ===\n');
    const mod = await import('../src/lib/api');
    const api = mod.api;

    const lookbooks = await api.getLookbooks();
    mark(lookbooks.length > 0, `getLookbooks() -> ${lookbooks.length} lookbooks from snapshot`);
    mark(typeof lookbooks[0]?.title === 'string', `  first: "${lookbooks[0]?.title}"`);

    const products = await api.getProducts();
    mark(products.length > 0, `getProducts() -> ${products.length} products from snapshot`);
    mark(products.every((p) => p.affiliateUrl && p.image), '  every product has an image + affiliateUrl');
    mark(products.every((p) => typeof p.description === 'string'), '  every product preserves a description field');
    mark(products.every((p) => p.merchantId && p.affiliateProgramId), '  every product preserves merchant + affiliate program relationships');
    mark(lookbooks.every((look) => look.pieces.every((pieceId) => products.some((p) => p.id === pieceId))), '  every lookbook piece ID resolves to a saved product');

    const heroes = await api.getHeroSlides();
    mark(heroes.length > 0, `getHeroSlides() -> ${heroes.length} slides from snapshot`);

    const testimonials = await api.getTestimonials();
    // A CMS can legitimately have zero testimonials; the section simply hides.
    mark(Array.isArray(testimonials), `getTestimonials() -> ${testimonials.length} from snapshot (array shape ok)`);

    const settings = await api.getSettings();
    mark(typeof settings.aboutTitle === 'string' && settings.aboutTitle.length > 0, `getSettings() -> "${settings.aboutTitle}"`);

    const stats = await api.getAnalytics();
    mark(typeof stats.totalClicks === 'number', `getAnalytics() -> ${stats.totalClicks} clicks / ${stats.totalImpressions} impressions`);

    // The product click path: no backend, so it must fall back to the raw URL.
    const first = products[0];
    let reachedMerchant = false;
    try {
      await api.handleAffiliateClick(first.id, undefined, 'web_lookbook');
    } catch {
      reachedMerchant = true; // rejected -> component falls back to product.affiliateUrl
    }
    mark(reachedMerchant && /^https?:\/\//.test(first.affiliateUrl), `click without backend falls back to ${first.affiliateUrl}`);

    console.log('\n=== C. writes fail loudly, not cryptically ===\n');
    let writeError = '';
    try {
      await api.createProduct({ title: 'x', image: 'https://x/i.jpg', affiliateUrl: 'https://www.amazon.com/dp/X' });
    } catch (e) {
      writeError = (e as Error).message;
    }
    mark(writeError.includes('static'), `createProduct() -> "${writeError}"`);
    mark(writeError.length > 20, 'error is human-readable, not a JSON parse failure');

    let deleteError = '';
    try {
      await api.deleteLookbook('look-1');
    } catch (e) {
      deleteError = (e as Error).message;
    }
    mark(deleteError.includes('static'), `deleteLookbook() -> "${deleteError}"`);

    console.log(`\nFAILURES=${failures}`);
    process.exit(failures === 0 ? 0 : 1);
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
