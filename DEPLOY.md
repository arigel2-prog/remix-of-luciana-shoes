# Deploying the back-office to lucianashoes.com/trade

This repo is the Luciana Shoes back-office / CRM. It deploys as **its own
Netlify site**, on **Turso**, served at **lucianashoes.com/trade** via a proxy
rule on the public site.

> **This supersedes the earlier Supabase runbook.** Two decisions changed the
> shape of the deploy: the database is Turso (not Supabase), and the app is
> served at a path on the public domain (not at `trade.lucianashoes.com`).
> Nothing that referred to a Supabase project, an anon key, or a `VITE_`
> database variable applies any more. There is no Supabase project to create.

---

## What changed, and why it matters

Supabase supplied four things this app depended on. Turso is a hosted SQLite
database and supplies exactly one of them (the database). The other three had
to be built, and now live in `netlify/functions/`:

| Was | Is now |
|---|---|
| Supabase Auth (signup, sessions, JWTs) | `netlify/functions/auth.js` — scrypt passwords, opaque session tokens in a `sessions` table |
| Row-level security policies | `netlify/functions/lib/acl.js` — per-table role rules, enforced in JavaScript |
| `style-images` storage bucket | `netlify/functions/storage.js` — Netlify Blobs |
| `analytics-chat` edge function | `netlify/functions/analytics-chat.js` — same Anthropic call, Netlify-hosted |

**The most important consequence:** the browser never talks to Turso. It cannot.
A Turso auth token is all-or-nothing — there is no equivalent of an anon key
made safe by RLS — so a token in the frontend bundle would hand every visitor
full read/write on the whole database. Everything goes through the functions,
which hold the token server-side and decide what the caller may see.

`src/integrations/supabase/client.ts` keeps its name and its API surface on
purpose: it now speaks to those functions instead of Supabase, so the 91 query
call sites across 21 pages did not have to be rewritten.

---

## Step 1 — Create the Turso database and load the schema

```sh
# https://docs.turso.tech/quickstart
turso db create luciana-trade
turso db shell luciana-trade < db/schema.sql

# Values for step 3.
turso db show luciana-trade --url
turso db tokens create luciana-trade
```

Verify:

```sh
turso db shell luciana-trade "SELECT count(*) FROM sqlite_master WHERE type='table'"
-- expect 13 (11 app tables + users + sessions)
```

`db/schema.sql` is safe to re-run — every statement is `IF NOT EXISTS`.

---

## Step 2 — Create the Netlify site

1. <https://app.netlify.com> → **Add new site → Import an existing project → GitHub**.
2. Pick **`arigel2-prog/remix-of-luciana-shoes`**. Make sure it is this repo and
   not the public site's repo.
3. `netlify.toml` already sets the build command (`npm run build`), publish
   directory (`dist`) and `APP_BASE_PATH`, so just confirm them.

There is an existing Netlify site called **`luciana-backoffice-preview`** on the
team. It has never run a build — it was created but never connected. Either
connect that one to this repo or make a new site; there is nothing in it to
preserve.

---

## Step 3 — Environment variables

**Site configuration → Environment variables.** All of these are server-side.
None of them may be prefixed `VITE_` — that would compile the value into the
public JavaScript bundle.

| Key | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://luciana-trade-<org>.turso.io`, from step 1 |
| `TURSO_AUTH_TOKEN` | the token from step 1 |
| `ANTHROPIC_API_KEY` | from <https://console.anthropic.com/settings/keys> |

`APP_BASE_PATH` is already set to `/trade/` in `netlify.toml`; override it to
`/` only if you want a build that serves from a domain root.

Deploy, and confirm the `.netlify.app` URL loads. The redirect rules in
`netlify.toml` mean the standalone URL serves the `/trade/`-prefixed build
correctly, so you can test everything before touching DNS.

---

## Step 4 — Proxy /trade from the public site

**This is the one step that is not in this repo.** The public lucianashoes.com
site is a separate Netlify site from a separate repo, and the rule has to live
there — in its `netlify.toml` or its `public/_redirects`:

```
/trade/*  https://<back-office-site>.netlify.app/:splat  200
```

Status `200` (a rewrite), not `301` — a redirect would send the browser to the
`.netlify.app` hostname and the URL would stop reading `lucianashoes.com/trade`.

Order matters: this rule must come **before** any catch-all SPA fallback in that
file, or the public site will swallow `/trade` and serve its own index.html.

