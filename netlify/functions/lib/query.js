// Compiles the query descriptors the client shim sends into parameterised SQL.
//
// This is a deliberately small re-implementation of the slice of PostgREST the
// app actually uses — enough for the 91 call sites in src/, and no more.
// Anything it does not recognise is rejected rather than guessed at.
//
// Two rules hold everywhere in this file:
//   * Table and column names are checked against the real schema and the
//     acl.js allowlist before they are interpolated. Values are always bound.
//   * Access is decided per table, including for embedded resources — an
//     embed is a second authorised query, not a join that inherits the
//     parent's permission.

import { db, decodeRows, encodeValue, knownColumns, writableColumns } from './db.js';
import { AccessError, authorize, relationship, scopeFor, TABLES } from './acl.js';

const COMPARATORS = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'LIKE',
  ilike: 'LIKE', // SQLite's LIKE is already case-insensitive for ASCII.
};

/**
 * Splits "a, b(c, d), e" into ["a", "b(c, d)", "e"] — a plain split(',')
 * would tear the nested lists apart.
 */
function splitTopLevel(input) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const char of input) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.filter(Boolean);
}

/**
 * Parses a select string into plain columns plus embedded resources.
 * `"*, clients(*), order_items(*, styles(*))"` becomes
 * `{ columns: ['*'], embeds: [{ name: 'clients', select: '*' }, ...] }`
 */
function parseSelect(select) {
  const columns = [];
  const embeds = [];

  for (const part of splitTopLevel(select || '*')) {
    const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/s);
    if (match) {
      embeds.push({ name: match[1], select: match[2].trim() || '*' });
    } else {
      columns.push(part);
    }
  }

  return { columns: columns.length ? columns : ['*'], embeds };
}

/** True if a select string already asks for `column` at the top level. */
function selectsColumn(select, column) {
  return splitTopLevel(select || '*').some((part) => {
    if (part.includes('(')) return false; // an embed, not a column
    const name = part.includes(':') ? part.split(':').pop().trim() : part.trim();
    return name === '*' || name === column;
  });
}

async function resolveColumns(table, requested, rule) {
  const available = await knownColumns(table);
  const denied = new Set(rule?.denyColumns || []);

  if (requested.includes('*')) {
    return [...available].filter((column) => !denied.has(column));
  }

  return requested.map((raw) => {
    // Tolerate `alias:column`, which supabase-js allows.
    const column = raw.includes(':') ? raw.split(':').pop().trim() : raw.trim();
    if (!available.has(column) || denied.has(column)) {
      throw new AccessError(400, `Unknown column ${table}.${column}`);
    }
    return column;
  });
}

const quote = (identifier) => `"${identifier}"`;

/** Turns one filter into a SQL fragment plus its bound arguments. */
async function compileFilter(table, filter, available) {
  const { op } = filter;

  if (op === 'or') {
    // supabase-js style: "status.eq.open,status.eq.pending"
    const clauses = [];
    const args = [];
    for (const term of splitTopLevel(filter.value)) {
      const [column, operator, ...rest] = term.split('.');
      const compiled = await compileFilter(
        table,
        { op: operator, column, value: rest.join('.') },
        available,
      );
      clauses.push(compiled.sql);
      args.push(...compiled.args);
    }
    if (!clauses.length) throw new AccessError(400, 'Empty or() filter');
    return { sql: `(${clauses.join(' OR ')})`, args };
  }

  if (op === 'match') {
    const clauses = [];
    const args = [];
    for (const [column, value] of Object.entries(filter.value || {})) {
      const compiled = await compileFilter(table, { op: 'eq', column, value }, available);
      clauses.push(compiled.sql);
      args.push(...compiled.args);
    }
    return clauses.length ? { sql: `(${clauses.join(' AND ')})`, args } : { sql: '1=1', args: [] };
  }

  if (!available.has(filter.column)) {
    throw new AccessError(400, `Unknown column ${table}.${filter.column}`);
  }
  const column = quote(filter.column);

  if (op === 'not') {
    const inner = await compileFilter(
      table,
      { op: filter.operator, column: filter.column, value: filter.value },
      available,
    );
    return { sql: `NOT (${inner.sql})`, args: inner.args };
  }

  if (op === 'is') {
    // Only `is(col, null)` is meaningful here; booleans go through eq.
    if (filter.value === null || filter.value === 'null') return { sql: `${column} IS NULL`, args: [] };
    return { sql: `${column} IS NOT NULL`, args: [] };
  }

  if (op === 'in') {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    if (!values.length) return { sql: '1=0', args: [] }; // IN () is a syntax error.
    const encoded = await Promise.all(values.map((v) => encodeValue(table, filter.column, v)));
    return { sql: `${column} IN (${values.map(() => '?').join(', ')})`, args: encoded };
  }

  const comparator = COMPARATORS[op];
  if (!comparator) throw new AccessError(400, `Unsupported filter: ${op}`);

  if (filter.value === null) {
    return { sql: op === 'neq' ? `${column} IS NOT NULL` : `${column} IS NULL`, args: [] };
  }

  return {
    sql: `${column} ${comparator} ?`,
    args: [await encodeValue(table, filter.column, filter.value)],
  };
}

