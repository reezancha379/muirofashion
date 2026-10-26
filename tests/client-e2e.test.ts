/**
 * True client-side E2E.
 *
 * Loads the REAL `src/lib/api.ts` (not a reimplementation) and drives it
 * against the running server, polyfilling only the browser globals it touches
 * (sessionStorage / window). This proves the exact code the admin panel and
 * the shop buttons execute -- token attachment, 401 broadcast, and the
 * affiliate destination -- rather than proving the server in isolation.
 *
 * Run:  node --import tsx client-e2e.test.ts
 */

const store = new Map<string, string>();
let lastEvent: unknown = null;

const sessionStoragePolyfill = {
  getItem: (k: string): string | null => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string): void => void store.set(k, String(v)),
  removeItem: (k: string): void => void store.delete(k),
  clear: (): void => store.clear(),
  get length(): number {
    return store.size;
  }
};

const localStore = new Map<string, string>();
const localStoragePolyfill = {
  getItem: (k: string): string | null => (localStore.has(k) ? (localStore.get(k) as string) : null),
  setItem: (k: string, v: string): void => void localStore.set(k, String(v)),
  removeItem: (k: string): void => void localStore.delete(k)
};

(globalThis as unknown as { sessionStorage: typeof sessionStoragePolyfill }).sessionStorage = sessionStoragePolyfill;
(globalThis as unknown as { localStorage: typeof localStoragePolyfill }).localStorage = localStoragePolyfill;

const windowPolyfill = {
  dispatchEvent: (e: unknown): boolean => {
    lastEvent = e;
    return true;
  },
  addEventListener: (): void => {},
  removeEventListener: (): void => {},
  open: (): null => null,
  location: { href: 'http://127.0.0.1:3000/', origin: 'http://127.0.0.1:3000', search: '', pathname: '/' },
  scrollTo: (): void => {}
};
(globalThis as unknown as { window: typeof windowPolyfill }).window = windowPolyfill;

// The browser resolves relative URLs against the page origin; Node's fetch
// does not. Mirror that so the client code under test can keep using
// '/api/...' paths exactly as it does in the browser.
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const nativeFetch = globalThis.fetch.bind(globalThis) as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
(globalThis as unknown as { fetch: typeof nativeFetch }).fetch = (input, init) => {
  const url = typeof input === 'string' && input.startsWith('/') ? `${BASE_URL}${input}` : input;
  return nativeFetch(url, init);
};

let failures = 0;
const mark = (ok: boolean, msg: string): boolean => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures++;
  return ok;
};

