import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// Persisted JSON store: lookbooks, products, tracking, and (hashed) credentials.
import { hashPin, isHashedPin, verifyPin, generateSessionSecret, generateTotpSecret } from '../auth/auth';

/**
 * The original hardcoded factory TOTP key. It shipped in the public browser
 * bundle (src/lib/totp.ts), so it must be treated as compromised and rotated
 * whenever it is found in the store.
 */
const LEAKED_FACTORY_SECRET = 'MUIROAUTHENTICATOR234567SECURE';
import { Product, Lookbook, Testimonial, ClickEvent, SiteSettings, HeroSlide, AffiliateProgram, Merchant } from '../../src/types';

// Persistence location. Defaults to <cwd>/data (so each installation keeps its
// own store), but MUIRO_DATA_DIR overrides it — used by tests / alternate
// deployments that must touch a throwaway store instead of the live one.
const DATA_DIR = process.env.MUIRO_DATA_DIR
  ? path.resolve(process.env.MUIRO_DATA_DIR)
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

export const INITIAL_HERO_SLIDES: HeroSlide[] = [
  {
    id: "hero-1",
    image: "/hero-1.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=800&q=80",
    title: "Autumn Essentials & Layered Knits",
    tagline: "Beige Cable-Knit Vest, Crisp Poplin Shirt & Tan Loafers",
    category: "Fall / Autumn Edit",
    lookId: "look-1",
    keyPieces: ["Cable Knit Vest", "Tan Loafers", "Poplin Shirt"],
    isActive: true,
    order: 1
  },
  {
    id: "hero-2",
    image: "/hero-2.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80",
    title: "K-Fashion Summer & Y2K Softwear",
    tagline: "Tiered Ruffle Skirt, Floral Babydoll Dress & Baby Tee",
    category: "Korean Summer Aesthetic",
    lookId: "look-2",
    keyPieces: ["Tiered Ruffle Skirt", "Babydoll Dress", "Contrast Baby Tee"],
    isActive: true,
    order: 2
  },
  {
    id: "hero-3",
    image: "/hero-3.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80",
    title: "10 Effortless Outfit Ideas For Every Day",
    tagline: "Tiered Cotton Maxi Skirt, Platform Combat Boots & Olive Bomber",
    category: "Casual Street Inspo",
    lookId: "look-3",
    keyPieces: ["Cotton Maxi Skirt", "Combat Boots", "Slouchy Bomber"],
    isActive: true,
    order: 3
  },
  {
    id: "hero-4",
    image: "/hero-4.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80",
    title: "How to Look Stylish: 4 Capsule Formulas",
    tagline: "Breton Striped Cardigan, Cable Knit Crewneck & Butter Yellow Polo",
    category: "Minimalist Chic",
    lookId: "look-4",
    keyPieces: ["Striped Cardigan", "Cream Cable Knit", "Butter Yellow Polo"],
    isActive: true,
    order: 4
  }
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "p001",
    title: "Y2K Floral Drawstring A-Line Dress",
    price: "$43.99",
    numericPrice: 43.99,
    board: "Acubi Aesthetic Outfit",
    category: "Dresses",
    image: "https://i.pinimg.com/736x/e1/ae/2a/e1ae2afed5c0cdfc33e8bc7aabb9ec99.jpg",
    description: "Floral A-line dress with an adjustable drawstring waist, made for relaxed everyday styling and effortless silhouettes.",
    affiliateUrl: "https://www.amazon.com/dp/B0F2GZ1QWN?tag=fashionzon03-20",
    merchant: "Amazon",
    commissionRate: 10.0,
    rating: 4.9,
    reviewCount: 384,
    clicks: 142,
    featured: true
  },
  {
    id: "p002",
    title: "Off-Shoulder Lolita Cozy Fleece Sweater",
    price: "$38.50",
    numericPrice: 38.50,
    board: "Acubi Aesthetic Outfit",
    category: "Sweaters",
    image: "https://i.pinimg.com/736x/b0/04/fb/b004fb2af71b8128b8327441c54d6208.jpg",
    description: "Ultra-soft fuzzy fleece pullover with a slouchy boat neck silhouette. Perfect for layering over delicate bralettes.",
    affiliateUrl: "https://www.amazon.com/dp/B0DSFS8DTV?tag=fashionzon03-20",
    merchant: "Amazon",
    commissionRate: 10.0,
    rating: 5.0,
    reviewCount: 512,
    clicks: 198,
    featured: true
  },
  {
    id: "p1-1",
    title: "V-Neck Chocolate Ribbed Long Sleeve Tee",
    price: "$24.99",
    numericPrice: 24.99,
    board: "Linen & Minimalist Dress",
    category: "Tops",
    image: "https://ugc.production.linktr.ee/e92acc3e-2f15-451c-adea-224dcd9daa56_5d04ea00-9951-476b-991a-6c2e3b62af22--1-.jpeg?io=true&size=thumbnail-stack_v1_0",
    description: "Form-fitting chocolate brown ribbed knit top with a flattering deep v-neckline for effortless everyday chic.",
    affiliateUrl: "https://amzn.to/4yEua07",
    merchant: "Amazon",
    commissionRate: 8.5,
    rating: 4.8,
    reviewCount: 229,
    clicks: 115,
    featured: false
  },
  {
    id: "p1-2",
    title: "Low Rise Boyfriend Jeans Baggy Straight Leg",
    price: "$49.90",
    numericPrice: 49.90,
    board: "Linen & Minimalist Dress",
    category: "Jeans",
    image: "https://ugc.production.linktr.ee/d55c2307-2385-4fbb-acce-28dfaa008631_5d04ea00-9951-476b-991a-6c2e3b62af22--1-.jpeg?io=true&size=thumbnail-stack_v1_0",
    description: "Light wash vintage denim with a relaxed low-slung waist and wide straight leg cut for authentic Y2K energy.",
    affiliateUrl: "https://amzn.to/4gZextZ",
    merchant: "Amazon",
    commissionRate: 9.0,
    rating: 4.9,
    reviewCount: 641,
    clicks: 284,
    featured: true
  },
  {
    id: "p1-3",
    title: "Keds Triple Up Platform Canvas Sneaker",
    price: "$55.00",
    numericPrice: 55.00,
    board: "Linen & Minimalist Dress",
    category: "Shoes",
    image: "https://ugc.production.linktr.ee/eadb6bd5-1a0a-4af7-bb1e-af279a8e736b_5d04ea00-9951-476b-991a-6c2e3b62af22--1-.jpeg?io=true&size=thumbnail-stack_v1_0",
    description: "Classic white triple-tier platform sneaker providing height, lightweight cushioning, and clean streetwear vibes.",
    affiliateUrl: "https://amzn.to/4x7FbFX",
    merchant: "Amazon",
    commissionRate: 8.0,
    rating: 4.7,
    reviewCount: 180,
    clicks: 92,
    featured: false
  },
  {
    id: "p2-1",
    title: "White Ribbed Knit Undershirt Top",
    price: "$29.99",
    numericPrice: 29.99,
    board: "Autumn Fashion | Fall Outfit Ideas",
    category: "Tops",
    image: "https://m.media-amazon.com/images/W/BW_MEDIAX_AVIF_MEASUREMENT_1306696-T1/images/I/51TvHffyl+L._AC_SX679_.jpg",
    description: "A clean-girl wardrobe essential, blending comfy stretch knit fabric with an understated Korean aesthetic.",
    affiliateUrl: "https://www.amazon.com/Winter-Sweater-Knitted-Undershirt-Bottoming/dp/B0DL5YSY3Q?tag=fashionzon03-20",
    merchant: "Amazon",
    commissionRate: 10.0,
    rating: 4.8,
    reviewCount: 310,
    clicks: 165,
    featured: false
  },
  {
    id: "p2-2",
    title: "Light Wash Wide-Leg Distressed Jeans",
    price: "$48.00",
    numericPrice: 48.00,
    board: "Autumn Fashion | Fall Outfit Ideas",
    category: "Jeans",
    image: "https://m.media-amazon.com/images/W/BW_MEDIAX_AVIF_MEASUREMENT_1306696-T1/images/I/71kkksuX4cL._AC_SY741_.jpg",
    description: "Relaxed high-waisted boyfriend jeans with a loose straight-leg cut for ultimate casual day-to-night comfort.",
    affiliateUrl: "https://www.amazon.com/Boyfriend-Distressed-Straight-Trousers-Streetwear/dp/B0BBPRQ787?tag=fashionzon03-20",
    merchant: "Amazon",
    commissionRate: 9.0,
    rating: 4.9,
    reviewCount: 420,
    clicks: 210,
    featured: true
  },
  {
    id: "p2-3",
    title: "Converse Chuck Taylor All Star Low Top",
    price: "$65.00",
    numericPrice: 65.00,
    board: "Autumn Fashion | Fall Outfit Ideas",
    category: "Shoes",
    image: "https://m.media-amazon.com/images/W/BW_MEDIAX_AVIF_MEASUREMENT_1306696-T1/images/I/61fqHgYEGfL._AC_SX625_.jpg",
    description: "Timeless black canvas low tops with iconic vulcanized rubber soles. The versatile foundation for every capsule look.",
    affiliateUrl: "https://www.amazon.com/Converse-Unisex-Black-Mono-Women/dp/B07PRP1GXB?tag=fashionzon03-20",
    merchant: "Amazon",
    commissionRate: 7.5,
    rating: 4.9,
    reviewCount: 980,
    clicks: 178,
    featured: false
  },
  {
    id: "p3-1",
    title: "Oversized Minimalist Tailored Wool Blazer",
    price: "$89.00",
    numericPrice: 89.00,
    board: "Capsule Wardrobe Essentials",
    category: "Jackets",
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80",
    description: "Structured wool-blend blazer with padded shoulders and horn buttons for effortless Copenhagen layering.",
    affiliateUrl: "https://www.revolve.com/dp/B08BLAZER?tag=fashionzon03-20",
    merchant: "Revolve",
    commissionRate: 12.0,
    rating: 5.0,
    reviewCount: 145,
    clicks: 133,
    featured: true
  },
  {
    id: "p3-2",
    title: "Smooth Italian Vegan Leather Baguette Bag",
    price: "$52.00",
    numericPrice: 52.00,
    board: "Capsule Wardrobe Essentials",
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80",
    description: "Streamlined 90s shoulder bag with custom gold hardware and a magnetic flap closure.",
    affiliateUrl: "https://www.amazon.com/dp/B09BAGUETTE?tag=fashionzon03-20",
    merchant: "Amazon",
    commissionRate: 11.0,
    rating: 4.9,
    reviewCount: 290,
    clicks: 146,
    featured: false
  }
];

