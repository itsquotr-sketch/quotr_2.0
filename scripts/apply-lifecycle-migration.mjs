/**
 * Apply 007_project_lifecycle.sql to the Supabase database.
 *
 * Usage (requires direct Postgres connection):
 *   DATABASE_URL="postgresql://postgres.[ref]:[password]@...supabase.com:5432/postgres" node scripts/apply-lifecycle-migration.mjs
 *
 * Or run supabase/migrations/007_project_lifecycle.sql in the Supabase SQL editor.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "007_project_lifecycle.sql"
);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "DATABASE_URL is not set. Run the SQL in supabase/migrations/007_project_lifecycle.sql via the Supabase SQL editor instead."
  );
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf8");

let pg;
try {
  pg = await import("pg");
} catch {
  console.error(
    "Install pg to run this script: npm install --save-dev pg"
  );
  process.exit(1);
}

const client = new pg.default.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(sql);

  const { rows } = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name in ('archived_at', 'deleted_at', 'duplicated_from_project_id')
    order by column_name
  `);

  console.log("Migration applied. Columns:");
  for (const row of rows) {
    console.log(`  - ${row.column_name} (${row.data_type})`);
  }

  if (rows.length < 3) {
    console.warn("Expected 3 lifecycle columns; verify manually.");
    process.exit(1);
  }
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exit(1);
} finally {
  await client.end();
}
