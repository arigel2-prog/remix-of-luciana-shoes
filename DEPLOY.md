# Deploying the back-office to trade.lucianashoes.com

This repo is the Luciana Shoes back-office / CRM. It deploys as **its own Netlify
site** on **its own Supabase project**, at **trade.lucianashoes.com**.

It is completely independent of the public lucianashoes.com site: separate repo,
separate Netlify site, separate database. Nothing in this runbook touches the
public site.

> **On provenance.** The original `DEPLOY.md`, `luciana-migration.sql` and
> `analytics-chat-index.ts` prepared for this migration did not survive the
> hand-off — the attached archive turned out to be a built `dist/` bundle. This
> runbook and `supabase/luciana-migration.sql` were rebuilt from what the repo
> itself proves: the nine original Lovable migrations recovered from git history
> (commit `f8a00f0^`), and the app's own code. Where the original notes and this
> file disagree, check before trusting either.

---

## What is already done in this branch

Steps 2 and 3 of the original plan are committed here — no action needed:

| Change | File |
|---|---|
| Analytics sends the user's access token, not the anon key | `src/pages/Analytics.tsx` |
| SPA redirect so deep links don't 404 | `public/_redirects`, `netlify.toml` |
| Edge function calls Anthropic instead of the Lovable gateway | `supabase/functions/analytics-chat/index.ts` |
| Consolidated schema for a fresh project | `supabase/luciana-migration.sql` |
| Lockfile resynced so `npm ci` doesn't fail the build | `package-lock.json` |

Everything below needs your login, so it's yours to run. Work top to bottom —
step 5 needs values produced in step 1.

---

## Step 1 — Create the Supabase project and load the schema

1. Go to <https://supabase.com/dashboard> and **New project**.
   - Name: `luciana-trade` (anything you like)
   - Region: pick the one closest to you
   - **Save the database password** somewhere safe — it is shown once.
2. Wait for provisioning (~2 minutes).
3. Open **SQL Editor → New query**.
4. Paste the entire contents of [`supabase/luciana-migration.sql`](supabase/luciana-migration.sql)
   and **Run**. It is ~600 lines; run it in one go, top to bottom.
   - Expect a batch of green `NOTICE: ... does not exist, skipping` lines. Those
     are the idempotency guards doing their job, not errors.
   - Re-running the whole file later is safe.
5. Verify — paste and run:

   ```sql
   SELECT count(*) AS tables FROM pg_tables WHERE schemaname = 'public';
   -- expect 11

   SELECT id, public FROM storage.buckets WHERE id = 'style-images';
   -- expect one row, public = true

   SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created_bootstrap_admin';
   -- expect one row
   ```

6. Go to **Project Settings → API** and copy these two values — step 5 needs them:
   - **Project URL** → `https://<ref>.supabase.co`
   - **Publishable / anon key** → starts `sb_publishable_...`

> The last two checks in step 5 above are the two bugs that were flagged in the
> original hand-off: a signup trigger missing `FOR EACH ROW` (which blocks all
> signup, so nobody can ever log in), and a missing `style-images` bucket (which
> breaks every image upload). Both are correct in this file — verified by
> actually running it against a PostgreSQL 16 database, creating users, and
> confirming the first signup is promoted to admin and the second is not.

---

## Step 2 — Auth fix in `src/pages/Analytics.tsx`

**Already applied in this branch.** For the record, as shipped the page sent:

```ts
Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
```

The edge function resolves the caller with `auth.getUser(token)` and then checks
their `admin` role. The publishable key is not a user JWT, so it resolves to no
user and the AI Analytics tab returns **401 Unauthorized** every time. It now
sends the signed-in user's `session.access_token` instead.

---

## Step 3 — SPA redirect

**Already applied in this branch** as `public/_redirects`:

```
/*    /index.html   200
```

Vite copies `public/` into `dist/`, so it lands at `dist/_redirects` where
Netlify reads it (confirmed in a local build). Without it, a hard refresh on
`/orders` or any deep link returns 404. The same rule is duplicated in
`netlify.toml` as a backstop.

