type AnyRecord = Record<string, any>;

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

function categorySlug(value: unknown): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'category';
}

function projectCategories(source: AnyRecord, products: AnyRecord[], lookbooks: AnyRecord[]): AnyRecord[] {
  const categories: AnyRecord[] = [];
  const names = new Set<string>();
  const slugs = new Set<string>();
  const epoch = new Date(0).toISOString();
  const add = (value: AnyRecord) => {
    const name = String(value?.name || '').trim().slice(0, 60);
    if (!name || names.has(name.toLocaleLowerCase())) return;
    const base = categorySlug(name);
    const candidate = String(value?.slug || base).trim().toLowerCase();
    const safeCandidate = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ? candidate : base;
    let slug = safeCandidate;
    let suffix = 2;
    while (slugs.has(slug)) slug = `${safeCandidate}-${suffix++}`;
    const createdAt = typeof value?.createdAt === 'string' ? value.createdAt.slice(0, 40) : epoch;
    categories.push({
      id: String(value?.id || `category-${slug}`).slice(0, 100),
      name,
      slug,
      description: String(value?.description || '').trim().slice(0, 300),
      createdAt,
      updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt.slice(0, 40) : createdAt,
    });
    names.add(name.toLocaleLowerCase());
    slugs.add(slug);
  };

  if (Array.isArray(source?.categories)) {
    for (const category of source.categories) {
      if (category && typeof category === 'object' && !Array.isArray(category)) add(category);
    }
  }
  for (const label of [...products.map(product => product.category), ...lookbooks.map(lookbook => lookbook.category)]) {
    const name = String(label || '').trim();
    if (name && !names.has(name.toLocaleLowerCase())) add({ name });
  }
  return categories;
}

export function projectPublicSnapshot(source: AnyRecord): AnyRecord {
  const products = Array.isArray(source?.products) ? source.products : [];
  const lookbooks = Array.isArray(source?.lookbooks) ? source.lookbooks : [];
  const testimonials = Array.isArray(source?.testimonials) ? source.testimonials : [];
  const heroSlides = Array.isArray(source?.heroSlides) ? source.heroSlides : [];
  const settings = source?.settings && typeof source.settings === 'object' ? source.settings : {};

  return {
    lookbooks: lookbooks.map((item: AnyRecord) => ({
      ...pick(item, [
        'id', 'title', 'board', 'category', 'cover', 'frame', 'description', 'pieces',
        'featured', 'isNewlyAdded', 'isTrending', 'authorNote', 'season',
        'seoTitle', 'seoDescription', 'seoKeywords',
      ]),
      ...(item.videoUrl ? { videoUrl: safeMediaUrl(item.videoUrl) } : {}),
      ...(item.videoCaptionsUrl ? { videoCaptionsUrl: safeMediaUrl(item.videoCaptionsUrl) } : {}),
      pieceCovers: safePieceCoverMap(item),
      views: 0,
      likes: 0,
    })),
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
