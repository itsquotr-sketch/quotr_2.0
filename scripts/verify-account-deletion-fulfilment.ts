/**
 * Security checks for personal-account fulfilment.
 * Run: npx tsx scripts/verify-account-deletion-fulfilment.ts
 */
import { readFileSync } from "node:fs";
import { deleteLoopsContact } from "../lib/communications/loops-client";
import {
  INITIAL_DELETION_OPERATOR,
  deletionDryRunReview,
  deletionProjectAllowed,
  productionExecutionRequested,
} from "../lib/account-deletion/operator";
import { planPersonalDeletion, type DeletionFacts } from "../lib/account-deletion/plan";
import {
  interpretStripeSubscription,
  type StripeProviderCheck,
} from "../lib/account-deletion/stripe-verification";
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
  subscriptionSource: null,
  stripeSubscriptionId: null,
  stripeCustomerId: null,
  stripeProvider: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  restrictedAuthorCount: 0,
  detachableAuthorCount: 0,
  organisationId: "org-fixture",
  continuingMemberId: null,
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
const stripeIds = {
  stripeSubscriptionId: "sub_test",
  stripeCustomerId: "cus_test",
};
const confirmedEnd: StripeProviderCheck = {
  available: true,
  subscriptionId: "sub_test",
  customerId: "cus_test",
  status: "active",
  nonRenewing: true,
  cancelAtPeriodEnd: true,
  serviceEnd: "2026-12-15T00:00:00.000Z",
  outstanding: true,
};
const stillRenewing: StripeProviderCheck = {
  available: true,
  subscriptionId: "sub_test",
  customerId: "cus_test",
  status: "active",
  nonRenewing: false,
  cancelAtPeriodEnd: false,
  serviceEnd: null,
  outstanding: false,
};
const subscribed = planPersonalDeletion({
  ...base,
  ...stripeIds,
  subscriptionStatus: "active",
  subscriptionSource: "stripe",
  stripeProvider: stillRenewing,
});
const subscribedAcknowledged = planPersonalDeletion({
  ...base,
  ...stripeIds,
  subscriptionStatus: "active",
  subscriptionSource: "stripe",
  cancelAtPeriodEnd: true,
});
const scheduled = planPersonalDeletion({
  ...base,
  ...stripeIds,
  subscriptionStatus: "active",
  subscriptionSource: "stripe",
  cancelAtPeriodEnd: true,
  currentPeriodEnd: "2026-11-01T00:00:00.000Z",
  stripeProvider: confirmedEnd,
});
const historical = planPersonalDeletion({
  ...base,
  ...stripeIds,
  subscriptionStatus: "cancelled",
  subscriptionSource: "stripe",
  stripeProvider: {
    available: true,
    subscriptionId: "sub_test",
    customerId: "cus_test",
    status: "canceled",
    nonRenewing: true,
    cancelAtPeriodEnd: false,
    serviceEnd: "2026-10-01T00:00:00.000Z",
    outstanding: false,
  },
});
const overrideRecord = planPersonalDeletion({
  ...base,
  subscriptionStatus: "active",
  subscriptionSource: "override",
});
const transferredBilling = planPersonalDeletion({
  ...base,
  otherActiveMemberCount: 1,
  continuingMemberId: "member-fixture",
  subscriptionStatus: "active",
  subscriptionSource: "stripe",
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
  "a renewing Stripe subscription blocks a sole owner without a billing owner",
  !subscribed.executable &&
    !subscribedAcknowledged.executable &&
    subscribed.blockers.includes("billing_resolution_required") &&
    subscribedAcknowledged.blockers.includes("stripe_provider_verification_required") &&
    !subscribed.effects.some((effect) => effect.action === "delete")
);
assert(
  "a scheduled cancellation is retained without changing Stripe",
  scheduled.executable &&
    scheduled.outcome.includes("Stripe confirmed sub_test for cus_test") &&
    scheduled.outcome.includes("A payment is still outstanding") &&
    scheduled.outcome.includes("2026-12-15T00:00:00.000Z") &&
    scheduled.outcome.includes("did not change the subscription")
);
assert(
  "historical and non-Stripe rows stay without authorising a live charge",
  historical.executable &&
    historical.outcome.includes("Status canceled") &&
    historical.outcome.includes("2026-10-01T00:00:00.000Z") &&
    overrideRecord.executable &&
    overrideRecord.outcome.includes("no Stripe subscription")
);
assert(
  "a continuing owner can administer a subscription that is not cancelled here",
  transferredBilling.executable &&
    transferredBilling.effects.some((effect) => effect.action === "transfer") &&
    transferredBilling.outcome.includes("can administer billing")
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
const productionProof = {
  confirmedProjectRef: "lxvnylhsbvudzzupxeqr",
  requestId: "11111111-1111-4111-8111-111111111111",
  operatorEmail: INITIAL_DELETION_OPERATOR.email,
  confirmation: "delete-personal-account",
  dryRunReview: "a".repeat(64),
};
assert("production is not a fulfilment project", deletionProjectAllowed("lxvnylhsbvudzzupxeqr") === false);
assert(
  "production dry-run is allowed and ungated production execution is not",
  deletionProjectAllowed("lxvnylhsbvudzzupxeqr", "dry-run") &&
    deletionProjectAllowed("lxvnylhsbvudzzupxeqr", "execute") === false &&
    deletionProjectAllowed("lxvnylhsbvudzzupxeqr", "execute", {
      ...productionProof,
      confirmedProjectRef: "shhpjsoldmqtkdbgrbtm",
    }) === false &&
    deletionProjectAllowed("lxvnylhsbvudzzupxeqr", "execute", productionProof)
);
assert(
  "production execution requires the operator, request, and exact project",
  productionExecutionRequested({
    projectRef: "lxvnylhsbvudzzupxeqr",
    requestId: productionProof.requestId,
    operatorEmail: INITIAL_DELETION_OPERATOR.email,
    proof: productionProof,
  }) &&
    productionExecutionRequested({
      projectRef: "lxvnylhsbvudzzupxeqr",
      requestId: productionProof.requestId,
      operatorEmail: "someone@example.com",
      proof: { ...productionProof, operatorEmail: "someone@example.com" },
    }) === false
);
const reviewPlan = planPersonalDeletion(base);
const review = deletionDryRunReview(productionProof.requestId, reviewPlan);
assert(
  "a dry-run review changes when the plan changes",
  review !== deletionDryRunReview(productionProof.requestId, { ...reviewPlan, outcome: `${reviewPlan.outcome} changed` })
);
assert("preview is the fulfilment project", deletionProjectAllowed("shhpjsoldmqtkdbgrbtm", "execute"));
assert(
  "execution requires the confirmation phrase",
  readFileSync("lib/account-deletion/operator.ts", "utf8").includes("delete-personal-account") &&
    executeSource.includes("confirmationMatches")
);
assert(
  "fulfilment does not cancel Stripe or delete shared business rows",
  !executeSource.includes("api.stripe.com") &&
    !executeSource.includes("STRIPE_SECRET_KEY") &&
    !executeSource.includes("/cancel") &&
    !executeSource.includes('.from("organisations").delete') &&
    !executeSource.includes('.from("projects").delete') &&
    !executeSource.includes('.from("quotes").delete')
);
const fulfilScript = readFileSync("scripts/fulfil-account-deletion.ts", "utf8");
assert(
  "the operator command reads Stripe and gates Production execution",
  fulfilScript.includes("api.stripe.com/v1/subscriptions/") &&
    fulfilScript.includes("Refusing Production execution") &&
    fulfilScript.includes("--production-dry-run") &&
    fulfilScript.includes("--production-execute") &&
    fulfilScript.includes("--project-ref") &&
    fulfilScript.includes("--dry-run-review") &&
    fulfilScript.includes("PRODUCTION_EXECUTION_RECORD") &&
    readFileSync("lib/account-deletion/operator.ts", "utf8").includes(
      "Production execution is enabled and has not been exercised against a real account"
    ) &&
    executeSource.includes("The dry-run review is no longer current") &&
    !fulfilScript.includes("/cancel")
);
const mismatch = interpretStripeSubscription({
  expectedSubscriptionId: "sub_test",
  expectedCustomerId: "cus_test",
  httpOk: true,
  body: { id: "sub_other", customer: "cus_test", status: "canceled" },
});
const unavailable = interpretStripeSubscription({
  expectedSubscriptionId: "sub_test",
  expectedCustomerId: "cus_test",
  httpOk: false,
  body: null,
});
assert(
  "a Stripe read fails closed on a mismatch or an unavailable provider",
  mismatch.available === false &&
    mismatch.reason === "mismatch" &&
    unavailable.available === false &&
    unavailable.reason === "unavailable"
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
    outcome: historical.outcome,
  }).body === historical.outcome
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