async function buildWhere(table, filters, user) {
  const available = await knownColumns(table);
  const clauses = [];
  const args = [];

  for (const filter of filters || []) {
    const compiled = await compileFilter(table, filter, available);
    clauses.push(compiled.sql);
    args.push(...compiled.args);
  }

  // The RLS-equivalent row restriction, applied last so it cannot be
  // cancelled out by anything the caller sent.
  const scope = scopeFor(user, table);
  if (scope) {
    clauses.push(`${quote(scope.column)} = ?`);
    args.push(scope.value);
  }

  return {
    sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
    args,
  };
}

async function buildOrder(table, order) {
  if (!order?.length) return '';

  const available = await knownColumns(table);
  const terms = order.map((entry) => {
    if (!available.has(entry.column)) {
      throw new AccessError(400, `Cannot order by unknown column ${table}.${entry.column}`);
    }
    return `${quote(entry.column)} ${entry.ascending === false ? 'DESC' : 'ASC'}`;
  });

  return ` ORDER BY ${terms.join(', ')}`;
}

/**
 * Fetches embedded resources and attaches them to `rows`.
 *
 * Done as one extra query per embed rather than a join: joins would either
 * multiply the parent rows (for `many`) or need per-row JSON aggregation that
 * SQLite makes awkward. One query per level keeps the row shape exactly what
 * supabase-js produced.
 */
async function attachEmbeds(table, rows, embeds, user) {
  if (!rows.length || !embeds.length) return rows;

  for (const embed of embeds) {
    const relation = relationship(table, embed.name);
    if (!relation) {
      throw new AccessError(400, `Cannot embed ${embed.name} in ${table}`);
    }

    // An embed is authorised in its own right — embedding is not a way to
    // read a table you could not have queried directly.
    authorize(user, relation.table, 'read');

    const keys = [...new Set(rows.map((row) => row[relation.localKey]).filter((v) => v != null))];

    if (!keys.length) {
      for (const row of rows) row[embed.name] = relation.type === 'many' ? [] : null;
      continue;
    }

    // The join key has to come back on the child rows to stitch them onto the
    // parents, even when the caller's select list left it out — e.g.
    // `order_items(*, styles(style_code, name))` needs styles.id internally.
    const wantsKey = selectsColumn(embed.select, relation.foreignKey);
    const childSelect = wantsKey ? embed.select : `${embed.select}, ${relation.foreignKey}`;

    const children = await runSelect(
      {
        table: relation.table,
        select: childSelect,
        filters: [{ op: 'in', column: relation.foreignKey, value: keys }],
      },
      user,
    );

    const grouped = new Map();
    for (const child of children) {
      const key = child[relation.foreignKey];
      if (!grouped.has(key)) grouped.set(key, []);
      // Drop the key again if it was only fetched to make the join work.
      if (!wantsKey) delete child[relation.foreignKey];
      grouped.get(key).push(child);
    }

    for (const row of rows) {
      const matches = grouped.get(row[relation.localKey]) || [];
      row[embed.name] = relation.type === 'many' ? matches : matches[0] || null;
    }
  }

  return rows;
}

