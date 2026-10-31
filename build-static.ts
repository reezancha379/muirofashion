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
import { projectPublicSnapshot, validatePublicSnapshotShape } from './src/lib/publicSnapshot';

const root = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const siteDir = path.join(root, 'site');

function fail(msg: string): never {
  console.error(`[build-static] ERROR: ${msg}`);
  process.exit(1);
}

function resolvePublicOrigin(): string {
  const configured = (process.env.PUBLIC_SITE_ORIGIN || '').trim();
  if (!configured) return '';
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    fail('PUBLIC_SITE_ORIGIN must be a valid absolute HTTPS origin, for example https://www.example.com');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    fail('PUBLIC_SITE_ORIGIN must be an HTTPS origin only, without credentials, path, query, or fragment');
  }
  return url.origin;
}

const publicOrigin = resolvePublicOrigin();
if (process.env.NETLIFY === 'true' && !publicOrigin) {
  fail('PUBLIC_SITE_ORIGIN is required for Netlify so canonical and sitemap URLs use the confirmed public domain');
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

function setCanonicalLink(html: string, href: string): string {
  const tag = `<link rel="canonical" href="${escapeHtmlAttribute(href)}" />`;
  const pattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function applySiteSeo(html: string, settings: Record<string, any>, origin: string): string {
  const title = 'MUIRO';
  const socialTitle = 'MUIRO';
  const sourceDescription = String(settings?.seoDescription || 'MUIRO, also known as MuiroFashion, is a fashion editorial lookbook for curated outfit ideas with selected products linked to participating retailers.').trim();
  let descriptionSource = sourceDescription;
  const descriptionPreview = sourceDescription.slice(0, 160);
  if (!(/\bMUIRO\b/i.test(descriptionPreview) && /\bMuiroFashion\b/i.test(descriptionPreview))) {
    if (/^MUIRO\b/i.test(sourceDescription)) {
      descriptionSource = sourceDescription.replace(/^MUIRO\b/i, 'MUIRO (also known as MuiroFashion)');
    } else if (/^MuiroFashion\b/i.test(sourceDescription)) {
      descriptionSource = sourceDescription.replace(/^MuiroFashion\b/i, 'MUIRO (also known as MuiroFashion)');
    } else {
      descriptionSource = `MUIRO (also known as MuiroFashion): ${sourceDescription}`;
    }
  }
  const description = descriptionSource.slice(0, 160);
  const sourceKeywords = String(settings?.seoKeywords || 'fashion lookbooks, outfit ideas, shoppable fashion, curated style, outfit inspiration')
    .split(',').map((item: string) => item.trim()).filter(Boolean);
  const keywordMap = new Map<string, string>();
  for (const item of ['MUIRO', 'MuiroFashion', ...sourceKeywords]) {
    const clean = item.trim();
    if (clean && !keywordMap.has(clean.toLowerCase())) keywordMap.set(clean.toLowerCase(), clean);
  }
  const keywords = [...keywordMap.values()].slice(0, 8).join(', ');
  let output = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtmlAttribute(title)}</title>`);
  output = setMetaContent(output, 'description', description);
  output = setMetaContent(output, 'og:description', description);
  output = setMetaContent(output, 'twitter:description', description);
  output = setMetaContent(output, 'og:title', socialTitle);
  output = setMetaContent(output, 'twitter:title', socialTitle);
  output = setMetaContent(output, 'keywords', keywords);
  if (origin) {
    output = setCanonicalLink(output, `${origin}/`);
    output = setMetaContent(output, 'og:url', `${origin}/`);
  }
  if (settings?.ogImage) {
    const rawImage = String(settings.ogImage).trim();
    let absoluteImage = '';
    try {
      const imageUrl = rawImage.startsWith('/') && origin ? new URL(rawImage, `${origin}/`) : new URL(rawImage);
      if (imageUrl.protocol === 'https:' || imageUrl.protocol === 'http:') absoluteImage = imageUrl.toString();
    } catch {
      // Keep the safe static fallback image already present in index.html.
    }
    if (absoluteImage) {
      output = setMetaContent(output, 'og:image', absoluteImage);
      output = setMetaContent(output, 'twitter:image', absoluteImage);
    }
  }
  output = output.replace(/(src|href)="\.\//g, '$1="/');
  if (!output.includes('"alternateName": "MuiroFashion"')) {
    output = output.replace(/("name":\s*"MUIRO",\s*"url":)/, '"name": "MUIRO",\n          "alternateName": "MuiroFashion",\n          "url":');
  }
  output = output.replace(/(MUIRO Fashion Lookbooks<\/h1>[\s\S]*?)(<\/noscript>)/i, '$1<p>Also known as MuiroFashion.</p>$2');
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
        validatePublicSnapshotShape(remote);
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
      if ((error as Error)?.message?.startsWith('Public snapshot is incomplete:')) fail((error as Error).message);
      fail('public Supabase snapshot could not be fetched; refusing to publish stale local content');
    }
  } else if (isNetlify) {
    fail('VITE_SUPABASE_URL is required for Netlify builds so published CMS content cannot regress to the repository seed');
  }

  const seedPath = path.join(root, 'data', 'store.json');
  if (!fs.existsSync(seedPath)) fail('content-only data/store.json seed is missing');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  validatePublicSnapshotShape(seed);
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
const html = applySiteSeo(fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8'), snapshot.settings || {}, publicOrigin);
if (/(?:src|href)=["'](?:\.\/|\/)?src\/main\.tsx["']/i.test(html)) {
  fail('production index.html still references /src/main.tsx');
}
const assetRefs = [...html.matchAll(/(?:src|href)="(?:\/|\.\/)?(assets\/[^\"]+)"/g)].map((m) => m[1]);
for (const ref of assetRefs) {
  if (!fs.existsSync(path.join(distDir, ref))) fail(`hashed asset missing: ${ref}`);
}
fs.writeFileSync(path.join(siteDir, 'index.html'), html, 'utf-8');
fs.cpSync(path.join(distDir, 'assets'), path.join(siteDir, 'assets'), { recursive: true });
for (const entry of fs.readdirSync(publicDir)) {
  fs.cpSync(path.join(publicDir, entry), path.join(siteDir, entry), { recursive: true });
}
const robotsPath = path.join(siteDir, 'robots.txt');
if (!fs.existsSync(robotsPath)) fail('robots.txt is missing from public/');
const robotsBase = fs.readFileSync(robotsPath, 'utf-8').replace(/^\s*Sitemap:\s*.*$/gim, '').trim();
fs.writeFileSync(robotsPath, `${robotsBase}${publicOrigin ? `\n\nSitemap: ${publicOrigin}/sitemap.xml` : ''}\n`, 'utf-8');
const sitemapPath = path.join(siteDir, 'sitemap.xml');
if (publicOrigin) {
  fs.writeFileSync(
    sitemapPath,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${publicOrigin}/</loc></url>\n</urlset>\n`,
    'utf-8',
  );
} else {
  fs.rmSync(sitemapPath, { force: true });
}
fs.writeFileSync(path.join(siteDir, 'content-snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf-8');
fs.writeFileSync(path.join(siteDir, '_redirects'), '/lookbook/*  /index.html  200\n', 'utf-8');
const requiredSeoFiles = ['robots.txt', 'llms.txt'];
for (const file of requiredSeoFiles) {
  if (!fs.existsSync(path.join(siteDir, file))) fail(`SEO discovery file missing from static output: ${file}`);
}
for (const number of [1, 2, 3, 4]) {
  const candidates = [`hero-${number}.webp`, `hero-${number}.jpg`];
  if (!candidates.some((file) => fs.existsSync(path.join(siteDir, file)))) {
    fail(`hero fallback image missing from static output: ${candidates.join(' or ')}`);
  }
}
if (publicOrigin) {
  const sitemap = fs.readFileSync(sitemapPath, 'utf-8');
  if (!sitemap.includes(`<loc>${publicOrigin}/</loc>`) || !html.includes(`href="${publicOrigin}/"`)) {
    fail('canonical URL and sitemap must match PUBLIC_SITE_ORIGIN');
  }
} else if (/rel="canonical"|property="og:url"/.test(html) || fs.existsSync(sitemapPath)) {
  fail('canonical, og:url, and sitemap absolute URLs must be omitted until PUBLIC_SITE_ORIGIN is configured');
}
fs.writeFileSync(
  path.join(siteDir, '_headers'),
  '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n' +
    '/assets/*.js\n  Content-Type: text/javascript; charset=utf-8\n\n' +
    '/assets/*.css\n  Content-Type: text/css; charset=utf-8\n',
  'utf-8',
);

const entryScript = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
const jsAsset = entryScript ? entryScript[1].replace(/^(?:\/|\.\/)?assets\//, '') : '';
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
