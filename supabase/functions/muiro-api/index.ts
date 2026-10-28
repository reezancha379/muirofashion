// Supabase Edge Function backend for MUIRO. All persistent state is in the private
// public.muiro_state row; never return that row wholesale from a public handler.

type AnyRecord = Record<string, any>;
const BUCKET = "muiro-public";
const MAX_JSON_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SESSION_TTL = 24 * 60 * 60;
const enc = new TextEncoder();
const decoder = new TextDecoder();
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-muiro-session",
  "Access-Control-Expose-Headers": "x-muiro-publication",
  "Access-Control-Max-Age": "86400",
};
const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const json = (data: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...responseHeaders, ...extra },
  });
const err = (error: string, status: number, rest: AnyRecord = {}) =>
  json({ error, ...rest }, status);
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const b64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) =>
  Uint8Array.from(
    atob(
      s
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(s.length / 4) * 4, "="),
    ),
    (c) => c.charCodeAt(0),
  );
const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const equal = (a: string, b: string) => {
  let d = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++)
    d |=
      (a.charCodeAt(i % (a.length || 1)) || 0) ^
      (b.charCodeAt(i % (b.length || 1)) || 0);
  return d === 0;
};
function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}
function supaConfig() {
  const url = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY");
  if (!url || !key)
    throw new Error("Supabase service credentials are not configured");
  return { url, key };
}
async function sb(path: string, init: RequestInit = {}) {
  const { url, key } = supaConfig();
  const h = new Headers(init.headers);
  h.set("apikey", key);
  h.set("Authorization", `Bearer ${key}`);
  if (!h.has("Content-Type") && init.body)
    h.set("Content-Type", "application/json");
  return fetch(`${url}${path}`, { ...init, headers: h });
}

async function clientHash(req: Request) {
  const forwarded = (req.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  // Prefer proxy-provided single-address headers; if only XFF is present, use
  // its final (proxy-appended) value, never the client-controlled first value.
  const raw =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    forwarded[forwarded.length - 1] ||
    "unknown";
  const salt = env("IP_SALT") || env("SUPABASE_URL") || "muiro-client-hash";
  return hex(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        enc.encode(`${raw}:${salt}`),
      ),
    ),
  ).slice(0, 16);
}
async function allowRateRequest(key: string, limit: number, windowSeconds: number) {
  const response = await sb("/rest/v1/rpc/muiro_allow_request", {
    method: "POST",
    body: JSON.stringify({
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }),
  });
  if (!response.ok) throw new Error("Durable rate limit check failed");
  return (await response.json()) === true;
}

async function derivePin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin.normalize()),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 210000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return hex(new Uint8Array(bits));
}
async function hashPin(pin: string) {
  const salt = hex(randomBytes(16));
  return `pbkdf2$210000$${salt}$${await derivePin(pin, salt)}`;
}
async function verifyPin(stored: string, candidate: string) {
  const p = stored.split("$");
  if (p.length !== 4 || p[0] !== "pbkdf2" || p[1] !== "210000") return false;
  return equal(await derivePin(candidate, p[2]), p[3]);
}
function randomSecret() {
  return hex(randomBytes(32));
}
async function hmac(keyText: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyText),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))),
  );
}
async function signToken(secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(
    enc.encode(
      JSON.stringify({
        sub: "admin",
        iat: now,
        exp: now + SESSION_TTL,
        jti: hex(randomBytes(8)),
      }),
    ),
  );
  return `${body}.${await hmac(secret, body)}`;
}
async function verifyToken(secret: string, token: string | null) {
  if (!token) return null;
  const p = token.split(".");
  if (p.length !== 2) return null;
  if (!equal(await hmac(secret, p[0]), p[1])) return null;
  try {
    const data = JSON.parse(decoder.decode(fromB64url(p[0])));
    return data?.sub === "admin" &&
      typeof data.exp === "number" &&
      data.exp * 1000 > Date.now()
      ? data
      : null;
  } catch {
    return null;
  }
}
function base32Bytes(s: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.toUpperCase().replace(/[\s=-]/g, "")) {
    const i = alphabet.indexOf(c);
    if (i >= 0) bits += i.toString(2).padStart(5, "0");
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    out.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(out);
}
function randomTotpSecret(n = 32) {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let out = "";
  while (out.length < n) {
    for (const b of randomBytes(n)) {
      if (b < 248) {
        out += a[b % 32];
        if (out.length === n) break;
      }
    }
  }
  return out;
}
async function verifyTotp(
  token: string,
  secret: string,
  allowRecovery = false,
) {
  const recovery = env("MUIRO_MASTER_KEY");
  if (
    allowRecovery &&
    recovery &&
    equal(token.trim().toUpperCase(), recovery.toUpperCase())
  )
    return true;
  const code = token.trim();
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Bytes(secret);
  if (!key.length) return false;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const step = Math.floor(Date.now() / 30000);
  for (let off = -2; off <= 2; off++) {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigUint64(0, BigInt(step + off));
    const digest = new Uint8Array(
      await crypto.subtle.sign("HMAC", cryptoKey, buf),
    );
    const o = digest[digest.length - 1] & 15;
    const v =
      ((digest[o] & 127) << 24) |
      ((digest[o + 1] & 255) << 16) |
      ((digest[o + 2] & 255) << 8) |
      (digest[o + 3] & 255);
    if (String(v % 1000000).padStart(6, "0") === code) return true;
  }
  return false;
}

function defaultState(
  seed: AnyRecord,
  pinHash: string,
  pinLen: number,
): AnyRecord {
  return {
    ...seed,
    products: Array.isArray(seed.products) ? seed.products : [],
    categories: deriveCategories(
      Array.isArray(seed.products) ? seed.products : [],
      Array.isArray(seed.categories) ? seed.categories : [],
      Array.isArray(seed.lookbooks) ? seed.lookbooks : [],
    ),
    lookbooks: Array.isArray(seed.lookbooks) ? seed.lookbooks : [],
    testimonials: Array.isArray(seed.testimonials) ? seed.testimonials : [],
    heroSlides: Array.isArray(seed.heroSlides) ? seed.heroSlides : [],
    settings: seed.settings || {},
    affiliatePrograms: Array.isArray(seed.affiliatePrograms)
      ? seed.affiliatePrograms
      : [],
    merchants: Array.isArray(seed.merchants) ? seed.merchants : [],
    clicks: [],
    impressions: 0,
    adminPin: pinHash,
    adminPinLength: pinLen,
    sessionSecret: randomSecret(),
    authenticatorSecret: randomTotpSecret(),
    authenticatorEnabled: true,
  };
}
async function getRow() {
  const r = await sb(
    "/rest/v1/muiro_state?state_key=eq.primary&select=state,updated_at",
    { headers: { Accept: "application/json" } },
  );
  if (!r.ok) throw new Error(`Private state read failed (${r.status})`);
  const rows = await r.json();
  return rows[0] || null;
}
async function loadState() {
  let row = await getRow();
  if (row) return row;
  const pin = env("MUIRO_ADMIN_PIN");
  if (!/^\d{6,12}$/.test(pin)) throw new BootstrapError();
  // Embedded minimal seed for bootstrap when seed.json is not bundled
  const seed: AnyRecord = {
    products: [],
    lookbooks: [],
    categories: [],
    heroSlides: [],
    testimonials: [],
    settings: {},
    affiliatePrograms: [],
    merchants: [],
  };
  const initial = defaultState(seed, await hashPin(pin), pin.length);
  const post = await sb("/rest/v1/muiro_state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({ state_key: "primary", state: initial }),
  });
  if (!post.ok) throw new Error("Private state bootstrap failed");
  row = await getRow();
  if (!row) throw new Error("Private state bootstrap race; retry request");
  return row;
}
class BootstrapError extends Error {}
async function cas(mutator: (s: AnyRecord) => unknown, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const row = await loadState();
    const next = structuredClone(row.state) as AnyRecord;
    const result = mutator(next);
    const updatedAt = new Date(
      Math.max(Date.now(), Date.parse(row.updated_at) + 1),
    ).toISOString();
    const q = `/rest/v1/muiro_state?state_key=eq.primary&updated_at=eq.${encodeURIComponent(row.updated_at)}`;
    const r = await sb(q, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ state: next, updated_at: updatedAt }),
    });
    if (!r.ok) throw new Error("Private state update failed");
    const rows = await r.json();
    if (rows.length) return { state: next, result };
  }
  throw new Error("State changed concurrently; retry the request");
}