const INITIAL_LOOKBOOKS: Lookbook[] = [
  {
    id: "look-1",
    title: "Streetwear Outfit Inspo",
    board: "Linen & Minimalist Dress",
    category: "Streetwear",
    cover: "https://i.pinimg.com/474x/25/41/2c/25412cbe38af795ed7d7dda468951c6b.jpg",
    frame: "2-3",
    description: "Recreate this viral aesthetic Asian streetwear outfit look! Featuring a chocolate brown ribbed v-neck long sleeve slim-fit tee paired effortlessly with light wash low-rise baggy straight-leg denim jeans. This casual, minimalist look is perfect for everyday style, school outfits, or a clean weekend aesthetic.",
    authorNote: "Finish with one sculptural accessory and let the proportions do the work.",
    pieces: ["p1-1", "p1-2", "p1-3"],
    views: 1840,
    likes: 412,
    featured: true
  },
  {
    id: "look-2",
    title: "Cute Everyday Outfits With White Long Sleeve Top",
    board: "Autumn Fashion | Fall Outfit Ideas",
    category: "Autumn Chic",
    cover: "https://i.pinimg.com/736x/4e/a4/0f/4ea40fed8edaef38ca04dd7c41dd23d0.jpg",
    frame: "2-3",
    description: "A cozy, minimalist autumn combination with a crisp textured knit top, slouchy denim, and vintage low-top sneakers. Subtle, comfortable, and undeniably photogenic.",
    authorNote: "Keep the palette quiet and let texture carry the look through the season.",
    pieces: ["p2-1", "p2-2", "p2-3"],
    views: 2490,
    likes: 673,
    featured: true
  },
  {
    id: "look-3",
    title: "Acubi Aesthetic & Soft Lolita Layering",
    board: "Acubi Aesthetic Outfit",
    category: "Acubi & Y2K",
    cover: "https://i.pinimg.com/736x/e1/ae/2a/e1ae2afed5c0cdfc33e8bc7aabb9ec99.jpg",
    frame: "2-3",
    description: "The dreamiest combination of soft-girl texture and edgy Y2K proportions. The drawstring floral A-line layer balances the fuzzy fleece sweater seamlessly.",
    authorNote: "Balance soft texture with one sharper piece for an effortless contrast.",
    pieces: ["p001", "p002"],
    views: 3120,
    likes: 890,
    featured: true
  },
  {
    id: "look-4",
    title: "Off-Duty Model Scandinavian Capsule",
    board: "Capsule Wardrobe Essentials",
    category: "Minimalist",
    cover: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    frame: "2-3",
    description: "Sharp tailoring meets relaxed weekend ease. Clean silhouettes, premium neutral color palette, and high-impact leather accents.",
    authorNote: "Keep the layers relaxed, then anchor the silhouette with a clean leather accent.",
    pieces: ["p3-1", "p3-2", "p1-3"],
    views: 1980,
    likes: 540,
    featured: false
  }
];

