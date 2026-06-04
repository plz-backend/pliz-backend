import crypto from 'crypto';

function requiredSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getEncryptionKey(): Buffer {
  const secret = requiredSecret('DATA_ENCRYPTION_KEY');
  const decoded = /^[A-Za-z0-9+/=_-]{43,88}$/.test(secret)
    ? Buffer.from(secret.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    : Buffer.from(secret, 'utf8');

  if (decoded.length === 32) return decoded;
  return crypto.createHash('sha256').update(secret).digest();
}

export function hashRefreshToken(token: string): string {
  return crypto
    .createHmac('sha256', requiredSecret('REFRESH_TOKEN_PEPPER'))
    .update(token)
    .digest('hex');
}

export function stableSecretHash(value: string): string {
  return crypto
    .createHmac('sha256', requiredSecret('DATA_ENCRYPTION_KEY'))
    .update(value.trim())
    .digest('hex');
}

export function encryptText(value: string | null | undefined): string | null {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptText(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('v1:')) return value;

  const [, ivRaw, tagRaw, ciphertextRaw] = value.split(':');
  if (!ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error('Invalid encrypted payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivRaw, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function maskAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `******${digits.slice(-4)}`;
}
