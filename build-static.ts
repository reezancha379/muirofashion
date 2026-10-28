/**
 * Builds the Netlify-ready static visitor site.
 *
 * Local builds use the sanitized content-only data/store.json seed. Netlify
 * builds must package the latest public Supabase Storage snapshot; if it cannot
 * be fetched, the build fails rather than overwriting fresh CMS content with an
 * older Git seed.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { projectPublicSnapshot } from './src/lib/publicSnapshot';

const root = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const siteDir = path.join(root, 'site');

function fail(msg: string): never {
  console.error(`[build-static] ERROR: ${msg}`);
  process.exit(1);
}

const escapeHtmlAttribute = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function setMetaContent(html: string, key: string, value: string): string {
  const attribute = key.startsWith('og:') ? 'property' : 'name';
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\s+${attribute}="${escapedKey}"\\s+content="[^"]*"\\s*\\/?>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${escapeHtmlAttribute(value)}" />`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function applySiteSeo(html: string, settings: Record<string, any>): string {
  const title = 'MUIRO';
  const socialTitle = String(settings?.seoTitle || 'MUIRO').trim().slice(0, 70) || 'MUIRO';
  const description = String(settings?.seoDescription || '').trim().slice(0, 180);
  const keywords = String(settings?.seoKeywords || '').trim().slice(0, 300);
  let output = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtmlAttribute(title)}</title>`);
  if (description) {
    output = setMetaContent(output, 'description', description);
    output = setMetaContent(output, 'og:description', description);
    output = setMetaContent(output, 'twitter:description', description);
  }
  output = setMetaContent(output, 'og:title', socialTitle);
  output = setMetaContent(output, 'twitter:title', socialTitle);
  if (keywords) output = setMetaContent(output, 'keywords', keywords);
  if (settings?.ogImage) {
    const rawImage = String(settings.ogImage).trim();
    const absoluteImage = rawImage.startsWith('/')
      ? new URL(rawImage, 'https://muirofashion.netlify.app').toString()
      : rawImage;
    output = setMetaContent(output, 'og:image', absoluteImage);
    output = setMetaContent(output, 'twitter:image', absoluteImage);
  }
  return output;
}

async function loadSnapshot(): Promise<Record<string, any>> {
  const browserSupabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const supabaseUrl = (browserSupabaseUrl || process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const publicKey = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const isNetlify = process.env.NETLIFY === 'true';

  if (isNetlify && !browserSupabaseUrl) {
    fail('VITE_SUPABASE_URL is required for Netlify admin API calls; a server-only SUPABASE_URL does not configure the browser client');
  }

  if (isNetlify && !publicKey) {
    fail('VITE_SUPABASE_PUBLISHABLE_KEY is required for Netlify admin API calls; never use a service-role key here');
  }

  if (supabaseUrl) {
    const snapshotUrl = `${supabaseUrl}/storage/v1/object/public/muiro-public/content-snapshot.json`;
    try {
      const response = await fetch(snapshotUrl, { cache: 'no-store' });
      if (response.ok) {
        const remote = await response.json();
        console.log('[build-static] packaging current public Supabase snapshot');
        return projectPublicSnapshot(remote);
      }
      if (response.status === 404 && process.env.MUIRO_ALLOW_SEED_SNAPSHOT === 'true') {
        console.warn('[build-static] one-time seed snapshot fallback explicitly enabled');
      } else {
        fail(`public Supabase snapshot could not be fetched (HTTP ${response.status}); refusing to publish stale local content`);
      }
    } catch (error) {
      if ((error as Error)?.message?.startsWith('[build-static]')) throw error;
      fail('public Supabase snapshot could not be fetched; refusing to publish stale local content');
    }
  } else if (isNetlify) {
    fail('VITE_SUPABASE_URL is required for Netlify builds so published CMS content cannot regress to the repository seed');
  }

  const seedPath = path.join(root, 'data', 'store.json');
  if (!fs.existsSync(seedPath)) fail('content-only data/store.json seed is missing');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  return projectPublicSnapshot(seed);
}

const snapshot = await loadSnapshot();

// Build with a compile-time marker so public Netlify visitors never probe /api.
console.log('[build-static] running vite build...');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const viteExit = spawnSync(process.execPath, [viteBin, 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_STATIC_PUBLIC: 'true' },
});
if (viteExit.status !== 0) fail(`vite build failed (exit ${viteExit.status})`);
if (!fs.existsSync(path.join(distDir, 'index.html'))) fail('vite wrote no dist/index.html');

fs.rmSync(siteDir, { recursive: true, force: true });
fs.mkdirSync(siteDir, { recursive: true });
const html = applySiteSeo(fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8'), snapshot.settings || {});
if (/(?:src|href)=["'](?:\.\/|\/)?src\/main\.tsx["']/i.test(html)) {
  fail('production index.html still references /src/main.tsx');
}
const assetRefs = [...html.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^\"]+)"/g)].map((m) => m[1]);
for (const ref of assetRefs) {
  if (!fs.existsSync(path.join(distDir, ref))) fail(`hashed asset missing: ${ref}`);
}
fs.writeFileSync(path.join(siteDir, 'index.html'), html, 'utf-8');
fs.cpSync(path.join(distDir, 'assets'), path.join(siteDir, 'assets'), { recursive: true });
for (const entry of fs.readdirSync(publicDir)) {
  fs.cpSync(path.join(publicDir, entry), path.join(siteDir, entry), { recursive: true });
}
fs.writeFileSync(path.join(siteDir, 'content-snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf-8');
const requiredSeoFiles = ['robots.txt', 'sitemap.xml', 'llms.txt'];
for (const file of requiredSeoFiles) {
  if (!fs.existsSync(path.join(siteDir, file))) fail(`SEO discovery file missing from static output: ${file}`);
}
for (const file of ['hero-1.webp', 'hero-2.webp', 'hero-3.webp', 'hero-4.webp']) {
  if (!fs.existsSync(path.join(siteDir, file))) fail(`optimized hero image missing from static output: ${file}`);
}
const sitemap = fs.readFileSync(path.join(siteDir, 'sitemap.xml'), 'utf-8');
if (!sitemap.includes('<loc>https://muirofashion.netlify.app/</loc>')) {
  fail('sitemap.xml must include the canonical MUIRO homepage URL');
}
fs.writeFileSync(
  path.join(siteDir, '_headers'),
  '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n' +
    '/assets/*.js\n  Content-Type: text/javascript; charset=utf-8\n\n' +
    '/assets/*.css\n  Content-Type: text/css; charset=utf-8\n',
  'utf-8',
);

const entryScript = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
const jsAsset = entryScript ? entryScript[1].replace(/^(?:\.\/)?assets\//, '') : '';
const jsSize = jsAsset ? fs.statSync(path.join(siteDir, 'assets', jsAsset)).size : 0;
const moduleOk = !!jsAsset && fs.existsSync(path.join(siteDir, 'assets', jsAsset));
const faviconOk = fs.existsSync(path.join(siteDir, 'favicon.svg')) && html.includes('favicon.svg');
const fontsOk = fs.existsSync(path.join(siteDir, 'fonts', 'fonts.css')) && html.includes('fonts/fonts.css');
const seoOk = requiredSeoFiles.every((file) => fs.existsSync(path.join(siteDir, file)));

console.log('\n[build-static] done.');
console.log(`  site/index.html         ${html.length}B`);
console.log(`  site/assets/${jsAsset.padEnd(13)} ${jsSize}B`);
console.log(`  content-snapshot.json   ${snapshot.lookbooks.length} lookbooks, ${snapshot.products.length} products, ${snapshot.heroSlides.length} hero slides, ${snapshot.testimonials.length} testimonials`);
console.log(`  reference check         module [${moduleOk}] favicon [${faviconOk}] self-hosted fonts [${fontsOk}] SEO files [${seoOk}]`);
if (!jsAsset || !moduleOk || !faviconOk || !fontsOk || !seoOk) fail('built index references do not match the static output');