const INITIAL_TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    author: "Elena Rostova",
    location: "New York, NY",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    rating: 5,
    outfitTitle: "Streetwear Outfit Inspo",
    comment: "I spent weeks trying to find the exact jeans from that viral Pinterest photo. MUIRO had the direct link and sizing advice ready. Arrived in two days via Prime, fits 10/10!",
    verified: true,
    date: "2 days ago",
    helpfulCount: 46,
    featured: true
  },
  {
    id: "t2",
    author: "Sophie Chen",
    location: "Vancouver, BC",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
    rating: 5,
    outfitTitle: "Acubi Aesthetic & Soft Lolita",
    comment: "The lookbook layout is so fast on mobile. Tapping 'Shop the Look' opened the exact verified listing without sketchy spam redirects. Bought the fleece sweater immediately.",
    verified: true,
    date: "Yesterday",
    helpfulCount: 38,
    featured: true
  },
  {
    id: "t3",
    author: "Maya Lindqvist",
    location: "Stockholm, SE",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80",
    rating: 5,
    outfitTitle: "Off-Duty Scandinavian Capsule",
    comment: "Editorial quality that actually respects my time. The image inspector lets you zoom in to check the knit texture before clicking out. This is how affiliate curation should be.",
    verified: true,
    date: "4 days ago",
    helpfulCount: 52,
    featured: true
  },
  {
    id: "t4",
    author: "Brooke Adams",
    location: "Austin, TX",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    rating: 5,
    outfitTitle: "Cute Everyday Outfits",
    comment: "I love that all prices and commission disclosures are completely transparent. Everything feels curated by real stylists instead of generic bots.",
    verified: true,
    date: "1 week ago",
    helpfulCount: 29,
    featured: false
  }
];

const DEFAULT_SETTINGS: SiteSettings = {
  aboutTitle: "About MUIRO & Our Editorial Vision",
  aboutSubtitle: "Bridging the gap between aesthetic moodboards and verified, direct shoppable pieces.",
  aboutStory: "MUIRO was created out of a simple frustration: discovering captivating outfit lookbooks across Pinterest and Instagram, only to hit dead-ends, low-grade dupes, or mysterious unlinked garments. We deconstruct every aesthetic lookbook into individual, wearable wardrobe pieces and connect you directly with authenticated retail merchants—including Amazon Associates, Revolve, and Nordstrom. Every piece is vetted for fit, fabric quality, and transparent zero-markup pricing.",
  aboutPillars: [
    {
      title: "Direct Merchant Verification",
      desc: "Every listed garment links directly to verified authentic merchant partners with authentic return policies and direct pricing.",
      icon: "ShieldCheck"
    },
    {
      title: "Zero-Markup Transparency",
      desc: "Some links are affiliate links. Qualifying purchases may earn MUIRO a commission at no extra cost to you.",
      icon: "Sparkles"
    },
    {
      title: "Garment Fabric Zoom Inspector",
      desc: "Interactive high-resolution fabric and weave zoom inspector allows you to inspect garments up close before clicking through to purchase.",
      icon: "Eye"
    }
  ],
  affiliateDisclosure: "Some links are affiliate links. Qualifying purchases may earn MUIRO a commission at no extra cost to you."
};

