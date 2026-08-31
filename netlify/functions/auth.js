// /api/auth/:action — signup, login, logout, session.
//
// Replaces Supabase Auth. The response shapes deliberately mirror what
// supabase-js returned ({ user, session }) so the client shim stays thin and
// the login pages did not need rewriting.

import { AccessError } from './lib/acl.js';
import {
  bearerToken,
  createSession,
  createUser,
  destroySession,
  userFromToken,
  verifyPassword,
} from './lib/auth.js';
import { db } from './lib/db.js';
import { handler, json, readJson } from './lib/http.js';

// Failed logins are answered at roughly the cost of a successful one, so the
// response time does not reveal whether an email exists.
const DUMMY_HASH =
  'scrypt$32768$8$1$00000000000000000000000000000000$' + '0'.repeat(128);

async function login(request) {
  const { email, password } = await readJson(request);
  const normalised = String(email || '').trim().toLowerCase();

  const result = await db().execute({
    sql: 'SELECT id, email, password_hash FROM users WHERE email = ?',
    args: [normalised],
  });

  const row = result.rows[0];
  const ok = await verifyPassword(String(password || ''), row?.password_hash ?? DUMMY_HASH);

  if (!row || !ok) throw new AccessError(400, 'Invalid login credentials');

  const session = await createSession(row.id);
  const user = await userFromToken(session.access_token);

  return json({ user, session });
}

async function signup(request) {
  const { email, password } = await readJson(request);
  const created = await createUser(email, password);

  const session = await createSession(created.id);
  const user = await userFromToken(session.access_token);

  return json({ user, session });
}

async function logout(request) {
  await destroySession(bearerToken(request));
  return json({ ok: true });
}

async function session(request) {
  const user = await userFromToken(bearerToken(request));
  return json({ user, session: user ? { access_token: bearerToken(request) } : null });
}

const ROUTES = { login, signup, logout, session };

export default handler(async (request) => {
  const action = new URL(request.url).pathname.split('/').pop();
  const route = ROUTES[action];

  if (!route) throw new AccessError(404, `Unknown auth action: ${action}`);
  if (action !== 'session' && request.method !== 'POST') {
    return json({ error: { message: 'Use POST' } }, 405);
  }

  return route(request);
});

export const config = { path: '/api/auth/:action' };
