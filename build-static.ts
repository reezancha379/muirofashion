import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { verifyStaticOutput } from './scripts/verify-static.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(root, 'dist');
const siteDir = path.join(root, 'site');

function readContent(filename: string, key: string) {
  const context = { window: {} as Record<string, unknown> };
  vm.runInNewContext(fs.readFileSync(path.join(root, filename), 'utf8'), context, { timeout: 1000 });
  const records = context.window[key];
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`No content found in ${filename}`);
  }
  return records;
}

function main() {
  fs.rmSync(siteDir, { recursive: true, force: true });
  fs.rmSync(distDir, { recursive: true, force: true });

  const snapshot = {
    products: readContent('products.js', 'PRODUCTS'),
    lookbooks: readContent('lookbooks.js', 'LOOKBOOKS'),
    heroSlides: [
      { id: 'hero-1', title: 'Fashion, curated with a closer look.', image: '/hero-1.jpg', order: 0 },
      { id: 'hero-2', title: 'MUIRO Fashion Edit', image: '/hero-2.jpg', order: 1 },
      { id: 'hero-3', title: 'Shoppable discoveries', image: '/hero-3.png', order: 2 },
      { id: 'hero-4', title: 'Everyday style inspiration', image: '/hero-4.png', order: 3 },
    ],
  };

  console.log('[build-static] Running Vite production compilation');
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [viteBin, 'build'], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Vite failed with exit status ${result.status}`);

  verifyStaticOutput(distDir, { requireSnapshot: false });
  fs.cpSync(distDir, siteDir, { recursive: true });
  for (const slide of snapshot.heroSlides) {
    fs.copyFileSync(path.join(root, slide.image.slice(1)), path.join(siteDir, slide.image.slice(1)));
  }
  for (const filename of ['about.html', 'shop.html', 'lookbook.html', 'muiro.css', 'muiro.js', 'products.js', 'lookbooks.js']) {
    fs.copyFileSync(path.join(root, filename), path.join(siteDir, filename));
  }
  fs.writeFileSync(path.join(siteDir, 'content-snapshot.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(siteDir, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n');

  verifyStaticOutput(siteDir);
  const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  if (html !== fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')) {
    throw new Error('Published HTML differs from the Vite-generated HTML');
  }
  console.log('[build-static] VERIFIED publish directory: site');
  console.log('[build-static] Exact contents of site/index.html:\n' + html);
}

try {
  main();
} catch (error) {
  fs.rmSync(siteDir, { recursive: true, force: true });
  console.error('[build-static]', error instanceof Error ? error.message : 'Production build failed');
  process.exitCode = 1;
}
