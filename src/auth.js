import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const SCRYPT_KEY_LENGTH = 32;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizeUsername(username = '') {
  const value = String(username).trim().toLowerCase();
  if (!value) throw httpError(400, 'Username is required.');
  if (value.length < 3) throw httpError(400, 'Username must be at least 3 characters.');
  if (value.length > 40) throw httpError(400, 'Username must be 40 characters or fewer.');
  if (!/^[a-z0-9_-]+$/.test(value)) {
    throw httpError(400, 'Username may only contain letters, numbers, underscores, and hyphens.');
  }
  return value;
}

export function validatePassword(password = '') {
  const value = String(password);
  if (!value) throw httpError(400, 'Password is required.');
  if (value.length < 6) throw httpError(400, 'Password must be at least 6 characters.');
  if (value.length > 200) throw httpError(400, 'Password is too long.');
  return value;
}

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const value = validatePassword(password);
  const hash = await scryptAsync(value, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt}$${Buffer.from(hash).toString('hex')}`;
}

export async function verifyPassword(password, storedHash = '') {
  const [, salt, hashHex] = String(storedHash).split('$');
  if (!salt || !hashHex) return false;
  const hash = Buffer.from(hashHex, 'hex');
  const candidate = await scryptAsync(String(password), salt, hash.length);
  return hash.length === candidate.length && timingSafeEqual(hash, candidate);
}

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

export function parseCookies(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf('=');
      if (index <= 0) return cookies;
      const name = decodeURIComponent(part.slice(0, index));
      const value = decodeURIComponent(part.slice(index + 1));
      cookies[name] = value;
      return cookies;
    }, {});
}

export function sessionCookie(name, value, { maxAge = 60 * 60 * 24 * 30, secure = false } = {}) {
  return [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}
