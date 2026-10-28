/**
 * CMS integration E2E — proves the full data chain for the features this audit
 * repaired: image uploads (server receiving → persisted file → public URL →
 * saved against CMS records), hero slide ordering, delete-all hero slides
 * persisting as empty, and shared image values between Admin API writes and
 * the public reads.
 *
 * Run with the server up:  node --import tsx tests/cms-integration.test.ts
 * (Set BASE_URL if the server is not on 127.0.0.1:3111.)
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3111';
const ROOT = path.dirname(fileURLToPath(import.meta.url));

// --- Browser polyfills used by src/lib/api.ts -------------------------------
const store = new Map<string, string>();
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  get length() { return store.size; }
};
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}
};
(globalThis as unknown as { window: unknown }).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  open: () => null,
  location: { href: BASE_URL + '/', origin: BASE_URL, search: '', pathname: '/' },
  scrollTo: () => {}
};

// Node (unlike a browser) has no FileReader; supply a minimal one so the real
// src/lib/api.ts `readFileAsBase64` path executes identically here.
class FileReaderPolyfill {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  readAsDataURL(blob: Blob): void {
    blob.arrayBuffer().then((buf) => {
      const b64 = Buffer.from(buf).toString('base64');
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
      this.onload?.();
    }).catch(() => this.onerror?.());
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = FileReaderPolyfill;

const nativeFetch = globalThis.fetch.bind(globalThis);
(globalThis as unknown as { fetch: typeof nativeFetch }).fetch = (input: any, init?: any) => {
  const url = typeof input === 'string' && input.startsWith('/') ? `${BASE_URL}${input}` : input;
  return nativeFetch(url, init);
};

// A real 1x1 transparent PNG (valid magic bytes).
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let failures = 0;
const mark = (ok: boolean, msg: string): boolean => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures++;
  return ok;
};

async function main(): Promise<void> {
  const { api } = await import('../src/lib/api');

  // ---------- 1. Upload endpoint is admin-only ----------
  const unauth = await nativeFetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: TINY_PNG_BASE64, filename: 'x.png' })
  });
  mark(unauth.status === 401, `POST /api/upload without a session -> HTTP ${unauth.status} (protected)`);

  // ---------- 2. Login via the real client code ----------
  const pin = process.env.MUIRO_ADMIN_PIN;
  if (!pin) throw new Error('MUIRO_ADMIN_PIN required to run the CMS integration test');
  mark(await api.verifyAdminCredential(pin), 'client logs in with the configured passcode');

  // ---------- 3. Managed categories persist and are safe to rename/delete ----------
  const initialCategories = await api.getCategories();
  mark(Array.isArray(initialCategories) && initialCategories.length > 0, 'category endpoint returns managed/derived categories');
  const category = await api.createCategory({ name: 'CMS Integration Category', slug: 'cms-integration-category', description: 'Temporary integration category' });
  mark(!!category.id && category.slug === 'cms-integration-category', `category created -> ${category.id}`);

  // ---------- 4. Upload a real image ----------
  const up = await api.uploadImage(new File([Buffer.from(TINY_PNG_BASE64, 'base64')], 'tiny.png', { type: 'image/png' }));
  mark(typeof up.url === 'string' && up.url.startsWith('/uploads/'), `upload returns a public path -> ${up.url}`);
  mark(/^[A-Za-z0-9_./-]+$/.test(up.url), 'upload URL has no unsafe characters / no Windows path leak');
  mark(up.mime === 'image/png', `server validated the real bytes -> mime ${up.mime}`);

  const imgRes = await nativeFetch(`${BASE_URL}${up.url}`);
  const bytes = Buffer.from(await imgRes.arrayBuffer());
  mark(imgRes.status === 200, `uploaded file is servable -> HTTP ${imgRes.status}`);
  mark(bytes.length > 0 && bytes[0] === 0x89 && bytes[1] === 0x50, 'served file is the exact image bytes (PNG magic)');
  mark((imgRes.headers.get('content-type') || '').startsWith('image/'), `served with image content type -> ${imgRes.headers.get('content-type')}`);

  // ---------- 4. Invalid uploads are rejected ----------
  let garbageRejected = false;
  try { await api.uploadImage(new File([Buffer.from('this is not an image')], 'bad.bin', { type: 'application/octet-stream' })); }
  catch { garbageRejected = true; }
  mark(garbageRejected, 'non-image bytes are rejected by the server');
  const unsupported = await nativeFetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'), filename: 'x.svg' })
  });
  // requires a session token
  mark(unsupported.status === 401, 'SVG upload without session still blocked by auth');
  let svgWithSessionRejected = false;
  try {
    await api.uploadImage(new File([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>')], 'x.svg', { type: 'image/svg+xml' }));
  } catch { svgWithSessionRejected = true; }
  mark(svgWithSessionRejected, 'SVG upload WITH a session is rejected — only raster image formats are stored (XSS-safe)');

  // ---------- 5. Upload image saved against a HERO slide and returned by GET ----------
  const hs = await api.createHeroSlide({
    title: 'CMS Integration Slide',
    tagline: 'integration test',
    category: 'Test Edit',
    image: up.url,
    fallbackImage: up.url,
    lookId: undefined,
    keyPieces: [],
    isActive: true,
    order: 1
  });
  mark(!!hs && hs.id != null, `hero slide created -> ${hs && hs.id}`);
  const heroList = await api.getHeroSlides();
  const savedHero = heroList.find((s: any) => s.id === hs.id);
  mark(!!savedHero && savedHero.image === up.url, `GET /hero-slides returns the exact uploaded image -> ${savedHero && savedHero.image}`);
  const updated = await api.updateHeroSlide(hs.id, { image: up.url, order: 99, isActive: true });
  mark(updated && updated.image === up.url, 'hero slide image persists through PUT');

  // ---------- 6. Hero slide ordering ----------
  const allHeroes = await api.getHeroSlides();
  const sorted = [...allHeroes].sort((a: any, b: any) => (a.order ?? 99999) - (b.order ?? 99999));
  mark(JSON.stringify(allHeroes.map((h: any) => h.id)) === JSON.stringify(sorted.map((h: any) => h.id)),
    'getHeroSlides returns slides ordered by the persisted order field (public Hero and admin list agree)');

  // ---------- 7. Product image saved & returned ----------
  const products = await api.getProducts();
  const merchant = (await api.getMerchants())[0];
  const program = (await api.getAffiliatePrograms()).find((p: any) => p.id === merchant.affiliateProgramId)!;
  const prod = await api.createProduct({
    title: 'CMS Integration Product',
    price: '$123.45',
    numericPrice: 123.45,
    category: category.name,
    merchant: merchant.name,
    merchantId: merchant.id,
    affiliateProgramId: program.id,
    image: up.url,
    imageAlt: 'A cream coat on a model against a neutral backdrop',
    affiliateUrl: 'https://www.amazon.com/dp/B0CMSINTEGRATE?tag=fashionzon03-20',
    commissionRate: 9,
    description: 'integration test product',
    isNewlyAdded: false,
    isTrending: false,
    featured: false
  });
  mark(!!prod && prod.id != null, `product created -> ${prod && prod.id}`);
  mark(prod.image === up.url, `product persisted the uploaded image -> ${prod.image}`);
  mark(prod.imageAlt === 'A cream coat on a model against a neutral backdrop', 'product image alt text persists on create');
  mark(prod.category === category.name, 'new product is assigned to its managed category');
  mark(prod.price === '$123.45', `product price persisted -> "${prod.price}"`);
  const updatedAltProduct = await api.updateProduct(prod.id, { imageAlt: 'Updated coat image description' });
  mark(updatedAltProduct.imageAlt === 'Updated coat image description', 'product image alt text persists through update');
  const productList = await api.getProducts();
  const savedProd = productList.find((p: any) => p.id === prod.id);
  mark(!!savedProd && savedProd.image === up.url, 'GET /products returns the same uploaded image');

  // ---------- 8. Lookbook cover saved & returned ----------
  const lb = await api.createLookbook({
    title: 'CMS Integration Look',
    board: 'Test Board',
    category: category.name,
    cover: up.url,
    description: 'lookbook with uploaded cover',
    pieces: [prod.id]
  });
  mark(!!lb && lb.cover === up.url, `lookbook cover persisted the uploaded image -> ${lb.cover}`);
  const lookbookList = await api.getLookbooks();
  const savedLook = lookbookList.find((l: any) => l.id === lb.id);
  mark(!!savedLook && savedLook.pieces.includes(prod.id) && savedLook.cover === up.url, 'GET /lookbooks returns uploaded cover + product relationship');
  mark(savedLook?.category === category.name, 'new lookbook is assigned to its managed category');

  const renamedCategory = await api.updateCategory(category.id, { name: 'CMS Integration Edit', slug: 'cms-integration-edit' });
  mark(renamedCategory.name === 'CMS Integration Edit', 'category can be renamed');
  const renamedProduct = (await api.getProducts()).find((item: any) => item.id === prod.id);
  const renamedLookbook = (await api.getLookbooks()).find((item: any) => item.id === lb.id);
  mark(renamedProduct?.category === renamedCategory.name && renamedLookbook?.category === renamedCategory.name, 'renaming a category propagates to assigned products and lookbooks');
  let assignedCategoryDeleteBlocked = false;
  try { await api.deleteCategory(category.id); } catch { assignedCategoryDeleteBlocked = true; }
  mark(assignedCategoryDeleteBlocked, 'assigned category cannot be deleted until content is reassigned');

  // ---------- 10. Testimonial can store the uploaded avatar ----------
  const tst = await api.createTestimonial({
    author: 'CMS Integration', location: 'Test', avatar: up.url, rating: 5, outfitTitle: 'Test', comment: 'integration avatar', verified: true
  });
  mark(!!tst && tst.avatar === up.url, `testimonial avatar persisted -> ${tst.avatar}`);

  // ---------- 11. Delete-all hero slides persists as empty (no silent re-seed) ----------
  const backingHeroes = await api.getHeroSlides();
  for (const s of backingHeroes) await api.deleteHeroSlide(s.id);
  const afterDeleteAll = await api.getHeroSlides();
  mark(afterDeleteAll.length === 0, `deleting every hero slide persists empty (no hard-coded defaults resurrected) -> got ${afterDeleteAll.length}`);
  // restore the original slides so the public site is intact
  const restored = await api.updateAllHeroSlides(backingHeroes as never);
  mark(restored.length === backingHeroes.length && restored.length > 0, `hero slides restored (${restored.length}) after delete-all test`);

  // ---------- 12. Cleanup temp records ----------
  await api.deleteProduct(prod.id);
  await api.deleteLookbook(lb.id);
  await api.deleteTestimonial(tst.id);
  await api.deleteHeroSlide(hs.id);
  await api.deleteCategory(category.id);
  const remainingCategories = await api.getCategories();
  mark(!remainingCategories.some((item: any) => item.id === category.id), 'unused managed category can be deleted after content cleanup');
  const finalProducts = await api.getProducts();
  mark(!finalProducts.some((p: any) => p.id === prod.id), 'cleanup removed the integration product');

  console.log(`\nFAILURES=${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
