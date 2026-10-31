import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

const seedState = {
  products: [{
    id: 'p-1', title: 'Test coat', price: '$120.00', numericPrice: 120,
    category: 'Outerwear', image: 'https://assets.example/coat.jpg',
    description: 'Plain text <script>not executable</script>',
    affiliateUrl: 'https://www.amazon.com/dp/B000000001?tag=muiro-20',
    merchant: 'Amazon', merchantId: 'm-1', affiliateProgramId: 'program-1',
    commissionRate: 8, seoTitle: 'Test coat | MUIRO', seoDescription: 'A test coat',
    seoKeywords: 'coat, muiro', clicks: 23, adminNote: 'private', authToken: 'product-secret',
  }],
  lookbooks: [{ id: 'look-1', title: 'Winter edit', board: 'Winter', category: 'Outerwear', cover: '/cover.jpg', pieces: ['p-1', 'deleted-product'], pieceCovers: { 'p-1': '/detail.jpg', 'deleted-product': '/stale.jpg', orphan: '/orphan.jpg' }, description: 'Warm layers', authorNote: 'private note', privateSettings: { secret: 'lookbook-secret' }, seoTitle: 'Winter edit | MUIRO', seoDescription: 'Winter looks', seoKeywords: 'winter, style', views: 41, likes: 8 }],
  testimonials: [{ id: 'review-1', author: 'Ari', comment: 'Lovely', verified: true, privateEmail: 'hidden@example.com' }],
  heroSlides: [{ id: 'hero-1', title: 'Winter', image: '/winter.jpg', order: 1, privateToken: 'hidden' }],
  settings: { seoTitle: 'MUIRO', seoDescription: 'MUIRO fashion', seoKeywords: 'MUIRO, MuiroFashion', affiliateDisclosure: 'Qualifying purchases may earn MUIRO a commission at no extra cost to you.', adminSecret: 'hidden', arbitraryPrivateSetting: 'not-public' },
  affiliatePrograms: [{ id: 'pr-1', name: 'Amazon Associates', network: 'Amazon', defaultCommissionRate: 8, privateCredential: 'affiliate-secret' }],
  merchants: [{ id: 'm-1', name: 'Amazon', affiliateProgramId: 'pr-1', privateAccountId: 'merchant-secret' }], media: [], clicks: [], impressions: 0,
  categories: [],
  adminPin: 'not-for-public', adminPinLength: 6, sessionSecret: 'test-secret',
  authenticatorSecret: 'private-secret', authenticatorEnabled: true,
};

let state: typeof seedState;
let rpcCount: number;
let edgeHandler: ((request: Request) => Response | Promise<Response>) | undefined;

(globalThis as any).Deno = {
  env: { get: (name: string) => ({ SUPABASE_URL: 'https://test-project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', IP_SALT: 'test-salt' } as Record<string, string>)[name] || '' },
  serve: (handler: (request: Request) => Response | Promise<Response>) => { edgeHandler = handler; },
};
(globalThis as any).EdgeRuntime = { waitUntil: (promise: Promise<unknown>) => { void promise; } };

await import('../supabase/functions/muiro-api/index.ts');

beforeEach(() => {
  state = structuredClone(seedState);
  rpcCount = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/rest/v1/rpc/muiro_allow_request')) {
      rpcCount += 1;
      return new Response('true', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/rest/v1/muiro_state')) {
      if (init?.method === 'PATCH') {
        const patch = JSON.parse(String(init.body));
        state = patch.state;
        return new Response(JSON.stringify([{ state, updated_at: patch.updated_at }]), { status: 200 });
      }
      return new Response(JSON.stringify([{ state, updated_at: '2026-10-28T00:00:00.000Z' }]), { status: 200 });
    }
    if (url.endsWith('/storage/v1/bucket')) {
      return new Response(JSON.stringify([{ name: 'muiro-public', public: true, file_size_limit: 26214400, allowed_mime_types: ['application/json','image/jpeg','image/png','image/gif','image/webp','image/avif','video/mp4','video/webm'] }]), { status: 200 });
    }
    if (url.includes('/storage/v1/object/muiro-public/content-snapshot.json') && init?.method === 'POST') {
      return new Response(JSON.stringify({ Key: 'content-snapshot.json' }), { status: 200 });
    }
    throw new Error(`Unexpected mocked Supabase request: ${init?.method || 'GET'} ${url}`);
  }) as typeof fetch;
});

