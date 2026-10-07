import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyStaticOutput } from '../scripts/verify-static.mjs';

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'muiro-artifact-test-'));
  fs.mkdirSync(path.join(directory, 'assets'));
  const html = '<html><head><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/index-123abc.css"></head><body><div id="root"></div><script type="module" crossorigin src="/assets/index-123abc.js"></script></body></html>';
  fs.writeFileSync(path.join(directory, 'index.html'), html);
  fs.writeFileSync(path.join(directory, 'assets', 'index-123abc.js'), 'export {};');
  fs.writeFileSync(path.join(directory, 'assets', 'index-123abc.css'), '@font-face{font-family:"DM Sans";src:url(/assets/dm-sans-123abc.woff2)}');
  fs.copyFileSync(new URL('../src/fonts/dm-sans-300-900-normal-latin.woff2', import.meta.url), path.join(directory, 'assets', 'dm-sans-123abc.woff2'));
  fs.copyFileSync(new URL('../public/favicon.svg', import.meta.url), path.join(directory, 'favicon.svg'));
  fs.writeFileSync(path.join(directory, 'hero.jpg'), 'test-image');
  fs.writeFileSync(path.join(directory, 'content-snapshot.json'), JSON.stringify({ products: [{ id: 'product' }], lookbooks: [{ id: 'lookbook' }], heroSlides: [{ image: '/hero.jpg' }] }));
  return directory;
}

function checkFixture(callback) {
  const directory = fixture();
  try {
    callback(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('accepts complete transformed output', () => checkFixture((directory) => {
  assert.equal(verifyStaticOutput(directory).files.length, 7);
}));

test('rejects the actual repository source HTML', () => checkFixture((directory) => {
  fs.copyFileSync(new URL('../index.html', import.meta.url), path.join(directory, 'index.html'));
  assert.throws(() => verifyStaticOutput(directory), /Development reference/);
}));

test('rejects a stale font stylesheet reference anywhere in output', () => checkFixture((directory) => {
  fs.writeFileSync(path.join(directory, 'assets', 'stale.js'), 'fetch("/fonts/fonts.css")');
  assert.throws(() => verifyStaticOutput(directory), /Development reference/);
}));

test('rejects missing emitted JavaScript', () => checkFixture((directory) => {
  fs.unlinkSync(path.join(directory, 'assets', 'index-123abc.js'));
  assert.throws(() => verifyStaticOutput(directory), /Missing published asset/);
}));

test('rejects missing generated CSS', () => checkFixture((directory) => {
  fs.unlinkSync(path.join(directory, 'assets', 'index-123abc.css'));
  assert.throws(() => verifyStaticOutput(directory), /Missing published asset/);
}));

test('rejects missing font URLs in generated CSS', () => checkFixture((directory) => {
  fs.writeFileSync(path.join(directory, 'assets', 'index-123abc.css'), '@font-face{src:url(./missing.woff2)}');
  assert.throws(() => verifyStaticOutput(directory), /Missing published asset/);
}));

test('rejects missing hero images in the content snapshot', () => checkFixture((directory) => {
  fs.unlinkSync(path.join(directory, 'hero.jpg'));
  assert.throws(() => verifyStaticOutput(directory), /Missing published asset/);
}));

test('rejects missing favicon', () => checkFixture((directory) => {
  fs.unlinkSync(path.join(directory, 'favicon.svg'));
  assert.throws(() => verifyStaticOutput(directory), /Missing published asset/);
}));
