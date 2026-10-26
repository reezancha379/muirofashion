import crypto from 'crypto';
import { Request } from 'express';

// Known reputable merchant domains
const TRUSTED_DOMAINS = [
  'amazon.com',
  'amzn.to',
  'amazon.co.uk',
  'revolve.com',
  'nordstrom.com',
  'asos.com',
  'zara.com',
  'target.com',
  'shopbop.com',
  'farfetch.com',
  'ssense.com',
  'net-a-porter.com',
  'mango.com',
  'hm.com',
  'urbanoutfitters.com',
  'aritzia.com',
  'princesspolly.com'
];

// In-memory rate limiting bucket
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimits = new Map<string, RateLimitBucket>();

// Clean up stale rate limits every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimits.entries()) {
    if (now > val.resetAt) {
      rateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function isCrawlerOrBot(userAgent: string): boolean {
  if (!userAgent) return false;
  const botPattern = /(bot|spider|crawl|slurp|headless|phantom|facebookexternalhit|whatsapp|telegrambot|curl|wget|python|postman|lighthouse|headlesschrome|googlebot|bingbot)/i;
  return botPattern.test(userAgent);
}

export function detectDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  if (!userAgent) return 'mobile';
  const ua = userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop|android/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'muiro_secure_2026')).digest('hex').substring(0, 16);
}

export function checkRateLimit(ipHash: string, limit = 30, windowMs = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = rateLimits.get(ipHash);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    rateLimits.set(ipHash, bucket);
    return { allowed: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - bucket.count };
}

export function sanitizeAffiliateUrl(rawUrl: string): { valid: boolean; safeUrl: string; reason?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, safeUrl: '', reason: 'Empty URL' };
  }

  const trimmed = rawUrl.trim();

  // Reject dangerous protocols
  if (/^(javascript:|data:|file:|vbscript:)/i.test(trimmed)) {
    return { valid: false, safeUrl: '', reason: 'Illegal URL protocol scheme' };
  }

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, safeUrl: '', reason: 'Only HTTP/HTTPS protocols are permitted' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Affiliate redirects are allowlisted by default. Custom merchants can be
    // enabled deliberately with MUIRO_ALLOW_CUSTOM_AFFILIATE_DOMAINS=true,
    // rather than silently accepting arbitrary HTTPS destinations.
    const isDomainAllowed = TRUSTED_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));
    const allowCustomDomains = process.env.MUIRO_ALLOW_CUSTOM_AFFILIATE_DOMAINS === 'true';
    if (!isDomainAllowed && !allowCustomDomains) {
      return { valid: false, safeUrl: '', reason: 'Affiliate domain is not on the MUIRO allowlist' };
    }

    // Strip suspicious injection parameters or overly long strings
    const sanitizedParams = new URLSearchParams();
    parsed.searchParams.forEach((val, key) => {
      // Clean dangerous characters
      if (key.length <= 64 && val.length <= 512 && !/[<>'"\(\)\{\}]/.test(val)) {
        sanitizedParams.append(key, val);
      }
    });

    parsed.search = sanitizedParams.toString();

    return {
      valid: true,
      safeUrl: parsed.toString(),
      reason: undefined
    };
  } catch {
    return { valid: false, safeUrl: '', reason: 'Malformed URL' };
  }
}

export function extractClientMetadata(req: Request) {
  const userAgent = req.headers['user-agent'] || '';
  // Express normalizes the client IP and only trusts forwarded headers when
  // the application explicitly enables a trusted proxy in server.ts.
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const ipH = hashIp(ip);
  const device = detectDeviceType(userAgent);
  const isBot = isCrawlerOrBot(userAgent);

  const rawReferrer = (req.headers['referer'] as string) || (req.query.ref as string) || 'direct';
  let referrer = 'direct';
  try {
    if (rawReferrer.startsWith('http')) {
      const u = new URL(rawReferrer);
      referrer = u.hostname.replace('www.', '');
    } else {
      referrer = rawReferrer.substring(0, 50);
    }
  } catch {
    referrer = 'direct';
  }

  const utmSource = typeof req.query.utm_source === 'string' ? req.query.utm_source.substring(0, 30) : undefined;
  const utmCampaign = typeof req.query.utm_campaign === 'string' ? req.query.utm_campaign.substring(0, 40) : undefined;

  return {
    userAgent,
    ipHash: ipH,
    device,
    isBot,
    referrer,
    utmSource,
    utmCampaign
  };
}
