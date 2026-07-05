const JOURNAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS journal_entries (
  user_id text NOT NULL,
  id text NOT NULL,
  entry jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
)`;

const REVIEW_SCHEMA = `
CREATE TABLE IF NOT EXISTS review_summaries (
  user_id text NOT NULL,
  id text NOT NULL,
  type text NOT NULL DEFAULT 'week',
  summary jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
)`;

async function migrateUserOwnership(db, table, defaultUserId) {
  await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id text`);
  if (defaultUserId) {
    await db.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [defaultUserId]);
  }
  await db.query(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '${table}' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM ${table} WHERE user_id IS NULL
  ) THEN
    ALTER TABLE ${table} ALTER COLUMN user_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '${table}'::regclass
      AND conname = '${table}_pkey'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) THEN
    ALTER TABLE ${table} DROP CONSTRAINT ${table}_pkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '${table}'::regclass
      AND contype = 'p'
  ) AND NOT EXISTS (
    SELECT 1 FROM ${table} WHERE user_id IS NULL
  ) THEN
    ALTER TABLE ${table} ADD PRIMARY KEY (user_id, id);
  END IF;
END $$`);
}

export async function ensureJournalSchema(db, { defaultUserId = '' } = {}) {
  await db.query(JOURNAL_SCHEMA);
  await db.query(REVIEW_SCHEMA);
  await migrateUserOwnership(db, 'journal_entries', defaultUserId);
  await migrateUserOwnership(db, 'review_summaries', defaultUserId);
}

export async function saveJournalEntryToDb(db, userId = 'default', entry = {}) {
  if (!entry.id) throw new Error('entry.id is required');
  await db.query(
    'INSERT INTO journal_entries (user_id, id, entry, updated_at) VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, now())) ON CONFLICT (user_id, id) DO UPDATE SET entry = EXCLUDED.entry, updated_at = EXCLUDED.updated_at',
    [userId, entry.id, entry, entry.updatedAt || entry.firstRecordedAt || null],
  );
  return {
    markdownPath: '',
    jsonPath: `postgres://journal_entries/${userId}/${entry.id}`,
  };
}

export async function saveJournalEntriesToDb(db, userId = 'default', entries = []) {
  const results = [];
  for (const entry of entries) {
    results.push(await saveJournalEntryToDb(db, userId, entry));
  }
  return results;
}

export async function readJournalEntriesFromDb(db, userId = 'default') {
  const result = await db.query('SELECT entry FROM journal_entries WHERE user_id = $1 ORDER BY id DESC', [userId]);
  return result.rows.map((row) => row.entry).filter((entry) => entry?.id);
}

export async function deleteJournalEntryFromDb(db, userId = 'default', id) {
  const result = await db.query('DELETE FROM journal_entries WHERE user_id = $1 AND id = $2', [userId, id]);
  return {
    markdownDeleted: false,
    jsonDeleted: Boolean(result.rowCount),
  };
}

export async function saveReviewSummariesToDb(db, userId = 'default', summaries = []) {
  for (const summary of summaries) {
    if (!summary?.id) continue;
    await db.query(
      'INSERT INTO review_summaries (user_id, id, type, summary, updated_at) VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now())) ON CONFLICT (user_id, id) DO UPDATE SET type = EXCLUDED.type, summary = EXCLUDED.summary, updated_at = EXCLUDED.updated_at',
      [userId, summary.id, summary.type || 'week', summary, summary.createdAt || null],
    );
  }
}

export async function readReviewSummariesFromDb(db, userId = 'default') {
  const result = await db.query('SELECT summary FROM review_summaries WHERE user_id = $1 ORDER BY id DESC', [userId]);
  return result.rows.map((row) => row.summary).filter((summary) => summary?.id);
}
