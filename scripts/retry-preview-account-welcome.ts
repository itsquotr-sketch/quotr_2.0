/**
 * Retry pending, failed, or expired welcome deliveries on Preview only.
 * Uses the stored idempotency key, so a provider-accepted send is not sent again.
 * Does not choose a recipient and does not touch Production.
 *
 * Usage:
 *   npx tsx scripts/retry-preview-account-welcome.ts --yes
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { accountWelcomeFromHeader } from "../lib/auth/account-welcome";
import {
  createAccountWelcomeStore,
  deliverAccountWelcomeEmail,
} from "../lib/auth/account-welcome-send";
import { sendResendEmail } from "../lib/email/resend-send";
import type { QuoteDeliveryProvider } from "../lib/quotes/delivery-types";

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

const fileEnv = parseEnvFile(".env.local");
for (const [key, value] of Object.entries(fileEnv)) {
  if (!process.env[key]) process.env[key] = value;
}

const yes = process.argv.includes("--yes");
const ref = refOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (!yes) {
  console.error("Refusing to retry without --yes.");
  process.exit(1);
}
if (ref === PRODUCTION_REF || ref !== PREVIEW_REF) {
  console.error(`Refusing welcome retry for database ${ref}.`);
  process.exit(1);
}

async function main() {
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data, error } = await admin
  .from("account_welcome_deliveries")
  .select("id, status, lease_until, environment")
  .eq("environment", "preview")
  .in("status", ["pending", "failed", "sending"]);

if (error) {
  console.error(error.code || "query_failed");
  process.exit(1);
}

const now = Date.now();
const due = (data ?? []).filter((row) => {
  if (row.status !== "sending") return true;
  const lease = row.lease_until ? Date.parse(String(row.lease_until)) : 0;
  return !Number.isFinite(lease) || lease <= now;
});

const provider: QuoteDeliveryProvider = {
  name: "resend",
  isConfigured: () => Boolean(process.env.RESEND_API_KEY?.trim()),
  send: (payload) => sendResendEmail(payload),
};
const store = createAccountWelcomeStore(admin);
const from = accountWelcomeFromHeader();

let accepted = 0;
let failed = 0;
let skipped = 0;
for (const row of due) {
  const result = await deliverAccountWelcomeEmail({
    deliveryId: String(row.id),
    store,
    provider,
    from,
  });
  if (result.outcome === "accepted" || result.outcome === "accepted_unacked") {
    accepted += 1;
    console.log(
      JSON.stringify({
        outcome: result.outcome,
        providerMessageId: result.providerMessageId,
        deliveryConfirmed: false,
      })
    );
  } else if (result.outcome === "failed" || result.outcome === "refused") {
    failed += 1;
  } else {
    skipped += 1;
  }
}

console.log(JSON.stringify({ due: due.length, accepted, failed, skipped }));
}

main();
