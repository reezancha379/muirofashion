/**
 * Downloads the Google Fonts used by index.html into public/fonts/ and writes
 * a local fonts.css, so the site has no external stylesheet dependency.
 *
 *   node fetch-fonts.mjs
 *
 * Removes the browser's "css2:1 net::ERR_NAME_NOT_RESOLVED" error when offline
 * and drops a render-blocking third-party request from the deployed site.
 * Only the latin and latin-ext subsets are kept to limit size.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, 'public', 'fonts');
const CSS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=DM+Sans:ital,opsz,wght@0,9..40,300..900;1,9..40,300..900' +
  '&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400' +
  '&family=Outfit:wght@400;500;600;700;800' +
  '&family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..800' +
  '&family=Urbanist:ital,wght@0,400..800;1,400..800' +
  '&display=swap';

// A desktop Chrome UA makes Google serve woff2 (otherwise it falls back to ttf).
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const KEEP_SUBSETS = new Set(['latin', 'latin-ext']);

async function main() {
  const res = await fetch(CSS_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`css fetch failed: HTTP ${res.status}`);
  let css = await res.text();

  // Google groups faces by a leading /* subset */ comment.
  const segments = css.split(/(?=\/\*\s*[a-z0-9-]+\s*\*\/)/g).filter((s) => s.trim());

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let kept = 0;
  let skipped = 0;
  let bytes = 0;
  const seen = new Map();

  for (const seg of segments) {
    const subsetMatch = seg.match(/\/\*\s*([a-z0-9-]+)\s*\*\//);
    const subset = subsetMatch ? subsetMatch[1] : null;
    const urlMatch = seg.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);

    if (!subset || !urlMatch || !KEEP_SUBSETS.has(subset)) {
      skipped++;
      continue;
    }

    const url = urlMatch[1];
    const family = (seg.match(/font-family:\s*'([^']+)'/) || [, 'font'])[1]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const style = (seg.match(/font-style:\s*(\w+)/) || [, 'normal'])[1];
    const weight = (seg.match(/font-weight:\s*([\d\s]+)/) || [, '400'])[1].trim().replace(/\s+/g, '-');
    const base = `${family}-${weight}-${style}-${subset}`;

    let filename = seen.get(url);
    if (!filename) {
      filename = `${base}.woff2`;
      let n = 1;
      while (fs.existsSync(path.join(outDir, filename))) {
        filename = `${base}-${n++}.woff2`;
      }
      const bin = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!bin.ok) {
        console.warn(`  skip (HTTP ${bin.status}) ${url}`);
        skipped++;
        continue;
      }
      const buf = Buffer.from(await bin.arrayBuffer());
      fs.writeFileSync(path.join(outDir, filename), buf);
      bytes += buf.length;
      seen.set(url, filename);
      kept++;
    }

    // Point at the local copy (same directory as fonts.css).
    collected.push(seg.replace(urlMatch[1], `./${filename}`));
  }

  const finalCss = collected.join('').trim() + '\n';
  fs.writeFileSync(path.join(outDir, 'fonts.css'), finalCss, 'utf-8');

  const faces = (finalCss.match(/@font-face/g) || []).length;
  console.log(`[fetch-fonts] ${kept} files, ${faces} @font-face rules, ${(bytes / 1024).toFixed(0)} KB`);
  console.log(`[fetch-fonts] skipped ${skipped} non-latin/other segments`);
  console.log(`[fetch-fonts] -> public/fonts/fonts.css`);

  if (faces === 0) {
    console.error('[fetch-fonts] ERROR: no font faces written');
    process.exit(1);
  }
}

const collected = [];

main().catch((e) => {
  console.error(`[fetch-fonts] ERROR: ${e.message}`);
  process.exit(1);
});