function pickPublicFields(value: AnyRecord, fields: string[]) {
  return Object.fromEntries(
    fields
      .filter((field) => Object.prototype.hasOwnProperty.call(value, field))
      .map((field) => [field, value[field]]),
  );
}
function safeMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const raw = value.trim();
  if (raw.startsWith("/")) {
    if (raw.startsWith("//")) throw new Error("Invalid media URL");
    return raw;
  }
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid media URL");
  return url.toString();
}
function publicPieceCovers(value: AnyRecord) {
  const pieces = new Set(Array.isArray(value?.pieces) ? value.pieces : []);
  const covers = value?.pieceCovers;
  if (!covers || typeof covers !== "object" || Array.isArray(covers)) return {};
  return Object.fromEntries(Object.entries(covers).flatMap(([productId, url]) => {
    if (!pieces.has(productId)) return [];
    const safeUrl = safeMediaUrl(url);
    return safeUrl ? [[productId, safeUrl]] : [];
  }));
}
function categorySlug(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function deriveCategories(products: AnyRecord[], existing: AnyRecord[] = [], lookbooks: AnyRecord[] = []) {
  const categories: AnyRecord[] = [];
  const names = new Set<string>();
  const slugs = new Set<string>();
  const add = (value: AnyRecord) => {
    const name = String(value?.name || "").trim().slice(0, 60);
    const key = name.toLowerCase();
    if (!name || names.has(key)) return;
    const base = categorySlug(name) || "category";
    const rawSlug = String(value?.slug || base).trim().toLowerCase();
    const safeSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug) && rawSlug.length <= 64 ? rawSlug : base;
    let slug = safeSlug;
    let suffix = 2;
    while (slugs.has(slug)) slug = `${safeSlug}-${suffix++}`;
    const timestamp = new Date(0).toISOString();
    const createdAt = typeof value?.createdAt === "string" ? value.createdAt.slice(0, 40) : timestamp;
    categories.push({
      id: String(value?.id || `category-${slug}`).slice(0, 100),
      name,
      slug,
      description: String(value?.description || "").trim().slice(0, 300),
      createdAt,
      updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt.slice(0, 40) : createdAt,
    });
    names.add(key);
    slugs.add(slug);
  };
  for (const category of Array.isArray(existing) ? existing : []) {
    if (category && typeof category === "object" && !Array.isArray(category)) add(category);
  }
  for (const label of [
    ...(Array.isArray(products) ? products : []).map((product) => product.category),
    ...(Array.isArray(lookbooks) ? lookbooks : []).map((lookbook) => lookbook.category),
  ]) {
    const name = String(label || "").trim();
    if (name) add({ name });
  }
  return categories;
}
function ensureCategoryForState(state: AnyRecord, value: unknown) {
  const name = String(value || "Fashion").trim() || "Fashion";
  const categories = deriveCategories(
    Array.isArray(state.products) ? state.products : [],
    Array.isArray(state.categories) ? state.categories : [],
    Array.isArray(state.lookbooks) ? state.lookbooks : [],
  );
  const existing = categories.find((category) => String(category.name).trim().toLowerCase() === name.toLowerCase());
  if (existing) {
    state.categories = categories;
    return existing.name;
  }
  const base = categorySlug(name) || "category";
  let slug = base;
  let suffix = 2;
  const slugs = new Set(categories.map((category) => category.slug));
  while (slugs.has(slug)) slug = `${base}-${suffix++}`;
  const now = new Date().toISOString();
  state.categories = [...categories, { id: id("category"), name, slug, description: "", createdAt: now, updatedAt: now }];
  return name;
}
function publicCategory(value: AnyRecord) {
  return pickPublicFields(value, ["id", "name", "slug", "description", "createdAt", "updatedAt"]);
}
function publicProduct(value: AnyRecord) {
  return {
    ...pickPublicFields(value, [
      "id", "title", "price", "numericPrice", "board", "category", "image", "imageAlt",
      "description", "affiliateUrl", "merchant", "merchantId", "affiliateProgramId", "badge", "rating",
      "reviewCount", "featured", "isNewlyAdded", "isTrending", "seoTitle", "seoDescription", "seoKeywords",
    ]),
    ...(value.videoUrl ? { videoUrl: safeMediaUrl(value.videoUrl) } : {}),
    ...(value.videoCaptionsUrl ? { videoCaptionsUrl: safeMediaUrl(value.videoCaptionsUrl) } : {}),
    clicks: 0,
  };
}
function publicLookbook(value: AnyRecord) {
  return {
    ...pickPublicFields(value, [
      "id", "title", "board", "category", "cover", "frame", "description",
      "pieces", "featured", "isNewlyAdded", "isTrending",
      "authorNote", "season", "seoTitle", "seoDescription", "seoKeywords",
    ]),
    ...(value.videoUrl ? { videoUrl: safeMediaUrl(value.videoUrl) } : {}),
    ...(value.videoCaptionsUrl ? { videoCaptionsUrl: safeMediaUrl(value.videoCaptionsUrl) } : {}),
    pieceCovers: publicPieceCovers(value),
    views: 0,
    likes: 0,
  };
}
function publicHeroSlide(value: AnyRecord) {
  return pickPublicFields(value, [
    "id", "image", "fallbackImage", "title", "tagline", "category", "lookId",
    "keyPieces", "isActive", "order",
  ]);
}
function publicTestimonial(value: AnyRecord) {
  return pickPublicFields(value, [
    "id", "author", "location", "avatar", "rating", "outfitTitle", "comment",
    "verified", "date", "helpfulCount", "featured",
  ]);
}
function publicSettings(value: AnyRecord) {
  const settings = pickPublicFields(value || {}, [
    "aboutTitle", "aboutSubtitle", "aboutStory", "affiliateDisclosure",
    "seoTitle", "seoDescription", "seoKeywords",
  ]);
  if (value?.ogImage) settings.ogImage = safeMediaUrl(value.ogImage);
  return {
    ...settings,
    aboutPillars: Array.isArray(value?.aboutPillars)
      ? value.aboutPillars.map((x: AnyRecord) =>
          pickPublicFields(x, ["title", "desc", "icon"]),
        )
      : [],
  };
}
function publicContent(s: AnyRecord) {
  return {
    lookbooks: (s.lookbooks || []).map(publicLookbook),
    products: (s.products || []).map(publicProduct),
    categories: deriveCategories(s.products || [], s.categories || [], s.lookbooks || []).map(publicCategory),
    testimonials: (s.testimonials || []).map(publicTestimonial),
    heroSlides: (s.heroSlides || []).map(publicHeroSlide),
    settings: publicSettings(s.settings),
  };
}
function changedContent(before: AnyRecord, after: AnyRecord) {
  return JSON.stringify(publicContent(before)) !== JSON.stringify(publicContent(after));
}
const BUCKET_MIMES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "application/json",
];
let snapshotPublishQueue: Promise<boolean> = Promise.resolve(true);

async function ensureBucket() {
  const list = await sb("/storage/v1/bucket");
  if (!list.ok) throw new Error("Storage bucket check failed");
  const buckets = await list.json();
  const bucket = buckets.find((b: AnyRecord) => b.name === BUCKET);
  if (!bucket) {
    const r = await sb("/storage/v1/bucket", {
      method: "POST",
      body: JSON.stringify({
        id: BUCKET,
        name: BUCKET,
        public: true,
        file_size_limit: MAX_IMAGE_BYTES,
        allowed_mime_types: BUCKET_MIMES,
      }),
    });
    if (r.status === 409) return ensureBucket();
    if (!r.ok) throw new Error("Could not create public storage bucket");
    return;
  }
  const allowed = Array.isArray(bucket.allowed_mime_types) ? bucket.allowed_mime_types : [];
  if (
    bucket.public !== true ||
    Number(bucket.file_size_limit) < MAX_IMAGE_BYTES ||
    !BUCKET_MIMES.every((mime) => allowed.includes(mime))
  ) throw new Error("Existing public bucket configuration is not approved for MUIRO assets");
}

