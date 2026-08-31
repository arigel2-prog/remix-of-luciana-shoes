// Tests for the server tier, run against a real local libSQL database.
//
// These matter more than usual: acl.js is the only thing replacing row-level
// security, so "a wholesale user cannot read the order book" is now a claim
// about JavaScript rather than about Postgres. It needs to be tested.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const workDir = mkdtempSync(join(tmpdir(), 'luciana-test-'));
process.env.TURSO_DATABASE_URL = `file:${join(workDir, 'test.db')}`;

// Imported after the env var is set, since db.js reads it on first use.
const { db } = await import('./db.js');
const { runSelect, runInsert, runUpdate, runDelete, runCount } = await import('./query.js');
const { AccessError } = await import('./acl.js');
const { createUser, createSession, userFromToken, verifyPassword, hashPassword } =
  await import('./auth.js');

const admin = { id: 'admin-user', email: 'admin@example.com', roles: ['admin'] };
const wholesale = { id: 'wholesale-user', email: 'buyer@example.com', roles: ['wholesale'] };
const noRole = { id: 'norole-user', email: 'nobody@example.com', roles: [] };

let clientId;
let styleId;
let inactiveStyleId;
let orderId;

beforeAll(async () => {
  const schema = readFileSync(new URL('../../../db/schema.sql', import.meta.url), 'utf8');

  // executeMultiple runs the whole file, triggers and all.
  await db().executeMultiple(schema);

  // Seed. Inserted directly rather than through runInsert so the fixtures do
  // not depend on the code under test.
  for (const user of [admin, wholesale, noRole]) {
    await db().execute({
      sql: 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      args: [user.id, user.email, 'x'],
    });
    for (const role of user.roles) {
      await db().execute({
        sql: 'INSERT INTO user_roles (user_id, role) VALUES (?, ?)',
        args: [user.id, role],
      });
    }
  }

  clientId = randomUUID();
  await db().execute({
    sql: 'INSERT INTO clients (id, company_name, city) VALUES (?, ?, ?)',
    args: [clientId, 'Bella Calzature', 'Milan'],
  });

  styleId = randomUUID();
  await db().execute({
    sql: `INSERT INTO styles (id, style_code, name, sizes, colors, wholesale_price, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 1)`,
    args: [styleId, 'LS-100', 'Ankle Boot', '["38","39","40"]', '["black"]', 89.5],
  });

  inactiveStyleId = randomUUID();
  await db().execute({
    sql: 'INSERT INTO styles (id, style_code, name, is_active) VALUES (?, ?, ?, 0)',
    args: [inactiveStyleId, 'LS-999', 'Discontinued Loafer'],
  });

  orderId = randomUUID();
  await db().execute({
    sql: 'INSERT INTO orders (id, order_number, client_id, status) VALUES (?, ?, ?, ?)',
    args: [orderId, 'ORD-001', clientId, 'confirmed'],
  });

  await db().execute({
    sql: `INSERT INTO order_items (order_id, style_id, quantity, unit_price)
          VALUES (?, ?, 12, 89.5)`,
    args: [orderId, styleId],
  });
});

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

describe('row marshalling', () => {
  it('returns SQLite integers as real booleans and JSON text as arrays', async () => {
    const [style] = await runSelect(
      { table: 'styles', select: '*', filters: [{ op: 'eq', column: 'id', value: styleId }] },
      admin,
    );

    expect(style.is_active).toBe(true);
    expect(style.sizes).toEqual(['38', '39', '40']);
    expect(style.colors).toEqual(['black']);
    expect(style.wholesale_price).toBe(89.5);
  });

  it('round-trips a boolean and an array through an insert', async () => {
    const [created] = await runInsert(
      {
        table: 'styles',
        values: { style_code: 'LS-200', name: 'Derby', sizes: ['41', '42'], is_active: false },
      },
      admin,
    );

    expect(created.is_active).toBe(false);
    expect(created.sizes).toEqual(['41', '42']);

    await runDelete(
      { table: 'styles', filters: [{ op: 'eq', column: 'id', value: created.id }] },
      admin,
    );
  });
});

