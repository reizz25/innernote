import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { migrateLocalJournalData } from '../src/journal-migration.js';
import { saveJournalEntry } from '../src/journal-files.js';

test('migrateLocalJournalData imports local entries and review summaries into a store', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inner-notes-migrate-'));
  const journalRoot = join(root, 'journals');
  const reviewRoot = join(root, 'reviews');
  const savedEntries = [];
  const savedSummaries = [];

  try {
    await saveJournalEntry(journalRoot, {
      id: '2026-07-02-233420',
      updatedAt: '2026-07-02T15:40:00.000Z',
      prompts: {},
      body: '要迁移到数据库的一篇。',
    });
    await mkdir(join(reviewRoot, 'weekly'), { recursive: true });
    await writeFile(join(reviewRoot, 'weekly', '2026-W26.json'), JSON.stringify({
      period: { start: '2026-06-22', end: '2026-06-28' },
      entryCount: 1,
      review: { overview: '一周总结。' },
    }), 'utf8');

    const result = await migrateLocalJournalData({
      journalRoot,
      reviewRoot,
      store: {
        saveEntries: async (entries) => savedEntries.push(...entries),
        saveSummaries: async (summaries) => savedSummaries.push(...summaries),
      },
    });

    assert.deepEqual(result, { entryCount: 1, summaryCount: 1 });
    assert.equal(savedEntries[0].id, '2026-07-02-233420');
    assert.equal(savedSummaries[0].id, 'week-2026-06-22');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
