/**
 * Static-host E2E: proves the built site/ works with NO backend.
 *
 * Starts a file server that mimics the static Netlify output (static files plus
 * a custom 404 page for unknown paths), then drives the REAL src/lib/api.ts
 * against it and checks the storefront reads fall back to content-snapshot.json
 * while writes report a clear error instead of failing cryptically.
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
const configuredOrigin = (process.env.PUBLIC_SITE_ORIGIN || '').trim().replace(/\/$/, '');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
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
    let status = 200;
    const isLookbookDeepLink = /^\/lookbook\/[^/]+\/?$/.test(urlPath);
    let filePath = urlPath === '/' || isLookbookDeepLink ? path.join(siteDir, 'index.html') : path.join(siteDir, urlPath);
    if (!filePath.startsWith(siteDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(siteDir, '404.html');
      status = 404;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(status, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
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
const browserLocation = { href: BASE + '/', origin: BASE, search: '', pathname: '/' };
(globalThis as unknown as { window: unknown }).window = {
  dispatchEvent: (): boolean => true,
  addEventListener: (): void => {},
  removeEventListener: (): void => {},
  open: (): null => null,
  location: browserLocation,
  scrollTo: (): void => {}
};
const observedRequests: string[] = [];
(globalThis as typeof globalThis & { __MUIRO_STATIC_PUBLIC__?: boolean }).__MUIRO_STATIC_PUBLIC__ = true;

// Node's fetch needs absolute URLs; mirror browser URL resolution against the
// current page so deep-link requests expose accidental relative references.
const nativeFetch = globalThis.fetch.bind(globalThis) as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
(globalThis as unknown as { fetch: typeof nativeFetch }).fetch = (input, init) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const resolved = new URL(raw, browserLocation.href);
  observedRequests.push(resolved.pathname);
  return nativeFetch(resolved.href, init);
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
    mark(health.status === 404, `unknown path /api/health -> HTTP ${health.status} (not a soft-404 homepage)`);
    mark(healthBody.includes("couldn't find that page") && !healthBody.includes('content-snapshot.json'), 'unknown path returns the branded 404 page, not the storefront or an API response');

    const index = await nativeFetch(`${BASE}/`);
    const html = await index.text();
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    mark(/<title>MUIRO<\/title>/.test(html), 'browser tab title is exactly MUIRO');
    const metaDescription = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1];
    const expectedCanonical = configuredOrigin ? `${configuredOrigin}/` : undefined;
    mark((configuredOrigin ? canonical === expectedCanonical : !canonical) && !!metaDescription, 'homepage has descriptive initial metadata and only emits canonical after origin configuration');
    mark(/MUIRO/.test(metaDescription || '') && /MuiroFashion/.test(metaDescription || ''), 'meta description identifies both MUIRO and MuiroFashion');
    mark((configuredOrigin ? html.includes(`property="og:url" content="${expectedCanonical}"`) : !html.includes('property="og:url"')) && html.includes('twitter:card') && html.includes('"@type": "WebSite"'), 'social previews and WebSite structured data are present without guessed URLs');
    mark(html.includes('"alternateName": "MuiroFashion"'), 'structured data declares MuiroFashion as the alternate brand name');
    mark(/<noscript>[\s\S]*?<h1>MUIRO Fashion Lookbooks<\/h1>[\s\S]*?MuiroFashion[\s\S]*?<\/noscript>/.test(html), 'initial HTML includes a useful no-JavaScript brand and editorial summary');
    const robots = await nativeFetch(`${BASE}/robots.txt`);
    const robotsText = await robots.text();
    mark(robots.status === 200 && robotsText.includes('Disallow: /api/') && (configuredOrigin ? robotsText.includes(`Sitemap: ${configuredOrigin}/sitemap.xml`) : !robotsText.includes('Sitemap:')), `robots.txt -> HTTP ${robots.status}, public crawl policy and origin-aware sitemap reference`);
    const sitemap = await nativeFetch(`${BASE}/sitemap.xml`);
    const sitemapText = await sitemap.text();
    mark(configuredOrigin ? sitemap.status === 200 && sitemapText.includes(`<loc>${configuredOrigin}/</loc>`) : sitemap.status === 404, `sitemap.xml -> HTTP ${sitemap.status}, emitted only for a configured public origin`);
    const llms = await nativeFetch(`${BASE}/llms.txt`);
    const llmsText = await llms.text();
    mark(llms.status === 200 && llmsText.includes('# MUIRO') && llmsText.includes('MuiroFashion'), `llms.txt -> HTTP ${llms.status}, factual guide with both brand names`);
    const deepLink = `${BASE}/lookbook/look-1`;
    const deepResponse = await nativeFetch(deepLink);
    const deepHtml = await deepResponse.text();
    mark(deepResponse.status === 200 && /<div id="root"><\/div>/.test(deepHtml), '/lookbook/:id is rewritten to the app shell');
    const jsRef = (deepHtml.match(/<script[^>]*src="(\/assets\/[^\"]+\.js)"/) || [])[1];
    mark(!!jsRef, `index.html references root-based hashed module ${jsRef}`);
    mark(/href="\/assets\/[^"]+\.css"/.test(deepHtml), 'stylesheet reference is rooted at the site origin');
    mark(/href="\/fonts\/fonts\.css"/.test(deepHtml), 'font stylesheet reference is rooted at the site origin');
    mark(/href="\/favicon\.svg"/.test(deepHtml), 'favicon reference is rooted at the site origin');

    if (jsRef) {
      const deepUrl = new URL(deepLink);
      const jsUrl = new URL(jsRef, deepUrl);
      const js = await nativeFetch(jsUrl.href);
      mark(jsUrl.pathname.startsWith('/assets/') && (js.headers.get('content-type') || '').includes('javascript'), `deep-link module resolved to ${jsUrl.pathname} and served as [${js.headers.get('content-type')}]`);
      const cssRef = (deepHtml.match(/href="(\/assets\/[^"]+\.css)"/) || [])[1];
      const cssUrl = new URL(cssRef || '', deepUrl);
      const css = await nativeFetch(cssUrl.href);
      mark((css.headers.get('content-type') || '').includes('text/css'), `stylesheet served as [${css.headers.get('content-type')}]`);
      mark(cssUrl.pathname.startsWith('/assets/'), `deep-link stylesheet resolved to ${cssUrl.pathname}`);
      const faviconUrl = new URL('/favicon.svg', deepUrl);
      const fav = await nativeFetch(faviconUrl.href);
      const fav32 = await nativeFetch(`${BASE}/favicon-32.png`);
      const apple = await nativeFetch(`${BASE}/apple-touch-icon.png`);
      mark(faviconUrl.pathname === '/favicon.svg' && fav.status === 200 && fav32.status === 200 && apple.status === 200, `M favicon set -> SVG ${fav.status}, 32px ${fav32.status}, touch ${apple.status}`);
      const fontUrl = new URL('/fonts/fonts.css', deepUrl);
      const font = await nativeFetch(fontUrl.href);
      const fontBody = await font.text();
      const fontRef = (fontBody.match(/url\(([^)]+\.woff2)\)/) || [])[1]?.replace(/["']/g, '');
      const fontAssetUrl = fontRef ? new URL(fontRef, fontUrl) : null;
      const fontAsset = fontAssetUrl ? await nativeFetch(fontAssetUrl.href) : null;
      mark(font.status === 200 && fontBody.includes('@font-face') && !!fontAsset && fontAsset.status === 200 && !!fontAssetUrl && fontAssetUrl.pathname.startsWith('/fonts/'), `self-hosted font CSS and WOFF2 resolve from root (CSS ${font.status}, font ${fontAsset?.status})`);
      const snapshotUrl = new URL('/content-snapshot.json', deepUrl);
      const snap = await nativeFetch(snapshotUrl.href);
      mark(snap.status === 200 && snapshotUrl.pathname === '/content-snapshot.json', `deep-link content-snapshot.json -> HTTP ${snap.status} from the site root`);
    }

    console.log('\n=== B. real client code reads content with NO backend ===\n');
    browserLocation.href = deepLink;
    browserLocation.pathname = '/lookbook/look-1';
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
    mark(observedRequests.includes('/content-snapshot.json') && !observedRequests.includes('/lookbook/content-snapshot.json'), 'client snapshot fetch remains rooted while the browser is on /lookbook/:id');

    const snapshotData = JSON.parse(fs.readFileSync(path.join(siteDir, 'content-snapshot.json'), 'utf-8'));
    mark(!['stats', 'affiliatePrograms', 'merchants', 'clicks', 'impressions'].some((key) => key in snapshotData), 'public snapshot excludes analytics and admin-only collections');
    mark(snapshotData.products.every((p: any) => p.clicks === 0) && snapshotData.lookbooks.every((l: any) => l.views === 0 && l.likes === 0), 'public product/lookbook analytics start at zero');
    const heroPaths = snapshotData.heroSlides.map((slide: any) => slide.image);
    mark(heroPaths.length > 0 && heroPaths.every((value: string) => /^\/hero-[1-4]\.webp$/.test(value)), 'public snapshot references optimized first-party hero WebP files');
    const heroAsset = await nativeFetch(`${BASE}${heroPaths[0]}`);
    mark(heroAsset.status === 200 && (heroAsset.headers.get('content-type') || '').includes('image/webp'), `optimized hero asset -> HTTP ${heroAsset.status} (${heroAsset.headers.get('content-type')})`);

    let statsUnavailable = false;
    try {
      await api.getAnalytics();
    } catch {
      statsUnavailable = true;
    }
    mark(statsUnavailable, 'getAnalytics() is unavailable to public visitors without an owner session');
    const requestsBeforeTracking = observedRequests.length;
    await api.recordImpression();
    mark(observedRequests.length === requestsBeforeTracking, 'unconfigured static build skips visitor telemetry requests');

    // A static build without Supabase still returns the already-safe URL and
    // never delays navigation waiting for a missing telemetry backend.
    const first = products[0];
    const clickResult = await api.handleAffiliateClick(first.id, undefined, 'web_lookbook', first.affiliateUrl);
    mark(clickResult.safeUrl === first.affiliateUrl && /^https?:\/\//.test(first.affiliateUrl), 'click without backend preserves the static affiliate URL immediately');
    mark(!observedRequests.some((url) => url.startsWith('/api/')), 'public collection reads made no API/health calls');

    console.log('\n=== C. writes fail loudly, not cryptically ===\n');
    let writeError = '';
    try {
      await api.createProduct({ title: 'x', image: 'https://x/i.jpg', affiliateUrl: 'https://www.amazon.com/dp/X' });
    } catch (e) {
      writeError = (e as Error).message;
    }
    mark(writeError.includes('Supabase'), `createProduct() -> "${writeError}"`);
    mark(writeError.length > 20, 'error is human-readable, not a JSON parse failure');

    let deleteError = '';
    try {
      await api.deleteLookbook('look-1');
    } catch (e) {
      deleteError = (e as Error).message;
    }
    mark(deleteError.includes('Supabase'), `deleteLookbook() -> "${deleteError}"`);

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