/** Row count for the same filters, for `.select("*", { count: "exact" })`. */
export async function runCount(request, user) {
  const { table, filters } = request;
  authorize(user, table, 'read');

  const where = await buildWhere(table, filters, user);
  const result = await db().execute({
    sql: `SELECT count(*) AS n FROM ${quote(table)}${where.sql}`,
    args: where.args,
  });

  return Number(result.rows[0].n);
}

export async function runSelect(request, user) {
  const { table, filters, order, limit } = request;
  const rule = authorize(user, table, 'read');

  const { columns, embeds } = parseSelect(request.select);
  const selected = await resolveColumns(table, columns, rule);

  // Embeds need their local keys present to stitch children onto parents,
  // and they get stripped again below if the caller did not ask for them.
  const needed = new Set(selected);
  for (const embed of embeds) {
    const relation = relationship(table, embed.name);
    if (relation) needed.add(relation.localKey);
  }

  const where = await buildWhere(table, filters, user);
  const sql =
    `SELECT ${[...needed].map(quote).join(', ')} FROM ${quote(table)}` +
    where.sql +
    (await buildOrder(table, order)) +
    (Number.isInteger(limit) && limit > 0 ? ` LIMIT ${limit}` : '');

  const result = await db().execute({ sql, args: where.args });
  const rows = await decodeRows(table, result.rows);

  await attachEmbeds(table, rows, embeds, user);

  const wanted = new Set([...selected, ...embeds.map((e) => e.name)]);
  return rows.map((row) => {
    const out = {};
    for (const key of Object.keys(row)) if (wanted.has(key)) out[key] = row[key];
    return out;
  });
}

async function encodeRow(table, values, rule) {
  const available = await writableColumns(table);
  const denied = new Set(rule?.denyColumns || []);
  const entries = [];

  for (const [column, value] of Object.entries(values || {})) {
    if (!available.has(column) || denied.has(column)) {
      throw new AccessError(400, `Unknown column ${table}.${column}`);
    }
    entries.push([column, await encodeValue(table, column, value)]);
  }

  if (!entries.length) throw new AccessError(400, 'No values supplied');
  return entries;
}

export async function runInsert(request, user) {
  const { table } = request;
  const rule = authorize(user, table, 'write');

  const payload = Array.isArray(request.values) ? request.values : [request.values];
  const scope = scopeFor(user, table);
  const inserted = [];

  for (const values of payload) {
    // A scoped writer may only create rows that belong to them.
    const withScope = scope ? { ...values, [scope.column]: scope.value } : values;
    const entries = await encodeRow(table, withScope, rule);

    const sql =
      `INSERT INTO ${quote(table)} (${entries.map(([c]) => quote(c)).join(', ')}) ` +
      `VALUES (${entries.map(() => '?').join(', ')}) RETURNING *`;

    const result = await db().execute({ sql, args: entries.map(([, v]) => v) });
    inserted.push(...(await decodeRows(table, result.rows)));
  }

  return stripDenied(inserted, rule);
}

export async function runUpdate(request, user) {
  const { table } = request;
  const rule = authorize(user, table, 'write');

  const entries = await encodeRow(table, request.values, rule);
  const where = await buildWhere(table, request.filters, user);

  if (!where.sql) throw new AccessError(400, 'Refusing to update every row — add a filter');

  const sql =
    `UPDATE ${quote(table)} SET ${entries.map(([c]) => `${quote(c)} = ?`).join(', ')}` +
    where.sql +
    ' RETURNING *';

  const result = await db().execute({
    sql,
    args: [...entries.map(([, v]) => v), ...where.args],
  });

  return stripDenied(await decodeRows(table, result.rows), rule);
}

export async function runDelete(request, user) {
  const { table } = request;
  const rule = authorize(user, table, 'write');

  const where = await buildWhere(table, request.filters, user);
  if (!where.sql) throw new AccessError(400, 'Refusing to delete every row — add a filter');

  const result = await db().execute({
    sql: `DELETE FROM ${quote(table)}${where.sql} RETURNING *`,
    args: where.args,
  });

  return stripDenied(await decodeRows(table, result.rows), rule);
}

function stripDenied(rows, rule) {
  const denied = rule?.denyColumns;
  if (!denied?.length) return rows;

  return rows.map((row) => {
    const out = { ...row };
    for (const column of denied) delete out[column];
    return out;
  });
}

export const KNOWN_TABLES = Object.keys(TABLES);
