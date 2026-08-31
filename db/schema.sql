-- Luciana Shoes back-office — Turso (libSQL/SQLite) schema.
--
-- Ported from the Postgres original in supabase/luciana-migration.sql. The
-- differences that matter, and why:
--
--   * No pgcrypto. UUID defaults are built from randomblob(), laid out as a
--     v4 UUID so ids look the same as the ones already in the app.
--   * No timestamptz. Timestamps are ISO-8601 TEXT in UTC, which is what
--     `new Date(...)` in the frontend already expects to parse.
--   * No TEXT[]. Array columns are JSON text, declared as TEXT_ARRAY so the
--     server can spot them via PRAGMA table_info and parse them back to
--     arrays. Declared types are load-bearing here — see db.js.
--   * No enums. Those become CHECK constraints.
--   * No row-level security. SQLite has no equivalent, so every access rule
--     that used to live in a policy now lives in netlify/functions/lib/acl.js.
--     Changing a rule there is what changing a policy used to be.
--   * No auth.users. Supabase Auth is replaced by the users/sessions tables
--     below.
--
-- Safe to re-run: every statement is IF NOT EXISTS.

PRAGMA foreign_keys = ON;

--------------------------------------------------------------------------------
-- Auth. Replaces auth.users and Supabase's session handling.
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  -- scrypt, stored as "scrypt$N$r$p$<salt hex>$<derived key hex>".
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Sessions are rows rather than self-contained JWTs so that signing out, and
-- revoking a user's access, take effect immediately instead of at expiry.
CREATE TABLE IF NOT EXISTS sessions (
  -- SHA-256 of the bearer token. The token itself is never stored, so a
  -- database leak does not hand over live sessions.
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_roles (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'wholesale')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, role)
);

--------------------------------------------------------------------------------
-- Catalog
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS styles (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  style_code          TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  factory_name        TEXT,
  factory_description TEXT,
  category            TEXT,
  wholesale_price     REAL,
  retail_price        REAL,
  image_url           TEXT,
  sizes               TEXT_ARRAY,
  colors              TEXT_ARRAY,
  materials           TEXT,
  season              TEXT,
  last_number         TEXT,
  leather_description TEXT,
  sole_type           TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  city         TEXT,
  state        TEXT,
  zip_code     TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

--------------------------------------------------------------------------------
-- Orders
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  order_number TEXT NOT NULL UNIQUE,
  client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  order_date   TEXT NOT NULL DEFAULT (date('now')),
  season       TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_confirmation', 'confirmed', 'submitted_to_factory', 'in_production', 'shipped', 'delivered', 'cancelled')),
  notes        TEXT,
  total_amount REAL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);

CREATE TABLE IF NOT EXISTS order_items (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  style_id    TEXT NOT NULL REFERENCES styles(id) ON DELETE RESTRICT,
  size        TEXT,
  color       TEXT,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  REAL NOT NULL,
  total_price REAL GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_style ON order_items(style_id);

CREATE TABLE IF NOT EXISTS payments (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  amount           REAL NOT NULL,
  payment_date     TEXT NOT NULL DEFAULT (date('now')),
  payment_method   TEXT,
  reference_number TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);

CREATE TABLE IF NOT EXISTS expenses (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  description      TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'general',
  amount           REAL NOT NULL DEFAULT 0,
  expense_date     TEXT NOT NULL DEFAULT (date('now')),
  season           TEXT,
  vendor           TEXT,
  reference_number TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

--------------------------------------------------------------------------------
-- Delivery checks
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS order_item_checks (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  order_item_id TEXT NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  verified      BOOLEAN NOT NULL DEFAULT 0,
  checked_at    TEXT,
  checked_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_order_item_checks_order ON order_item_checks(order_id);

CREATE TABLE IF NOT EXISTS delivery_issues (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id TEXT REFERENCES order_items(id) ON DELETE SET NULL,
  issue_type    TEXT NOT NULL CHECK (issue_type IN ('missing', 'wrong', 'damaged', 'extra')),
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at   TEXT,
  resolved_by   TEXT,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_delivery_issues_order ON delivery_issues(order_id);

--------------------------------------------------------------------------------
-- Wholesale portal and admin invitations
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wholesale_customers (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT NOT NULL,
  phone        TEXT,
  is_approved  BOOLEAN NOT NULL DEFAULT 0,
  client_id    TEXT REFERENCES clients(id),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_wholesale_customers_user ON wholesale_customers(user_id);

CREATE TABLE IF NOT EXISTS admin_invitations (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'wholesale')),
  token       TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(24)))),
  invited_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TEXT,
  accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+7 days')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

--------------------------------------------------------------------------------
-- updated_at triggers. Postgres did this with one shared trigger function;
-- SQLite needs one trigger per table.
--------------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS trg_styles_updated AFTER UPDATE ON styles
  FOR EACH ROW BEGIN
    UPDATE styles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_clients_updated AFTER UPDATE ON clients
  FOR EACH ROW BEGIN
    UPDATE clients SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_orders_updated AFTER UPDATE ON orders
  FOR EACH ROW BEGIN
    UPDATE orders SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_users_updated AFTER UPDATE ON users
  FOR EACH ROW BEGIN
    UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_order_item_checks_updated AFTER UPDATE ON order_item_checks
  FOR EACH ROW BEGIN
    UPDATE order_item_checks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_delivery_issues_updated AFTER UPDATE ON delivery_issues
  FOR EACH ROW BEGIN
    UPDATE delivery_issues SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_wholesale_customers_updated AFTER UPDATE ON wholesale_customers
  FOR EACH ROW BEGIN
    UPDATE wholesale_customers SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_admin_invitations_updated AFTER UPDATE ON admin_invitations
  FOR EACH ROW BEGIN
    UPDATE admin_invitations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
  END;