export const INITIAL_AFFILIATE_PROGRAMS: AffiliateProgram[] = [
  { id: 'program-amazon', name: 'Amazon Associates', network: 'Amazon Associates', website: 'https://affiliate-program.amazon.com/', defaultCommissionRate: 8, disclosure: 'MUIRO may earn a commission from qualifying purchases.', status: 'active' },
  { id: 'program-revolve', name: 'Revolve Affiliate Program', network: 'Revolve', website: 'https://www.revolve.com/', defaultCommissionRate: 12, disclosure: 'MUIRO may earn a commission from qualifying purchases.', status: 'active' },
  { id: 'program-nordstrom', name: 'Nordstrom Affiliate Program', network: 'Nordstrom', website: 'https://www.nordstrom.com/', defaultCommissionRate: 8, disclosure: 'MUIRO may earn a commission from qualifying purchases.', status: 'active' }
];

export const INITIAL_MERCHANTS: Merchant[] = [
  { id: 'merchant-amazon', name: 'Amazon', website: 'https://www.amazon.com/', affiliateProgramId: 'program-amazon', status: 'active' },
  { id: 'merchant-revolve', name: 'Revolve', website: 'https://www.revolve.com/', affiliateProgramId: 'program-revolve', status: 'active' },
  { id: 'merchant-nordstrom', name: 'Nordstrom', website: 'https://www.nordstrom.com/', affiliateProgramId: 'program-nordstrom', status: 'active' }
];

interface DbSchema {
  products: Product[];
  lookbooks: Lookbook[];
  testimonials: Testimonial[];
  clicks: ClickEvent[];
  impressions: number;
  settings?: SiteSettings;
  heroSlides?: HeroSlide[];
  /** scrypt-hashed passcode. Legacy plaintext is migrated on first load. */
  adminPin?: string;
  /** Clear-text length of the passcode, so status endpoints never need the secret. */
  adminPinLength?: number;
  /** Signing secret for admin session tokens; generated once and persisted. */
  sessionSecret?: string;
  authenticatorSecret?: string;
  authenticatorEnabled?: boolean;
  affiliatePrograms?: AffiliateProgram[];
  merchants?: Merchant[];
}

function getBootstrapAdminPin(): string {
  const configured = process.env.MUIRO_ADMIN_PIN?.trim();
  if (!configured || !/^\d{6,12}$/.test(configured)) {
    throw new Error(
      'MUIRO_ADMIN_PIN is required on first run and must contain 6-12 digits. Set it in .env before starting MUIRO.'
    );
  }
  return configured;
}

class DataStore {
  private data: DbSchema;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DbSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Spread first so that every persisted field survives a restart.
        // (Rebuilding field-by-field used to drop authenticatorSecret and
        // authenticatorEnabled, silently reverting a paired Google
        // Authenticator secret to the default on every boot.)
        const merged: DbSchema = {
          ...parsed,
          products: parsed.products || INITIAL_PRODUCTS,
          lookbooks: parsed.lookbooks || INITIAL_LOOKBOOKS,
          testimonials: parsed.testimonials || INITIAL_TESTIMONIALS,
          clicks: parsed.clicks || this.generateSeedClicks(),
          impressions: parsed.impressions || 14850,
          settings: parsed.settings || DEFAULT_SETTINGS,
          heroSlides: parsed.heroSlides && parsed.heroSlides.length > 0 ? parsed.heroSlides : INITIAL_HERO_SLIDES,
          adminPin: parsed.adminPin || hashPin(getBootstrapAdminPin()),
          adminPinLength:
            typeof parsed.adminPinLength === 'number'
              ? parsed.adminPinLength
              : String(parsed.adminPin || getBootstrapAdminPin()).length,
          sessionSecret: parsed.sessionSecret || generateSessionSecret(),
          affiliatePrograms: parsed.affiliatePrograms?.length ? parsed.affiliatePrograms : INITIAL_AFFILIATE_PROGRAMS,
          merchants: parsed.merchants?.length ? parsed.merchants : INITIAL_MERCHANTS,
        };