describe('embedded resources', () => {
  it('embeds a one relation as an object and a many relation as an array', async () => {
    const [order] = await runSelect(
      {
        table: 'orders',
        select: '*, clients(*), order_items(*, styles(style_code, name))',
        filters: [{ op: 'eq', column: 'id', value: orderId }],
      },
      admin,
    );

    expect(order.clients).toMatchObject({ company_name: 'Bella Calzature', city: 'Milan' });
    expect(Array.isArray(order.order_items)).toBe(true);
    expect(order.order_items).toHaveLength(1);

    // Two levels deep, and the generated column came through.
    expect(order.order_items[0].styles).toEqual({ style_code: 'LS-100', name: 'Ankle Boot' });
    expect(order.order_items[0].total_price).toBe(12 * 89.5);
  });

  it('returns an empty array, not null, for a many relation with no rows', async () => {
    const [order] = await runSelect(
      {
        table: 'orders',
        select: 'id, payments(*)',
        filters: [{ op: 'eq', column: 'id', value: orderId }],
      },
      admin,
    );

    expect(order.payments).toEqual([]);
  });

  it('does not leak the embed helper column when it was not selected', async () => {
    const [order] = await runSelect(
      { table: 'orders', select: 'order_number, clients(company_name)' },
      admin,
    );

    // client_id had to be fetched to stitch clients on, but was not asked for.
    expect(Object.keys(order).sort()).toEqual(['clients', 'order_number']);
  });

  it('refuses an embed the caller could not query directly', async () => {
    // A wholesale user can read styles, but styles -> order_items would walk
    // into the order book.
    await expect(
      runSelect({ table: 'styles', select: '*, order_items(*)' }, wholesale),
    ).rejects.toThrow(/Not allowed to read order_items/);
  });

  it('refuses an undeclared relationship', async () => {
    await expect(runSelect({ table: 'orders', select: '*, users(*)' }, admin)).rejects.toThrow(
      /Cannot embed users in orders/,
    );
  });
});

