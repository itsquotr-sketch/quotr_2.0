/**
 * Exercise archive / restore / soft-delete against one project (reverts all changes).
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: sample } = await supabase
  .from("projects")
  .select("id, title, archived_at, deleted_at")
  .is("deleted_at", null)
  .is("archived_at", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (!sample) {
  console.error("No active project to test");
  process.exit(1);
}

const id = sample.id;
console.log(`Testing lifecycle on project ${id} (${sample.title})`);

async function read() {
  const { data } = await supabase
    .from("projects")
    .select("archived_at, deleted_at")
    .eq("id", id)
    .single();
  return data;
}

// Archive
const archivedAt = new Date().toISOString();
await supabase.from("projects").update({ archived_at: archivedAt }).eq("id", id);
let row = await read();
console.log("Archive:", row?.archived_at ? "PASS" : "FAIL", row);

// Restore
await supabase.from("projects").update({ archived_at: null }).eq("id", id);
row = await read();
console.log("Restore:", row?.archived_at === null ? "PASS" : "FAIL", row);

// Soft delete
const deletedAt = new Date().toISOString();
await supabase.from("projects").update({ deleted_at: deletedAt }).eq("id", id);
row = await read();
console.log("Delete:", row?.deleted_at ? "PASS" : "FAIL", row);

// Revert delete (cleanup)
await supabase
  .from("projects")
  .update({ deleted_at: null, archived_at: null })
  .eq("id", id);
row = await read();
console.log("Cleanup:", row?.deleted_at === null && row?.archived_at === null ? "PASS" : "FAIL", row);
