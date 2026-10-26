/**
 * Builds the complete Netlify-ready static site.
 *
 *   node --import tsx build-static.ts
 *
 * Produces ./site/ containing:
 *   index.html            SPA entry (hashed asset references from vite build)
 *   assets/               hashed JS + CSS
 *   public/*              favicons + hero images (served from /public/)
 *   content-snapshot.json data captured from the REAL store (same shapes the
 *                         API serves), so the storefront renders without a backend
 *   _headers              correct Content-Type for module scripts
 *   _redirects            SPA fallback (Netlify)
 *
 * Also writes dist/index.html with correct hashed references, so
 * `npm run build && npm start` (full-stack local mode) keeps working.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
// Same datastore the API serves: guarantees the snapshot matches the exact
// TypeScript shapes (lookbooks, products, settings, analytics) the client needs.
import { store } from './server/database/dataStore';

const root = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const siteDir = path.join(root, 'site');

function fail(msg: string): never {
  console.error(`[build-static] ERROR: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Content snapshot from the real store (no backend required at runtime)
// ---------------------------------------------------------------------------
// Images referenced as "/hero-1.jpg" live in public/, and a static host serves
// public/ at the site root (the same way Vite and the dev server do), so paths
// pass through unchanged.
const snapshot = {
  lookbooks: store.getLookbooks(),
  products: store.getProducts(),
  testimonials: store.getTestimonials(),
  heroSlides: store.getHeroSlides(),
  settings: store.getSettings(),
  stats: store.getAnalytics(),
  affiliatePrograms: store.getAffiliatePrograms(),
  merchants: store.getMerchants()
};

// ---------------------------------------------------------------------------
// 2. Vite production build (dist/ gets correct hashed references)
// ---------------------------------------------------------------------------
console.log('[build-static] running vite build...');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const viteExit = spawnSync(process.execPath, [viteBin, 'build'], { stdio: 'inherit' });
if (viteExit.status !== 0) fail(`vite build failed (exit ${viteExit.status})`);
if (!fs.existsSync(path.join(distDir, 'index.html'))) fail('vite wrote no dist/index.html');

// ---------------------------------------------------------------------------
// 3. Assemble site/
// ---------------------------------------------------------------------------
fs.rmSync(siteDir, { recursive: true, force: true });
fs.mkdirSync(siteDir, { recursive: true });

// dist/index.html already has a hashed Vite module script (relative ./assets/XXXX.js)
// rewritten by vite; verify each /assets/* reference really exists on disk.
const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

// Production must never publish Vite source entrypoints. These are valid only
// while running the Vite dev server and would 404 on a static host.
if (/(?:src|href)=["'](?:\.\/|\/)?src\/main\.tsx["']/i.test(html)) {
  fail('production index.html still references /src/main.tsx');
}

const assetRefs = [...html.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^"]+)"/g)].map((m) => m[1]);
for (const ref of assetRefs) {
  if (!fs.existsSync(path.join(distDir, ref))) fail(`hashed asset missing: ${ref}`);
}
fs.writeFileSync(path.join(siteDir, 'index.html'), html, 'utf-8');

fs.cpSync(path.join(distDir, 'assets'), path.join(siteDir, 'assets'), { recursive: true });

// public/ -> site root, mirroring how vite and the dev server serve it, so
// /favicon.png, /fonts/* and /hero-*.jpg all resolve without path rewriting.
for (const entry of fs.readdirSync(publicDir)) {
  fs.cpSync(path.join(publicDir, entry), path.join(siteDir, entry), { recursive: true });
}

fs.writeFileSync(
  path.join(siteDir, 'content-snapshot.json'),
  JSON.stringify(snapshot, null, 2),
  'utf-8'
);

// Netlify SPA fallback: every unknown path serves index.html (status 200).
fs.writeFileSync(path.join(siteDir, '_redirects'), '/*  /index.html  200\n', 'utf-8');

// Netlify serves .js/.css with no known MIME mapping as application/octet-stream,
// which Strict MIME checking rejects for module scripts - declare them explicitly.
fs.writeFileSync(
  path.join(siteDir, '_headers'),
  '/*\n  X-Content-Type-Options: nosniff\n\n' +
    '/assets/*.js\n  Content-Type: text/javascript; charset=utf-8\n\n' +
    '/assets/*.css\n  Content-Type: text/css; charset=utf-8\n',
  'utf-8'
);

// ---------------------------------------------------------------------------
// 4. Report
// ---------------------------------------------------------------------------
// Resolve the ACTUAL entry module from dist/index.html instead of guessing
// "the first .js file in the assets dir". Lazy chunks such as
// AdminManager-*.js sort before the real entry on some platforms, which used
// to make the reference check fail even though the build was fine.
const entryScript = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
const jsAsset = entryScript ? entryScript[1].replace(/^(?:\.\/)?assets\//, '') : '';
const jsSize = jsAsset ? fs.statSync(path.join(siteDir, 'assets', jsAsset)).size : 0;
const moduleOk = !!jsAsset && fs.existsSync(path.join(siteDir, 'assets', jsAsset));
const faviconOk = fs.existsSync(path.join(siteDir, 'favicon.png')) && html.includes('href="./favicon.png"') || html.includes('href="/favicon.png"');
const fontsOk = fs.existsSync(path.join(siteDir, 'fonts', 'fonts.css')) && (html.includes('href="./fonts/fonts.css"') || html.includes('href="/fonts/fonts.css"'));

console.log(`\n[build-static] done.`);
console.log(`  site/index.html         ${html.length}B`);
console.log(`  site/assets/${jsAsset.padEnd(13)} ${jsSize}B`);
console.log(
  `  content-snapshot.json   ${snapshot.lookbooks.length} lookbooks, ${snapshot.products.length} products, ` +
    `${snapshot.heroSlides.length} hero slides, ${snapshot.testimonials.length} testimonials, ` +
    `${snapshot.stats.totalClicks} clicks`
);
const rootEntries = fs.readdirSync(siteDir);
console.log(`  site root               ${rootEntries.filter((e) => e !== 'assets').length} entries (favicons, hero images, fonts/, _redirects)`);
console.log(`  _redirects / _headers   SPA fallback + explicit MIME types`);
console.log(
  `\n  reference check: type=module+hashed path [${moduleOk}]  favicon [${faviconOk}]  self-hosted fonts [${fontsOk}]`
);

if (!jsAsset || !moduleOk || !faviconOk || !fontsOk) {
  fail('instant-request mismatch: index.html references do not match built assets');
}