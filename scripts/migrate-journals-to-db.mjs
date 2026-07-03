import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadLocalEnv } from '../src/local-env.js';
import { createJournalStore } from '../src/journal-store.js';
import { migrateLocalJournalData } from '../src/journal-migration.js';

const root = process.cwd();
loadLocalEnv({ root });

const journalRoot = process.env.INNER_NOTES_JOURNAL_ROOT || join(homedir(), 'Desktop', 'InnerNotes', 'journals');
const reviewRoot = process.env.INNER_NOTES_REVIEW_ROOT || join(journalRoot, '..', 'reviews');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to migrate journals into Postgres.');
  process.exit(1);
}

const store = await createJournalStore({ journalRoot, reviewRoot });
try {
  const result = await migrateLocalJournalData({ journalRoot, reviewRoot, store });
  console.log(`Migrated ${result.entryCount} journal entries and ${result.summaryCount} review summaries to Postgres.`);
} finally {
  await store.close();
}
