import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSession,
  createUser,
  ensureAuthSchema,
  getSessionUser,
  verifyUserLogin,
} from '../src/auth-db.js';

function createFakeAuthDb() {
  const users = new Map();
  const sessions = new Map();
  return {
    async query(sql, params = []) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS users')) return { rows: [] };
      if (sql.includes('CREATE TABLE IF NOT EXISTS user_sessions')) return { rows: [] };
      if (sql.startsWith('SELECT id, username, password_hash FROM users WHERE username')) {
        const user = users.get(params[0]);
        return { rows: user ? [user] : [] };
      }
      if (sql.startsWith('INSERT INTO users')) {
        const [id, username, passwordHash] = params;
        if (users.has(username)) {
          const error = new Error('duplicate');
          error.code = '23505';
          throw error;
        }
        const user = { id, username, password_hash: passwordHash };
        users.set(username, user);
        return { rows: [{ id, username }] };
      }
      if (sql.startsWith('INSERT INTO user_sessions')) {
        const [id, userId] = params;
        sessions.set(id, { id, user_id: userId, username: [...users.values()].find((user) => user.id === userId)?.username });
        return { rows: [{ id }] };
      }
      if (sql.startsWith('SELECT users.id, users.username FROM user_sessions')) {
        const session = sessions.get(params[0]);
        return { rows: session ? [{ id: session.user_id, username: session.username }] : [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test('auth db creates users and verifies login', async () => {
  const db = createFakeAuthDb();
  await ensureAuthSchema(db);
  const user = await createUser(db, ' Reizz ', 'test-password-123');

  assert.equal(user.username, 'reizz');
  assert.equal((await verifyUserLogin(db, 'reizz', 'test-password-123')).id, user.id);
  assert.equal(await verifyUserLogin(db, 'reizz', 'wrong'), null);
});

test('auth db creates sessions and resolves session users', async () => {
  const db = createFakeAuthDb();
  const user = await createUser(db, 'reizz', 'test-password-123');
  const session = await createSession(db, user.id);

  assert.equal(session.id.length, 64);
  assert.deepEqual(await getSessionUser(db, session.id), user);
});
