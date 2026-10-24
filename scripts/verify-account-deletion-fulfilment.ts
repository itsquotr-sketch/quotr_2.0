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
import { planPersonalDeletion, type DeletionFacts } from "../lib/account-deletion/plan";
import { deletionStatusCopy } from "../lib/account-deletion/request";

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
const base: DeletionFacts = {
  targetEmail: target,
  operatorEmail: operator,
  identityConfirmed: true,
  otherActiveMemberCount: 0,
  targetIsOwner: true,
  issuedQuoteCount: 0,
  subscriptionStatus: null,
  restrictedAuthorCount: 0,
  detachableAuthorCount: 0,
  organisationId: "org-fixture",
  continuingMemberId: null,
  retainSubscriptionConfirmed: false,
  retainIssuedDocumentsConfirmed: false,
};

const ready = planPersonalDeletion(base);
const unverified = planPersonalDeletion({ ...base, identityConfirmed: false });
const shared = planPersonalDeletion({
  ...base,
  otherActiveMemberCount: 2,
  issuedQuoteCount: 1,
  retainIssuedDocumentsConfirmed: true,
});
const transferred = planPersonalDeletion({
  ...base,
  otherActiveMemberCount: 1,
  restrictedAuthorCount: 2,
  detachableAuthorCount: 1,
  continuingMemberId: "member-fixture",
});
const issued = planPersonalDeletion({
  ...base,
  issuedQuoteCount: 1,
  restrictedAuthorCount: 1,
  retainIssuedDocumentsConfirmed: true,
});
const issuedUnconfirmed = planPersonalDeletion({ ...base, issuedQuoteCount: 1 });
const subscribed = planPersonalDeletion({ ...base, subscriptionStatus: "active" });
const subscribedKept = planPersonalDeletion({
  ...base,
  subscriptionStatus: "active",
  issuedQuoteCount: 1,
  restrictedAuthorCount: 1,
  retainSubscriptionConfirmed: true,
  retainIssuedDocumentsConfirmed: true,
});
const referenced = planPersonalDeletion({ ...base, restrictedAuthorCount: 3, detachableAuthorCount: 1 });
const self = planPersonalDeletion({ ...base, targetEmail: operator });
const stranger = planPersonalDeletion({ ...base, operatorEmail: "someone@example.com" });
const executeSource = readFileSync("lib/account-deletion/execute.ts", "utf8");
const migration = readFileSync("supabase/migrations/123_detach_personal_authors.sql", "utf8");

assert("a verified sole account can be fulfilled", ready.executable);
assert(
  "the ready plan deletes the login and keeps the company",
  ready.effects.some((effect) => effect.target === "supabase_auth_user") &&
    ready.effects.some((effect) => effect.action === "retain" && effect.target === "organisation")
);
assert("an unverified request has no delete effect", !unverified.effects.some((effect) => effect.action === "delete"));
assert(
  "an owner with other members stays unverified until a continuing member is named",
  !shared.executable &&
    shared.blockers.includes("continuing_member_required") &&
    !shared.effects.some((effect) => effect.action === "delete")
);
assert(
  "a named continuing member receives ownership and the company is not deleted",
  transferred.executable &&
    transferred.effects.some((effect) => effect.action === "transfer") &&
    transferred.effects.some((effect) => effect.action === "detach") &&
    !transferred.effects.some((effect) => effect.target === "organisation" && effect.action === "delete")
);
assert("issued links stay on the website", issued.issuedLinks.includes("https://app.get-quotr.com/q/"));
assert(
  "issued documents require a separate retention confirmation",
  !issuedUnconfirmed.executable &&
    issuedUnconfirmed.blockers.includes("issued_documents_retention_unconfirmed") &&
    issued.executable
);
assert(
  "a subscription stays until retention is confirmed, and is not cancelled",
  !subscribed.executable &&
    subscribed.blockers.includes("subscription_retention_unconfirmed") &&
    subscribedKept.executable &&
    subscribedKept.effects.some((effect) => effect.target === "subscription" && effect.action === "retain") &&
    !subscribedKept.outcome.toLowerCase().includes("cancelled the subscription")
);
assert(
  "a sole owner can be planned while project rows stay",
  referenced.executable &&
    referenced.effects.some((effect) => effect.action === "detach") &&
    referenced.outcome.includes("The personal login was deleted") &&
    referenced.outcome.includes("The company was not closed")
);
assert("the operator login cannot be the target", !self.executable && self.blockers.includes("operator_account_protected"));
assert("another person cannot operate the tool", !stranger.executable);
assert("production is not a fulfilment project", deletionProjectAllowed("lxvnylhsbvudzzupxeqr") === false);
assert("preview is the fulfilment project", deletionProjectAllowed("shhpjsoldmqtkdbgrbtm"));
assert(
  "execution requires the confirmation phrase",
  readFileSync("lib/account-deletion/operator.ts", "utf8").includes("delete-personal-account") &&
    executeSource.includes("confirmationMatches")
);
assert(
  "fulfilment does not cancel Stripe or delete shared business rows",
  !executeSource.includes("stripe") &&
    !executeSource.includes('.from("organisations").delete') &&
    !executeSource.includes('.from("projects").delete') &&
    !executeSource.includes('.from("quotes").delete')
);
assert(
  "author columns stay protected by their foreign key",
  migration.includes("drop not null") &&
    migration.includes("ON DELETE RESTRICT") &&
    !migration.includes("on delete cascade")
);
assert(
  "completed copy comes from the stored outcome",
  deletionStatusCopy({
    status: "completed",
    identityConfirmed: true,
    resolution: "recorded",
    otherActiveMemberCount: 0,
    issuedQuoteCount: 1,
    subscriptionStatus: "active",
    outcome: subscribedKept.outcome,
  }).body === subscribedKept.outcome
);
assert(
  "a completed row without an outcome is not described as finished work",
  deletionStatusCopy({
    status: "completed",
    identityConfirmed: true,
    resolution: "recorded",
    otherActiveMemberCount: 0,
    issuedQuoteCount: 0,
    subscriptionStatus: null,
  }).body.includes("without a stored outcome")
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