No DNS change is needed, and the root and `www` records are untouched — that is
the main advantage of the path over the old subdomain plan.

---

## Step 5 — Create your admin login

The database starts empty, with no users.

1. Open `https://lucianashoes.com/trade/admin/login`.
2. Sign up with the email you want as the owner account.
3. The first account to sign up is granted `admin` automatically (`createUser`
   in `netlify/functions/lib/auth.js`). Everyone after that gets no role and
   sees nothing until invited — so sign up yourself first, before anyone else.
4. Invite the rest of the team from the **Team** page.

To grant it explicitly instead:

```sh
turso db shell luciana-trade \
  "INSERT OR IGNORE INTO user_roles (user_id, role)
   SELECT id, 'admin' FROM users WHERE email = 'you@example.com'"
```

---

## Verification checklist

- [ ] `https://lucianashoes.com/trade` loads over HTTPS
- [ ] A hard refresh on `/trade/orders` loads instead of 404 — proves the redirects
- [ ] You can sign in, and the sidebar shows the admin pages
- [ ] Catalog → add a style with a photo — proves Netlify Blobs
- [ ] Create a client, then an order — proves the write path and the ACL
- [ ] Open an order — the client and line items appear, proving embedded reads
- [ ] AI Analytics → ask "what are the top selling styles?" and watch it stream
- [ ] Public lucianashoes.com still loads and is unchanged

---

## Testing

```sh
npm run test          # frontend (jsdom)
npm run test:server   # server tier against a real local libSQL file
npm run test:all      # both
```

The server tests are the ones that matter most. `acl.js` is now the only thing
standing between a signed-in wholesale user and the whole order book — under
Supabase that was the database's job. The suite asserts that a wholesale user
is refused the order book, sees only active styles, cannot escape that scope
with an explicit filter, and cannot reach a forbidden table by embedding it.
**If you change `acl.js`, run these.**

---

## Notes worth knowing

- **The analytics function sends the whole database to the model on every
  message.** It reads all orders, clients, styles, order items, payments and
  expenses into the system prompt. Fine at current volume; it grows linearly
  with the business and will eventually get expensive. The system prompt is
  marked cacheable and the queries are ordered by `id` so the snapshot stays
  byte-stable between turns, which is what makes the cache hit. When it
  outgrows this, give the model SQL query tools instead of a dump.
- **Model:** `claude-opus-5`, streaming, adaptive thinking. The function
  translates Anthropic's stream into OpenAI-shaped SSE chunks, which is what
  the reader in `Analytics.tsx` parses.
- **Declared column types in `db/schema.sql` are load-bearing.** `BOOLEAN` and
  `TEXT_ARRAY` are not SQLite types; the server reads them back via
  `PRAGMA table_xinfo` to know which columns to convert to real booleans and
  parsed arrays. Renaming those declarations silently changes what the API
  returns. (`table_xinfo`, not `table_info` — the latter omits generated
  columns, which would drop `order_items.total_price` from every read.)
- **Adding a table to `db/schema.sql` is not enough to make it reachable.** It
  also needs an entry in `TABLES` in `acl.js`, and an entry in `RELATIONSHIPS`
  if anything embeds it. Unlisted tables are denied — that default is
  deliberate.
- **This repo still syncs with Lovable.** Editing there will commit over these
  files. If you have finished with Lovable, disconnect it.
- **Leftovers from the Supabase era.** `supabase/luciana-migration.sql` and
  `supabase/functions/analytics-chat/index.ts` are kept as the reference the
  port was made from — nothing reads them at build or run time.
  `src/integrations/supabase/types.ts` is likewise dead. They can be deleted
  once the Turso deploy has been running happily for a while.

---

## Migrating existing data (optional)

If there is data worth keeping in the old Lovable Supabase project
(`kbfehjpbrnacpolkymjr`), it has to be moved column-by-column rather than with
`pg_dump` — the target is SQLite, and the types differ (`timestamptz` to ISO
text, `TEXT[]` to JSON, booleans to 0/1). Export each table to CSV from the
Supabase dashboard and load it with `turso db shell ... ".import"`, in
FK-dependency order: `clients` and `styles` first, then `orders`, then
`order_items`, `payments`, `expenses`.

User accounts do not transfer — passwords were hashed by Supabase Auth with a
different scheme. Everyone signs up again, and the first signup gets admin.