async function main(): Promise<void> {
  const mod = await import('../src/lib/api');
  const api = mod.api;
  const { getAdminToken, setAdminToken } = mod;

  // ---------- 1. Login through the real client code ----------
  const bad = await api.verifyAdminCredential('MUIRO-RESET');
  mark(bad === false, 'client rejects hardcoded backdoor credential "MUIRO-RESET"');
  const bad2 = await api.verifyAdminCredential('not-a-recovery-key');
  mark(bad2 === false, 'client rejects non-credential recovery text as a LOGIN');
  const wrong = await api.verifyAdminCredential('0000');
  mark(wrong === false, 'client rejects wrong passcode');

  const testPin = process.env.MUIRO_ADMIN_PIN;
  if (!testPin) throw new Error('MUIRO_ADMIN_PIN is required to run the client E2E test');
  const ok = await api.verifyAdminCredential(testPin);
  mark(ok === true, 'client logs in with the configured test passcode');
  mark(getAdminToken() !== null, 'client stored a session token');

  const sessionValid = await api.getSessionStatus();
  mark(sessionValid === true, 'client session probe reports valid');

  const pinStatus = await api.getAdminPinStatus();
  mark(
    pinStatus.configured === true && typeof pinStatus.length === 'number',
    `PIN status exposes only configured/length -> ${JSON.stringify(pinStatus)}`
  );

  // ---------- 1b. Affiliate programs & merchants ----------
  const programs = await api.getAffiliatePrograms();
  mark(programs.length > 0, `affiliate programs are data-driven -> ${programs.length}`);
  const merchants = await api.getMerchants();
  mark(merchants.length > 0, `merchants are data-driven -> ${merchants.length}`);
  const createdProgram = await api.createAffiliateProgram({
    name: 'CLIENT E2E Network',
    network: 'E2E',
    website: 'https://example.com/',
    defaultCommissionRate: 5,
    disclosure: 'E2E',
    status: 'active'
  });
  const createdMerchant = await api.createMerchant({
    name: 'CLIENT E2E Merchant',
    website: 'https://example.com/',
    affiliateProgramId: createdProgram.id,
    status: 'active'
  });
  mark(!!createdMerchant.id, 'client created merchant under a data-driven affiliate program');
  await api.deleteMerchant(createdMerchant.id);
  await api.deleteAffiliateProgram(createdProgram.id);
  mark(true, 'client cleaned up temporary merchant and affiliate program');

  // ---------- 2. Products: create / edit / delete ----------
  const cmsMerchant = merchants[0];
  const cmsProgram = programs.find((p) => p.id === cmsMerchant.affiliateProgramId) || programs[0];
  const created = await api.createProduct({
    title: 'CLIENT E2E Loafer',
    price: '$62.00',
    numericPrice: 62,
    category: 'Shoes',
    merchant: cmsMerchant.name,
    merchantId: cmsMerchant.id,
    affiliateProgramId: cmsProgram.id,
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
    affiliateUrl: 'https://www.amazon.com/dp/B0CLIENTE2E?tag=fashionzon03-20',
    commissionRate: 12,
    badge: 'Client E2E',
    description: 'created by client-side e2e',
    isNewlyAdded: true,
    isTrending: false,
    featured: true
  });
  mark(!!created && !!created.id, `client created product (token attached) -> id=${created && created.id}`);
  mark(created?.merchantId === cmsMerchant.id && created?.merchant === cmsMerchant.name, 'product stores the selected CMS merchant record');
  mark(created?.affiliateProgramId === cmsProgram.id, 'product stores the explicitly selected affiliate program');
  mark(created?.description === 'created by client-side e2e', 'product description persisted on create');
  mark(created?.affiliateUrl === 'https://www.amazon.com/dp/B0CLIENTE2E?tag=fashionzon03-20', 'product affiliate URL persisted on create');

  let invalidCreateRejected = false;
  try {
    await api.createProduct({
      title: 'CLIENT E2E Invalid URL',
      price: '$10.00',
      category: 'Test',
      merchantId: cmsMerchant.id,
      affiliateProgramId: cmsProgram.id,
      image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
      affiliateUrl: 'https://not-allowed.invalid/product',
      description: 'should be rejected'
    });
  } catch {
    invalidCreateRejected = true;
  }
  mark(invalidCreateRejected, 'invalid affiliate URL is rejected on create');
  if (!created || !created.id) {
    console.log('\nABORT: could not create product');
    process.exit(1);
  }

  let all = await api.getProducts();
  mark(all.some((p) => p.id === created.id), 'created product visible in list');

  const edited = await api.updateProduct(created.id, { title: 'CLIENT E2E Loafer EDITED', price: '$71.00', numericPrice: 71, description: 'edited product description', affiliateUrl: 'https://www.amazon.com/dp/B0CLIENTEDIT?tag=fashionzon03-20' });
  mark(!!edited && edited.title.includes('EDITED'), `client edit persisted -> "${edited && edited.title}"`);
  mark(!!edited && edited.price === '$71.00', `client edit price persisted -> "${edited && edited.price}"`);
  mark(edited?.description === 'edited product description', 'product description persists on update');
  mark(edited?.affiliateUrl === 'https://www.amazon.com/dp/B0CLIENTEDIT?tag=fashionzon03-20', 'product affiliate URL persists on update');

  let invalidUpdateRejected = false;
  try {
    await api.updateProduct(created.id, { affiliateUrl: 'https://not-allowed.invalid/product' });
  } catch {
    invalidUpdateRejected = true;
  }
  mark(invalidUpdateRejected, 'invalid affiliate URL is rejected on update just like create');

  all = await api.getProducts();
  const persisted = all.find((p) => p.id === created.id);
  mark(!!persisted && persisted.title.includes('EDITED'), 'edit survived a fresh fetch (what the admin panel re-reads)');

  // ---------- 3. Lookbook / testimonial / hero ----------
  const lb = await api.createLookbook({
    title: 'CLIENT E2E Look',
    cover: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=800&q=80',
    category: 'Fall Fashion',
    description: 'lookbook regression description',
    pieces: [created.id]
  });
  mark(!!lb && !!lb.id, `client created lookbook -> id=${lb && lb.id}`);
  mark(lb?.pieces.includes(created.id), 'lookbook stores the created product relationship by product ID');
  mark(lb?.description === 'lookbook regression description', 'lookbook description persisted');
  const lbEd = await api.updateLookbook(lb.id, { title: 'CLIENT E2E Look EDITED', isTrending: true, pieces: [created.id], description: 'edited lookbook description' });
  mark(!!lbEd && lbEd.title.includes('EDITED') && lbEd.isTrending === true, 'client lookbook edit persisted');
  mark(lbEd?.pieces.length === 1 && lbEd.pieces[0] === created.id, 'lookbook → product relationship survives update');
  mark(lbEd?.description === 'edited lookbook description', 'lookbook description persists on update');
  const refreshedLookbooks = await api.getLookbooks();
  const refreshedLook = refreshedLookbooks.find((look) => look.id === lb.id);
  const refreshedProducts = await api.getProducts();
  const relationshipProduct = refreshedLook ? refreshedProducts.find((product) => refreshedLook.pieces.includes(product.id)) : undefined;
  mark(!!relationshipProduct && relationshipProduct.id === created.id, 'fresh fetch resolves lookbook piece to saved product data');
  mark(relationshipProduct?.description === 'edited product description' && relationshipProduct?.affiliateUrl === 'https://www.amazon.com/dp/B0CLIENTEDIT?tag=fashionzon03-20', 'resolved lookbook product retains description + affiliate URL');

  const tst = await api.createTestimonial({ author: 'Client E2E', location: 'Berlin', rating: 5, outfitTitle: 'Looks', comment: 'client e2e', verified: true });
  mark(!!tst && !!tst.id, `client created testimonial -> id=${tst && tst.id}`);
  const tstEd = await api.updateTestimonial(tst.id, { comment: 'client e2e edited' });
  mark(!!tstEd && tstEd.comment === 'client e2e edited', 'client testimonial edit persisted');

  const hs = await api.createHeroSlide({
    title: 'CLIENT E2E Slide',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1600&q=80'
  });
  mark(!!hs && !!hs.id, `client created hero slide -> id=${hs && hs.id}`);
  const hsEd = await api.updateHeroSlide(hs.id, { title: 'CLIENT E2E Slide EDITED', isActive: false });
  mark(!!hsEd && hsEd.title.includes('EDITED') && hsEd.isActive === false, 'client hero edit persisted');
  const reordered = await api.updateAllHeroSlides((await api.getHeroSlides()).map((s) => ({ id: s.id } as never)));
  mark(Array.isArray(reordered), `client bulk reorder saved -> ${reordered.length} slides`);

  // ---------- 4. THE CLICK: does the user reach a real destination? ----------
  const products = await api.getProducts();
  let clickFailures = 0;
  for (const p of products) {
    try {
      const res = await api.handleAffiliateClick(p.id, undefined, 'web_lookbook');
      const isHttp = /^https?:\/\//i.test(res.safeUrl || '');
      if (!isHttp) clickFailures++;
      if (!isHttp) console.log(`      !! ${p.id} returned unsafeUrl: ${JSON.stringify(res.safeUrl)}`);
    } catch (e) {
      clickFailures++;
      console.log(`      !! ${p.id} threw: ${(e as Error).message}`);
    }
  }
  mark(clickFailures === 0, `all ${products.length} product clicks resolve to a real http(s) destination`);

  const one = await api.handleAffiliateClick(products[0].id, undefined, 'web_lookbook');
  mark(
    one.safeUrl === products[0].affiliateUrl,
    `click returns the exact destination\n      -> ${one.safeUrl}`
  );

  // ---------- 5. 401 handling: what happens when the session is gone ----------
  setAdminToken(null);
  store.delete('muiro_admin_auth');
  lastEvent = null;
  let rejected = false;
  try {
    await api.createProduct({ title: 'should not work', image: 'https://x.com/a.jpg', affiliateUrl: 'https://www.amazon.com/dp/X' });
  } catch {
    rejected = true;
  }
  mark(rejected, 'mutation with no token is rejected by the server');
  mark(lastEvent !== null, 'client broadcasts "muiro:unauthorized" so the shell logs out');
  mark(store.get('muiro_admin_auth') === undefined, 'client clears its stored auth flag on 401');

  // ---------- 6. Cleanup ----------
  const relogin = await api.verifyAdminCredential(testPin);
  if (relogin) {
    await api.deleteProduct(created.id);
    await api.deleteLookbook(lb.id);
    await api.deleteTestimonial(tst.id);
    await api.deleteHeroSlide(hs.id);
    const after = await api.getProducts();
    mark(!after.some((p) => p.id === created.id), 'cleanup removed the test product');
  }

  console.log(`\nFAILURES=${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
