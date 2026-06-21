/**
 * Verify lifecycle columns exist and sample project rows (read-only).
 * Loads credentials from .env.local — run locally only.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: probe, error: probeError } = await supabase
  .from("projects")
  .select("id, title, archived_at, deleted_at, duplicated_from_project_id")
  .order("created_at", { ascending: false })
  .limit(20);

if (probeError) {
  console.error("Lifecycle column probe failed:", probeError.message);
  process.exit(1);
}

console.log("Lifecycle columns accessible. Sample rows (up to 20):");
for (const row of probe ?? []) {
  console.log(
    `  ${row.id.slice(0, 8)}… ${JSON.stringify(row.title)} archived=${row.archived_at} deleted=${row.deleted_at}`
  );
}

console.log(`\nTotal sampled: ${probe?.length ?? 0}`);
