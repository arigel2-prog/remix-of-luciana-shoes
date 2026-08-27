/**
 * Export all business data out of the OLD Lovable-provisioned Supabase project.
 *
 * You do NOT need Supabase dashboard access to run this. It signs in through the
 * app's own admin login — the same email and password you use on the deployed
 * site — and reads the data through the API, exactly as the app does.
 *
 *   node scripts/export-old-data.mjs you@example.com 'your-password'
 *
 * Writes ./migration-data/*.json and downloads every style image.
 * Read-only: it never writes to or deletes from the old project.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// The old project, from the .env Lovable committed to this repo.
const OLD_URL = process.env.OLD_SUPABASE_URL || "https://kbfehjpbrnacpolkymjr.supabase.co";
const OLD_KEY = process.env.OLD_SUPABASE_KEY || "sb_publishable_1G2I01tZm4HPZHenikOXVg_nDoHWEab";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/export-old-data.mjs <admin-email> <password>");
  process.exit(1);
}

// Order matters on re-import: parents before children.
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

const OUT = "migration-data";

const supabase = createClient(OLD_URL, OLD_KEY, {
  auth: { persistSession: false },
  global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") === `Bearer ${OLD_KEY}`) headers.delete("Authorization");
    headers.set("apikey", OLD_KEY);
    return fetch(input, { ...init, headers });
  } },
});

async function main() {
  await mkdir(OUT, { recursive: true });

  process.stdout.write(`Signing in as ${email} ... `);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error(`\nSign-in failed: ${authErr.message}`);
    console.error("Use the same credentials as the deployed app's /admin/login page.");
    process.exit(1);
  }
  console.log("ok");

  const { data: role } = await supabase
    .from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
  if (!role) {
    console.error("That account has no admin role, so row-level security will hide most data.");
    process.exit(1);
  }

  const summary = {};
  for (const table of TABLES) {
    // Page through, so a large table isn't silently cut off at the API's default limit.
    const rows = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
      if (error) {
        console.log(`  ${table.padEnd(20)} skipped (${error.message})`);
        break;
      }
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    await writeFile(join(OUT, `${table}.json`), JSON.stringify(rows, null, 2));
    summary[table] = rows.length;
    console.log(`  ${table.padEnd(20)} ${rows.length} rows`);
  }

  // Style photos live in storage, which no SQL dump would capture.
  process.stdout.write("Downloading style images ... ");
  await mkdir(join(OUT, "style-images"), { recursive: true });
  const { data: files, error: listErr } = await supabase.storage.from("style-images").list("", { limit: 1000 });
  if (listErr) {
    console.log(`skipped (${listErr.message})`);
  } else {
    let saved = 0;
    for (const f of files ?? []) {
      if (f.id === null) continue; // a folder, not a file
      const { data: blob, error } = await supabase.storage.from("style-images").download(f.name);
      if (error) continue;
      await writeFile(join(OUT, "style-images", f.name), Buffer.from(await blob.arrayBuffer()));
      saved++;
    }
    console.log(`${saved} file(s)`);
    summary["style-images"] = saved;
  }

  await writeFile(join(OUT, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nDone. Everything is in ./${OUT}/`);
  console.log("Next: node scripts/import-new-data.mjs (after the new project's schema is loaded)");
  await supabase.auth.signOut();
}

main().catch((e) => { console.error(e); process.exit(1); });
