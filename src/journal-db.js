const JOURNAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS journal_entries (
  id text PRIMARY KEY,
  entry jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;

const REVIEW_SCHEMA = `
CREATE TABLE IF NOT EXISTS review_summaries (
  id text PRIMARY KEY,
  type text NOT NULL DEFAULT 'week',
  summary jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;

export async function ensureJournalSchema(db) {
  await db.query(JOURNAL_SCHEMA);
  await db.query(REVIEW_SCHEMA);
}

export async function saveJournalEntryToDb(db, entry = {}) {
  if (!entry.id) throw new Error('entry.id is required');
  await db.query(
    'INSERT INTO journal_entries (id, entry, updated_at) VALUES ($1, $2::jsonb, COALESCE($3::timestamptz, now())) ON CONFLICT (id) DO UPDATE SET entry = EXCLUDED.entry, updated_at = EXCLUDED.updated_at',
    [entry.id, entry, entry.updatedAt || entry.firstRecordedAt || null],
  );
  return {
    markdownPath: '',
    jsonPath: `postgres://journal_entries/${entry.id}`,
  };
}

export async function saveJournalEntriesToDb(db, entries = []) {
  const results = [];
  for (const entry of entries) {
    results.push(await saveJournalEntryToDb(db, entry));
  }
  return results;
}

export async function readJournalEntriesFromDb(db) {
  const result = await db.query('SELECT entry FROM journal_entries ORDER BY id DESC');
  return result.rows.map((row) => row.entry).filter((entry) => entry?.id);
}

export async function deleteJournalEntryFromDb(db, id) {
  const result = await db.query('DELETE FROM journal_entries WHERE id = $1', [id]);
  return {
    markdownDeleted: false,
    jsonDeleted: Boolean(result.rowCount),
  };
}

export async function saveReviewSummariesToDb(db, summaries = []) {
  for (const summary of summaries) {
    if (!summary?.id) continue;
    await db.query(
      'INSERT INTO review_summaries (id, type, summary, updated_at) VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, now())) ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, summary = EXCLUDED.summary, updated_at = EXCLUDED.updated_at',
      [summary.id, summary.type || 'week', summary, summary.createdAt || null],
    );
  }
}

export async function readReviewSummariesFromDb(db) {
  const result = await db.query('SELECT summary FROM review_summaries ORDER BY id DESC');
  return result.rows.map((row) => row.summary).filter((summary) => summary?.id);
}
