/**
 * Send the one Preview welcome test to the existing confirmed test account.
 * Does not create a user, does not change confirmation, and does not accept
 * another recipient. The live send runs on the Preview deployment, where
 * the Resend key exists. This script only checks the account, then calls
 * that guarded route once.
 *
 * Usage:
 *   npx tsx scripts/send-preview-account-welcome-test.ts --yes --deployment https://...
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const PREVIEW_REF = "shhpjsoldmqtkdbgrbtm";
const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
const RECIPIENT = "hello+test@erccontracting.co.nz";

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

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

const deployment = argValue("--deployment");
const token = process.env.ACCOUNT_WELCOME_PREVIEW_TEST_TOKEN?.trim() ?? "";
const ref = refOf(process.env.NEXT_PUBLIC_SUPABASE_URL);

if (!process.argv.includes("--yes")) {
  console.error("Refusing to send without --yes.");
  process.exit(1);
}
if (ref === PRODUCTION_REF || ref !== PREVIEW_REF) {
  console.error(`Refusing welcome test for database ${ref}.`);
  process.exit(1);
}
if (!deployment || !deployment.startsWith("https://")) {
  console.error("Pass --deployment https://<preview-host>.");
  process.exit(1);
}
if (token.length < 24) {
  console.error("ACCOUNT_WELCOME_PREVIEW_TEST_TOKEN is missing.");
  process.exit(1);
}

async function main() {
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

let found: { id: string; email?: string; email_confirmed_at?: string | null } | null =
  null;
for (let page = 1; page <= 30 && !found; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("Could not read the test account.");
    process.exit(1);
  }
  const users = data?.users ?? [];
  found =
    users.find((user) => (user.email || "").toLowerCase() === RECIPIENT) ?? null;
  if (users.length < 200) break;
}

if (!found?.email || found.email.toLowerCase() !== RECIPIENT || !found.email_confirmed_at) {
  console.error("The confirmed test account was not found. No email was sent.");
  process.exit(1);
}

const headers: Record<string, string> = {
  "x-quotr-welcome-test": token,
};
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
if (bypass) headers["x-vercel-protection-bypass"] = bypass;

const response = await fetch(
  `${deployment.replace(/\/+$/, "")}/api/internal/account-welcome-preview-test`,
  { method: "POST", headers }
);
const body = await response.text();
let parsed: unknown = null;
try {
  parsed = JSON.parse(body);
} catch {
  parsed = null;
}
console.log(
  JSON.stringify({
    httpStatus: response.status,
    identified: "preview_test",
    recipientVerified: true,
    confirmationChanged: false,
    body: parsed ?? body.slice(0, 200),
  })
);
if (!response.ok) process.exit(1);
}

main();
