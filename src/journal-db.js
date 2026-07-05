const JOURNAL_TABLE = 'journal_entries_v2';
const REVIEW_TABLE = 'review_summaries_v2';

const JOURNAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS ${JOURNAL_TABLE} (
  user_id text NOT NULL,
  id text NOT NULL,
  entry jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
)`;

const REVIEW_SCHEMA = `
CREATE TABLE IF NOT EXISTS ${REVIEW_TABLE} (
  user_id text NOT NULL,
  id text NOT NULL,
  type text NOT NULL DEFAULT 'week',
  summary jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
)`;

async function copyLegacyJournalEntries(db, defaultUserId) {
  if (!defaultUserId) return;
  try {
    await db.query(
      `INSERT INTO ${JOURNAL_TABLE} (user_id, id, entry, updated_at)
       SELECT $1, id, entry, updated_at FROM journal_entries
       ON CONFLICT (user_id, id) DO NOTHING`,
      [defaultUserId],
    );
  } catch (error) {
    if (!['42P01', '42703', '42501'].includes(error.code)) throw error;
  }
}

async function copyLegacyReviewSummaries(db, defaultUserId) {
  if (!defaultUserId) return;
  try {
    await db.query(
      `INSERT INTO ${REVIEW_TABLE} (user_id, id, type, summary, updated_at)
       SELECT $1, id, type, summary, updated_at FROM review_summaries
       ON CONFLICT (user_id, id) DO NOTHING`,
      [defaultUserId],
    );
  } catch (error) {
    if (!['42P01', '42703', '42501'].includes(error.code)) throw error;
  }
}

export async function ensureJournalSchema(db, { defaultUserId = '' } = {}) {
  await db.query(JOURNAL_SCHEMA);
  await db.query(REVIEW_SCHEMA);
  await copyLegacyJournalEntries(db, defaultUserId);
  await copyLegacyReviewSummaries(db, defaultUserId);
}

export async function saveJournalEntryToDb(db, userId = 'default', entry = {}) {
  if (!entry.id) throw new Error('entry.id is required');
  await db.query(
    `INSERT INTO ${JOURNAL_TABLE} (user_id, id, entry, updated_at) VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, now())) ON CONFLICT (user_id, id) DO UPDATE SET entry = EXCLUDED.entry, updated_at = EXCLUDED.updated_at`,
    [userId, entry.id, entry, entry.updatedAt || entry.firstRecordedAt || null],
  );
  return {
    markdownPath: '',
    jsonPath: `postgres://${JOURNAL_TABLE}/${userId}/${entry.id}`,
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
  const result = await db.query(`SELECT entry FROM ${JOURNAL_TABLE} WHERE user_id = $1 ORDER BY id DESC`, [userId]);
  return result.rows.map((row) => row.entry).filter((entry) => entry?.id);
}

export async function deleteJournalEntryFromDb(db, userId = 'default', id) {
  const result = await db.query(`DELETE FROM ${JOURNAL_TABLE} WHERE user_id = $1 AND id = $2`, [userId, id]);
  return {
    markdownDeleted: false,
    jsonDeleted: Boolean(result.rowCount),
  };
}

export async function saveReviewSummariesToDb(db, userId = 'default', summaries = []) {
  for (const summary of summaries) {
    if (!summary?.id) continue;
    await db.query(
      `INSERT INTO ${REVIEW_TABLE} (user_id, id, type, summary, updated_at) VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now())) ON CONFLICT (user_id, id) DO UPDATE SET type = EXCLUDED.type, summary = EXCLUDED.summary, updated_at = EXCLUDED.updated_at`,
      [userId, summary.id, summary.type || 'week', summary, summary.createdAt || null],
    );
  }
}

export async function readReviewSummariesFromDb(db, userId = 'default') {
  const result = await db.query(`SELECT summary FROM ${REVIEW_TABLE} WHERE user_id = $1 ORDER BY id DESC`, [userId]);
  return result.rows.map((row) => row.summary).filter((summary) => summary?.id);
}
