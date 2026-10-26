// Standard TOTP (RFC 6238 / RFC 4226) & Google Authenticator Integration
import QRCode from 'qrcode';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// NOTE: no factory secret lives here on purpose. Everything in this file is
// compiled into the public browser bundle, so any secret written here would be
// readable by whoever downloads the page -- and a TOTP secret is a login
// credential. The pairing secret is fetched from the admin-only endpoint
// (GET /api/admin/authenticator) and the server mints its own on first use.

/**
 * Decodes a Base32 string into Uint8Array
 */
export function base32ToUint8Array(base32: string): Uint8Array {
  const cleanBase32 = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleanBase32.length; i++) {
    const char = cleanBase32[i];
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Generates a random Base32 secret string (24-32 characters)
 */
export function generateRandomSecret(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE32_CHARS[bytes[i] % BASE32_CHARS.length];
  }
  return result;
}

/**
 * Generates an otpauth:// URI for Google Authenticator / 2FA apps
 */
export function generateOtpauthUri(secret: string, accountName = 'admin', issuer = 'MUIRO'): string {
  const cleanSecret = secret.toUpperCase().replace(/\s+/g, '');
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates a QR code Data URL (PNG) for instant scanning in Google Authenticator
 */
export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
}

/**
 * Computes TOTP token for given secret at step offset
 */
export async function computeTotp(secret: string, stepOffset = 0): Promise<string> {
  const keyBytes = base32ToUint8Array(secret);
  if (keyBytes.length === 0) return '000000';

  const epochSeconds = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const counter = Math.floor(epochSeconds / timeStep) + stepOffset;

  // 8-byte buffer for counter in big-endian
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setBigUint64(0, BigInt(counter));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer as unknown as BufferSource);
  const hash = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit code against the secret.
 * Accepts only the rolling code, in the current window plus or minus two steps
 * for clock skew (matching the server's drift tolerance) -- deliberately NOT
 * the raw secret and NOT any master key: both of those were shipped in the
 * bundle, which would have made them public credentials rather than secrets.
 */
export async function verifyTotpOrKey(input: string, secret: string, window = 2): Promise<boolean> {
  const trimmed = input.trim();
  if (!trimmed) return false;

  const cleanCode = trimmed.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return false;

  const cleanSecret = secret.toUpperCase().replace(/\s+/g, '');
  if (!cleanSecret) return false;

  for (let step = -window; step <= window; step++) {
    const expected = await computeTotp(cleanSecret, step);
    if (expected === cleanCode) return true;
  }

  return false;
}
