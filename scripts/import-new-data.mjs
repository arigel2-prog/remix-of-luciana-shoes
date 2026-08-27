/**
 * Load the exported data into your NEW Supabase project.
 *
 * Run this AFTER the new project's schema is in place (supabase/luciana-migration.sql)
 * and after you have signed up on the new site, so an admin account exists.
 *
 *   NEW_SUPABASE_URL=https://xxxx.supabase.co \
 *   NEW_SUPABASE_KEY=sb_publishable_xxx \
 *   node scripts/import-new-data.mjs you@example.com 'your-new-password'
 *
 * Safe to re-run: rows are upserted on their primary key, so a second run
 * updates rather than duplicates.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_KEY;
const [email, password] = process.argv.slice(2);

if (!NEW_URL || !NEW_KEY || !email || !password) {
  console.error("Usage:");
  console.error("  NEW_SUPABASE_URL=... NEW_SUPABASE_KEY=... node scripts/import-new-data.mjs <email> <password>");
  process.exit(1);
}

// Parents before children — a child row whose foreign key isn't there yet is rejected.
const TABLES = [
  "clients",
  "styles",
  "wholesale_customers",
  "orders",
  "order_items",
  "payments",
  "expenses",
  "order_item_checks",
  "delivery_issues",
  "admin_invitations",
];

// Postgres computes these; sending them back is an error.
const GENERATED = { order_items: ["total_price"] };

const IN = "migration-data";

const supabase = createClient(NEW_URL, NEW_KEY, {
  auth: { persistSession: false },
  global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") === `Bearer ${NEW_KEY}`) headers.delete("Authorization");
    headers.set("apikey", NEW_KEY);
    return fetch(input, { ...init, headers });
  } },
});

async function main() {
  process.stdout.write(`Signing in to the new project as ${email} ... `);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) { console.error(`\nSign-in failed: ${authErr.message}`); process.exit(1); }
  console.log("ok");

  const { data: role } = await supabase
    .from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
  if (!role) {
    console.error("That account is not an admin on the new project, so every insert will be refused by RLS.");
    console.error("Sign up on the new site first — the first account is promoted to admin automatically.");
    process.exit(1);
  }

  let failed = 0;
  for (const table of TABLES) {
    let rows;
    try {
      rows = JSON.parse(await readFile(join(IN, `${table}.json`), "utf8"));
    } catch {
      console.log(`  ${table.padEnd(20)} no export file, skipped`);
      continue;
    }
    if (rows.length === 0) { console.log(`  ${table.padEnd(20)} empty`); continue; }

    const drop = GENERATED[table] ?? [];
    const clean = rows.map((r) => {
      const c = { ...r };
      for (const k of drop) delete c[k];
      return c;
    });

    // Chunk, so one oversized request doesn't fail the whole table.
    const SIZE = 500;
    let done = 0;
    for (let i = 0; i < clean.length; i += SIZE) {
      const { error } = await supabase.from(table).upsert(clean.slice(i, i + SIZE), { onConflict: "id" });
      if (error) {
        console.log(`  ${table.padEnd(20)} FAILED at row ${i}: ${error.message}`);
        failed++;
        break;
      }
      done += Math.min(SIZE, clean.length - i);
    }
    if (done) console.log(`  ${table.padEnd(20)} ${done} rows`);
  }

  process.stdout.write("Uploading style images ... ");
  try {
    const files = await readdir(join(IN, "style-images"));
    let up = 0;
    for (const name of files) {
      const body = await readFile(join(IN, "style-images", name));
      const { error } = await supabase.storage.from("style-images").upload(name, body, { upsert: true });
      if (!error) up++;
    }
    console.log(`${up} file(s)`);
  } catch {
    console.log("none found, skipped");
  }

  console.log(failed ? `\nFinished with ${failed} table(s) in error — see above.` : "\nDone.");
  console.log("Note: image_url values still point at the old project. Re-check a style's photo in the app;");
  console.log("if images are broken, re-upload them from the Catalog page.");
  await supabase.auth.signOut();
}

main().catch((e) => { console.error(e); process.exit(1); });
