/**
 * Count failed and overdue Loops syncs. Prints counts only, never an email.
 *
 * Preview, from this repo:
 *   npx tsx scripts/inspect-marketing-loops-retry.ts --yes
 *
 * Production does not load .env.local. Set the Production URL and service role,
 * then:
 *   npx tsx scripts/inspect-marketing-loops-retry.ts --yes
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return env;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx).trim()] = value;
  }
  return env;
}

function refOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname.replace(/\.supabase\.co$/i, "");
  } catch {
    return "invalid";
  }
}

const fileEnv = process.env.NEXT_PUBLIC_SUPABASE_URL ? {} : parseEnvFile(".env.local");
for (const [key, value] of Object.entries(fileEnv)) {
  if (!process.env[key]) process.env[key] = value;
}

const ref = refOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (!process.argv.includes("--yes")) {
  console.error("Refusing to inspect without --yes.");
  process.exit(1);
}
if (ref === PRODUCTION_REF && process.env.CONFIRM_PRODUCTION_DB !== PRODUCTION_REF) {
  console.error("Refusing Production inspect without CONFIRM_PRODUCTION_DB.");
  process.exit(1);
}
if (ref !== PREVIEW_REF && ref !== PRODUCTION_REF) {
  console.error(`Refusing Loops inspect for database ${ref}.`);
  process.exit(1);
}
if (ref === PRODUCTION_REF && fileEnv.NEXT_PUBLIC_SUPABASE_URL) {
  const fileRef = refOf(fileEnv.NEXT_PUBLIC_SUPABASE_URL);
  if (fileRef !== PRODUCTION_REF && process.env.NEXT_PUBLIC_SUPABASE_URL === fileEnv.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("Refusing to inspect Production with the Preview .env.local database.");
    process.exit(1);
  }
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("profiles")
    .select(
      "marketing_consent, marketing_loops_sync_pending, marketing_loops_auto_retry, marketing_loops_retry_stopped, marketing_loops_retry_after, marketing_loops_last_error"
    )
    .eq("marketing_loops_sync_pending", true);
  if (error || !data) {
    console.error("Could not read pending sync counts.");
    process.exit(1);
  }
  const rows = data as Array<{
    marketing_consent: boolean | null;
    marketing_loops_auto_retry: boolean | null;
    marketing_loops_retry_stopped: boolean | null;
    marketing_loops_retry_after: string | null;
    marketing_loops_last_error: string | null;
  }>;
  const eligible = rows.filter((row) => row.marketing_loops_auto_retry === true);
  const overdue = eligible.filter(
    (row) =>
      row.marketing_loops_retry_stopped !== true &&
      (row.marketing_loops_retry_after == null || row.marketing_loops_retry_after <= now)
  );
  console.log(
    JSON.stringify({
      database: ref,
      pending: rows.length,
      excluded_existing: rows.filter((row) => row.marketing_loops_auto_retry !== true).length,
      overdue: overdue.length,
      overdue_opt_out: overdue.filter((row) => row.marketing_consent !== true).length,
      waiting_backoff: eligible.filter(
        (row) =>
          row.marketing_loops_retry_stopped !== true &&
          row.marketing_loops_retry_after != null &&
          row.marketing_loops_retry_after > now
      ).length,
      stopped: eligible.filter((row) => row.marketing_loops_retry_stopped === true).length,
      stopped_codes: [
        ...new Set(
          eligible
            .filter((row) => row.marketing_loops_retry_stopped === true)
            .map((row) => row.marketing_loops_last_error ?? "unknown")
        ),
      ],
    })
  );
}

main();
