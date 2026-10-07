import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(filename) : [filename];
  });
}

export function verifyStaticOutput(directory, { requireSnapshot = true } = {}) {
  const root = path.resolve(directory);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const files = filesIn(root);

  function requireFile(reference, relativeTo = root) {
    const pathname = decodeURIComponent(reference.split(/[?#]/)[0]);
    const filename = path.resolve(pathname.startsWith('/') ? root : relativeTo, pathname.replace(/^\//, ''));
    if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      throw new Error(`Missing published asset: ${reference}`);
    }
    return filename;
  }

  for (const filename of files.filter((filename) => /\.(html|js|css|json)$/.test(filename))) {
    const text = fs.readFileSync(filename, 'utf8');
    if (/\/?src\/main\.tsx|\/?fonts\/fonts\.css/.test(text)) {
      throw new Error(`Development reference in ${path.relative(root, filename)}`);
    }
  }

  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)];
  if (!scripts.some(([tag, reference]) => /\btype=["']module["']/.test(tag) && /^\/assets\/[^/]+-[\w-]+\.js$/.test(reference))) {
    throw new Error('index.html has no Vite-generated module script');
  }
  const stylesheets = [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) => /\brel=["']stylesheet["']/.test(tag) ? tag.match(/\bhref=["']([^"']+)["']/)?.[1] : null)
    .filter(Boolean);
  if (!stylesheets.some((reference) => /^\/assets\/[^/]+-[\w-]+\.css$/.test(reference))) {
    throw new Error('index.html has no Vite-generated stylesheet');
  }
  for (const [, reference] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    if (!/^(?:https?:|data:|#)/.test(reference)) requireFile(reference);
  }

  for (const filename of files.filter((filename) => filename.includes(`${path.sep}assets${path.sep}`) && filename.endsWith('.css'))) {
    const css = fs.readFileSync(filename, 'utf8');
    for (const [, reference] of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
      if (!/^(?:https?:|data:|#)/.test(reference)) requireFile(reference, path.dirname(filename));
    }
  }
  if (!files.some((filename) => filename.endsWith('.woff2'))) throw new Error('No published font files');
  if (!stylesheets.map((reference) => fs.readFileSync(requireFile(reference), 'utf8')).join('\n').includes('@font-face')) {
    throw new Error('The production stylesheet does not include self-hosted fonts');
  }
  requireFile('/favicon.svg');

  if (requireSnapshot) {
    const snapshot = JSON.parse(fs.readFileSync(requireFile('/content-snapshot.json'), 'utf8'));
    for (const key of ['products', 'lookbooks', 'heroSlides']) {
      if (!Array.isArray(snapshot[key]) || snapshot[key].length === 0) throw new Error(`Missing ${key} content`);
      for (const record of snapshot[key]) {
        for (const key of ['image', 'cover', 'fallbackImage']) {
          if (record[key]?.startsWith('/')) requireFile(record[key]);
        }
      }
    }
  }
  return { html, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyStaticOutput(process.argv[2] || 'site');
    console.log(`Verified ${result.files.length} published files. Exact index.html:\n${result.html}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
