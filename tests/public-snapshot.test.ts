import assert from 'node:assert/strict';
import { projectPublicSnapshot, safeAffiliateUrl } from '../src/lib/publicSnapshot';

const projected = projectPublicSnapshot({
  adminPin: 'private',
  authenticatorSecret: 'private',
  sessionSecret: 'private',
  impressions: 123,
  clicks: [{ ipHash: 'private' }],
  stats: { totalClicks: 123 },
  affiliatePrograms: [{ name: 'admin-only' }],
  merchants: [{ name: 'admin-only' }],
  categories: [{ id: 'cat-outerwear', name: 'Outerwear', slug: 'outerwear', description: 'Coats and jackets', privateNotes: 'private' }],
  products: [{
    id: 'p1',
    title: 'Editorial coat',
    category: 'Outerwear',
    image: '/coat.jpg',
    affiliateUrl: 'https://www.amazon.com/dp/example?tag=muiro-20',
    merchant: 'Amazon',
    merchantId: 'merchant-amazon',
    affiliateProgramId: 'program-amazon',
    videoUrl: 'https://media.example/coat.mp4',
    videoCaptionsUrl: 'https://media.example/coat.vtt',
    seoTitle: 'Editorial coat | MUIRO',
    seoDescription: 'A tailored coat for winter styling.',
    seoKeywords: 'winter coat, tailoring',
    clicks: 55,
    internalNotes: 'private',
  }],
  lookbooks: [{ id: 'look-1', title: 'Winter edit', category: 'Winter Styling', pieces: ['p1'], pieceCovers: { p1: 'https://media.example/coat-lookbook.jpg', unrelated: 'https://media.example/hidden.jpg' }, videoUrl: 'https://media.example/winter.webm', videoCaptionsUrl: 'https://media.example/winter.vtt', seoTitle: 'Winter edit | MUIRO', views: 55, likes: 20, internalNotes: 'private' }],
  testimonials: [],
  heroSlides: [{ id: 'hero-1', image: '/hero-1.jpg', fallbackImage: '/hero-2.jpg' }],
  settings: { aboutTitle: 'MUIRO', seoTitle: 'MUIRO', seoDescription: 'Fashion lookbooks by MUIRO.', ogImage: 'https://media.example/muiro-card.jpg', internalNotes: 'private' },
});

for (const key of ['adminPin', 'authenticatorSecret', 'sessionSecret', 'impressions', 'clicks', 'stats', 'affiliatePrograms', 'merchants']) {
  assert.equal(key in projected, false, `${key} must not enter the public snapshot`);
}
assert.equal(projected.products[0].clicks, 0);
assert.equal(projected.products[0].merchantId, 'merchant-amazon');
assert.equal(projected.products[0].affiliateProgramId, 'program-amazon');
assert.equal(projected.products[0].videoUrl, 'https://media.example/coat.mp4');
assert.equal(projected.products[0].videoCaptionsUrl, 'https://media.example/coat.vtt');
assert.equal(projected.products[0].seoTitle, 'Editorial coat | MUIRO');
assert.equal(projected.products[0].internalNotes, undefined);
assert.equal(projected.lookbooks[0].views, 0);
assert.equal(projected.lookbooks[0].likes, 0);
assert.equal(projected.lookbooks[0].videoUrl, 'https://media.example/winter.webm');
assert.equal(projected.lookbooks[0].videoCaptionsUrl, 'https://media.example/winter.vtt');
assert.deepEqual(projected.lookbooks[0].pieceCovers, { p1: 'https://media.example/coat-lookbook.jpg' });
assert.equal(projected.lookbooks[0].seoTitle, 'Winter edit | MUIRO');
assert.equal(projected.lookbooks[0].internalNotes, undefined);
assert.equal(projected.settings.internalNotes, undefined);
assert.equal(projected.settings.seoTitle, 'MUIRO');
assert.equal(projected.settings.ogImage, 'https://media.example/muiro-card.jpg');
assert.deepEqual(projected.categories.map((category: any) => category.name), ['Outerwear', 'Winter Styling']);
assert.equal(projected.categories[0].privateNotes, undefined);
assert.match(projected.products[0].affiliateUrl, /^https:\/\/www\.amazon\.com\//);
assert.equal(projected.heroSlides[0].image, '/hero-1.webp');
assert.equal(projected.heroSlides[0].fallbackImage, '/hero-2.jpg');

assert.throws(() => safeAffiliateUrl('https://user:pass@www.amazon.com/item'), /invalid affiliate destination/i);
assert.throws(() => safeAffiliateUrl('https://attacker.example/path'), /allowlist/i);
assert.throws(() => safeAffiliateUrl('javascript:alert(1)'), /invalid affiliate destination/i);
assert.throws(() => projectPublicSnapshot({ products: [{ affiliateUrl: 'https://amazon.com/item', videoUrl: 'javascript:alert(1)' }] }), /invalid media url/i);

console.log('PASS public snapshot whitelist and affiliate URL validation');
