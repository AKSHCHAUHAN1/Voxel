import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MFA_ENCRYPTION_CONTEXT = 'voxel-totp-secret-v1';

export const createTotpSecret = () => encodeBase32(randomBytes(20));

export function encodeBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value) {
  const normalized = value.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid authenticator secret.');
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  if (!output.length) throw new Error('Invalid authenticator secret.');
  return Buffer.from(output);
}

const encryptionKey = (sessionSecret) => Buffer.from(hkdfSync(
  'sha256',
  Buffer.from(sessionSecret),
  Buffer.from(MFA_ENCRYPTION_CONTEXT),
  Buffer.from('secret-at-rest'),
  32,
));

export function encryptTotpSecret(secret, sessionSecret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(sessionSecret), iv);
  cipher.setAAD(Buffer.from(MFA_ENCRYPTION_CONTEXT));
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptTotpSecret(value, sessionSecret) {
  const [ivText, tagText, dataText] = value.split('.');
  if (!ivText || !tagText || !dataText) throw new Error('Invalid encrypted authenticator secret.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(sessionSecret), Buffer.from(ivText, 'base64url'));
  decipher.setAAD(Buffer.from(MFA_ENCRYPTION_CONTEXT));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
}

export function createTotpUri({ secret, email }) {
  const label = encodeURIComponent(`Voxel:${email}`);
  const query = new URLSearchParams({ secret, issuer: 'Voxel', algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${query}`;
}

export function getTotpCode(secret, time = Date.now()) {
  const counter = Math.floor(time / 30_000);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret, code, time = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const provided = Buffer.from(code);
  for (const timeOffset of [-30_000, 0, 30_000]) {
    const expected = Buffer.from(getTotpCode(secret, time + timeOffset));
    if (timingSafeEqual(provided, expected)) return true;
  }
  return false;
}

export function createRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(12).toString('hex').toUpperCase();
    return `${raw.slice(0, 8)}-${raw.slice(8, 16)}-${raw.slice(16)}`;
  });
}

export const normalizeRecoveryCode = (code) => code.replace(/[\s-]/g, '').toUpperCase();
