// Password hashing and session handling — the replacement for Supabase Auth.
//
// Deliberately boring: scrypt from node:crypto for passwords, opaque random
// bearer tokens for sessions, both with zero dependencies. Sessions are rows
// in the database rather than self-contained JWTs so that signing out and
// revoking access take effect immediately instead of at token expiry.

import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';
import { AccessError } from './acl.js';

const scryptAsync = promisify(scrypt);

// OWASP's floor for scrypt. Raising N later is fine — the parameters are
// stored per hash, so existing passwords keep verifying.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keyLength: 64 };

const SESSION_TTL_DAYS = 30;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keyLength, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    // scrypt needs memory roughly 128 * N * r bytes; the default cap is lower.
    maxmem: 256 * SCRYPT.N * SCRYPT.r,
  });

  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltHex, keyHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');

  const actual = await scryptAsync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 256 * Number(n) * Number(r),
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000).toISOString();

  await db().execute({
    sql: 'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    args: [hashToken(token), userId, expiresAt],
  });

  return { access_token: token, expires_at: expiresAt };
}

export async function destroySession(token) {
  if (!token) return;
  await db().execute({
    sql: 'DELETE FROM sessions WHERE token_hash = ?',
    args: [hashToken(token)],
  });
}

/**
 * Resolves a bearer token to { id, email, roles }, or null if the token is
 * absent, unknown or expired. Expired rows are swept as they are encountered.
 */
export async function userFromToken(token) {
  if (!token) return null;

  const result = await db().execute({
    sql: `SELECT u.id, u.email, s.expires_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ?`,
    args: [hashToken(token)],
  });

  const row = result.rows[0];
  if (!row) return null;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await destroySession(token);
    return null;
  }

  const roles = await db().execute({
    sql: 'SELECT role FROM user_roles WHERE user_id = ?',
    args: [row.id],
  });

  return {
    id: row.id,
    email: row.email,
    roles: roles.rows.map((r) => r.role),
  };
}

export function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/** Resolves the caller, or throws 401. */
export async function requireUser(request) {
  const user = await userFromToken(bearerToken(request));
  if (!user) throw new AccessError(401, 'Not signed in');
  return user;
}

/**
 * Creates a user, and grants 'admin' if they are the very first account —
 * the equivalent of the old bootstrap_first_admin trigger. Everyone after
 * that gets no role until an admin invites them.
 */
export async function createUser(email, password) {
  const normalised = String(email || '').trim().toLowerCase();
  if (!normalised || !normalised.includes('@')) {
    throw new AccessError(400, 'A valid email is required');
  }
  if (String(password || '').length < 8) {
    throw new AccessError(400, 'Password must be at least 8 characters');
  }

  const existing = await db().execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [normalised],
  });
  if (existing.rows.length) throw new AccessError(409, 'That email is already registered');

  const id = randomUUID();
  await db().execute({
    sql: 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
    args: [id, normalised, await hashPassword(password)],
  });

  const count = await db().execute('SELECT count(*) AS n FROM users');
  if (Number(count.rows[0].n) === 1) {
    await db().execute({
      sql: 'INSERT INTO user_roles (user_id, role) VALUES (?, ?)',
      args: [id, 'admin'],
    });
  }

  return { id, email: normalised };
}
