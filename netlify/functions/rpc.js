// /api/rpc/:name — ports of the two Postgres functions the app called via
// supabase.rpc(). Both were SECURITY DEFINER, i.e. they ran with privileges
// the caller did not have; here that is expressed by them reading and writing
// admin_invitations directly rather than going through acl.js.
//
// Return shapes match the original jsonb payloads exactly, because
// AcceptInvite.tsx branches on those exact keys.

import { AccessError } from './lib/acl.js';
import { requireUser } from './lib/auth.js';
import { db } from './lib/db.js';
import { handler, json, readJson } from './lib/http.js';

async function invitationByToken(token) {
  const result = await db().execute({
    sql: 'SELECT * FROM admin_invitations WHERE token = ?',
    args: [String(token || '')],
  });
  return result.rows[0] || null;
}

const isExpired = (invitation) => new Date(invitation.expires_at).getTime() < Date.now();

/** Unauthenticated on purpose — the invite page shows who the invite is for. */
async function get_invitation_info(request) {
  const { _token } = await readJson(request);
  const invitation = await invitationByToken(_token);

  if (!invitation) return json({ data: { valid: false, error: 'invalid_token' } });
  if (invitation.accepted_at) return json({ data: { valid: false, error: 'already_accepted' } });
  if (isExpired(invitation)) return json({ data: { valid: false, error: 'expired' } });

  return json({ data: { valid: true, email: invitation.email, role: invitation.role } });
}

async function accept_admin_invitation(request) {
  const user = await requireUser(request).catch(() => null);
  if (!user) return json({ data: { success: false, error: 'not_authenticated' } });

  const { _token } = await readJson(request);
  const invitation = await invitationByToken(_token);

  if (!invitation) return json({ data: { success: false, error: 'invalid_token' } });
  if (invitation.accepted_at) return json({ data: { success: false, error: 'already_accepted' } });
  if (isExpired(invitation)) return json({ data: { success: false, error: 'expired' } });

  // The invitation is for one specific address; signing in as someone else
  // and pasting the link does not work.
  if (String(invitation.email).toLowerCase() !== String(user.email).toLowerCase()) {
    return json({ data: { success: false, error: 'email_mismatch' } });
  }

  await db().batch(
    [
      {
        sql: 'INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)',
        args: [user.id, invitation.role],
      },
      {
        sql: `UPDATE admin_invitations
                 SET accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), accepted_by = ?
               WHERE id = ? AND accepted_at IS NULL`,
        args: [user.id, invitation.id],
      },
    ],
    'write',
  );

  return json({ data: { success: true, role: invitation.role } });
}

const ROUTES = { get_invitation_info, accept_admin_invitation };

export default handler(async (request) => {
  if (request.method !== 'POST') return json({ error: { message: 'Use POST' } }, 405);

  const name = new URL(request.url).pathname.split('/').pop();
  const route = ROUTES[name];
  if (!route) throw new AccessError(404, `Unknown function: ${name}`);

  return route(request);
});

export const config = { path: '/api/rpc/:name' };
