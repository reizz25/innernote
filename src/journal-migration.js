import { readJournalEntries, readReviewSummaries } from './journal-files.js';

export async function migrateLocalJournalData({ journalRoot, reviewRoot, store }) {
  const entries = await readJournalEntries(journalRoot);
  const summaries = await readReviewSummaries(reviewRoot);

  await store.saveEntries(entries);
  await store.saveSummaries(summaries);

  return {
    entryCount: entries.length,
    summaryCount: summaries.length,
  };
}
