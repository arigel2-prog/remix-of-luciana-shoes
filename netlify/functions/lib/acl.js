// Access rules — the replacement for Postgres row-level security.
//
// SQLite has no RLS, so nothing in the database itself stops a query. Every
// rule that used to be a CREATE POLICY now lives here, and this file is the
// only thing standing between a signed-in wholesale user and the whole order
// book. Treat a change here the way you would have treated a policy change.
//
// Two layers:
//   * `TABLES` — who may read or write each table at all.
//   * `scope`  — a row filter applied on top, for rules that were
//                `USING (auth.uid() = user_id)` style predicates.
//
// Anything not listed is denied. That default is deliberate: a table added to
// schema.sql without a matching entry here is unreachable rather than public.

/**
 * read/write: roles allowed the operation. 'admin' and 'wholesale' are the
 *   only roles; a signed-in user with neither gets nothing, which is what
 *   happens to an invited-but-unassigned account.
 * scope: optional (user) => ({ column, value }) restricting visible rows.
 * denyColumns: columns never sent to the browser.
 */
export const TABLES = {
  styles: {
    read: ['admin', 'wholesale'],
    write: ['admin'],
    // Wholesale sees the catalog, but only what is on sale.
    scope: (user) => (user.roles.includes('admin') ? null : { column: 'is_active', value: 1 }),
  },
  clients: { read: ['admin'], write: ['admin'] },
  orders: { read: ['admin'], write: ['admin'] },
  order_items: { read: ['admin'], write: ['admin'] },
  payments: { read: ['admin'], write: ['admin'] },
  expenses: { read: ['admin'], write: ['admin'] },
  order_item_checks: { read: ['admin'], write: ['admin'] },
  delivery_issues: { read: ['admin'], write: ['admin'] },
  admin_invitations: { read: ['admin'], write: ['admin'] },

  wholesale_customers: {
    read: ['admin', 'wholesale'],
    write: ['admin', 'wholesale'],
    // A wholesale user sees and edits only their own profile row.
    scope: (user) =>
      user.roles.includes('admin') ? null : { column: 'user_id', value: user.id },
  },

  user_roles: {
    // Any signed-in user may read their own roles — that is how the frontend
    // decides what to render. Only an admin may grant or revoke.
    read: ['admin', 'wholesale', null],
    write: ['admin'],
    scope: (user) => (user.roles.includes('admin') ? null : { column: 'user_id', value: user.id }),
  },

  users: {
    read: ['admin'],
    write: [],
    denyColumns: ['password_hash'],
  },
};

// Embedded resources, i.e. PostgREST's `select("*, clients(*)")`.
//
// `one` produces an object, `many` produces an array — the same shape
// supabase-js returned, so the pages consuming these do not change.
// Only the pairs listed here can be embedded.
export const RELATIONSHIPS = {
  orders: {
    clients: { table: 'clients', type: 'one', localKey: 'client_id', foreignKey: 'id' },
    order_items: { table: 'order_items', type: 'many', localKey: 'id', foreignKey: 'order_id' },
    payments: { table: 'payments', type: 'many', localKey: 'id', foreignKey: 'order_id' },
    delivery_issues: { table: 'delivery_issues', type: 'many', localKey: 'id', foreignKey: 'order_id' },
  },
  order_items: {
    styles: { table: 'styles', type: 'one', localKey: 'style_id', foreignKey: 'id' },
    orders: { table: 'orders', type: 'one', localKey: 'order_id', foreignKey: 'id' },
    order_item_checks: { table: 'order_item_checks', type: 'many', localKey: 'id', foreignKey: 'order_item_id' },
  },
  clients: {
    orders: { table: 'orders', type: 'many', localKey: 'id', foreignKey: 'client_id' },
    payments: { table: 'payments', type: 'many', localKey: 'id', foreignKey: 'client_id' },
  },
  payments: {
    orders: { table: 'orders', type: 'one', localKey: 'order_id', foreignKey: 'id' },
    clients: { table: 'clients', type: 'one', localKey: 'client_id', foreignKey: 'id' },
  },
  delivery_issues: {
    orders: { table: 'orders', type: 'one', localKey: 'order_id', foreignKey: 'id' },
    order_items: { table: 'order_items', type: 'one', localKey: 'order_item_id', foreignKey: 'id' },
  },
  order_item_checks: {
    order_items: { table: 'order_items', type: 'one', localKey: 'order_item_id', foreignKey: 'id' },
    orders: { table: 'orders', type: 'one', localKey: 'order_id', foreignKey: 'id' },
  },
  wholesale_customers: {
    clients: { table: 'clients', type: 'one', localKey: 'client_id', foreignKey: 'id' },
  },
  styles: {
    order_items: { table: 'order_items', type: 'many', localKey: 'id', foreignKey: 'style_id' },
  },
};

export class AccessError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Throws unless `user` may perform `operation` ('read' | 'write') on `table`.
 * Returns the table's rule so the caller can apply its scope.
 */
export function authorize(user, table, operation) {
  const rule = TABLES[table];
  if (!rule) throw new AccessError(404, `Unknown table: ${table}`);

  const allowed = rule[operation] || [];
  const hasRole = user.roles.some((role) => allowed.includes(role));
  // `null` in the allowlist means "any signed-in user, role or not".
  const allowsAnySignedIn = allowed.includes(null);

  if (!hasRole && !allowsAnySignedIn) {
    throw new AccessError(403, `Not allowed to ${operation} ${table}`);
  }

  return rule;
}

export function scopeFor(user, table) {
  const rule = TABLES[table];
  return rule?.scope ? rule.scope(user) : null;
}

export function relationship(table, name) {
  return RELATIONSHIPS[table]?.[name] || null;
}