        if (this.migratePinAtRest(merged)) {
          // Persist immediately so credential migrations leave disk.
          this.persist(merged);
        }
        this.normalizeCommerceData(merged);
        return merged;
      }
    } catch (err) {
      console.warn('Failed to read db.json, using defaults', err);
    }
    const initial: DbSchema = {
      products: INITIAL_PRODUCTS,
      lookbooks: INITIAL_LOOKBOOKS,
      testimonials: INITIAL_TESTIMONIALS,
      clicks: this.generateSeedClicks(),
      impressions: 14850,
      settings: DEFAULT_SETTINGS,
      heroSlides: INITIAL_HERO_SLIDES,
      adminPin: hashPin(getBootstrapAdminPin()),
      adminPinLength: getBootstrapAdminPin().length,
      sessionSecret: generateSessionSecret(),
      affiliatePrograms: INITIAL_AFFILIATE_PROGRAMS,
      merchants: INITIAL_MERCHANTS
    };
    this.persist(initial);
    return initial;
  }

  /**
   * Upgrades credentials at rest: hashes a legacy plaintext passcode and
   * ensures a session signing secret exists. Returns true when the db changed
   * and should be flushed to disk.
   */
  private migratePinAtRest(db: DbSchema): boolean {
    let changed = false;
    const legacy = db.adminPin || getBootstrapAdminPin();
    if (!isHashedPin(legacy)) {
      db.adminPin = hashPin(legacy);
      db.adminPinLength = legacy.length;
      changed = true;
    }
    if (typeof db.adminPinLength !== 'number' || db.adminPinLength <= 0) {
      db.adminPinLength = 4;
      changed = true;
    }
    if (!db.sessionSecret) {
      db.sessionSecret = generateSessionSecret();
      changed = true;
    }
    // SECURITY: the original factory authenticator key was a fixed literal that
    // was also compiled into the browser bundle, so anyone holding the
    // downloaded JS could mint a valid login code for it. Rotate it once, at
    // rest, to a per-install random value. Existing device pairings must be
    // re-scanned from the admin panel after this runs.
    if (!db.authenticatorSecret || db.authenticatorSecret === LEAKED_FACTORY_SECRET) {
      db.authenticatorSecret = generateTotpSecret();
      changed = true;
    }
    return changed;
  }

  private normalizeCommerceData(db: DbSchema): void {
    db.affiliatePrograms = db.affiliatePrograms?.length ? db.affiliatePrograms : INITIAL_AFFILIATE_PROGRAMS;
    db.merchants = db.merchants?.length ? db.merchants : INITIAL_MERCHANTS;
    const merchantByName = new Map(db.merchants.map(m => [m.name.toLowerCase(), m]));
    const programByMerchant = new Map(db.merchants.map(m => [m.name.toLowerCase(), m.affiliateProgramId]));
    db.products = db.products.map(product => {
      const merchant = merchantByName.get((product.merchant || '').toLowerCase());
      return merchant
        ? { ...product, merchantId: product.merchantId || merchant.id, affiliateProgramId: product.affiliateProgramId || programByMerchant.get(merchant.name.toLowerCase()) }
        : product;
    });
  }

  private persist(dataToSave?: DbSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave || this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting database:', err);
    }
  }

  private generateSeedClicks(): ClickEvent[] {
    const devices: ('mobile' | 'desktop' | 'tablet')[] = ['mobile', 'mobile', 'mobile', 'desktop', 'desktop', 'tablet'];
    const referrers = ['pinterest.com/muiro', 'tiktok.com/@muiro', 'instagram.com/stories', 'direct', 'google.com'];
    const sources = ['pinterest', 'tiktok', 'instagram', 'direct', 'newsletter'];
    const now = Date.now();
    const seed: ClickEvent[] = [];

    INITIAL_PRODUCTS.forEach((prod, pIdx) => {
      const clickCount = Math.floor(prod.clicks / 2) || 15;
      for (let i = 0; i < clickCount; i++) {
        const daysAgo = Math.floor(Math.random() * 7);
        const time = new Date(now - daysAgo * 86400000 - Math.random() * 86400000).toISOString();
        const dev = devices[Math.floor(Math.random() * devices.length)];
        const src = sources[Math.floor(Math.random() * sources.length)];
        const estComm = Number(((prod.numericPrice * (prod.commissionRate / 100)) * (Math.random() > 0.4 ? 1 : 0.6)).toFixed(2));

        seed.push({
          id: `clk_${pIdx}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          productId: prod.id,
          productTitle: prod.title,
          lookId: i % 2 === 0 ? "look-1" : "look-2",
          merchant: prod.merchant,
          timestamp: time,
          device: dev,
          referrer: referrers[Math.floor(Math.random() * referrers.length)],
          utmSource: src,
          utmCampaign: 'autumn_lookbook_2026',
          ipHash: crypto.createHash('sha256').update(`ip_${i}_${pIdx}`).digest('hex').substring(0, 12),
          isBot: false,
          estimatedCommission: estComm
        });
      }
    });

    return seed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Affiliate programs & merchants
  public getAffiliatePrograms(): AffiliateProgram[] { return this.data.affiliatePrograms || []; }
  public addAffiliateProgram(program: Omit<AffiliateProgram, 'id'>): AffiliateProgram {
    const created = { ...program, id: `program-${Date.now()}` };
    this.data.affiliatePrograms = [created, ...(this.data.affiliatePrograms || [])];
    this.persist();
    return created;
  }
  public updateAffiliateProgram(id: string, updates: Partial<AffiliateProgram>): AffiliateProgram | null {
    const list = this.data.affiliatePrograms || [];
    const index = list.findIndex(p => p.id === id);
    if (index < 0) return null;
    list[index] = { ...list[index], ...updates };
    this.persist();
    return list[index];
  }
  public deleteAffiliateProgram(id: string): boolean {
    if ((this.data.merchants || []).some(m => m.affiliateProgramId === id)) return false;
    const before = (this.data.affiliatePrograms || []).length;
    this.data.affiliatePrograms = (this.data.affiliatePrograms || []).filter(p => p.id !== id);
    if (this.data.affiliatePrograms.length !== before) { this.persist(); return true; }
    return false;
  }
  public getMerchants(): Merchant[] { return this.data.merchants || []; }
  public addMerchant(merchant: Omit<Merchant, 'id'>): Merchant {
    const created = { ...merchant, id: `merchant-${Date.now()}` };
    this.data.merchants = [created, ...(this.data.merchants || [])];
    this.persist();
    return created;
  }
  public updateMerchant(id: string, updates: Partial<Merchant>): Merchant | null {
    const list = this.data.merchants || [];
    const index = list.findIndex(m => m.id === id);
    if (index < 0) return null;
    list[index] = { ...list[index], ...updates };
    this.persist();
    return list[index];
  }
  public deleteMerchant(id: string): boolean {
    if (this.data.products.some(p => p.merchantId === id)) return false;
    const before = (this.data.merchants || []).length;
    this.data.merchants = (this.data.merchants || []).filter(m => m.id !== id);
    if (this.data.merchants.length !== before) { this.persist(); return true; }
    return false;
  }

  // Lookbooks
  public getLookbooks(): Lookbook[] {
    return this.data.lookbooks;
  }

  public getLookbook(id: string): Lookbook | undefined {
    return this.data.lookbooks.find(l => l.id === id);
  }

  public addLookbook(lookbook: Omit<Lookbook, 'id' | 'views' | 'likes'>): Lookbook {
    const newLook: Lookbook = {
      ...lookbook,
      id: `look-${Date.now()}`,
      views: 0,
      likes: 0
    };
    this.data.lookbooks.unshift(newLook);
    this.persist();
    return newLook;
  }

  public updateLookbook(id: string, updates: Partial<Lookbook>): Lookbook | null {
    const index = this.data.lookbooks.findIndex(l => l.id === id);
    if (index === -1) return null;
    this.data.lookbooks[index] = { ...this.data.lookbooks[index], ...updates };
    this.persist();
    return this.data.lookbooks[index];
  }

  public deleteLookbook(id: string): boolean {
    const prevLen = this.data.lookbooks.length;
    this.data.lookbooks = this.data.lookbooks.filter(l => l.id !== id);
    if (this.data.lookbooks.length !== prevLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // Products
  public getProducts(): Product[] {
    return this.data.products;
  }

  public getProduct(id: string): Product | undefined {
    return this.data.products.find(p => p.id === id);
  }

  public addProduct(product: Omit<Product, 'id' | 'clicks'>): Product {
    const newProd: Product = {
      ...product,
      id: `p-${Date.now()}`,
      clicks: 0
    };
    this.data.products.unshift(newProd);
    this.persist();
    return newProd;
  }

  public updateProduct(id: string, updates: Partial<Product>): Product | null {
    const index = this.data.products.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.data.products[index] = { ...this.data.products[index], ...updates };
    this.persist();
    return this.data.products[index];
  }

  public deleteProduct(id: string): boolean {
    const prevLen = this.data.products.length;
    this.data.products = this.data.products.filter(p => p.id !== id);
    if (this.data.products.length !== prevLen) {
      // Drop stale references from lookbooks so their piece counts and the
      // public renderer never point at a deleted product.
      this.data.lookbooks = this.data.lookbooks.map(look => ({
        ...look,
        pieces: look.pieces.filter(pieceId => pieceId !== id)
      }));
      this.persist();
      return true;
    }
    return false;
  }

  // Testimonials
  public getTestimonials(): Testimonial[] {
    return this.data.testimonials;
  }

  public addTestimonial(testimonial: Omit<Testimonial, 'id' | 'date' | 'helpfulCount'>): Testimonial {
    const newTest: Testimonial = {
      ...testimonial,
      id: `t-${Date.now()}`,
      date: 'Just now',
      helpfulCount: 0
    };
    this.data.testimonials.unshift(newTest);
    this.persist();
    return newTest;
  }

  public updateTestimonial(id: string, updates: Partial<Testimonial>): Testimonial | null {
    const index = this.data.testimonials.findIndex(t => t.id === id);
    if (index === -1) return null;
    this.data.testimonials[index] = { ...this.data.testimonials[index], ...updates };
    this.persist();
    return this.data.testimonials[index];
  }

  public deleteTestimonial(id: string): boolean {
    const prevLen = this.data.testimonials.length;
    this.data.testimonials = this.data.testimonials.filter(t => t.id !== id);
    if (this.data.testimonials.length !== prevLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // Site Settings & Editorial Content
  public getSettings(): SiteSettings {
    return this.data.settings || DEFAULT_SETTINGS;
  }

  public updateSettings(updates: Partial<SiteSettings>): SiteSettings {
    this.data.settings = { ...(this.data.settings || DEFAULT_SETTINGS), ...updates };
    this.persist();
    return this.data.settings;
  }

  // Impressions & Clicks
  public recordImpression(lookId?: string): number {
    this.data.impressions += 1;
    if (lookId) {
      const look = this.data.lookbooks.find(l => l.id === lookId);
      if (look) look.views += 1;
    }
    this.persist();
    return this.data.impressions;
  }

  public recordClick(event: Omit<ClickEvent, 'id' | 'timestamp'>): ClickEvent {
    const fullEvent: ClickEvent = {
      ...event,
      id: `clk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString()
    };

    // Increment product clicks
    const product = this.data.products.find(p => p.id === event.productId);
    if (product) {
      product.clicks = (product.clicks || 0) + 1;
    }

    this.data.clicks.unshift(fullEvent);
    // Keep max 2000 clicks
    if (this.data.clicks.length > 2000) {
      this.data.clicks = this.data.clicks.slice(0, 2000);
    }
    this.persist();
    return fullEvent;
  }

  public getAnalytics() {
    const totalClicks = this.data.clicks.filter(c => !c.isBot).length;
    const totalImpressions = Math.max(this.data.impressions, totalClicks * 6);
    const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
    const estimatedEarnings = Number(
      this.data.clicks
        .filter(c => !c.isBot)
        .reduce((sum, c) => sum + (c.estimatedCommission || 0), 0)
        .toFixed(2)
    );

    const mobileClicks = this.data.clicks.filter(c => !c.isBot && c.device === 'mobile').length;
    const mobilePercentage = totalClicks > 0 ? Math.round((mobileClicks / totalClicks) * 100) : 68;

    // Top Lookbooks
    const topLookbooks = this.data.lookbooks.map(l => {
      const clicks = this.data.clicks.filter(c => c.lookId === l.id).length;
      const views = l.views || 100;
      const lCtr = views > 0 ? Number(((clicks / views) * 100).toFixed(1)) : 0;
      return {
        id: l.id,
        title: l.title,
        clicks,
        views,
        ctr: lCtr
      };
    }).sort((a, b) => b.clicks - a.clicks);

    // Top Products
    const topProducts = this.data.products.map(p => {
      const prodClicks = this.data.clicks.filter(c => c.productId === p.id);
      const earnings = prodClicks.reduce((sum, c) => sum + (c.estimatedCommission || 0), 0);
      return {
        id: p.id,
        title: p.title,
        clicks: prodClicks.length || p.clicks,
        earnings: Number(earnings.toFixed(2)),
        merchant: p.merchant,
        image: p.image
      };
    }).sort((a, b) => b.clicks - a.clicks).slice(0, 5);

    // Daily breakdown for last 7 days
    const dailyMap = new Map<string, { clicks: number; impressions: number; earnings: number }>();
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, { clicks: 0, impressions: Math.floor(totalImpressions / 7) + Math.floor(Math.random() * 80 - 40), earnings: 0 });
    }

    this.data.clicks.forEach(c => {
      const dStr = c.timestamp.split('T')[0];
      if (dailyMap.has(dStr)) {
        const item = dailyMap.get(dStr)!;
        item.clicks += 1;
        item.earnings = Number((item.earnings + (c.estimatedCommission || 0)).toFixed(2));
      }
    });

    const clicksByDay = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      clicks: data.clicks,
      impressions: data.impressions,
      earnings: data.earnings
    }));

    // Traffic Sources
    const sourceMap = new Map<string, number>();
    this.data.clicks.forEach(c => {
      const src = c.utmSource || 'direct';
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
    });
    const trafficSources = Array.from(sourceMap.entries())
      .map(([source, count]) => ({
        source: source.charAt(0).toUpperCase() + source.slice(1),
        clicks: count,
        percentage: totalClicks > 0 ? Math.round((count / totalClicks) * 100) : 0
      }))
      .sort((a, b) => b.clicks - a.clicks);

    return {
      totalImpressions,
      totalClicks,
      ctr,
      estimatedEarnings,
      mobilePercentage,
      topLookbooks,
      topProducts,
      recentClicks: this.data.clicks.slice(0, 25),
      clicksByDay,
      trafficSources
    };
  }

  // --- Hero Slides Management ---

  /** Stable ascending sort by the persisted `order` field; slides without an
   *  order keep their current array position (treated as Infinity). */
  private sortHeroSlides(slides: HeroSlide[]): HeroSlide[] {
    return [...slides].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
    );
  }

  /**
   * Merge a partial persisted slide with its source of truth:
   *   1. the same-id record in the STORE (custom, admin-created slides), then
   *   2. the same-id INITIAL_HERO_SLIDES counterpart.
   * Partial records — e.g. the `{ id }` stubs a reorder payload can leave behind —
   * would otherwise render as empty slides with no keyPieces and crash the Hero,
   * and a reorder must NOT silently drop admin-created slides.
   */
  private normalizeHeroSlide(slide: HeroSlide): HeroSlide {
    // Prefer the currently-persisted record of the same id (so a `{ id }` reorder
    // stub resolves back to the admin's own saved content), falling back to the
    // initial seed only as a secondary base for the curated starter slides.
    const persisted: HeroSlide | undefined = this.data.heroSlides?.find(s => s && s.id === slide?.id);
    const base: Partial<HeroSlide> | undefined =
      persisted || INITIAL_HERO_SLIDES.find(s => s.id === slide?.id);
    const clean = (v: unknown): boolean => v !== undefined && v !== null && v !== '';
    const pick = <K extends keyof HeroSlide>(key: K, fallback?: HeroSlide[K]): HeroSlide[K] =>
      clean(slide?.[key]) ? slide[key] : clean(base?.[key]) ? (base as HeroSlide)[key] : fallback as HeroSlide[K];
    return {
      ...base,
      ...slide,
      id: pick('id', ''),
      title: pick('title', ''),
      tagline: pick('tagline', ''),
      category: pick('category', 'Curated Edit'),
      fallbackImage: pick('fallbackImage'),
      lookId: pick('lookId'),
      isActive: pick('isActive', true),
      order: pick('order'),
      image: clean(slide?.image)
        ? slide.image
        : clean(base?.image)
          ? (base as HeroSlide).image
          : slide?.fallbackImage || base?.fallbackImage || '',
      keyPieces: Array.isArray(slide?.keyPieces) && slide.keyPieces.length > 0
        ? slide.keyPieces
        : Array.isArray(base?.keyPieces)
          ? (base as HeroSlide).keyPieces
          : [],
    };
  }

  public getHeroSlides(): HeroSlide[] {
    const slides = this.data.heroSlides;
    // True first-run / file missing the key → seed the initial curated slides.
    if (slides === undefined || slides === null) return this.sortHeroSlides(INITIAL_HERO_SLIDES);
    // The array exists and is intentionally empty → respect what the admin
    // persisted; do NOT silently resurrect hard-coded defaults over an
    // explicit empty state (that would also make deletions reappear).
    if (slides.length === 0) return [];
    return this.sortHeroSlides(slides.map(s => this.normalizeHeroSlide(s)));
  }

  public addHeroSlide(slide: Omit<HeroSlide, 'id'>): HeroSlide {
    const id = `hero-${Date.now()}`;
    const newSlide: HeroSlide = {
      ...slide,
      id,
      isActive: slide.isActive !== false,
      order: slide.order || (this.data.heroSlides?.length || 0) + 1
    };
    if (!this.data.heroSlides) {
      this.data.heroSlides = [...INITIAL_HERO_SLIDES];
    }
    this.data.heroSlides.push(newSlide);
    this.persist();
    return newSlide;
  }

  public updateHeroSlide(id: string, updates: Partial<HeroSlide>): HeroSlide | null {
    if (!this.data.heroSlides) {
      this.data.heroSlides = [...INITIAL_HERO_SLIDES];
    }
    const idx = this.data.heroSlides.findIndex(s => s.id === id);
    if (idx === -1) return null;
    this.data.heroSlides[idx] = { ...this.data.heroSlides[idx], ...updates };
    this.persist();
    return this.data.heroSlides[idx];
  }

  public deleteHeroSlide(id: string): boolean {
    if (!this.data.heroSlides) return false;
    const initialLen = this.data.heroSlides.length;
    this.data.heroSlides = this.data.heroSlides.filter(s => s.id !== id);
    if (this.data.heroSlides.length < initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  public setHeroSlides(slides: HeroSlide[]): HeroSlide[] {
    // Only keep records that carry real content after merging with defaults, so a
    // reorder payload of `{ id }` stubs cannot wipe the slide content. An empty
    // payload is respected (persisted as empty) rather than silently re-seeded.
    const normalized = slides
      .map(s => this.normalizeHeroSlide(s))
      .filter(s => Boolean(s.title) && Boolean(s.image || s.fallbackImage));
    this.data.heroSlides = this.sortHeroSlides(normalized);
    this.persist();
    return this.data.heroSlides;
  }

  // --- Admin PIN & Authenticator Key Management ---

  /** Raw stored credential. After migration this is a `scrypt$...` hash. */
  public getAdminPin(): string {
    return this.data.adminPin || hashPin(getBootstrapAdminPin());
  }

  /** Clear-text length of the passcode, safe to expose to the status UI. */
  public getAdminPinLength(): number {
    return typeof this.data.adminPinLength === 'number' && this.data.adminPinLength > 0
      ? this.data.adminPinLength
      : getBootstrapAdminPin().length;
  }

  /** Persists a new passcode as a salted scrypt hash. Returns its length. */
  public setAdminPin(pin: string): number {
    const clean = pin.trim();
    this.data.adminPin = hashPin(clean);
    this.data.adminPinLength = clean.length;
    this.persist();
    return clean.length;
  }

  /** Signing secret for session tokens; stable across restarts. */
  public getSessionSecret(): string {
    if (!this.data.sessionSecret) {
      this.data.sessionSecret = generateSessionSecret();
      this.persist();
    }
    return this.data.sessionSecret;
  }

  /** Rotates the signing secret, revoking every previously issued token. */
  public rotateSessionSecret(): string {
    this.data.sessionSecret = generateSessionSecret();
    this.persist();
    return this.data.sessionSecret;
  }

  public getAuthenticatorConfig(): { secret: string; enabled: boolean } {
    return {
      secret: this.data.authenticatorSecret || generateTotpSecret(),
      enabled: this.data.authenticatorEnabled !== false
    };
  }

  public setAuthenticatorConfig(secret: string, enabled?: boolean): { secret: string; enabled: boolean } {
    this.data.authenticatorSecret = secret.trim().toUpperCase().replace(/[^A-Z2-7]/g, '') || generateTotpSecret();
    if (enabled !== undefined) {
      this.data.authenticatorEnabled = Boolean(enabled);
    }
    this.persist();
    return this.getAuthenticatorConfig();
  }

  public resetAuthenticatorConfig(): { secret: string; enabled: boolean } {
    // A "factory reset" issues a never-before-seen key, never a fixed literal.
    this.data.authenticatorSecret = generateTotpSecret();
    this.data.authenticatorEnabled = true;
    this.persist();
    return this.getAuthenticatorConfig();
  }

  public resetDemo() {
    this.data = {
      products: INITIAL_PRODUCTS,
      lookbooks: INITIAL_LOOKBOOKS,
      testimonials: INITIAL_TESTIMONIALS,
      clicks: this.generateSeedClicks(),
      impressions: 14850,
      heroSlides: INITIAL_HERO_SLIDES,
      adminPin: hashPin(getBootstrapAdminPin()),
      adminPinLength: getBootstrapAdminPin().length,
      authenticatorSecret: generateTotpSecret(),
      authenticatorEnabled: true,
      // A content reset must not log the owner out: rebuild the object with
      // the existing signing secret so every issued session token survives.
      // (This was previously documented as "preserved" but the field was
      // dropped by the object literal, so every restart minted a new secret.)
      sessionSecret: this.data.sessionSecret || generateSessionSecret(),
      affiliatePrograms: INITIAL_AFFILIATE_PROGRAMS,
      merchants: INITIAL_MERCHANTS
    };
    this.persist();
    return true;
  }
}

export const store = new DataStore();
