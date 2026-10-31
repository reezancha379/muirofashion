type AnyRecord = Record<string, any>;

const REQUIRED_PUBLIC_COLLECTIONS = ['products', 'lookbooks', 'heroSlides', 'testimonials'] as const;
const REQUIRED_STOREFRONT_COLLECTIONS = ['products', 'lookbooks', 'heroSlides'] as const;

/** Reject incomplete remote/seed payloads before projection can hide missing arrays. */
export function validatePublicSnapshotShape(source: unknown): asserts source is AnyRecord {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Public snapshot is incomplete: expected a JSON object. Check that the published content-snapshot.json is a complete snapshot.');
  }

  const snapshot = source as AnyRecord;
  for (const collection of REQUIRED_PUBLIC_COLLECTIONS) {
    if (!Array.isArray(snapshot[collection])) {
      throw new Error(`Public snapshot is incomplete: required collection "${collection}" must be an array. Republish a complete public content snapshot.`);
    }
  }
  for (const collection of REQUIRED_STOREFRONT_COLLECTIONS) {
    if (snapshot[collection].length === 0) {
      throw new Error(`Public snapshot is incomplete: storefront collection "${collection}" is empty. Add at least one ${collection === 'heroSlides' ? 'hero slide' : collection.slice(0, -1)} and republish.`);
    }
  }
}

const TRUSTED_AFFILIATE_DOMAINS = [
  'amazon.com', 'amzn.to', 'revolve.com', 'nordstrom.com', 'asos.com', 'zara.com',
  'target.com', 'shopbop.com', 'farfetch.com', 'ssense.com', 'net-a-porter.com',
  'mango.com', 'hm.com', 'urbanoutfitters.com', 'aritzia.com', 'princesspolly.com',
];

export function safeAffiliateUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim() || /^(javascript:|data:|file:|vbscript:)/i.test(raw.trim())) {
    throw new Error('Static snapshot contains an invalid affiliate destination.');
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new Error('Static snapshot contains an invalid affiliate destination.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Static snapshot contains an invalid affiliate destination.');
  }
  const host = url.hostname.toLowerCase();
  if (!TRUSTED_AFFILIATE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    throw new Error('Static snapshot contains an affiliate domain that is not on the MUIRO allowlist.');
  }
  const safeQuery = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (key.length <= 64 && value.length <= 512 && !/[<>\'"(){}]/.test(value)) safeQuery.append(key, value);
  });
  url.search = safeQuery.toString();
  return url.toString();
}

function pick(value: AnyRecord, fields: string[]): AnyRecord {
  return Object.fromEntries(fields.filter((field) => Object.prototype.hasOwnProperty.call(value || {}, field)).map((field) => [field, value[field]]));
}

function safeMediaUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.toString();
  } catch {
    throw new Error('Static snapshot contains an invalid media URL.');
  }
}

function safePieceCoverMap(item: AnyRecord): Record<string, string> {
  const pieces = new Set(Array.isArray(item?.pieces) ? item.pieces : []);
  const covers = item?.pieceCovers;
  if (!covers || typeof covers !== 'object' || Array.isArray(covers)) return {};
  return Object.fromEntries(Object.entries(covers).flatMap(([productId, url]) => {
    if (!pieces.has(productId)) return [];
    const safeUrl = safeMediaUrl(url);
    return safeUrl ? [[productId, safeUrl]] : [];
  }));
}

function optimizeBundledHeroPath(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(/^\/(hero-[1-4])\.jpg$/i, '/$1.webp');
}

function projectCategories(source: AnyRecord, products: AnyRecord[], lookbooks: AnyRecord[]): AnyRecord[] {
  const existing = Array.isArray(source?.categories) ? source.categories : [];
  const categories = existing.map((item: AnyRecord) => pick(item, [
    'id', 'name', 'slug', 'description', 'createdAt', 'updatedAt',
  ]));
  const names = new Set(categories.map((item: AnyRecord) => String(item.name || '').trim().toLowerCase()));
  const slugs = new Set(categories.map((item: AnyRecord) => String(item.slug || '')));
  const labels = [
    ...products.map((product: AnyRecord) => product.category),
    ...lookbooks.map((lookbook: AnyRecord) => lookbook.category),
  ];
  for (const label of labels) {
    const name = String(label || '').trim();
    const key = name.toLowerCase();
    if (!name || names.has(key)) continue;
    const base = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
    let slug = base;
    let suffix = 2;
    while (slugs.has(slug)) slug = `${base}-${suffix++}`;
    const timestamp = new Date(0).toISOString();
    categories.push({ id: `category-${slug}`, name, slug, description: '', createdAt: timestamp, updatedAt: timestamp });
    names.add(key);
    slugs.add(slug);
  }
  return categories;
}

