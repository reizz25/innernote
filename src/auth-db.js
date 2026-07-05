import { hashPassword, newToken, normalizeUsername, validatePassword, verifyPassword } from './auth.js';

const USER_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`;

const SESSION_SCHEMA = `
CREATE TABLE IF NOT EXISTS user_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
)`;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function ensureAuthSchema(db) {
  await db.query(USER_SCHEMA);
  await db.query(SESSION_SCHEMA);
}

export async function findUserByUsername(db, username) {
  const normalized = normalizeUsername(username);
  const result = await db.query(
    'SELECT id, username, password_hash FROM users WHERE username = $1',
    [normalized],
  );
  return result.rows[0] || null;
}

export async function createUser(db, username, password) {
  const normalized = normalizeUsername(username);
  const passwordHash = await hashPassword(validatePassword(password));
  try {
    const result = await db.query(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
      [newToken(16), normalized, passwordHash],
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') throw httpError(409, 'Username is already registered.');
    throw error;
  }
}

export async function verifyUserLogin(db, username, password) {
  const user = await findUserByUsername(db, username);
  if (!user) return null;
  if (!(await verifyPassword(password, user.password_hash))) return null;
  return { id: user.id, username: user.username };
}

export async function createSession(db, userId, days = 30) {
  const id = newToken(32);
  await db.query(
    "INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)",
    [id, userId, days],
  );
  return { id, maxAge: days * 24 * 60 * 60 };
}

export async function getSessionUser(db, sessionId = '') {
  if (!sessionId) return null;
  const result = await db.query(
    'SELECT users.id, users.username FROM user_sessions JOIN users ON users.id = user_sessions.user_id WHERE user_sessions.id = $1 AND user_sessions.expires_at > now()',
    [sessionId],
  );
  return result.rows[0] || null;
}

export async function deleteSession(db, sessionId = '') {
  if (!sessionId) return;
  await db.query('DELETE FROM user_sessions WHERE id = $1', [sessionId]);
}

export async function ensureInitialUser(db, env = process.env) {
  if (!env.INITIAL_USERNAME || !env.INITIAL_PASSWORD) return null;
  const username = normalizeUsername(env.INITIAL_USERNAME);
  const existing = await findUserByUsername(db, username);
  if (existing) return { id: existing.id, username: existing.username };
  return createUser(db, username, env.INITIAL_PASSWORD);
}