---

## Step 4 — Deploy the `analytics-chat` edge function

Two ways. The dashboard route needs no tooling.

### Option A — Supabase dashboard

1. **Edge Functions → Deploy a new function**, name it exactly `analytics-chat`.
2. Paste the contents of `supabase/functions/analytics-chat/index.ts`.
3. **Turn "Verify JWT" OFF.** This is required. The function does its own auth —
   it reads the Authorization header, resolves the user, and rejects anyone
   without the `admin` role. Supabase's built-in JWT verification would reject
   the request before that code runs.
4. **Edge Functions → Secrets** (or Project Settings → Edge Functions → Secrets),
   add:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key from <https://console.anthropic.com/settings/keys> |

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
   do not add them by hand.

### Option B — Supabase CLI

```sh
npx supabase login
npx supabase link --project-ref <your-new-project-ref>
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy analytics-chat --no-verify-jwt
```

The `--no-verify-jwt` flag is what turns Verify JWT off; don't omit it.

> **Your Anthropic key never goes in the frontend.** It lives only as an edge
> function secret. Anything in `VITE_*` is compiled into the public JS bundle.

---

## Step 5 — Create the Netlify site

1. <https://app.netlify.com> → **Add new site → Import an existing project → GitHub**.
2. Pick **`arigel2-prog/remix-of-luciana-shoes`**. Make sure it is this repo and
   not the public site's repo.
3. Build settings — `netlify.toml` in this repo already sets them, so just confirm:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Before the first deploy**, open **Site configuration → Environment variables**
   and add the two values from step 1.6:

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<your-new-ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |

   This matters: a stale `.env` is committed in this repo pointing at the old
   Lovable Supabase project. Netlify's environment variables take precedence over
   it at build time (verified in a local build — with the vars set, the old
   project URL does not appear in the bundle at all). But if you forget to set
   them, the build silently succeeds and points the live site at the old
   database. Set them first.
5. Deploy, and confirm the `.netlify.app` preview URL loads.

---

## Step 6 — Point trade.lucianashoes.com at the site

1. In Netlify: **Domain management → Add a domain → `trade.lucianashoes.com`**.
2. Netlify shows you a target hostname like `your-site-name.netlify.app`.
3. At whatever DNS host holds `lucianashoes.com`, add:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `trade` | `your-site-name.netlify.app` |

   A `CNAME` on the `trade` subdomain only. **Do not touch the root `@` record or
   `www`** — those point at the public site and changing them takes it down.
4. Wait for propagation (usually minutes, up to an hour), then let Netlify
   provision the Let's Encrypt certificate. Confirm `https://trade.lucianashoes.com`
   loads with a valid padlock.

---

## Step 7 — Create your admin login

The new database starts empty, with no users.

1. Open `https://trade.lucianashoes.com/admin-login`.
2. Sign up with the email you want as the owner account.
3. The `on_auth_user_created_bootstrap_admin` trigger grants `admin` to the
   **first** account to sign up. Everyone after that gets no role and sees
   nothing until invited — so sign up yourself first, before anyone else.
4. Invite the rest of the team from the **Team** page.

If you would rather not rely on ordering, grant it explicitly in the SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'you@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

---

## Verification checklist

- [ ] `https://trade.lucianashoes.com` loads over HTTPS
- [ ] A hard refresh on a deep link (e.g. `/orders`) loads instead of 404 — proves `_redirects`
- [ ] You can sign in, and the sidebar shows the admin pages
- [ ] Catalog → add a style with a photo — proves the `style-images` bucket
- [ ] Create a client, then an order — proves the RLS policies accept an admin
- [ ] AI Analytics → ask "what are the top selling styles?" and watch it stream —
      proves the auth fix, the edge function, and `ANTHROPIC_API_KEY` together
- [ ] Public lucianashoes.com still loads and is unchanged