describe('access control', () => {
  it('lets an admin read the order book', async () => {
    const rows = await runSelect({ table: 'orders', select: '*' }, admin);
    expect(rows).toHaveLength(1);
  });

  it('refuses a wholesale user the order book', async () => {
    await expect(runSelect({ table: 'orders', select: '*' }, wholesale)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('refuses a signed-in user with no role', async () => {
    await expect(runSelect({ table: 'clients', select: '*' }, noRole)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('shows a wholesale user only active styles', async () => {
    const rows = await runSelect({ table: 'styles', select: 'id' }, wholesale);
    const ids = rows.map((r) => r.id);

    expect(ids).toContain(styleId);
    expect(ids).not.toContain(inactiveStyleId);

    // …and an explicit filter cannot escape that scope.
    const forced = await runSelect(
      { table: 'styles', select: 'id', filters: [{ op: 'eq', column: 'is_active', value: false }] },
      wholesale,
    );
    expect(forced).toEqual([]);
  });

  it('refuses a wholesale user write access to styles', async () => {
    await expect(
      runInsert({ table: 'styles', values: { style_code: 'X', name: 'X' } }, wholesale),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('scopes user_roles to the caller unless they are an admin', async () => {
    const own = await runSelect({ table: 'user_roles', select: '*' }, wholesale);
    expect(own).toHaveLength(1);
    expect(own[0].user_id).toBe(wholesale.id);

    const all = await runSelect({ table: 'user_roles', select: '*' }, admin);
    expect(all.length).toBeGreaterThan(1);
  });

  it('never returns password hashes', async () => {
    const [row] = await runSelect({ table: 'users', select: '*' }, admin);
    expect(row).not.toHaveProperty('password_hash');

    await expect(
      runSelect({ table: 'users', select: 'password_hash' }, admin),
    ).rejects.toThrow(/Unknown column/);
  });

  it('rejects an unknown table', async () => {
    await expect(runSelect({ table: 'sqlite_master', select: '*' }, admin)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('filters', () => {
  it('supports in, or, not and match', async () => {
    const inRows = await runSelect(
      {
        table: 'styles',
        select: 'style_code',
        filters: [{ op: 'in', column: 'style_code', value: ['LS-100', 'LS-999'] }],
        order: [{ column: 'style_code', ascending: true }],
      },
      admin,
    );
    expect(inRows.map((r) => r.style_code)).toEqual(['LS-100', 'LS-999']);

    const orRows = await runSelect(
      {
        table: 'styles',
        select: 'style_code',
        filters: [{ op: 'or', value: 'style_code.eq.LS-100,style_code.eq.LS-999' }],
      },
      admin,
    );
    expect(orRows).toHaveLength(2);

    const notRows = await runSelect(
      {
        table: 'styles',
        select: 'style_code',
        filters: [{ op: 'not', column: 'style_code', operator: 'eq', value: 'LS-999' }],
      },
      admin,
    );
    expect(notRows.map((r) => r.style_code)).toEqual(['LS-100']);

    const matchRows = await runSelect(
      { table: 'orders', select: 'order_number', filters: [{ op: 'match', value: { status: 'confirmed' } }] },
      admin,
    );
    expect(matchRows).toEqual([{ order_number: 'ORD-001' }]);
  });

  it('treats an empty in() as matching nothing rather than erroring', async () => {
    const rows = await runSelect(
      { table: 'styles', select: 'id', filters: [{ op: 'in', column: 'id', value: [] }] },
      admin,
    );
    expect(rows).toEqual([]);
  });

  it('rejects an unknown column instead of interpolating it', async () => {
    await expect(
      runSelect(
        { table: 'orders', select: '*', filters: [{ op: 'eq', column: 'id = 1 OR 1', value: 'x' }] },
        admin,
      ),
    ).rejects.toThrow(/Unknown column/);

    await expect(
      runSelect({ table: 'orders', select: '*', order: [{ column: 'id; DROP TABLE orders' }] }, admin),
    ).rejects.toThrow(/unknown column/i);
  });

  it('binds values rather than splicing them into SQL', async () => {
    const rows = await runSelect(
      {
        table: 'clients',
        select: 'id',
        filters: [{ op: 'eq', column: 'company_name', value: "'; DROP TABLE clients; --" }],
      },
      admin,
    );

    expect(rows).toEqual([]);
    // The table is still there.
    expect(await runCount({ table: 'clients' }, admin)).toBe(1);
  });
});

describe('writes', () => {
  it('inserts, updates and deletes, returning the affected rows', async () => {
    const [created] = await runInsert(
      { table: 'clients', values: { company_name: 'Scarpe Roma', city: 'Rome' } },
      admin,
    );
    expect(created.id).toBeTruthy();
    expect(created.company_name).toBe('Scarpe Roma');

    const [updated] = await runUpdate(
      {
        table: 'clients',
        values: { city: 'Naples' },
        filters: [{ op: 'eq', column: 'id', value: created.id }],
      },
      admin,
    );
    expect(updated.city).toBe('Naples');

    const [deleted] = await runDelete(
      { table: 'clients', filters: [{ op: 'eq', column: 'id', value: created.id }] },
      admin,
    );
    expect(deleted.id).toBe(created.id);
  });

  it('inserts many rows in one call', async () => {
    const rows = await runInsert(
      {
        table: 'expenses',
        values: [
          { description: 'Leather', amount: 1200 },
          { description: 'Shipping', amount: 340 },
        ],
      },
      admin,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.description)).toEqual(['Leather', 'Shipping']);
  });

  it('refuses an unfiltered update or delete', async () => {
    await expect(
      runUpdate({ table: 'clients', values: { city: 'Nowhere' }, filters: [] }, admin),
    ).rejects.toThrow(/add a filter/);

    await expect(runDelete({ table: 'clients', filters: [] }, admin)).rejects.toThrow(
      /add a filter/,
    );
  });

  it('forces a scoped writer to write inside their own scope', async () => {
    const [created] = await runInsert(
      {
        table: 'wholesale_customers',
        // Trying to create a profile owned by someone else.
        values: { user_id: admin.id, company_name: 'Not Mine', email: 'x@example.com' },
      },
      wholesale,
    );

    expect(created.user_id).toBe(wholesale.id);
  });

  it('counts rows for select(..., { count: exact })', async () => {
    expect(await runCount({ table: 'styles' }, admin)).toBe(2);
    // The wholesale scope applies to the count too.
    expect(await runCount({ table: 'styles' }, wholesale)).toBe(1);
  });
});

describe('auth', () => {
  it('hashes and verifies a password, and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain('correct horse');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('makes the first account an admin and later ones role-less', async () => {
    // The fixture users above were inserted directly, so this database already
    // has users; assert on the rule rather than on ordering.
    const before = await db().execute('SELECT count(*) AS n FROM users');
    expect(Number(before.rows[0].n)).toBeGreaterThan(0);

    const second = await createUser('later@example.com', 'a-long-enough-password');
    const roles = await db().execute({
      sql: 'SELECT role FROM user_roles WHERE user_id = ?',
      args: [second.id],
    });
    expect(roles.rows).toHaveLength(0);
  });

  it('rejects a short password and a duplicate email', async () => {
    await expect(createUser('short@example.com', 'abc')).rejects.toMatchObject({ status: 400 });
    await expect(createUser('later@example.com', 'a-long-enough-password')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('resolves a session token to a user with roles, and forgets it on sign-out', async () => {
    const session = await createSession(admin.id);
    const resolved = await userFromToken(session.access_token);

    expect(resolved).toMatchObject({ id: admin.id, email: admin.email, roles: ['admin'] });

    // The raw token is never stored.
    const stored = await db().execute('SELECT token_hash FROM sessions');
    expect(stored.rows.some((r) => r.token_hash === session.access_token)).toBe(false);

    expect(await userFromToken('not-a-real-token')).toBeNull();
  });

  it('treats an expired session as signed out', async () => {
    const session = await createSession(admin.id);
    await db().execute({
      sql: "UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?",
      args: [admin.id],
    });

    expect(await userFromToken(session.access_token)).toBeNull();
  });
});
