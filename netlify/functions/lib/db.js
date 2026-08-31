// Turso connection and row marshalling.
//
// SQLite has no booleans and no arrays, so values need converting in both
// directions or the frontend gets 0/1 where it expects true/false and a JSON
// string where it expects string[]. Rather than keep a hand-written column map
// in sync with db/schema.sql, the converters are derived from the declared
// column types via PRAGMA table_info — which is why schema.sql declares
// BOOLEAN and TEXT_ARRAY instead of INTEGER and TEXT.

import { createClient } from '@libsql/client';

let client;

export function db() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL is not set');

  client = createClient({ url, authToken });
  return client;
}

// table -> { column -> { type, generated } }. Populated lazily, once per cold
// start.
const schemaCache = new Map();

async function columnInfo(table) {
  if (schemaCache.has(table)) return schemaCache.get(table);

  // `table` is always an allowlisted name from acl.js, never raw user input —
  // PRAGMA cannot take a bound parameter.
  //
  // table_xinfo, not table_info: the latter omits generated columns entirely,
  // which would have silently dropped order_items.total_price from every read.
  // In table_xinfo, hidden is 2 for VIRTUAL and 3 for STORED generated columns.
  const result = await db().execute(`PRAGMA table_xinfo("${table}")`);

  const columns = new Map();
  for (const row of result.rows) {
    const hidden = Number(row.hidden);
    if (hidden === 1) continue; // virtual-table hidden column; not a real one

    columns.set(row.name, {
      type: String(row.type).toUpperCase(),
      generated: hidden === 2 || hidden === 3,
    });
  }

  schemaCache.set(table, columns);
  return columns;
}

async function columnTypes(table) {
  const columns = await columnInfo(table);
  return new Map([...columns].map(([name, info]) => [name, info.type]));
}

// SQLite -> JS, on the way out to the browser.
export async function decodeRows(table, rows) {
  const types = await columnTypes(table);

  return rows.map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      const type = types.get(key);

      if (value === null || value === undefined) {
        out[key] = null;
      } else if (type === 'BOOLEAN') {
        out[key] = Boolean(value);
      } else if (type === 'TEXT_ARRAY') {
        out[key] = parseJsonArray(value);
      } else if (typeof value === 'bigint') {
        // libSQL returns INTEGER as BigInt, which JSON.stringify throws on.
        out[key] = Number(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  });
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// JS -> SQLite, on the way in from the browser.
export async function encodeValue(table, column, value) {
  const types = await columnTypes(table);
  const type = types.get(column);

  if (value === undefined || value === null) return null;
  if (type === 'BOOLEAN') return value ? 1 : 0;
  if (type === 'TEXT_ARRAY') return JSON.stringify(Array.isArray(value) ? value : [value]);
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);

  return value;
}

/** Every column that can be read. */
export async function knownColumns(table) {
  return new Set((await columnInfo(table)).keys());
}

/**
 * Columns that can be written. Generated columns are computed by SQLite and
 * error on insert, so a write naming one is a client bug worth reporting.
 */
export async function writableColumns(table) {
  const columns = await columnInfo(table);
  return new Set([...columns].filter(([, info]) => !info.generated).map(([name]) => name));
}
