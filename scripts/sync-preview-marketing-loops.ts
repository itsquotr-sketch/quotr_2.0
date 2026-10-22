/**
 * Sync pending product-update choices to Loops on Preview only.
 * Pending rows only. Does not import other users, send mail, or start a campaign.
 *
 *   npx tsx scripts/sync-preview-marketing-loops.ts --yes
 *   npx tsx scripts/sync-preview-marketing-loops.ts --yes --email hello+test@erccontracting.co.nz
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { syncPendingMarketingContacts } from "../lib/communications/pending-sync";
import { readLoopsApiKey } from "../lib/communications/loops-client";

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

function emailArg(): string | undefined {
  const index = process.argv.indexOf("--email");
  if (index === -1) return undefined;
  const email = process.argv[index + 1]?.trim() ?? "";
  return email || undefined;
}

const fileEnv = parseEnvFile(".env.local");
for (const [key, value] of Object.entries(fileEnv)) {
  if (!process.env[key]) process.env[key] = value;
}

const ref = refOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (!process.argv.includes("--yes")) {
  console.error("Refusing to sync without --yes.");
  process.exit(1);
}
if (ref === PRODUCTION_REF || ref !== PREVIEW_REF) {
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
    email: emailArg(),
  });
  console.log(JSON.stringify(result));
}

main();