async function publishLatestSnapshot(): Promise<boolean> {
  try {
    await ensureBucket();
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await getRow();
      if (!before) return false;
      const r = await sb(`/storage/v1/object/${BUCKET}/content-snapshot.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-upsert": "true",
          "Cache-Control": "0",
        },
        body: JSON.stringify(publicContent(before.state)),
      });
      if (!r.ok) {
        console.error(`[MUIRO] public snapshot upload failed (${r.status})`);
        return false;
      }
      const after = await getRow();
      if (!after || after.updated_at !== before.updated_at) continue;

      const hook = env("NETLIFY_BUILD_HOOK_URL");
      if (!hook) {
        console.warn("[MUIRO] public snapshot stored; rebuild hook is not configured");
        return false;
      }
      let hookUrl: URL;
      try { hookUrl = new URL(hook); } catch { return false; }
      if (
        hookUrl.protocol !== "https:" || hookUrl.hostname !== "api.netlify.com" ||
        !hookUrl.pathname.startsWith("/build_hooks/") || hookUrl.username || hookUrl.password
      ) return false;
      const rebuild = await fetch(hookUrl, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
      if (!rebuild.ok) {
        console.error(`[MUIRO] Netlify rebuild hook failed (${rebuild.status})`);
        return false;
      }
      return true;
    }
    console.warn("[MUIRO] snapshot changed during publication; a later refresh is required");
    return false;
  } catch {
    // Do not disclose request contents or secret URLs in function logs.
    console.error("[MUIRO] public snapshot refresh failed after a CMS save");
    return false;
  }
}

function publishSnapshot(_state: AnyRecord): Promise<boolean> {
  const next = snapshotPublishQueue.catch(() => false).then(() => publishLatestSnapshot());
  snapshotPublishQueue = next;
  return next;
}

function safeDomain(raw: string) {
  if (
    typeof raw !== "string" ||
    !raw.trim() ||
    /^(javascript:|data:|file:|vbscript:)/i.test(raw.trim())
  )
    return { valid: false, safeUrl: "", reason: "Malformed URL" };
  let u: URL;
  try {
    u = new URL(
      /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`,
    );
  } catch {
    return { valid: false, safeUrl: "", reason: "Malformed URL" };
  }
  if (!["http:", "https:"].includes(u.protocol))
    return {
      valid: false,
      safeUrl: "",
      reason: "Only HTTP/HTTPS protocols are permitted",
    };
  if (u.username || u.password)
    return {
      valid: false,
      safeUrl: "",
      reason: "User information is not permitted in affiliate URLs",
    };
  const trusted = [
    "amazon.com",
    "amzn.to",
    "revolve.com",
    "nordstrom.com",
    "asos.com",
    "zara.com",
    "target.com",
    "shopbop.com",
    "farfetch.com",
    "ssense.com",
    "net-a-porter.com",
    "mango.com",
    "hm.com",
    "urbanoutfitters.com",
    "aritzia.com",
    "princesspolly.com",
  ];
  if (!trusted.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`)))
    return {
      valid: false,
      safeUrl: "",
      reason: "Affiliate domain is not on the MUIRO allowlist",
    };
  const q = new URLSearchParams();
  u.searchParams.forEach((v, k) => {
    if (k.length <= 64 && v.length <= 512 && !/[<>\'"(){}]/.test(v))
      q.append(k, v);
  });
  u.search = q.toString();
  return { valid: true, safeUrl: u.toString() };
}
function device(ua: string) {
  if (/tablet|ipad|playbook|silk|android(?!.*mobi)/i.test(ua)) return "tablet";
  return /mobile|iphone|ipod|blackberry|opera mini|iemobile|android/i.test(ua)
    ? "mobile"
    : "desktop";
}
function crawler(ua: string) {
  return /(bot|spider|crawl|slurp|headless|phantom|facebookexternalhit|whatsapp|telegrambot|curl|wget|python|postman|lighthouse|headlesschrome|googlebot|bingbot)/i.test(
    ua,
  );
}
async function clientMeta(req: Request, url: URL) {
  const ua = req.headers.get("user-agent") || "";
  const raw =
    req.headers.get("referer") || url.searchParams.get("ref") || "direct";
  let ref = "direct";
  try {
    ref = raw.startsWith("http")
      ? new URL(raw).hostname.replace(/^www\./, "")
      : raw.slice(0, 50);
  } catch {}
  return {
    ua,
    device: device(ua),
    isBot: crawler(ua),
    referrer: ref,
    ipHash: await clientHash(req),
    utmSource: (url.searchParams.get("utm_source") || "").slice(0, 30),
    utmCampaign: (url.searchParams.get("utm_campaign") || "").slice(0, 40),
  };
}
function background(promise: Promise<unknown>) {
  const pending = promise.catch(() => {});
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(pending);
}
function id(prefix: string) {
  return `${prefix}-${Date.now()}-${hex(randomBytes(4))}`;
}
function normalizeSlide(slide: AnyRecord, all: AnyRecord[]) {
  const base = all.find((x) => x.id === slide.id) || {};
  const merged = { ...base, ...slide };
  if (!Array.isArray(merged.keyPieces)) merged.keyPieces = [];
  return merged;
}
function analytics(s: AnyRecord) {
  const clicks = (s.clicks || []).filter((c: AnyRecord) => !c.isBot);
  const total = clicks.length;
  const impressions = Math.max(0, Number(s.impressions) || 0);
  const earnings = Number(
    clicks
      .reduce(
        (a: number, c: AnyRecord) => a + (Number(c.estimatedCommission) || 0),
        0,
      )
      .toFixed(2),
  );
  const lookbooks = (s.lookbooks || [])
    .map((l: AnyRecord) => {
      const n = (s.clicks || []).filter(
        (c: AnyRecord) => c.lookId === l.id,
      ).length;
      const v = Number(l.views) || 0;
      return {
        id: l.id,
        title: l.title,
        clicks: n,
        views: v,
        ctr: v ? Number(((n / v) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a: AnyRecord, b: AnyRecord) => b.clicks - a.clicks);
  const products = (s.products || [])
    .map((p: AnyRecord) => {
      const cs = (s.clicks || []).filter(
        (c: AnyRecord) => c.productId === p.id,
      );
      return {
        id: p.id,
        title: p.title,
        clicks: cs.length || p.clicks || 0,
        earnings: Number(
          cs
            .reduce(
              (a: number, c: AnyRecord) =>
                a + (Number(c.estimatedCommission) || 0),
              0,
            )
            .toFixed(2),
        ),
        merchant: p.merchant,
        image: p.image,
      };
    })
    .sort((a: AnyRecord, b: AnyRecord) => b.clicks - a.clicks)
    .slice(0, 5);
  const now = new Date();
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000),
      key = d.toISOString().slice(0, 10),
      events = (s.clicks || []).filter(
        (c: AnyRecord) => c.timestamp?.slice(0, 10) === key,
      );
    daily.push({
      date: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      }),
      clicks: events.length,
      impressions: Math.floor(impressions / 7),
      earnings: Number(
        events
          .reduce(
            (a: number, c: AnyRecord) =>
              a + (Number(c.estimatedCommission) || 0),
            0,
          )
          .toFixed(2),
      ),
    });
  }
  const src = new Map<string, number>();
  for (const c of s.clicks || []) {
    const k = c.utmSource || "direct";
    src.set(k, (src.get(k) || 0) + 1);
  }
  return {
    totalImpressions: impressions,
    totalClicks: total,
    ctr: impressions ? Number(((total / impressions) * 100).toFixed(2)) : 0,
    estimatedEarnings: earnings,
    mobilePercentage: total
      ? Math.round(
          (clicks.filter((c: AnyRecord) => c.device === "mobile").length /
            total) *
            100,
        )
      : 0,
    topLookbooks: lookbooks,
    topProducts: products,
    recentClicks: (s.clicks || []).slice(0, 25),
    clicksByDay: daily,
    trafficSources: Array.from(src)
      .map(([source, count]) => ({
        source: source.charAt(0).toUpperCase() + source.slice(1),
        clicks: count,
        percentage: total ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks),
  };
}

async function body(req: Request) {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES)
    throw new BodyError("Request body exceeds the 15 MB limit", 413);
  if (!text) return {};
  try {
    return JSON.parse(text) || {};
  } catch {
    throw new BodyError("Invalid JSON body", 400);
  }
}
class BodyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(req.url);
  let path =
    url.pathname
      .replace(/^\/muiro-api/, "")
      .replace(/\/$/, "") || "/";
  if (path === "/muiro-api") path = "/";
  const api = path.startsWith("/api/") ? path.slice(4) : path;
  const method = req.method.toUpperCase();
  let input: AnyRecord = {};
  if (["POST", "PUT", "PATCH"].includes(method)) {
    try {
      input = await body(req);
    } catch (e) {
      if (e instanceof BodyError) return err(e.message, e.status);
      return err("Invalid request body", 400);
    }
  }
  // Public endpoints that don't require authentication
  // Note: 'api' retains the leading slash from '/api/...' stripping (e.g., '/health')
  const isPublicGet = method === "GET" && [
    "/health", "/lookbooks", "/products", "/categories", "/hero-slides", 
    "/testimonials", "/settings", "/affiliate-programs", "/merchants",
    "/admin/pin", "/admin/pin-status"
  ].includes(api);
  if (method === "GET" && api === "/health")
    return json({ status: "ok", time: new Date().toISOString() });
  if (isPublicGet) {
    // Handle public GET endpoints before any auth checks
    let row;
    try {
      row = await loadState();
    } catch (e) {
      if (e instanceof BootstrapError)
        return err(
          "Admin bootstrap is not configured. Set MUIRO_ADMIN_PIN in Supabase Function Secrets.",
          503,
          { code: "BOOTSTRAP_NOT_CONFIGURED" },
        );
      return err("Backend state is unavailable", 503);
    }
    let s = row.state as AnyRecord;
    
    // Public content endpoints - return public projections
    if (api === "/affiliate-programs")
      return json(s.affiliatePrograms || []);
    if (api === "/merchants") return json(s.merchants || []);
    if (api === "/categories")
      return json(deriveCategories(s.products || [], s.categories || [], s.lookbooks || []).map(publicCategory));
    if (api === "/lookbooks")
      return json((s.lookbooks || []).map(publicLookbook));
    if (api === "/products")
      return json((s.products || []).map(publicProduct));
    if (api === "/hero-slides")
      return json(
        [...(s.heroSlides || [])]
          .map(publicHeroSlide)
          .sort(
            (a: AnyRecord, b: AnyRecord) =>
              (a.order ?? Number.MAX_SAFE_INTEGER) -
              (b.order ?? Number.MAX_SAFE_INTEGER),
          ),
      );
    if (api === "/testimonials")
      return json((s.testimonials || []).map(publicTestimonial));
    if (api === "/settings")
      return json(publicSettings(s.settings));
    if (api === "/admin/pin")
      return json({ configured: true, length: s.adminPinLength || 0 });
    if (api === "/admin/pin-status")
      return json({ configured: true, length: s.adminPinLength || 0 });
    return err("Not found", 404);
  }
  // Visitor telemetry is best-effort. Return before durable rate-limit or state
  // reads; work continues in the Edge Runtime background task queue.
  if (method === "POST" && api === "/impression") {
    if (
      input.lookId !== undefined &&
      (typeof input.lookId !== "string" || input.lookId.length > 128)
    ) return err("Invalid lookId", 400);
    const meta = await clientMeta(req, url);
    background((async () => {
      if (!(await allowRateRequest("impression:global", 1200, 60))) return;
      if (!(await allowRateRequest(`impression:${meta.ipHash}`, 60, 60))) return;
      await cas((st) => {
        st.impressions = (Number(st.impressions) || 0) + 1;
        if (input.lookId) {
          const look = st.lookbooks.find((x: AnyRecord) => x.id === input.lookId);
          if (look) look.views = (Number(look.views) || 0) + 1;
        }
      });
    })());
    return json({ success: true, accepted: true }, 202);
  }

  if (method === "POST" && api === "/click") {
    if (typeof input.productId !== "string" || !input.productId || input.productId.length > 128)
      return err("Invalid productId", 400);
    if (
      input.lookId !== undefined &&
      (typeof input.lookId !== "string" || input.lookId.length > 128)
    ) return err("Invalid lookId", 400);
    const requestedSafe = typeof input.affiliateUrl === "string"
      ? safeDomain(input.affiliateUrl)
      : null;
    if (requestedSafe && !requestedSafe.valid)
      return json({ success: true, accepted: false }, 202);
    const meta = await clientMeta(req, url);
    const source = typeof input.source === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(input.source)
      ? input.source
      : meta.utmSource || "web_lookbook";
    const clickId = `clk_${Date.now()}_${hex(randomBytes(3))}`;
    background((async () => {
      if (!(await allowRateRequest("click:global", 600, 60))) return;
      if (!(await allowRateRequest(`click:${meta.ipHash}`, 30, 60))) return;
      if (meta.isBot) return;
      await cas((st) => {
        const product = st.products.find((x: AnyRecord) => x.id === input.productId);
        if (!product) return;
        const authoritative = safeDomain(product.affiliateUrl);
        if (!authoritative.valid || (requestedSafe && authoritative.safeUrl !== requestedSafe.safeUrl)) return;
        const lookId = input.lookId && st.lookbooks.some((x: AnyRecord) => x.id === input.lookId)
          ? input.lookId
          : undefined;
        const commissionRate = Number(product.commissionRate) || 8;
        const estimatedCommission = Number(
          ((Number(product.numericPrice) || 0) * commissionRate / 100).toFixed(2),
        );
        product.clicks = (Number(product.clicks) || 0) + 1;
        st.clicks = Array.isArray(st.clicks) ? st.clicks : [];
        st.clicks.unshift({
          id: clickId,
          productId: product.id,
          productTitle: product.title,
          lookId,
          merchant: product.merchant,
          timestamp: new Date().toISOString(),
          device: meta.device,
          referrer: meta.referrer,
          utmSource: source,
          utmCampaign: meta.utmCampaign || "organic",
          ipHash: meta.ipHash,
          isBot: false,
          estimatedCommission,
        });
        st.clicks = st.clicks.slice(0, 2000);
      });
    })());
    return json({
      success: true,
      accepted: true,
      safeUrl: requestedSafe?.safeUrl || "",
      clickId,
    }, 202);
  }

  const segments = api.split("/").filter(Boolean);
  const resource = segments[0] || "";
  const itemId = segments[1];
  const token = req.headers.get("x-muiro-session")?.trim() ||
    (req.headers.get("authorization") || "")
      .match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
  const publicPost = method === "POST" &&
    ["/admin/verify", "/admin/reset-pin"].includes(api);
  const publicRedirect = method === "GET" && resource === "r" && !!itemId;
  const requiresAdmin = !publicPost && !publicRedirect && !isPublicGet;
  if (isPublicGet) {
    // Public GET endpoints skip auth checks
  } else {
    // Reject anonymous calls to protected/unknown paths before reading the
    // private CMS row. Keep even syntactically supplied sessions bounded by a
    // durable per-client ceiling before their signature check loads private state.
    if (requiresAdmin && !token)
      return err("Authentication required", 401, { code: "NO_SESSION" });
    if (token && token.length > 2048)
      return err("Session expired or invalid", 401, { code: "SESSION_INVALID" });
    if (requiresAdmin && token) {
      try {
        if (!(await allowRateRequest(`session:${await clientHash(req)}`, 300, 60)))
          return err("Too many requests. Please wait a moment.", 429);
      } catch {
        return err("Authentication rate-limit service is unavailable", 503);
      }
    }
  }

  if (publicRedirect) {
    try {
      if (!(await allowRateRequest(`redirect:${await clientHash(req)}`, 30, 60)))
        return new Response("Too many requests. Please wait a moment.", {
          status: 429,
          headers: { ...corsHeaders, "Cache-Control": "no-store" },
        });
    } catch {
      return err("Redirect rate-limit service is unavailable", 503);
    }
  }

  if (method === "POST" && api === "/admin/verify") {
    const credential = typeof input.credential === "string" ? input.credential.trim() : "";
    if (!/^\d{6,12}$/.test(credential))
      return err("Enter a 6–12 digit admin PIN or a 6-digit authenticator code.", 400);
    try {
      const globalMinute = await allowRateRequest("auth:global:minute", 1200, 60);
      const globalDay = await allowRateRequest("auth:global:day", 10000, 86400);
      const clientAllowed = await allowRateRequest(`auth:${await clientHash(req)}`, 10, 60);
      if (!globalMinute || !globalDay || !clientAllowed)
        return err("Too many attempts. Please wait a minute before trying again.", 429);
    } catch {
      return err("Authentication rate-limit service is unavailable", 503);
    }
  }

  if (method === "POST" && api === "/admin/reset-pin") {
    if (typeof input.authCodeOrKey !== "string" || input.authCodeOrKey.length > 128)
      return err("A valid authenticator code is required.", 400);
    try {
      const globalHour = await allowRateRequest("reset:global:hour", 1200, 3600);
      const globalDay = await allowRateRequest("reset:global:day", 10000, 86400);
      const clientAllowed = await allowRateRequest(`reset:${await clientHash(req)}`, 5, 60);
      if (!globalHour || !globalDay || !clientAllowed)
        return err("Too many attempts. Please wait a minute.", 429);
    } catch {
      return err("Authentication rate-limit service is unavailable", 503);
    }
  }

  let row;
  try {
    row = await loadState();
  } catch (e) {
    if (e instanceof BootstrapError)
      return err(
        "Admin bootstrap is not configured. Set MUIRO_ADMIN_PIN in Supabase Function Secrets.",
        503,
        { code: "BOOTSTRAP_NOT_CONFIGURED" },
      );
    return err("Backend state is unavailable", 503);
  }
  let s = row.state as AnyRecord;
  const isAdmin = async () => !!(await verifyToken(s.sessionSecret, token));
  const ownerSession = await isAdmin();
  if (requiresAdmin && !ownerSession)
    return err(
      token ? "Session expired or invalid" : "Authentication required",
      401,
      { code: token ? "SESSION_INVALID" : "NO_SESSION" },
    );
  if (method === "GET" && api === "/admin/session") {
    const p = await verifyToken(s.sessionSecret, token);
    return json({ valid: true, expiresAt: p.exp * 1000 });
  }
  if (method === "POST" && api === "/admin/verify") {
    const credential =
      typeof input.credential === "string" ? input.credential.trim() : "";
    if (!/^\d{6,12}$/.test(credential))
      return err("Enter a 6–12 digit admin PIN or a 6-digit authenticator code.", 400);
    const pinOk = await verifyPin(s.adminPin, credential);
    const totpOk =
      s.authenticatorEnabled !== false &&
      (await verifyTotp(credential, s.authenticatorSecret));
    if (!pinOk && !totpOk)
      return err(
        "Invalid credentials. If you used your authenticator app, enter the code currently displayed on your phone (it refreshes every 30 seconds) and make sure your phone clock is set to automatic.",
        401,
      );
    return json({
      success: true,
      verifiedBy: pinOk ? "pin" : "authenticator",
      token: await signToken(s.sessionSecret),
      expiresIn: SESSION_TTL,
    });
  }
  if (method === "POST" && api === "/admin/reset-pin") {
    if (
      typeof input.authCodeOrKey !== "string" ||
      input.authCodeOrKey.length > 128 ||
      !(await verifyTotp(
        input.authCodeOrKey,
        s.authenticatorSecret,
        true,
      ))
    )
      return err(
        "Unauthorized. You must provide a valid 6-digit Authenticator code from your paired app to reset the passcode.",
        403,
      );
    const pin = typeof input.newPin === "string" ? input.newPin.trim() : "";
    if (!/^\d{6,12}$/.test(pin))
      return err("Use a new 6–12 digit numeric passcode.", 400);
    const hash = await hashPin(pin);
    const r = await cas((st) => {
      st.adminPin = hash;
      st.adminPinLength = pin.length;
      st.sessionSecret = randomSecret();
    });
    return json({
      success: true,
      token: await signToken(r.state.sessionSecret),
    });
  }

  // Public content endpoints. Only explicitly public content projections escape.
  if (method === "GET" && api === "/affiliate-programs")
    return json(s.affiliatePrograms || []);
  if (method === "GET" && api === "/merchants") return json(s.merchants || []);
  if (method === "GET" && api === "/categories")
    return json(deriveCategories(s.products || [], s.categories || [], s.lookbooks || []).map(publicCategory));
  if (method === "GET" && api === "/lookbooks")
    return json(
      ownerSession
        ? s.lookbooks || []
        : (s.lookbooks || []).map(publicLookbook),
    );
  if (method === "GET" && api === "/products")
    return json(
      ownerSession ? s.products || [] : (s.products || []).map(publicProduct),
    );
  if (method === "GET" && api === "/hero-slides")
    return json(
      [...(s.heroSlides || [])]
        .map((x: AnyRecord) => ownerSession ? x : publicHeroSlide(x))
        .sort(
        (a: AnyRecord, b: AnyRecord) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER),
      ),
    );
  if (method === "GET" && api === "/testimonials")
    return json(
      ownerSession
        ? s.testimonials || []
        : (s.testimonials || []).map(publicTestimonial),
    );
  if (method === "GET" && api === "/settings")
    return json(ownerSession ? s.settings || {} : publicSettings(s.settings));
  if (method === "GET" && api === "/admin/pin")
    return json({ configured: true, length: s.adminPinLength || 0 });
  if (method === "GET" && api === "/admin/pin-status")
    return json({ configured: true, length: s.adminPinLength || 0 });
  if (method === "GET" && api === "/admin/authenticator")
    return json({
      secret: s.authenticatorSecret,
      enabled: s.authenticatorEnabled !== false,
      account: "admin",
      issuer: "MUIRO",
    });
  if (method === "GET" && api === "/stats") return json(analytics(s));

  // Mutations use a fresh-state compare-and-swap and retry; preserve concurrent events.
  let publicationStatus = "not-required";
  const mutationJson = (data: unknown, status = 200) =>
    json(data, status, { "X-MUIRO-Publication": publicationStatus });
  const mutate = async (fn: (st: AnyRecord) => unknown, content = false) => {
    const before = s;
    const saved = await cas(fn);
    if (content && changedContent(before, saved.state)) {
      publicationStatus = await publishSnapshot(saved.state) ? "published" : "pending";
    }
    return saved;
  };
  if (method === "POST" && api === "/admin/pin") {
    const pin = typeof input.newPin === "string" ? input.newPin.trim() : "";
    if (!/^\d{6,12}$/.test(pin))
      return err("Use a 6–12 digit numeric passcode.", 400);
    const hash = await hashPin(pin);
    const r = await mutate((st) => {
      st.adminPin = hash;
      st.adminPinLength = pin.length;
      st.sessionSecret = randomSecret();
    });
    return json({
      success: true,
      token: await signToken(r.state.sessionSecret),
    });
  }
  if (method === "POST" && api === "/admin/authenticator") {
    if (typeof input.secret !== "string" || !input.secret)
      return err("Authenticator secret is required", 400);
    const secret =
      input.secret
        .trim()
        .toUpperCase()
        .replace(/[^A-Z2-7]/g, "") || randomTotpSecret();
    const r = await mutate((st) => {
      st.authenticatorSecret = secret;
      if (input.enabled !== undefined)
        st.authenticatorEnabled = Boolean(input.enabled);
      st.sessionSecret = randomSecret();
    });
    return json({
      success: true,
      secret: r.state.authenticatorSecret,
      enabled: r.state.authenticatorEnabled !== false,
      token: await signToken(r.state.sessionSecret),
    });
  }
  if (method === "POST" && api === "/admin/authenticator/reset") {
    const secret = randomTotpSecret();
    const r = await mutate((st) => {
      st.authenticatorSecret = secret;
      st.authenticatorEnabled = true;
      st.sessionSecret = randomSecret();
    });
    return json({
      success: true,
      secret,
      enabled: true,
      token: await signToken(r.state.sessionSecret),
    });
  }
  // Existing clean-link redirect compatibility; no analytics wait on ordinary page rendering.
  if (publicRedirect) {
    const p = s.products.find((x: AnyRecord) => x.id === itemId);
    if (!p)
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: "/?error=product_not_found",
          "Cache-Control": "no-store",
        },
      });
    const meta = await clientMeta(req, url);
    const safe = safeDomain(p.affiliateUrl);
    if (!safe.valid)
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: "/?error=invalid_target" },
      });
    const requestedLook = url.searchParams.get("look");
    const lookId =
      requestedLook && requestedLook.length <= 128 &&
      s.lookbooks.some((x: AnyRecord) => x.id === requestedLook)
        ? requestedLook
        : undefined;
    if (!meta.isBot) {
      const rate = p.commissionRate || 8,
        amount = Number(((p.numericPrice * rate) / 100).toFixed(2));
      const event = {
        id: `clk_${Date.now()}_${hex(randomBytes(3))}`,
        productId: p.id,
        productTitle: p.title,
        lookId,
        merchant: p.merchant,
        timestamp: new Date().toISOString(),
        device: meta.device,
        referrer: meta.referrer,
        utmSource: meta.utmSource || "external_link",
        utmCampaign: meta.utmCampaign || "direct_share",
        ipHash: meta.ipHash,
        isBot: false,
        estimatedCommission: amount,
      };
      void cas((st) => {
        const pr = st.products.find((x: AnyRecord) => x.id === p.id);
        if (pr) pr.clicks = (pr.clicks || 0) + 1;
        st.clicks = [event, ...(st.clicks || [])].slice(0, 2000);
      }).catch(() => {});
    }
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: safe.safeUrl,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Referrer-Policy": "no-referrer-when-downgrade",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  if (method === "POST" && api === "/upload") {
    const data = typeof input.data === "string" ? input.data : "",
      filename = typeof input.filename === "string" ? input.filename : "";
    if (!data) return err("No image data provided", 400);
    if (!filename) return err("No filename provided", 400);
    let bytes: Uint8Array;
    try {
      const decoded = atob(data.replace(/\s/g, ""));
      bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    } catch {
      return err("Image data is not valid base64", 400);
    }
    if (!bytes.length) return err("Image data is empty", 400);
    if (bytes.length > MAX_IMAGE_BYTES)
      return err("Image exceeds the 8 MB limit", 400);
    let ext = "",
      mime = "";
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
      ext = "jpg";
      mime = "image/jpeg";
    } else if (
      bytes[0] === 137 &&
      decoder.decode(bytes.slice(1, 4)) === "PNG"
    ) {
      ext = "png";
      mime = "image/png";
    } else if (
      ["GIF87a", "GIF89a"].includes(decoder.decode(bytes.slice(0, 6)))
    ) {
      ext = "gif";
      mime = "image/gif";
    } else if (
      decoder.decode(bytes.slice(0, 4)) === "RIFF" &&
      decoder.decode(bytes.slice(8, 12)) === "WEBP"
    ) {
      ext = "webp";
      mime = "image/webp";
    } else if (
      decoder.decode(bytes.slice(4, 8)) === "ftyp" &&
      ["avif", "avis"].includes(decoder.decode(bytes.slice(8, 12)))
    ) {
      ext = "avif";
      mime = "image/avif";
    } else
      return err(
        "Unsupported image type. Upload a JPEG, PNG, WebP, GIF, or AVIF file.",
        400,
      );
    await ensureBucket();
    const original =
      filename
        .replace(/[^\w.-]/g, "_")
        .replace(/\.[A-Za-z0-9]+$/, "")
        .slice(0, 24) || "image";
    const name = `${Date.now()}_${hex(randomBytes(6))}_${original}.${ext}`;
    const { url } = supaConfig();
    const up = await sb(
      `/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": mime,
          "x-upsert": "false",
          "Cache-Control": "31536000",
        },
        // Deno fetch accepts Uint8Array bodies; TS7's DOM type now treats the
        // backing buffer generic more narrowly than this runtime contract.
        body: bytes as unknown as BodyInit,
      },
    );
    if (!up.ok) return err("Failed to store image on the server", 500);
    return json(
      {
        url: `${url}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(name)}`,
        name,
        mime,
        size: bytes.length,
      },
      201,
    );
  }

  if (method === "GET" && api === "/stats") return json(analytics(s));
  if (method === "POST" && api === "/reset") {
    let seed: AnyRecord = {};
    try {
      seed = JSON.parse(
        await Deno.readTextFile(new URL("./seed.json", import.meta.url)),
      );
    } catch {
      return err("Seed data is unavailable", 500);
    }
    const reset = await cas((st) => {
      const freshContent = defaultState(seed, st.adminPin, st.adminPinLength);
      freshContent.sessionSecret = st.sessionSecret;
      freshContent.authenticatorSecret = st.authenticatorSecret;
      freshContent.authenticatorEnabled = st.authenticatorEnabled;
      Object.assign(st, freshContent);
    });
    const published = await publishSnapshot(reset.state);
    return json(
      { success: true, message: "Reset to initial curated data" },
      200,
      { "X-MUIRO-Publication": published ? "published" : "pending" },
    );
  }

  // Entity routes: registrations below mirror the Express API contracts.
  if (resource === "affiliate-programs" && method === "POST") {
    const {
      name,
      network,
      website,
      defaultCommissionRate,
      disclosure,
      status,
    } = input;
    if (!name || !network || !website)
      return err("Name, network, and website are required", 400);
    try {
      new URL(website);
    } catch {
      return err("Website must be a valid URL", 400);
    }
    const rec = {
      id: id("program"),
      name: String(name).trim(),
      network: String(network).trim(),
      website: String(website).trim(),
      defaultCommissionRate: Number(defaultCommissionRate) || 0,
      disclosure: String(disclosure || "").trim(),
      status: status === "inactive" ? "inactive" : "active",
    };
    await mutate((st) => st.affiliatePrograms.push(rec), true);
    return mutationJson(rec, 201);
  }
  if (resource === "affiliate-programs" && itemId && method === "PUT") {
    if (input.website) {
      try {
        new URL(input.website);
      } catch {
        return err("Website must be a valid URL", 400);
      }
    }
    let out: any;
    const r = await mutate((st) => {
      const i = st.affiliatePrograms.findIndex(
        (x: AnyRecord) => x.id === itemId,
      );
      if (i < 0) return;
      out = st.affiliatePrograms[i] = { ...st.affiliatePrograms[i], ...input };
    }, true);
    if (!out) return err("Affiliate program not found", 404);
    return mutationJson(out);
  }
  if (resource === "affiliate-programs" && itemId && method === "DELETE") {
    let ok = false;
    await mutate((st) => {
      if (st.merchants.some((m: AnyRecord) => m.affiliateProgramId === itemId))
        return;
      const n = st.affiliatePrograms.length;
      st.affiliatePrograms = st.affiliatePrograms.filter(
        (x: AnyRecord) => x.id !== itemId,
      );
      ok = n !== st.affiliatePrograms.length;
    }, true);
    return ok
      ? mutationJson({ success: true })
      : err("Program not found or still assigned to a merchant", 409);
  }
  if (resource === "merchants" && method === "POST") {
    const { name, website, affiliateProgramId, status } = input;
    if (!name || !website) return err("Name and website are required", 400);
    try {
      new URL(website);
    } catch {
      return err("Website must be a valid URL", 400);
    }
    if (
      affiliateProgramId &&
      !s.affiliatePrograms.some((p: AnyRecord) => p.id === affiliateProgramId)
    )
      return err("Affiliate program not found", 400);
    const rec = {
      id: id("merchant"),
      name: String(name).trim(),
      website: String(website).trim(),
      affiliateProgramId,
      status: status === "inactive" ? "inactive" : "active",
    };
    await mutate((st) => st.merchants.push(rec), true);
    return mutationJson(rec, 201);
  }
  if (resource === "merchants" && itemId && method === "PUT") {
    if (input.website) {
      try {
        new URL(input.website);
      } catch {
        return err("Website must be a valid URL", 400);
      }
    }
    if (
      input.affiliateProgramId &&
      !s.affiliatePrograms.some(
        (p: AnyRecord) => p.id === input.affiliateProgramId,
      )
    )
      return err("Affiliate program not found", 400);
    let out: any;
    await mutate((st) => {
      const i = st.merchants.findIndex((x: AnyRecord) => x.id === itemId);
      if (i >= 0) out = st.merchants[i] = { ...st.merchants[i], ...input };
    }, true);
    return out ? mutationJson(out) : err("Merchant not found", 404);
  }
  if (resource === "merchants" && itemId && method === "DELETE") {
    let ok = false;
    await mutate((st) => {
      if (st.products.some((p: AnyRecord) => p.merchantId === itemId)) return;
      const n = st.merchants.length;
      st.merchants = st.merchants.filter((x: AnyRecord) => x.id !== itemId);
      ok = n !== st.merchants.length;
    }, true);
    return ok
      ? mutationJson({ success: true })
      : err("Merchant not found or still assigned to products", 409);
  }
  if (resource === "categories" && method === "POST") {
    const name = String(input.name || "").trim();
    const slug = String(input.slug || categorySlug(name)).trim().toLowerCase();
    const description = String(input.description || "").trim();
    if (!name || name.length > 60) return err("Category name must be 1–60 characters", 400);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64)
      return err("Category slug must contain lowercase letters, numbers, and hyphens only", 400);
    if (description.length > 300) return err("Category description must be 300 characters or fewer", 400);
    const current = deriveCategories(s.products || [], s.categories || [], s.lookbooks || []);
    if (current.some((category) => category.name.toLowerCase() === name.toLowerCase()))
      return err("A category with this name already exists", 409);
    if (current.some((category) => category.slug === slug))
      return err("A category with this slug already exists", 409);
    const now = new Date().toISOString();
    const rec = { id: id("category"), name, slug, description, createdAt: now, updatedAt: now };
    let conflict = "";
    await mutate((st) => {
      const categories = deriveCategories(st.products || [], st.categories || [], st.lookbooks || []);
      if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) conflict = "A category with this name already exists";
      else if (categories.some((category) => category.slug === slug)) conflict = "A category with this slug already exists";
      else st.categories = [...categories, rec];
    }, true);
    return conflict ? err(conflict, 409) : mutationJson(rec, 201);
  }
  if (resource === "categories" && itemId && method === "PUT") {
    const current = deriveCategories(s.products || [], s.categories || [], s.lookbooks || []).find((category) => category.id === itemId);
    if (!current) return err("Category not found", 404);
    const name = input.name === undefined ? current.name : String(input.name).trim();
    const slug = input.slug === undefined ? current.slug : String(input.slug).trim().toLowerCase();
    const description = input.description === undefined ? current.description : String(input.description).trim();
    if (!name || name.length > 60) return err("Category name must be 1–60 characters", 400);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64)
      return err("Category slug must contain lowercase letters, numbers, and hyphens only", 400);
    if (description.length > 300) return err("Category description must be 300 characters or fewer", 400);
    const otherCategories = deriveCategories(s.products || [], s.categories || [], s.lookbooks || []).filter((category) => category.id !== itemId);
    if (otherCategories.some((category) => category.name.toLowerCase() === name.toLowerCase()))
      return err("A category with this name already exists", 409);
    if (otherCategories.some((category) => category.slug === slug))
      return err("A category with this slug already exists", 409);
    let out: AnyRecord | null = null;
    let conflict = false;
    await mutate((st) => {
      const categories = deriveCategories(st.products || [], st.categories || [], st.lookbooks || []);
      const index = categories.findIndex((category) => category.id === itemId);
      if (index < 0) return;
      if (categories.some((category) => category.id !== itemId && (category.name.toLowerCase() === name.toLowerCase() || category.slug === slug))) {
        conflict = true;
        return;
      }
      const previousName = categories[index].name;
      out = { ...categories[index], name, slug, description, updatedAt: new Date().toISOString() };
      categories[index] = out;
      st.categories = categories;
      if (name !== previousName) {
        st.products = (st.products || []).map((product: AnyRecord) =>
          String(product.category || "").trim().toLowerCase() === previousName.trim().toLowerCase()
            ? { ...product, category: name }
            : product,
        );
        st.lookbooks = (st.lookbooks || []).map((lookbook: AnyRecord) =>
          String(lookbook.category || "").trim().toLowerCase() === previousName.trim().toLowerCase()
            ? { ...lookbook, category: name }
            : lookbook,
        );
      }
    }, true);
    if (conflict) return err("A category with this name or slug already exists", 409);
    return out ? mutationJson(out) : err("Category not found", 404);
  }
  if (resource === "categories" && itemId && method === "DELETE") {
    let removed = false;
    let productAssigned = 0;
    let lookbookAssigned = 0;
    await mutate((st) => {
      const categories = deriveCategories(st.products || [], st.categories || [], st.lookbooks || []);
      const category = categories.find((item) => item.id === itemId);
      if (!category) return;
      productAssigned = (st.products || []).filter((product: AnyRecord) =>
        String(product.category || "").trim().toLowerCase() === category.name.trim().toLowerCase(),
      ).length;
      lookbookAssigned = (st.lookbooks || []).filter((lookbook: AnyRecord) =>
        String(lookbook.category || "").trim().toLowerCase() === category.name.trim().toLowerCase(),
      ).length;
      if (productAssigned + lookbookAssigned) return;
      st.categories = categories.filter((item) => item.id !== itemId);
      removed = true;
    }, true);
    if (productAssigned + lookbookAssigned) return err(`Category is assigned to ${productAssigned} product${productAssigned === 1 ? "" : "s"} and ${lookbookAssigned} lookbook${lookbookAssigned === 1 ? "" : "s"}. Reassign content before deleting it`, 409);
    return removed ? mutationJson({ success: true }) : err("Category not found", 404);
  }
  if (resource === "lookbooks" && method === "POST") {
    const {
      title,
      board,
      category,
      cover,
      description,
      authorNote,
      pieces,
      pieceCovers,
      featured,
      isNewlyAdded,
      isTrending,
      season,
      videoUrl,
      videoCaptionsUrl,
      seoTitle,
      seoDescription,
      seoKeywords,
    } = input;
    if (!title || !cover) return err("Title and cover URL are required", 400);
    const categoryName = String(category || "Fashion").trim() || "Fashion";
    if (categoryName.length > 60) return err("Category name must be 60 characters or fewer", 400);
    let safeVideoUrl: string | undefined;
    let safeVideoCaptionsUrl: string | undefined;
    try { safeVideoUrl = safeMediaUrl(videoUrl); } catch { return err("Video URL must be a valid http(s) URL", 400); }
    try { safeVideoCaptionsUrl = safeMediaUrl(videoCaptionsUrl); } catch { return err("Video captions URL must be a valid http(s) URL", 400); }
    const selectedPieceIds = Array.isArray(pieces)
      ? pieces.filter((productId: unknown) => typeof productId === "string" && s.products.some((product: AnyRecord) => product.id === productId))
      : [];
    const safePieceCovers: Record<string, string> = {};
    if (pieceCovers !== undefined && (!pieceCovers || typeof pieceCovers !== "object" || Array.isArray(pieceCovers)))
      return err("Lookbook piece covers must be a product-ID to image-URL object", 400);
    for (const [productId, coverUrl] of Object.entries(pieceCovers || {})) {
      if (!selectedPieceIds.includes(productId) || !s.products.some((product: AnyRecord) => product.id === productId)) continue;
      try {
        const safeUrl = safeMediaUrl(coverUrl);
        if (safeUrl) safePieceCovers[productId] = safeUrl;
      } catch { return err("Piece cover must be a valid http(s) URL", 400); }
    }
    const rec = {
      id: id("look"),
      title,
      board: board || "Editorial Lookbook",
      category: categoryName,
      cover,
      frame: "2-3",
      description: description || "",
      authorNote: authorNote || "",
      pieces: Array.isArray(pieces) ? pieces : [],
      pieceCovers: safePieceCovers,
      views: 0,
      likes: 0,
      featured: Boolean(featured),
      isNewlyAdded: isNewlyAdded !== undefined ? Boolean(isNewlyAdded) : true,
      isTrending: Boolean(isTrending),
      season: season || "All-Season",
      ...(safeVideoUrl ? { videoUrl: safeVideoUrl } : {}),
      ...(safeVideoCaptionsUrl ? { videoCaptionsUrl: safeVideoCaptionsUrl } : {}),
      seoTitle: String(seoTitle || "").slice(0, 70),
      seoDescription: String(seoDescription || "").slice(0, 180),
      seoKeywords: String(seoKeywords || "").slice(0, 300),
    };
    await mutate((st) => {
      rec.category = ensureCategoryForState(st, rec.category);
      st.lookbooks.unshift(rec);
    }, true);
    return mutationJson(rec, 201);
  }
  if (resource === "lookbooks" && itemId && method === "PUT") {
    const upd = { ...input };
    if (Object.hasOwn(upd, "category")) {
      if (typeof upd.category !== "string" || upd.category.trim().length > 60)
        return err("Category name must be 60 characters or fewer", 400);
      upd.category = String(upd.category).trim() || "Fashion";
    }
    if (Object.hasOwn(upd, "videoUrl")) {
      try { upd.videoUrl = safeMediaUrl(upd.videoUrl) || ""; } catch { return err("Video URL must be a valid http(s) URL", 400); }
    }
    if (Object.hasOwn(upd, "videoCaptionsUrl")) {
      try { upd.videoCaptionsUrl = safeMediaUrl(upd.videoCaptionsUrl) || ""; } catch { return err("Video captions URL must be a valid http(s) URL", 400); }
    }
    if (Object.hasOwn(upd, "pieceCovers")) {
      const existing = s.lookbooks.find((look: AnyRecord) => look.id === itemId);
      const selectedPieces = Array.isArray(upd.pieces) ? upd.pieces : existing?.pieces || [];
      if (!upd.pieceCovers || typeof upd.pieceCovers !== "object" || Array.isArray(upd.pieceCovers))
        return err("Lookbook piece covers must be a product-ID to image-URL object", 400);
      const safePieceCovers: Record<string, string> = {};
      for (const [productId, coverUrl] of Object.entries(upd.pieceCovers)) {
        if (!selectedPieces.includes(productId) || !s.products.some((product: AnyRecord) => product.id === productId)) continue;
        try {
          const safeUrl = safeMediaUrl(coverUrl);
          if (safeUrl) safePieceCovers[productId] = safeUrl;
        } catch { return err("Piece cover must be a valid http(s) URL", 400); }
      }
      upd.pieceCovers = safePieceCovers;
    }
    if (Object.hasOwn(upd, "seoTitle")) upd.seoTitle = String(upd.seoTitle || "").slice(0, 70);
    if (Object.hasOwn(upd, "seoDescription")) upd.seoDescription = String(upd.seoDescription || "").slice(0, 180);
    if (Object.hasOwn(upd, "seoKeywords")) upd.seoKeywords = String(upd.seoKeywords || "").slice(0, 300);
    let out: any;
    await mutate((st) => {
      const i = st.lookbooks.findIndex((x: AnyRecord) => x.id === itemId);
      if (i >= 0) {
        if (Object.hasOwn(upd, "category")) upd.category = ensureCategoryForState(st, upd.category);
        out = st.lookbooks[i] = { ...st.lookbooks[i], ...upd };
      }
    }, true);
    return out ? mutationJson(out) : err("Lookbook not found", 404);
  }
  if (resource === "lookbooks" && itemId && method === "DELETE") {
    let ok = false;
    await mutate((st) => {
      const n = st.lookbooks.length;
      st.lookbooks = st.lookbooks.filter((x: AnyRecord) => x.id !== itemId);
      ok = n !== st.lookbooks.length;
    }, true);
    return ok ? mutationJson({ success: true }) : err("Lookbook not found", 404);
  }
  if (resource === "products" && method === "POST") {
    const {
      title,
      price,
      board,
      category,
      image,
      imageAlt,
      description,
      affiliateUrl,
      merchantId,
      affiliateProgramId,
      commissionRate,
      badge,
      videoUrl,
      videoCaptionsUrl,
      seoTitle,
      seoDescription,
      seoKeywords,
    } = input;
    if (!title || !image || !affiliateUrl || !merchantId || !affiliateProgramId)
      return err(
        "Title, image, affiliateUrl, merchant, and affiliate program are required",
        400,
      );
    if (imageAlt !== undefined && (typeof imageAlt !== "string" || imageAlt.length > 250))
      return err("Image alt text must be 250 characters or fewer", 400);
    const categoryName = String(category || "Fashion").trim() || "Fashion";
    if (categoryName.length > 60) return err("Category name must be 60 characters or fewer", 400);
    const safe = safeDomain(affiliateUrl);
    if (!safe.valid) return err(`Invalid affiliate URL: ${safe.reason}`, 400);
    let safeVideoUrl: string | undefined;
    let safeVideoCaptionsUrl: string | undefined;
    try { safeVideoUrl = safeMediaUrl(videoUrl); } catch { return err("Video URL must be a valid http(s) URL", 400); }
    try { safeVideoCaptionsUrl = safeMediaUrl(videoCaptionsUrl); } catch { return err("Video captions URL must be a valid http(s) URL", 400); }
    const m = s.merchants.find((x: AnyRecord) => x.id === merchantId);
    if (!m) return err("Merchant not found", 400);
    const pr = s.affiliatePrograms.find(
      (x: AnyRecord) => x.id === affiliateProgramId,
    );
    if (!pr) return err("Affiliate program not found", 400);
    const num = parseFloat(String(price ?? "").replace(/[^0-9.]/g, ""));
    const numericPrice = Number.isFinite(num) ? num : 0;
    const rec = {
      id: id("p"),
      title: String(title).trim(),
      price:
        numericPrice > 0
          ? String(price).startsWith("$")
            ? String(price)
            : `$${numericPrice.toFixed(2)}`
          : "",
      numericPrice,
      board: board || "Curated Edit",
      category: categoryName,
      image: String(image).trim(),
      imageAlt: String(imageAlt || "").trim(),
      description: String(description || ""),
      affiliateUrl: safe.safeUrl,
      merchant: m.name,
      merchantId: m.id,
      affiliateProgramId: pr.id,
      commissionRate: Number(commissionRate) || pr.defaultCommissionRate || 8,
      badge: badge || "Verified Link",
      rating: 5,
      reviewCount: 1,
      featured: Boolean(input.featured),
      isNewlyAdded:
        input.isNewlyAdded !== undefined ? Boolean(input.isNewlyAdded) : true,
      isTrending: Boolean(input.isTrending),
      clicks: 0,
      ...(safeVideoUrl ? { videoUrl: safeVideoUrl } : {}),
      ...(safeVideoCaptionsUrl ? { videoCaptionsUrl: safeVideoCaptionsUrl } : {}),
      seoTitle: String(seoTitle || "").slice(0, 70),
      seoDescription: String(seoDescription || "").slice(0, 180),
      seoKeywords: String(seoKeywords || "").slice(0, 300),
    };
    await mutate((st) => {
      rec.category = ensureCategoryForState(st, rec.category);
      st.products.unshift(rec);
    }, true);
    return mutationJson(rec, 201);
  }
  if (resource === "products" && itemId && method === "PUT") {
    const upd = { ...input };
    if (Object.hasOwn(upd, "category")) {
      if (typeof upd.category !== "string" || upd.category.trim().length > 60)
        return err("Category name must be 60 characters or fewer", 400);
      upd.category = String(upd.category).trim() || "Fashion";
    }
    if (Object.hasOwn(upd, "imageAlt")) {
      if (typeof upd.imageAlt !== "string" || upd.imageAlt.length > 250)
        return err("Image alt text must be 250 characters or fewer", 400);
      upd.imageAlt = upd.imageAlt.trim();
    }
    if (Object.hasOwn(upd, "videoUrl")) {
      try { upd.videoUrl = safeMediaUrl(upd.videoUrl) || ""; } catch { return err("Video URL must be a valid http(s) URL", 400); }
    }
    if (Object.hasOwn(upd, "videoCaptionsUrl")) {
      try { upd.videoCaptionsUrl = safeMediaUrl(upd.videoCaptionsUrl) || ""; } catch { return err("Video captions URL must be a valid http(s) URL", 400); }
    }
    if (Object.hasOwn(upd, "seoTitle")) upd.seoTitle = String(upd.seoTitle || "").slice(0, 70);
    if (Object.hasOwn(upd, "seoDescription")) upd.seoDescription = String(upd.seoDescription || "").slice(0, 180);
    if (Object.hasOwn(upd, "seoKeywords")) upd.seoKeywords = String(upd.seoKeywords || "").slice(0, 300);
    if (Object.hasOwn(upd, "affiliateUrl")) {
      const x = safeDomain(upd.affiliateUrl);
      if (!x.valid) return err(`Invalid affiliate URL: ${x.reason}`, 400);
      upd.affiliateUrl = x.safeUrl;
    }
    if (Object.hasOwn(upd, "merchantId") || Object.hasOwn(upd, "merchant")) {
      const m = s.merchants.find((x: AnyRecord) =>
        Object.hasOwn(upd, "merchantId")
          ? x.id === upd.merchantId
          : x.name.toLowerCase() === String(upd.merchant).trim().toLowerCase(),
      );
      if (!m) return err("Merchant not found", 400);
      upd.merchantId = m.id;
      upd.merchant = m.name;
      if (!Object.hasOwn(upd, "affiliateProgramId") && m.affiliateProgramId)
        upd.affiliateProgramId = m.affiliateProgramId;
    }
    if (
      Object.hasOwn(upd, "affiliateProgramId") &&
      !s.affiliatePrograms.some(
        (x: AnyRecord) => x.id === upd.affiliateProgramId,
      )
    )
      return err("Affiliate program not found", 400);
    if (upd.price) {
      const n = parseFloat(String(upd.price).replace(/[^0-9.]/g, ""));
      upd.numericPrice = Number.isFinite(n) ? n : 0;
      upd.price =
        upd.numericPrice > 0
          ? String(upd.price).startsWith("$")
            ? upd.price
            : `$${upd.numericPrice.toFixed(2)}`
          : "";
    }
    if (Object.hasOwn(upd, "description"))
      upd.description = String(upd.description ?? "");
    let out: any;
    await mutate((st) => {
      const i = st.products.findIndex((x: AnyRecord) => x.id === itemId);
      if (i >= 0) {
        if (Object.hasOwn(upd, "category")) upd.category = ensureCategoryForState(st, upd.category);
        out = st.products[i] = { ...st.products[i], ...upd };
      }
    }, true);
    return out ? mutationJson(out) : err("Product not found", 404);
  }
  if (resource === "products" && itemId && method === "DELETE") {
    let ok = false;
    await mutate((st) => {
      const n = st.products.length;
      st.products = st.products.filter((x: AnyRecord) => x.id !== itemId);
      if (n !== st.products.length) {
        st.lookbooks = st.lookbooks.map((l: AnyRecord) => ({
          ...l,
          pieces: (l.pieces || []).filter((p: string) => p !== itemId),
          pieceCovers: Object.fromEntries(Object.entries(l.pieceCovers || {}).filter(([productId]) => productId !== itemId)),
        }));
        ok = true;
      }
    }, true);
    return ok ? mutationJson({ success: true }) : err("Product not found", 404);
  }
  if (resource === "hero-slides" && method === "POST") {
    const {
      title,
      tagline,
      category,
      image,
      fallbackImage,
      lookId,
      keyPieces,
      isActive,
      order,
    } = input;
    if (!title || !image) return err("Title and image are required", 400);
    const rec = {
      id: id("hero"),
      title,
      tagline: tagline || "",
      category: category || "Curated Edit",
      image,
      fallbackImage: fallbackImage || image,
      lookId: lookId || undefined,
      keyPieces: Array.isArray(keyPieces) ? keyPieces : [],
      isActive: isActive !== false,
      order: order ? Number(order) : (s.heroSlides || []).length + 1,
    };
    await mutate((st) => st.heroSlides.push(rec), true);
    return mutationJson(rec, 201);
  }
  if (resource === "hero-slides" && method === "PUT" && !itemId) {
    if (!Array.isArray(input.slides))
      return err("Slides array is required", 400);
    const slides = input.slides
      .map((x: AnyRecord) => normalizeSlide(x, s.heroSlides || []))
      .filter(
        (x: AnyRecord) =>
          Boolean(x.title) && Boolean(x.image || x.fallbackImage),
      )
      .sort(
        (a: AnyRecord, b: AnyRecord) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER),
      );
    await mutate((st) => (st.heroSlides = slides), true);
    return mutationJson(slides);
  }
  if (resource === "hero-slides" && itemId && method === "PUT") {
    let out: any;
    await mutate((st) => {
      const i = st.heroSlides.findIndex((x: AnyRecord) => x.id === itemId);
      if (i >= 0) out = st.heroSlides[i] = { ...st.heroSlides[i], ...input };
    }, true);
    return out ? mutationJson(out) : err("Hero slide not found", 404);
  }
  if (resource === "hero-slides" && itemId && method === "DELETE") {
    let ok = false;
    await mutate((st) => {
      const n = st.heroSlides.length;
      st.heroSlides = st.heroSlides.filter((x: AnyRecord) => x.id !== itemId);
      ok = n !== st.heroSlides.length;
    }, true);
    return ok ? mutationJson({ success: true }) : err("Hero slide not found", 404);
  }
  if (resource === "testimonials" && method === "POST") {
    const {
      author,
      location,
      avatar,
      rating,
      outfitTitle,
      comment,
      verified,
      featured,
    } = input;
    if (!author || !comment) return err("Author and comment are required", 400);
    const rec = {
      id: id("t"),
      author,
      location: location || "Verified Shopper",
      avatar:
        avatar ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      rating: Number(rating) || 5,
      outfitTitle: outfitTitle || "Curated Look",
      comment,
      verified: verified !== false,
      date: "Just now",
      helpfulCount: 0,
      featured: Boolean(featured),
    };
    await mutate((st) => st.testimonials.unshift(rec), true);
    return mutationJson(rec, 201);
  }
  if (resource === "testimonials" && itemId && method === "PUT") {
    let out: any;
    await mutate((st) => {
      const i = st.testimonials.findIndex((x: AnyRecord) => x.id === itemId);
      if (i >= 0)
        out = st.testimonials[i] = { ...st.testimonials[i], ...input };
    }, true);
    return out ? mutationJson(out) : err("Testimonial not found", 404);
  }
  if (resource === "testimonials" && itemId && method === "DELETE") {
    let ok = false;
    await mutate((st) => {
      const n = st.testimonials.length;
      st.testimonials = st.testimonials.filter(
        (x: AnyRecord) => x.id !== itemId,
      );
      ok = n !== st.testimonials.length;
    }, true);
    return ok ? mutationJson({ success: true }) : err("Testimonial not found", 404);
  }
  if (method === "PUT" && api === "/settings") {
    const upd = { ...input };
    if (Object.hasOwn(upd, "seoTitle")) upd.seoTitle = String(upd.seoTitle || "").slice(0, 70);
    if (Object.hasOwn(upd, "seoDescription")) upd.seoDescription = String(upd.seoDescription || "").slice(0, 180);
    if (Object.hasOwn(upd, "seoKeywords")) upd.seoKeywords = String(upd.seoKeywords || "").slice(0, 300);
    if (Object.hasOwn(upd, "ogImage")) {
      try { upd.ogImage = safeMediaUrl(upd.ogImage) || ""; } catch { return err("Social preview image must be a valid URL", 400); }
    }
    let out: any;
    await mutate(
      (st) => (out = st.settings = { ...(st.settings || {}), ...upd }),
      true,
    );
    return mutationJson(out);
  }
  if (method === "POST" && api === "/reset") {
    let seed: AnyRecord = {};
    try {
      seed = JSON.parse(
        await Deno.readTextFile(new URL("./seed.json", import.meta.url)),
      );
    } catch {
      return err("Seed data is unavailable", 500);
    }
    const reset = defaultState(seed, s.adminPin, s.adminPinLength);
    reset.clicks = [];
    reset.impressions = 0;
    reset.sessionSecret = s.sessionSecret;
    reset.adminPin = s.adminPin;
    reset.adminPinLength = s.adminPinLength;
    reset.authenticatorSecret = s.authenticatorSecret;
    reset.authenticatorEnabled = s.authenticatorEnabled;
    await cas((st) => Object.assign(st, reset));
    const fresh = await loadState();
    await publishSnapshot(fresh.state);
    return json({ success: true, message: "Reset to initial curated data" });
  }
  return err("Not found", 404);
}

Deno.serve(async (req: Request) => {
  try {
    return await handler(req);
  } catch (_e) {
    /* Do not log request material, credentials, tokens, or IP metadata. */ return err(
      "Internal server error",
      500,
    );
  }
});
