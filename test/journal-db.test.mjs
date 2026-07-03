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

  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (sql.includes('CREATE TABLE IF NOT EXISTS journal_entries')) {
        return { rows: [] };
      }
      if (sql.includes('CREATE TABLE IF NOT EXISTS review_summaries')) {
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO journal_entries')) {
        const [id, entry] = params;
        entries.set(id, entry);
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
      if (sql.startsWith('INSERT INTO review_summaries')) {
        const [id, type, summary] = params;
        summaries.set(id, { ...summary, type });
        return { rows: [] };
      }
      if (sql.startsWith('SELECT summary FROM review_summaries')) {
        return {
          rows: [...summaries.entries()]
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

  await ensureJournalSchema(db);

  assert.equal(db.queries.length, 2);
  assert.match(db.queries[0].sql, /CREATE TABLE IF NOT EXISTS journal_entries/);
  assert.match(db.queries[1].sql, /CREATE TABLE IF NOT EXISTS review_summaries/);
});

test('journal entry db helpers save, list, and delete entries', async () => {
  const db = createFakeDb();

  await saveJournalEntryToDb(db, {
    id: '2026-07-02-233420',
    title: '夜里写一点',
    firstRecordedAt: '2026-07-02T15:34:20.000Z',
    updatedAt: '2026-07-02T15:40:00.000Z',
    prompts: { mood: ['松了一口气'] },
    body: '今天终于把项目推上去了。',
  });
  await saveJournalEntriesToDb(db, [{
    id: '2026-06-22',
    updatedAt: '2026-06-22T12:00:00.000Z',
    prompts: {},
    body: '旧的一篇也要迁过去。',
  }]);

  const entries = await readJournalEntriesFromDb(db);
  assert.deepEqual(entries.map((entry) => entry.id), ['2026-07-02-233420', '2026-06-22']);
  assert.equal(entries[0].prompts.mood[0], '松了一口气');

  const deleted = await deleteJournalEntryFromDb(db, '2026-06-22');
  assert.deepEqual(deleted, { markdownDeleted: false, jsonDeleted: true });
  assert.deepEqual((await readJournalEntriesFromDb(db)).map((entry) => entry.id), ['2026-07-02-233420']);
});

test('review summary db helpers persist summaries for the sidebar', async () => {
  const db = createFakeDb();

  await saveReviewSummariesToDb(db, [{
    id: 'week-2026-06-22',
    type: 'week',
    range: '2026-06-22 至 2026-06-28',
    entryCount: 4,
    summary: '这一周的主线是工作去向和表达边界。',
    createdAt: '2026-07-01T00:00:00+08:00',
  }]);

  const summaries = await readReviewSummariesFromDb(db);
  assert.equal(summaries[0].id, 'week-2026-06-22');
  assert.equal(summaries[0].entryCount, 4);
  assert.equal(summaries[0].summary, '这一周的主线是工作去向和表达边界。');
});
