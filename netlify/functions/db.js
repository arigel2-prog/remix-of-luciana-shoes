// POST /api/db — the single data endpoint the client shim talks to.
//
// Body is a query descriptor: { action, table, select, filters, order, limit,
// values, single }. Everything about who may see what is decided in acl.js and
// enforced in query.js; this file is only transport.

import { AccessError } from './lib/acl.js';
import { requireUser } from './lib/auth.js';
import { handler, json, readJson } from './lib/http.js';
import { runCount, runDelete, runInsert, runSelect, runUpdate } from './lib/query.js';

const ACTIONS = {
  select: runSelect,
  insert: runInsert,
  update: runUpdate,
  delete: runDelete,
};

export default handler(async (request) => {
  if (request.method !== 'POST') return json({ error: { message: 'Use POST' } }, 405);

  const user = await requireUser(request);
  const body = await readJson(request);

  const run = ACTIONS[body.action];
  if (!run) throw new AccessError(400, `Unknown action: ${body.action}`);

  // `{ count: "exact" }` on a select; `head: true` means count only.
  const count = body.action === 'select' && body.count ? await runCount(body, user) : null;
  if (body.head) return json({ data: null, count });

  const rows = await run(body, user);

  // `.single()` and `.maybeSingle()` mirror PostgREST: single insists on
  // exactly one row, maybeSingle tolerates none.
  if (body.single === 'one') {
    if (rows.length !== 1) {
      return json(
        { error: { message: `Expected exactly one row, got ${rows.length}`, code: 'PGRST116' } },
        406,
      );
    }
    return json({ data: rows[0], count });
  }

  if (body.single === 'maybe') {
    if (rows.length > 1) {
      return json({ error: { message: `Expected at most one row, got ${rows.length}` } }, 406);
    }
    return json({ data: rows[0] ?? null, count });
  }

  return json({ data: rows, count });
});

export const config = { path: '/api/db' };
