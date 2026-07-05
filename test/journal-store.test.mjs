import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createJournalStore, normalizePostgresConnectionString } from '../src/journal-store.js';

function createFakeDb() {
  const entries = new Map();
  const users = new Map();
  const sessions = new Map();
  const key = (userId, id) => `${userId || 'default'}:${id}`;
  return {
    async query(sql, params = []) {
      const cleanSql = sql.trim();
      if (cleanSql.includes('CREATE TABLE IF NOT EXISTS')) return { rows: [] };
      if (sql.startsWith('SELECT id, username, password_hash FROM users WHERE username')) {
        const user = users.get(params[0]);
        return { rows: user ? [user] : [] };
      }
      if (sql.startsWith('INSERT INTO users')) {
        const [id, username, passwordHash] = params;
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
      if (sql.startsWith('DELETE FROM user_sessions')) return { rows: [] };
      if (cleanSql.startsWith('INSERT INTO journal_entries_v2') && cleanSql.includes('SELECT $1')) return { rows: [] };
      if (cleanSql.startsWith('INSERT INTO review_summaries_v2') && cleanSql.includes('SELECT $1')) return { rows: [] };
      if (sql.startsWith('INSERT INTO journal_entries_v2')) {
        entries.set(key(params[0], params[1]), params[2]);
        return { rows: [] };
      }
      if (sql.startsWith('SELECT entry FROM journal_entries_v2')) {
        return {
          rows: [...entries.entries()]
            .filter(([entryKey]) => entryKey.startsWith(`${params[0] || 'default'}:`))
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([, entry]) => ({ entry })),
        };
      }
      if (sql.startsWith('DELETE FROM journal_entries_v2')) {
        const deleted = entries.delete(key(params[0], params[1]));
        return { rowCount: deleted ? 1 : 0, rows: [] };
      }
      if (sql.startsWith('SELECT summary FROM review_summaries_v2')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test('createJournalStore keeps file storage when no database url is configured', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inner-notes-store-'));
  try {
    const store = await createJournalStore({
      journalRoot: root,
      reviewRoot: join(root, '..', 'reviews'),
      env: {},
    });

    assert.equal(store.kind, 'file');
    await store.saveEntry({ id: '2026-07-03', prompts: {}, body: '本地仍然可以写。' });
    assert.deepEqual((await store.readEntries()).map((entry) => entry.id), ['2026-07-03']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('createJournalStore uses database storage when DATABASE_URL is configured', async () => {
  const db = createFakeDb();
  const store = await createJournalStore({
    journalRoot: '/unused',
    reviewRoot: '/unused',
    env: { DATABASE_URL: 'postgres://example', INITIAL_USERNAME: 'reizz', INITIAL_PASSWORD: 'test-password-123' },
    dbFactory: async () => db,
  });

  assert.equal(store.kind, 'postgres');
  const user = await store.auth.login('reizz', 'test-password-123');
  await store.saveEntry(user.id, { id: '2026-07-03', prompts: {}, body: '部署时写进数据库。' });
  assert.deepEqual((await store.readEntries(user.id)).map((entry) => entry.id), ['2026-07-03']);
  assert.deepEqual(await store.deleteEntry(user.id, '2026-07-03'), { markdownDeleted: false, jsonDeleted: true });
});

test('normalizePostgresConnectionString keeps sslmode=require compatible with self-signed gateways', () => {
  const url = normalizePostgresConnectionString('postgres://user:pass@example.com:5432/app?sslmode=require');

  assert.equal(url, 'postgres://user:pass@example.com:5432/app?sslmode=require&uselibpqcompat=true');
});

test('normalizePostgresConnectionString preserves explicit libpq compatibility settings', () => {
  const url = normalizePostgresConnectionString('postgres://user:pass@example.com:5432/app?sslmode=require&uselibpqcompat=true');

  assert.equal(url, 'postgres://user:pass@example.com:5432/app?sslmode=require&uselibpqcompat=true');
});
