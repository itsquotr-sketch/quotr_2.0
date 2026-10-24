/**
 * Security checks for personal-account fulfilment.
 * Run: npx tsx scripts/verify-account-deletion-fulfilment.ts
 */
import { readFileSync } from "node:fs";
import { deleteLoopsContact } from "../lib/communications/loops-client";
import {
  INITIAL_DELETION_OPERATOR,
  deletionProjectAllowed,
} from "../lib/account-deletion/operator";
import { planPersonalDeletion } from "../lib/account-deletion/plan";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok ${label}`);
}

const operator = INITIAL_DELETION_OPERATOR.email;
const target = "deletion-fixture@example.com";
const base = {
  targetEmail: target,
  operatorEmail: operator,
  identityConfirmed: true,
  otherActiveMemberCount: 0,
  issuedQuoteCount: 0,
  subscriptionStatus: null,
  blockingReferenceCount: 0,
  organisationId: "org-fixture",
};

const ready = planPersonalDeletion(base);
const unverified = planPersonalDeletion({ ...base, identityConfirmed: false });
const shared = planPersonalDeletion({ ...base, otherActiveMemberCount: 2, issuedQuoteCount: 1 });
const issued = planPersonalDeletion({ ...base, issuedQuoteCount: 1 });
const subscribed = planPersonalDeletion({ ...base, subscriptionStatus: "active" });
const referenced = planPersonalDeletion({ ...base, blockingReferenceCount: 3 });
const self = planPersonalDeletion({ ...base, targetEmail: operator });
const stranger = planPersonalDeletion({ ...base, operatorEmail: "someone@example.com" });

assert("a verified sole account can be fulfilled", ready.executable);
assert(
  "the ready plan deletes the login and keeps the company",
  ready.effects.some((effect) => effect.target === "supabase_auth_user") &&
    ready.effects.some((effect) => effect.action === "retain" && effect.target === "organisation")
);
assert("an unverified request has no delete effect", !unverified.effects.some((effect) => effect.action === "delete"));
assert(
  "other members are accepted for support and not deleted",
  !shared.executable &&
    shared.blockers.includes("other_members_need_support") &&
    !shared.effects.some((effect) => effect.action === "delete")
);
assert("issued links stay on the website", issued.issuedLinks.includes("https://app.get-quotr.com/q/"));
assert("a subscription blocks personal deletion", !subscribed.executable && subscribed.blockers.includes("subscription_retained"));
assert("referenced company records block personal deletion", !referenced.executable);
assert("the operator login cannot be the target", !self.executable && self.blockers.includes("operator_account_protected"));
assert("another person cannot operate the tool", !stranger.executable);
assert("production is not a fulfilment project", deletionProjectAllowed("lxvnylhsbvudzzupxeqr") === false);
assert("preview is the fulfilment project", deletionProjectAllowed("shhpjsoldmqtkdbgrbtm"));
assert(
  "execution requires the confirmation phrase",
  readFileSync("lib/account-deletion/operator.ts", "utf8").includes("delete-personal-account") &&
    readFileSync("lib/account-deletion/execute.ts", "utf8").includes("confirmationMatches")
);

async function main() {
  const calls: string[] = [];
  const provider = await deleteLoopsContact({
    email: target,
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
  });
  assert(
    "Loops deletion uses the contact delete endpoint",
    provider === "deleted" && calls[0] === "POST https://app.loops.so/api/v1/contacts/delete"
  );
  const missing = await deleteLoopsContact({ email: target, apiKey: null });
  assert("a missing Loops key does not pretend the contact was deleted", missing === "unconfigured");

  if (process.exitCode) console.error("account deletion fulfilment checks failed");
  else console.log("account deletion fulfilment checks passed");
}

void main();
