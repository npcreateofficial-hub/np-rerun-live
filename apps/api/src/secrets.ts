import crypto from 'node:crypto';
import { config } from './config';

const SECRET_PREFIX = 'bmk:v1:';

function key() {
  return crypto.createHash('sha256').update(config.dataSecret).digest();
}

export function isProtectedSecret(value?: string | null) {
  return Boolean(value?.startsWith(SECRET_PREFIX));
}

export function protectSecret(value?: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (isProtectedSecret(text)) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SECRET_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function revealSecret(value?: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!isProtectedSecret(text)) return text;

  const packed = text.slice(SECRET_PREFIX.length);
  const [ivRaw, tagRaw, ciphertextRaw] = packed.split('.');
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error('secret envelope is invalid');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function hasSecret(value?: string | null) {
  return Boolean(String(value ?? '').trim());
}

export function maskSecret(value?: string | null) {
  return hasSecret(value) ? '••••••••' : null;
}
