/**
 * Dry-run, then fulfil one disposable Preview personal account.
 * Refuses Production. Does not email anyone.
 *
 * Run: npx tsx scripts/fulfil-account-deletion.ts --request <id> --operator jeanluc@erccontracting.co.nz
 * Execute: add --confirm delete-personal-account
 * When a subscription or issued document stays, also pass
 * --retain-subscription and --retain-issued-documents.
 * When another member continues as owner, pass --continuing-member <user id>.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fulfilPersonalDeletion } from "../lib/account-deletion/execute";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/account-deletion/operator";

function envValue(name: string): string {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  const file = readFileSync(".env.local", "utf8");
  const line = file.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^"|"$/g, "") : "";
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
if (!url.includes(PREVIEW_SUPABASE_PROJECT_REF) || url.includes("lxvnylhsbvudzzupxeqr")) {
  console.error("Refusing fulfilment outside Preview.");
  process.exit(1);
}
if (!key) {
  console.error("Preview service role key is missing.");
  process.exit(1);
}

const requestId = flag("--request");
const operator = flag("--operator");
if (!requestId || !operator) {
  console.error("Pass --request and --operator.");
  process.exit(1);
}

process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = key;

async function main() {
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await fulfilPersonalDeletion(admin, {
    requestId,
    operatorEmail: operator,
    projectRef: PREVIEW_SUPABASE_PROJECT_REF,
    confirmation: flag("--confirm"),
    continuingMemberId: flag("--continuing-member"),
    retainSubscriptionConfirmed: process.argv.includes("--retain-subscription"),
    retainIssuedDocumentsConfirmed: process.argv.includes("--retain-issued-documents"),
    deleteContact: async () => "unconfigured",
  });

  console.log(
    JSON.stringify({
      dryRun: result.dryRun,
      completed: result.completed,
      lifecycle: result.plan.lifecycle,
      executable: result.plan.executable,
      blockers: result.plan.blockers,
      issuedLinks: result.plan.issuedLinks,
      effects: result.plan.effects,
      outcome: result.plan.outcome,
    })
  );
}

void main();
