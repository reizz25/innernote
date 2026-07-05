import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hashPassword,
  normalizeUsername,
  parseCookies,
  sessionCookie,
  verifyPassword,
} from '../src/auth.js';

test('normalizeUsername keeps usernames stable and rejects unsafe values', () => {
  assert.equal(normalizeUsername(' Reizz '), 'reizz');
  assert.equal(normalizeUsername('reizz_25'), 'reizz_25');
  assert.throws(() => normalizeUsername(''), /Username is required/);
  assert.throws(() => normalizeUsername('zz'), /at least 3/);
  assert.throws(() => normalizeUsername('中文用户'), /letters, numbers/);
});

test('password hashes verify without storing the plain password', async () => {
  const hash = await hashPassword('test-password-123', 'fixedsalt');

  assert.match(hash, /^scrypt\$/);
  assert.equal(hash.includes('test-password-123'), false);
  assert.equal(await verifyPassword('test-password-123', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('parseCookies and sessionCookie handle the app session cookie', () => {
  assert.deepEqual(parseCookies('innernote_session=abc; theme=paper'), {
    innernote_session: 'abc',
    theme: 'paper',
  });

  const cookie = sessionCookie('innernote_session', 'abc', { maxAge: 60, secure: true });
  assert.match(cookie, /^innernote_session=abc;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=60/);
});