async function jsonRequest(path: string, init: RequestInit = {}) {
  assert.ok(edgeHandler, 'Supabase Edge Function should register a request handler');
  return edgeHandler(new Request(`https://edge.test${path}`, init));
}

function base64url(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Buffer.from(bytes).toString('base64url');
}
async function adminToken(): Promise<string> {
  const payload = base64url(JSON.stringify({ sub: 'admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, jti: 'test-jti' }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('test-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${payload}.${base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))))}`;
}

test('anonymous product collection read returns public-safe content from the CMS state', async () => {
  const response = await jsonRequest('/api/products');
  assert.equal(response.status, 200);
  const products = await response.json();
  assert.equal(products.length, 1);
  assert.equal(products[0].id, 'p-1');
  assert.equal(products[0].seoTitle, 'Test coat | MUIRO');
  assert.equal(products[0].affiliateUrl, seedState.products[0].affiliateUrl);
  assert.equal(products[0].clicks, 0);
  assert.equal('commissionRate' in products[0], false);
  assert.equal('adminNote' in products[0], false);
  assert.equal('authToken' in products[0], false);
  assert.equal(rpcCount, 0);
});

test('anonymous lookbook, testimonial, hero and settings reads are public-safe', async () => {
  const [lookbooks, testimonials, heroes, settings] = await Promise.all([
    jsonRequest('/api/lookbooks'),
    jsonRequest('/api/testimonials'),
    jsonRequest('/api/hero-slides'),
    jsonRequest('/api/settings'),
  ]);
  assert.equal(lookbooks.status, 200);
  assert.equal(testimonials.status, 200);
  assert.equal(heroes.status, 200);
  assert.equal(settings.status, 200);
  const look = (await lookbooks.json())[0];
  assert.equal(look.seoKeywords, 'winter, style');
  assert.equal(look.views, 0);
  assert.equal('authorNote' in look, true);
  assert.deepEqual(look.pieces, ['p-1']);
  assert.deepEqual(look.pieceCovers, { 'p-1': '/detail.jpg' });
  assert.equal('privateSettings' in look, false);
  assert.equal('privateEmail' in (await testimonials.json())[0], false);
  assert.equal('privateToken' in (await heroes.json())[0], false);
  assert.equal((await settings.json()).affiliateDisclosure, seedState.settings.affiliateDisclosure);
  assert.equal('adminSecret' in (await jsonRequest('/api/settings').then(r => r.json())), false);
  assert.equal('arbitraryPrivateSetting' in (await jsonRequest('/api/settings').then(r => r.json())), false);
});

test('affiliate-program and merchant collections are owner-only, while owner reads retain CMS fields', async () => {
  assert.equal((await jsonRequest('/api/affiliate-programs')).status, 401);
  assert.equal((await jsonRequest('/api/merchants')).status, 401);
  const headers = { 'x-muiro-session': await adminToken() };
  const programsResponse = await jsonRequest('/api/affiliate-programs', { headers });
  const merchantsResponse = await jsonRequest('/api/merchants', { headers });
  assert.equal(programsResponse.status, 200);
  assert.equal(merchantsResponse.status, 200);
  const programs = await programsResponse.json();
  const merchants = await merchantsResponse.json();
  assert.equal(programs[0].defaultCommissionRate, 8);
  assert.equal(programs[0].privateCredential, 'affiliate-secret');
  assert.equal(merchants[0].privateAccountId, 'merchant-secret');

  const ownerProducts = await jsonRequest('/api/products', { headers }).then(response => response.json());
  const ownerLookbooks = await jsonRequest('/api/lookbooks', { headers }).then(response => response.json());
  assert.equal(ownerProducts[0].commissionRate, 8);
  assert.equal(ownerProducts[0].clicks, 23);
  assert.equal(ownerProducts[0].authToken, 'product-secret');
  assert.deepEqual(ownerLookbooks[0].pieces, ['p-1', 'deleted-product']);
  assert.equal(ownerLookbooks[0].privateSettings.secret, 'lookbook-secret');
});

test('category collection is public-read and owner-write with rename propagation and safe deletion', async () => {
  const anonymousRead = await jsonRequest('/api/categories');
  assert.equal(anonymousRead.status, 200);
  const initial = await anonymousRead.json();
  assert.equal(initial.some((category: any) => category.name === 'Outerwear'), true);
  assert.equal('privateNotes' in initial[0], false);

  const unauthorizedWrite = await jsonRequest('/api/categories', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauthorized', slug: 'unauthorized', description: '' }),
  });
  assert.equal(unauthorizedWrite.status, 401);

  const token = await adminToken();
  const headers = { 'Content-Type': 'application/json', 'x-muiro-session': token };
  const createdResponse = await jsonRequest('/api/categories', {
    method: 'POST', headers,
    body: JSON.stringify({ name: 'Accessories', slug: 'accessories', description: 'Small finishing pieces' }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(state.categories.some((category: any) => category.id === created.id), true);

  const updated = await jsonRequest(`/api/categories/${created.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ name: 'Statement Accessories', slug: 'statement-accessories' }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).name, 'Statement Accessories');
  const removed = await jsonRequest(`/api/categories/${created.id}`, { method: 'DELETE', headers });
  assert.equal(removed.status, 200);

  const outerwear = initial.find((category: any) => category.name === 'Outerwear');
  const renamed = await jsonRequest(`/api/categories/${outerwear.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ name: 'Tailoring', slug: 'tailoring' }),
  });
  assert.equal(renamed.status, 200);
  assert.equal(state.products[0].category, 'Tailoring');
  assert.equal(state.lookbooks[0].category, 'Tailoring');
  const inUseDelete = await jsonRequest(`/api/categories/${outerwear.id}`, { method: 'DELETE', headers });
  assert.equal(inUseDelete.status, 409);
});

test('admin-only and unknown routes remain protected from anonymous requests', async () => {
  for (const path of ['/api/admin/authenticator', '/api/stats', '/api/unknown']) {
    const response = await jsonRequest(path);
    assert.equal(response.status, 401, `${path} must not be public`);
  }
});

test('public click tracking validates the requested snapshot destination and returns an event ID', async () => {
  const response = await jsonRequest('/api/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'p-1', lookId: 'look-1', source: 'web_lookbook', affiliateUrl: seedState.products[0].affiliateUrl }),
  });
  assert.equal(response.status, 202);
  const data = await response.json();
  assert.equal(data.safeUrl, 'https://www.amazon.com/dp/B000000001?tag=muiro-20');
  assert.equal(typeof data.clickId, 'string');
});

test('admin product create, update and delete persist to Supabase state and public reads', async () => {
  const token = await adminToken();
  const headers = { 'Content-Type': 'application/json', 'x-muiro-session': token };
  const created = await jsonRequest('/api/products', {
    method: 'POST', headers,
    body: JSON.stringify({
      title: 'Published trench', price: '$120.00', category: 'Outerwear',
      image: 'https://assets.example/trench.jpg', description: 'A plain-text trench description.',
      imageAlt: 'A classic trench coat on a model',
      affiliateUrl: 'https://www.amazon.com/dp/B000000111?tag=muiro-20',
      merchantId: 'm-1', affiliateProgramId: 'pr-1', seoTitle: 'Published trench | MUIRO',
      seoDescription: 'A trench for rainy days.', seoKeywords: 'trench, raincoat',
    }),
  });
  assert.equal(created.status, 201);
  const product = await created.json();
  assert.equal(state.products[0].id, product.id);
  assert.equal(created.headers.get('X-MUIRO-Publication'), 'pending');

  const publicRead = await jsonRequest('/api/products');
  const visible = (await publicRead.json()).find((item: any) => item.id === product.id);
  assert.equal(visible.title, 'Published trench');
  assert.equal(visible.seoKeywords, 'trench, raincoat');
  assert.equal(visible.description, 'A plain-text trench description.');
  assert.equal(visible.imageAlt, 'A classic trench coat on a model');

  const lookbookResponse = await jsonRequest('/api/lookbooks', {
    method: 'POST', headers,
    body: JSON.stringify({
      title: 'Published rain edit', category: 'Rainwear', cover: 'https://assets.example/rain-edit.jpg',
      description: 'Plain text editorial description.', pieces: [product.id, 'missing-product', product.id],
      pieceCovers: { [product.id]: 'https://assets.example/trench-detail.jpg', 'missing-product': 'https://assets.example/stale.jpg', orphan: 'https://assets.example/orphan.jpg' },
      seoTitle: 'Published rain edit | MUIRO', seoDescription: 'Rain-ready looks.', seoKeywords: 'rainwear, trench',
    }),
  });
  assert.equal(lookbookResponse.status, 201);
  const lookbook = await lookbookResponse.json();
  assert.deepEqual(state.lookbooks[0].pieces, [product.id]);
  assert.deepEqual(state.lookbooks[0].pieceCovers, { [product.id]: 'https://assets.example/trench-detail.jpg' });
  const publicLookbook = (await (await jsonRequest('/api/lookbooks')).json()).find((item: any) => item.id === lookbook.id);
  assert.deepEqual(publicLookbook.pieces, [product.id]);
  assert.equal(publicLookbook.seoTitle, 'Published rain edit | MUIRO');

  const lookbookReferencesUpdated = await jsonRequest(`/api/lookbooks/${lookbook.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({
      pieces: [product.id, 'deleted-product', product.id],
      pieceCovers: { [product.id]: 'https://assets.example/new-detail.jpg', 'deleted-product': 'https://assets.example/stale.jpg', orphan: 'https://assets.example/orphan.jpg' },
    }),
  });
  assert.equal(lookbookReferencesUpdated.status, 200);
  assert.deepEqual(state.lookbooks[0].pieces, [product.id]);
  assert.deepEqual(state.lookbooks[0].pieceCovers, { [product.id]: 'https://assets.example/new-detail.jpg' });
  const piecesOnlyUpdate = await jsonRequest(`/api/lookbooks/${lookbook.id}`, {
    method: 'PUT', headers, body: JSON.stringify({ pieces: [] }),
  });
  assert.equal(piecesOnlyUpdate.status, 200);
  assert.deepEqual(state.lookbooks[0].pieces, []);
  assert.deepEqual(state.lookbooks[0].pieceCovers, {});
  await jsonRequest(`/api/lookbooks/${lookbook.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ pieces: [product.id], pieceCovers: { [product.id]: 'https://assets.example/trench-detail.jpg' } }),
  });

  const updated = await jsonRequest(`/api/products/${product.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ seoTitle: 'Rain-ready trench | MUIRO', seoDescription: 'Updated copy.', affiliateUrl: 'https://www.amazon.com/dp/B000000222?tag=muiro-20' }),
  });
  assert.equal(updated.status, 200);
  assert.equal(state.products[0].seoTitle, 'Rain-ready trench | MUIRO');
  const visibleAfterUpdate = (await (await jsonRequest('/api/products')).json()).find((item: any) => item.id === product.id);
  assert.equal(visibleAfterUpdate.seoDescription, 'Updated copy.');
  assert.equal(visibleAfterUpdate.affiliateUrl, 'https://www.amazon.com/dp/B000000222?tag=muiro-20');

  const removed = await jsonRequest(`/api/products/${product.id}`, { method: 'DELETE', headers });
  assert.equal(removed.status, 200);
  assert.equal(state.products.some((item) => item.id === product.id), false);
  assert.equal((state.lookbooks[0].pieces as string[]).includes(product.id), false);
  assert.equal(product.id in state.lookbooks[0].pieceCovers, false);
  const visibleAfterDelete = await jsonRequest('/api/products');
  assert.equal((await visibleAfterDelete.json()).some((item: any) => item.id === product.id), false);
  const publicLooksAfterDelete = await jsonRequest('/api/lookbooks');
  const remainingLookbook = (await publicLooksAfterDelete.json()).find((item: any) => item.id === lookbook.id);
  assert.deepEqual(remainingLookbook.pieces, []);

  const updatedLookbook = await jsonRequest(`/api/lookbooks/${lookbook.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ seoTitle: 'Updated rain edit | MUIRO', category: 'Spring Rainwear' }),
  });
  assert.equal(updatedLookbook.status, 200);
  assert.equal(state.lookbooks[0].seoTitle, 'Updated rain edit | MUIRO');
  const visibleUpdatedLookbook = (await (await jsonRequest('/api/lookbooks')).json()).find((item: any) => item.id === lookbook.id);
  assert.equal(visibleUpdatedLookbook.category, 'Spring Rainwear');

  const deletedLookbook = await jsonRequest(`/api/lookbooks/${lookbook.id}`, { method: 'DELETE', headers });
  assert.equal(deletedLookbook.status, 200);
  assert.equal(state.lookbooks.some((item) => item.id === lookbook.id), false);
  assert.equal((await (await jsonRequest('/api/lookbooks')).json()).some((item: any) => item.id === lookbook.id), false);
});
