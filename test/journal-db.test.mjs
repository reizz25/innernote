import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deleteJournalEntryFromDb,
  ensureJournalSchema,
  readJournalEntriesFromDb,
  readReviewSummariesFromDb,
  saveJournalEntriesToDb,
  saveJournalEntryToDb,
  saveReviewSummariesToDb,
} from '../src/journal-db.js';

function createFakeDb() {
  const entries = new Map();
  const summaries = new Map();
  const queries = [];
  const key = (userId, id) => `${userId || 'default'}:${id}`;

  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      const cleanSql = sql.trim();
      if (cleanSql.includes('CREATE TABLE IF NOT EXISTS')) {
        return { rows: [] };
      }
      if (cleanSql.startsWith('INSERT INTO journal_entries_v2') && cleanSql.includes('SELECT $1')) {
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO journal_entries_v2')) {
        const [userId, id, entry] = params;
        entries.set(key(userId, id), entry);
        return { rows: [] };
      }
      if (sql.startsWith('SELECT entry FROM journal_entries_v2')) {
        const [userId] = params;
        return {
          rows: [...entries.entries()]
            .filter(([entryKey]) => entryKey.startsWith(`${userId || 'default'}:`))
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([, entry]) => ({ entry })),
        };
      }
      if (sql.startsWith('DELETE FROM journal_entries_v2')) {
        const [userId, id] = params;
        const deleted = entries.delete(key(userId, id));
        return { rowCount: deleted ? 1 : 0, rows: [] };
      }
      if (cleanSql.startsWith('INSERT INTO review_summaries_v2') && cleanSql.includes('SELECT $1')) {
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO review_summaries_v2')) {
        const [userId, id, type, summary] = params;
        summaries.set(key(userId, id), { ...summary, type });
        return { rows: [] };
      }
      if (sql.startsWith('SELECT summary FROM review_summaries_v2')) {
        const [userId] = params;
        return {
          rows: [...summaries.entries()]
            .filter(([summaryKey]) => summaryKey.startsWith(`${userId || 'default'}:`))
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([, summary]) => ({ summary })),
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

test('ensureJournalSchema creates journal and review tables', async () => {
  const db = createFakeDb();

  await ensureJournalSchema(db, { defaultUserId: 'user-a' });

  assert.ok(db.queries.length >= 2);
  assert.match(db.queries[0].sql, /CREATE TABLE IF NOT EXISTS journal_entries_v2/);
  assert.match(db.queries[1].sql, /CREATE TABLE IF NOT EXISTS review_summaries_v2/);
});

test('journal entry db helpers save, list, and delete entries', async () => {
  const db = createFakeDb();

  await saveJournalEntryToDb(db, 'user-a', {
    id: '2026-07-02-233420',
    title: '夜里写一点',
    firstRecordedAt: '2026-07-02T15:34:20.000Z',
    updatedAt: '2026-07-02T15:40:00.000Z',
    prompts: { mood: ['松了一口气'] },
    body: '今天终于把项目推上去了。',
  });
  await saveJournalEntriesToDb(db, 'user-a', [{
    id: '2026-06-22',
    updatedAt: '2026-06-22T12:00:00.000Z',
    prompts: {},
    body: '旧的一篇也要迁过去。',
  }]);

  await saveJournalEntryToDb(db, 'user-b', {
    id: '2026-07-03',
    prompts: {},
    body: '另一位用户的内容。',
  });

  const entries = await readJournalEntriesFromDb(db, 'user-a');
  assert.deepEqual(entries.map((entry) => entry.id), ['2026-07-02-233420', '2026-06-22']);
  assert.equal(entries[0].prompts.mood[0], '松了一口气');

  const deleted = await deleteJournalEntryFromDb(db, 'user-a', '2026-06-22');
  assert.deepEqual(deleted, { markdownDeleted: false, jsonDeleted: true });
  assert.deepEqual((await readJournalEntriesFromDb(db, 'user-a')).map((entry) => entry.id), ['2026-07-02-233420']);
  assert.deepEqual((await readJournalEntriesFromDb(db, 'user-b')).map((entry) => entry.id), ['2026-07-03']);
});

test('review summary db helpers persist summaries for the sidebar', async () => {
  const db = createFakeDb();

  await saveReviewSummariesToDb(db, 'user-a', [{
    id: 'week-2026-06-22',
    type: 'week',
    range: '2026-06-22 至 2026-06-28',
    entryCount: 4,
    summary: '这一周的主线是工作去向和表达边界。',
    createdAt: '2026-07-01T00:00:00+08:00',
  }]);

  await saveReviewSummariesToDb(db, 'user-b', [{
    id: 'week-2026-06-22',
    type: 'week',
    summary: '另一位用户的回顾。',
  }]);

  const summaries = await readReviewSummariesFromDb(db, 'user-a');
  assert.equal(summaries[0].id, 'week-2026-06-22');
  assert.equal(summaries[0].entryCount, 4);
  assert.equal(summaries[0].summary, '这一周的主线是工作去向和表达边界。');
});
