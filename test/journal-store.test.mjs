import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createJournalStore, normalizePostgresConnectionString } from '../src/journal-store.js';

function createFakeDb() {
  const entries = new Map();
  return {
    async query(sql, params = []) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS')) return { rows: [] };
      if (sql.startsWith('INSERT INTO journal_entries')) {
        entries.set(params[0], params[1]);
        return { rows: [] };
      }
      if (sql.startsWith('SELECT entry FROM journal_entries')) {
        return {
          rows: [...entries.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([, entry]) => ({ entry })),
        };
      }
      if (sql.startsWith('DELETE FROM journal_entries')) {
        const deleted = entries.delete(params[0]);
        return { rowCount: deleted ? 1 : 0, rows: [] };
      }
      if (sql.startsWith('SELECT summary FROM review_summaries')) return { rows: [] };
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
    env: { DATABASE_URL: 'postgres://example' },
    dbFactory: async () => db,
  });

  assert.equal(store.kind, 'postgres');
  await store.saveEntry({ id: '2026-07-03', prompts: {}, body: '部署时写进数据库。' });
  assert.deepEqual((await store.readEntries()).map((entry) => entry.id), ['2026-07-03']);
  assert.deepEqual(await store.deleteEntry('2026-07-03'), { markdownDeleted: false, jsonDeleted: true });
});

test('normalizePostgresConnectionString keeps sslmode=require compatible with self-signed gateways', () => {
  const url = normalizePostgresConnectionString('postgres://user:pass@example.com:5432/app?sslmode=require');

  assert.equal(url, 'postgres://user:pass@example.com:5432/app?sslmode=require&uselibpqcompat=true');
});

test('normalizePostgresConnectionString preserves explicit libpq compatibility settings', () => {
  const url = normalizePostgresConnectionString('postgres://user:pass@example.com:5432/app?sslmode=require&uselibpqcompat=true');

  assert.equal(url, 'postgres://user:pass@example.com:5432/app?sslmode=require&uselibpqcompat=true');
});