---

## Migrating existing data (optional)

This sets up an empty database. To bring across data from the old Lovable
project (`kbfehjpbrnacpolkymjr`), dump and restore in FK-dependency order —
`clients` and `styles` first, then `orders`, then `order_items` and `payments`:

```sh
pg_dump --data-only --no-owner \
  -t public.clients -t public.styles -t public.orders \
  -t public.order_items -t public.payments -t public.expenses \
  "postgresql://postgres:<OLD_PASSWORD>@db.kbfehjpbrnacpolkymjr.supabase.co:5432/postgres" \
  > luciana-data.sql

psql "postgresql://postgres:<NEW_PASSWORD>@db.<NEW_REF>.supabase.co:5432/postgres" \
  -f luciana-data.sql
```

Storage objects in `style-images` are not covered by `pg_dump` — re-upload those,
or copy the bucket with the Supabase CLI. User accounts do not transfer either;
everyone signs up again on the new project.

---

## Troubleshooting

**AI Analytics returns 401** — the browser is not sending a session token. Confirm
you are signed in; confirm the deployed function has Verify JWT **off**.

**AI Analytics returns 403** — you are signed in but have no `admin` row in
`user_roles`. See step 7.

**AI Analytics says AI is not configured** — the `ANTHROPIC_API_KEY` secret is
missing on the edge function. Note that setting a secret does not redeploy the
function; redeploy after adding it.

**Every page is empty but there are no errors** — the frontend is pointed at the
wrong project, or RLS is refusing every row. Check the Network tab for the
Supabase host it is calling; if it is `kbfehjpbrnacpolkymjr`, the Netlify
environment variables from step 5.4 are missing and the stale committed `.env`
was used.

**Image upload fails** — the `style-images` bucket is missing. Re-run step 1's
verification query; the migration creates it.

**Netlify build succeeds but the site is blank** — check the deploy log for the
Vite build, and the browser console. A missing `VITE_SUPABASE_URL` throws at
client construction.

---

## Notes worth knowing

- **The edge function sends the whole database to the model on every message.**
  It reads all orders, clients, styles, order items, payments and expenses and
  embeds them in the system prompt. That is fine at current volume and it is how
  the function was originally written, but it grows linearly with the business
  and will eventually hit the context limit and get expensive. The system prompt
  is marked cacheable and the queries are ordered by `id` so the snapshot stays
  byte-stable between turns of a conversation, which is what makes the cache
  actually hit. When it does outgrow this, the fix is to give the model SQL query
  tools instead of a dump.
- **Model:** `claude-opus-5`, streaming, with adaptive thinking on. The function
  translates Anthropic's stream into OpenAI-shaped SSE chunks, which is why the
  reader in `Analytics.tsx` needed only the auth change.
- **Refusal fallbacks** (the `fallbacks` beta parameter) are deliberately not
  enabled. They add a beta flag for a failure mode that does not realistically
  apply to questions about your own order book. Worth adding if this function
  ever handles broader input.
- **The committed `package-lock.json` was out of sync with `package.json`** —
  it predated `@supabase/supabase-js`, `react-markdown`, `html2pdf.js`, `vitest`
  and Playwright being added. Netlify runs `npm ci` when it finds that lockfile,
  and `npm ci` fails outright on a lockfile that doesn't match (`EUSAGE`), so the
  first deploy would have failed before compiling anything. It's regenerated in
  this branch and `npm ci` now passes. Note the repo carries three lockfiles —
  `package-lock.json`, `bun.lock` and `bun.lockb` — because Lovable builds with
  Bun; both are now in sync, so it doesn't matter which one Netlify picks.
- **This repo still syncs with Lovable.** Editing there will commit over these
  files. If you have finished with Lovable, disconnect it so the auth fix and the
  Anthropic rewrite are not overwritten.
- **`supabase/config.toml`** still holds the old project ref. It only affects
  local CLI use, not the deployed site; update it if you use the CLI.
