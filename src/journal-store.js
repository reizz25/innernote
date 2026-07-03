import {
  deleteJournalEntryFiles,
  readJournalEntries,
  readReviewSummaries,
  saveJournalEntries,
  saveJournalEntry,
} from './journal-files.js';
import {
  deleteJournalEntryFromDb,
  ensureJournalSchema,
  readJournalEntriesFromDb,
  readReviewSummariesFromDb,
  saveJournalEntriesToDb,
  saveJournalEntryToDb,
  saveReviewSummariesToDb,
} from './journal-db.js';

async function createPgPool(connectionString) {
  const { Pool } = await import('pg');
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX || 5),
  });
}

export async function createJournalStore({
  journalRoot,
  reviewRoot,
  env = process.env,
  dbFactory = createPgPool,
} = {}) {
  if (env.DATABASE_URL) {
    const db = await dbFactory(env.DATABASE_URL);
    await ensureJournalSchema(db);
    return {
      kind: 'postgres',
      folder: 'Postgres database',
      readEntries: () => readJournalEntriesFromDb(db),
      readSummaries: () => readReviewSummariesFromDb(db),
      saveEntries: (entries) => saveJournalEntriesToDb(db, entries),
      saveEntry: (entry) => saveJournalEntryToDb(db, entry),
      deleteEntry: (id) => deleteJournalEntryFromDb(db, id),
      saveSummaries: (summaries) => saveReviewSummariesToDb(db, summaries),
      close: () => db.end?.(),
    };
  }

  return {
    kind: 'file',
    folder: journalRoot,
    readEntries: () => readJournalEntries(journalRoot),
    readSummaries: () => readReviewSummaries(reviewRoot),
    saveEntries: (entries) => saveJournalEntries(journalRoot, entries),
    saveEntry: (entry) => saveJournalEntry(journalRoot, entry),
    deleteEntry: (id) => deleteJournalEntryFiles(journalRoot, id),
    saveSummaries: async () => undefined,
    close: async () => undefined,
  };
}