export function projectPublicSnapshot(source: AnyRecord): AnyRecord {
  const products = Array.isArray(source?.products) ? source.products : [];
  const lookbooks = Array.isArray(source?.lookbooks) ? source.lookbooks : [];
  const testimonials = Array.isArray(source?.testimonials) ? source.testimonials : [];
  const heroSlides = Array.isArray(source?.heroSlides) ? source.heroSlides : [];
  const settings = source?.settings && typeof source.settings === 'object' ? source.settings : {};
  const productIds = new Set(products.map((item: AnyRecord) => String(item?.id ?? '')));

  return {
    lookbooks: lookbooks.map((item: AnyRecord) => {
      const pieces = (Array.isArray(item?.pieces) ? item.pieces : [])
        .filter((pieceId: unknown) => productIds.has(String(pieceId)))
        .map((pieceId: unknown) => String(pieceId));
      return {
        ...pick(item, [
          'id', 'title', 'board', 'category', 'cover', 'frame', 'description', 'pieces',
          'featured', 'isNewlyAdded', 'isTrending', 'authorNote', 'season',
          'seoTitle', 'seoDescription', 'seoKeywords',
        ]),
        pieces,
        ...(item.videoUrl ? { videoUrl: safeMediaUrl(item.videoUrl) } : {}),
        ...(item.videoCaptionsUrl ? { videoCaptionsUrl: safeMediaUrl(item.videoCaptionsUrl) } : {}),
        pieceCovers: safePieceCoverMap({ ...item, pieces }),
        views: 0,
        likes: 0,
      };
    }),
    products: products.map((item: AnyRecord) => ({
      ...pick(item, [
        'id', 'title', 'price', 'numericPrice', 'board', 'category', 'image', 'imageAlt', 'description',
        'merchant', 'merchantId', 'affiliateProgramId', 'badge', 'rating', 'reviewCount',
        'featured', 'isNewlyAdded', 'isTrending', 'seoTitle', 'seoDescription', 'seoKeywords',
      ]),
      ...(item.videoUrl ? { videoUrl: safeMediaUrl(item.videoUrl) } : {}),
      ...(item.videoCaptionsUrl ? { videoCaptionsUrl: safeMediaUrl(item.videoCaptionsUrl) } : {}),
      affiliateUrl: safeAffiliateUrl(item?.affiliateUrl),
      clicks: 0,
    })),
    categories: projectCategories(source, products, lookbooks),
    testimonials: testimonials.map((item: AnyRecord) => pick(item, [
      'id', 'author', 'location', 'avatar', 'rating', 'outfitTitle', 'comment', 'verified',
      'date', 'helpfulCount', 'featured',
    ])),
    heroSlides: heroSlides.map((item: AnyRecord) => {
      const slide = pick(item, [
        'id', 'image', 'fallbackImage', 'title', 'tagline', 'category', 'lookId', 'keyPieces',
        'isActive', 'order',
      ]);
      slide.image = optimizeBundledHeroPath(slide.image);
      return slide;
    }),
    settings: {
      ...pick(settings, [
        'aboutTitle', 'aboutSubtitle', 'aboutStory', 'affiliateDisclosure',
        'seoTitle', 'seoDescription', 'seoKeywords',
      ]),
      ...(settings.ogImage ? { ogImage: safeMediaUrl(settings.ogImage) } : {}),
      aboutPillars: Array.isArray(settings.aboutPillars)
        ? settings.aboutPillars.map((item: AnyRecord) => pick(item, ['title', 'desc', 'icon']))
        : [],
    },
  };
}
