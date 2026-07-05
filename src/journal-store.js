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
import {
  createSession,
  createUser,
  deleteSession,
  ensureAuthSchema,
  ensureInitialUser,
  findUserByUsername,
  getSessionUser,
  verifyUserLogin,
} from './auth-db.js';

export function normalizePostgresConnectionString(connectionString = '') {
  if (!connectionString) return connectionString;
  const parsed = new URL(connectionString);
  if (
    parsed.searchParams.get('sslmode') === 'require'
    && !parsed.searchParams.has('uselibpqcompat')
  ) {
    parsed.searchParams.set('uselibpqcompat', 'true');
  }
  return parsed.toString();
}

async function createPgPool(connectionString) {
  const { Pool } = await import('pg');
  return new Pool({
    connectionString: normalizePostgresConnectionString(connectionString),
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
    await ensureAuthSchema(db);
    const initialUser = await ensureInitialUser(db, env);
    await ensureJournalSchema(db, { defaultUserId: initialUser?.id || '' });
    return {
      kind: 'postgres',
      authEnabled: true,
      folder: 'Postgres database',
      auth: {
        register: (username, password) => createUser(db, username, password),
        login: (username, password) => verifyUserLogin(db, username, password),
        createSession: (userId) => createSession(db, userId),
        getSessionUser: (sessionId) => getSessionUser(db, sessionId),
        deleteSession: (sessionId) => deleteSession(db, sessionId),
        findUserByUsername: (username) => findUserByUsername(db, username),
      },
      readEntries: (userId) => readJournalEntriesFromDb(db, userId),
      readSummaries: (userId) => readReviewSummariesFromDb(db, userId),
      saveEntries: (userId, entries) => saveJournalEntriesToDb(db, userId, entries),
      saveEntry: (userId, entry) => saveJournalEntryToDb(db, userId, entry),
      deleteEntry: (userId, id) => deleteJournalEntryFromDb(db, userId, id),
      saveSummaries: (userId, summaries) => saveReviewSummariesToDb(db, userId, summaries),
      close: () => db.end?.(),
    };
  }

  return {
    kind: 'file',
    authEnabled: false,
    folder: journalRoot,
    readEntries: () => readJournalEntries(journalRoot),
    readSummaries: () => readReviewSummaries(reviewRoot),
    saveEntries: (userIdOrEntries, maybeEntries) => saveJournalEntries(journalRoot, Array.isArray(userIdOrEntries) ? userIdOrEntries : maybeEntries),
    saveEntry: (userIdOrEntry, maybeEntry) => saveJournalEntry(journalRoot, maybeEntry || userIdOrEntry),
    deleteEntry: (userIdOrId, maybeId) => deleteJournalEntryFiles(journalRoot, maybeId || userIdOrId),
    saveSummaries: async () => undefined,
    close: async () => undefined,
  };
}
