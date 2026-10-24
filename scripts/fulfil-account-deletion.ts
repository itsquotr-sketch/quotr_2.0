/**
 * Dry-run, then fulfil one personal account.
 * Production execution is enabled for the authorised operator and has not
 * been exercised against a real account. This command does not email anyone
 * and it does not cancel Stripe.
 *
 * Preview dry-run:
 *   npx tsx scripts/fulfil-account-deletion.ts --request <id> --operator jeanluc@erccontracting.co.nz
 * Preview execute: add --confirm delete-personal-account
 * Production dry-run: point NEXT_PUBLIC_SUPABASE_URL at Production and add
 *   --production-dry-run
 * Production execute, only after reading that dry-run:
 *   --production-execute --project-ref lxvnylhsbvudzzupxeqr
 *   --confirm delete-personal-account --dry-run-review <review>
 *
 * A sole owner's Stripe subscription is read from Stripe with STRIPE_SECRET_KEY
 * on this operator machine. The Android host does not receive that key.
 * When another member continues as owner, pass --continuing-member <user id>.
 * When an issued document stays, also pass --retain-issued-documents.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fulfilPersonalDeletion } from "../lib/account-deletion/execute";
import {
  DELETE_PERSONAL_ACCOUNT_CONFIRMATION,
  deletionDryRunReview,
  isDeletionOperator,
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_EXECUTION_RECORD,
  PRODUCTION_SUPABASE_PROJECT_REF,
  type ProductionExecutionProof,
} from "../lib/account-deletion/operator";
import {
  interpretStripeSubscription,
  type StripeProviderCheck,
} from "../lib/account-deletion/stripe-verification";

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
const production = url.includes(PRODUCTION_SUPABASE_PROJECT_REF);
const preview = url.includes(PREVIEW_SUPABASE_PROJECT_REF);
const productionDryRun = process.argv.includes("--production-dry-run");
const productionExecute = process.argv.includes("--production-execute");
if (production && process.argv.includes("--confirm") && !productionExecute) {
  console.error(
    "Refusing Production execution. Production execution requires --production-execute, --project-ref lxvnylhsbvudzzupxeqr, a current --dry-run-review, and --confirm delete-personal-account."
  );
  process.exit(1);
}
if (production && productionExecute && productionDryRun) {
  console.error("Refusing a Production command that both dry-runs and executes.");
  process.exit(1);
}
if (production && !productionDryRun && !productionExecute) {
  console.error("Refusing Production fulfilment without --production-dry-run or --production-execute.");
  process.exit(1);
}
if (preview && productionExecute) {
  console.error("Refusing Production execution against the Preview project.");
  process.exit(1);
}
if (!preview && !production) {
  console.error("Refusing fulfilment outside Preview or an explicit Production command.");
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

async function verifyStripeSubscription(input: {
  subscriptionId: string;
  customerId: string;
}): Promise<StripeProviderCheck> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim().replace(/^"|"$/g, "") ?? "";
  if (!secret) return { available: false, reason: "unavailable" };
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(input.subscriptionId)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    if (!response.ok) return { available: false, reason: "unavailable" };
    const body = (await response.json()) as Record<string, unknown>;
    return interpretStripeSubscription({
      expectedSubscriptionId: input.subscriptionId,
      expectedCustomerId: input.customerId,
      httpOk: true,
      body,
    });
  } catch {
    return { available: false, reason: "unavailable" };
  }
}

function described(result: Awaited<ReturnType<typeof fulfilPersonalDeletion>>, review: string) {
  return {
    dryRun: result.dryRun,
    completed: result.completed,
    review,
    lifecycle: result.plan.lifecycle,
    executable: result.plan.executable,
    blockers: result.plan.blockers,
    issuedLinks: result.plan.issuedLinks,
    effects: result.plan.effects,
    outcome: result.plan.outcome,
    ...(production ? { productionExecution: PRODUCTION_EXECUTION_RECORD } : {}),
  };
}

async function main() {
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const projectRef = production ? PRODUCTION_SUPABASE_PROJECT_REF : PREVIEW_SUPABASE_PROJECT_REF;
  const shared = {
    requestId,
    operatorEmail: operator,
    projectRef,
    continuingMemberId: flag("--continuing-member"),
    retainIssuedDocumentsConfirmed: process.argv.includes("--retain-issued-documents"),
    verifyStripeSubscription,
  };
  if (productionExecute) {
    const confirmedRef = flag("--project-ref");
    const suppliedReview = flag("--dry-run-review");
    if (confirmedRef !== PRODUCTION_SUPABASE_PROJECT_REF) {
      console.error("Refusing Production execution without the exact project ref lxvnylhsbvudzzupxeqr.");
      process.exit(1);
    }
    if (flag("--confirm") !== DELETE_PERSONAL_ACCOUNT_CONFIRMATION) {
      console.error("Refusing Production execution without --confirm delete-personal-account.");
      process.exit(1);
    }
    if (!isDeletionOperator(operator) || !suppliedReview) {
      console.error("Refusing Production execution without the authorised operator and the current dry-run review.");
      process.exit(1);
    }
    const reviewed = await fulfilPersonalDeletion(admin, shared);
    const review = deletionDryRunReview(requestId, reviewed.plan);
    if (review !== suppliedReview || !reviewed.plan.executable || reviewed.plan.blockers.includes("operator_account_protected")) {
      console.log(JSON.stringify(described(reviewed, review)));
      console.error("Refusing Production execution. The current dry-run was not accepted.");
      process.exit(1);
    }
    const proof: ProductionExecutionProof = {
      confirmedProjectRef: confirmedRef,
      requestId,
      operatorEmail: operator,
      confirmation: DELETE_PERSONAL_ACCOUNT_CONFIRMATION,
      dryRunReview: suppliedReview,
    };
    const result = await fulfilPersonalDeletion(admin, {
      ...shared,
      confirmation: DELETE_PERSONAL_ACCOUNT_CONFIRMATION,
      productionExecution: proof,
    });
    console.log(JSON.stringify(described(result, deletionDryRunReview(requestId, result.plan))));
    return;
  }

  const result = await fulfilPersonalDeletion(admin, {
    ...shared,
    confirmation: production ? undefined : flag("--confirm"),
  });
  console.log(JSON.stringify(described(result, deletionDryRunReview(requestId, result.plan))));
}

void main();
