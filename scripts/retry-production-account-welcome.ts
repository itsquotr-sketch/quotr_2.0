/**
 * Retry pending, failed, or expired welcome deliveries on Production only.
 * Does not load .env.local. Set the Production Supabase URL, service role,
 * team From address, and Resend key in the environment before running.
 * Same payload and idempotency key, inside Resend's 24-hour window.
 * After that window the row is left for reconciliation and is not sent.
 *
 *   npx tsx scripts/retry-production-account-welcome.ts --yes
 */
import { createClient } from "@supabase/supabase-js";
import { runAccountWelcomeRetry } from "./retry-account-welcome-run";

const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";

function refOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname.replace(/\.supabase\.co$/i, "");
  } catch {
    return "invalid";
  }
}

const ref = refOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (!process.argv.includes("--yes")) {
  console.error("Refusing to retry without --yes.");
  process.exit(1);
}
if (ref !== PRODUCTION_REF) {
  console.error(`Refusing welcome retry for database ${ref}.`);
  process.exit(1);
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  await runAccountWelcomeRetry(admin, "production");
}

main();
