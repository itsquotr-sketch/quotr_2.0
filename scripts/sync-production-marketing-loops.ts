/**
 * Sync one pending product-update choice to Loops on Production only.
 * Does not load .env.local. Set the Production Supabase URL, service role,
 * and LOOPS_API_KEY in the environment before running.
 * An email is required, so this cannot import every pending profile.
 * It does not send a campaign or a transactional email.
 *
 *   npx tsx scripts/sync-production-marketing-loops.ts --yes --email someone@example.com
 */
import { createClient } from "@supabase/supabase-js";
import { syncPendingMarketingContacts } from "../lib/communications/pending-sync";
import { readLoopsApiKey } from "../lib/communications/loops-client";

const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";

function refOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname.replace(/\.supabase\.co$/i, "");
  } catch {
    return "invalid";
  }
}

function emailArg(): string | undefined {
  const index = process.argv.indexOf("--email");
  if (index === -1) return undefined;
  const email = process.argv[index + 1]?.trim() ?? "";
  return email || undefined;
}

const ref = refOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const email = emailArg();
if (!process.argv.includes("--yes")) {
  console.error("Refusing to sync without --yes.");
  process.exit(1);
}
if (!email || !email.includes("@")) {
  console.error("Refusing Production Loops sync without one --email address.");
  process.exit(1);
}
if (ref !== PRODUCTION_REF) {
  console.error(`Refusing Loops sync for database ${ref}.`);
  process.exit(1);
}

const apiKey = readLoopsApiKey();
if (!apiKey) {
  console.error("LOOPS_API_KEY is not set. Pending choices were left unchanged.");
  process.exit(1);
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const result = await syncPendingMarketingContacts({
    admin,
    apiKey,
    email,
  });
  console.log(JSON.stringify(result));
}

main();
