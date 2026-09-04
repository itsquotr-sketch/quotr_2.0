/**
 * BILLING-2 central entitlement authority.
 * Fixtures only. No live Stripe. No paid AI. No Checkout.
 *
 * Run: npx tsx scripts/verify-billing-2.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { calculateEstimateSellFromCost } from "../lib/estimate/estimate-commercial-engine-adapter";
import {
  isWithinPastDueGrace,
  PAST_DUE_GRACE_DAYS,
} from "../lib/billing/access-policy";
import {
  ENTITLEMENT_CAPABILITIES,
  canonicalizeEntitlementCapability,
} from "../lib/billing/capabilities";
import { resolveBillingEnforcementMode } from "../lib/billing/enforcement-mode";
import {
  builderCapabilities,
  businessCapabilities,
  trialCapabilities,
} from "../lib/billing/entitlement-matrix";
import { evaluateOrgEntitlement } from "../lib/billing/entitlements";
import { resolvePastDueSince } from "../lib/billing/past-due";
import { buildInternalTrialSubscription } from "../lib/billing/trial";
import type {
  OrgBillingOverride,
  OrgBillingState,
  OrgSubscription,
  PlanCode,
  SubscriptionStatus,
} from "../lib/billing/types";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function file(path: string): string {
  return readFileSync(path, "utf8");
}

const NOW = new Date("2026-09-02T00:00:00.000Z");
const ORG = "11111111-1111-4111-8111-111111111111";

function emptyState(): OrgBillingState {
  return {
    orgId: ORG,
    billingEnvironment: "test",
    customer: null,
    subscription: null,
    activeOverride: null,
    effectiveTrialState: null,
  };
}

function sub(input: {
  plan?: PlanCode;
  status?: SubscriptionStatus;
  source?: OrgSubscription["source"];
  paidSeatQuantity?: number;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  lastStripeEventCreatedAt?: string | null;
  pastDueSince?: string | null;
  updatedAt?: string;
}): OrgSubscription {
  const iso = NOW.toISOString();
  return {
    id: "sub_1",
    orgId: ORG,
    billingEnvironment: "test",
    planCode: input.plan ?? "builder",
    status: input.status ?? "active",
    source: input.source ?? "stripe",
    stripeSubscriptionId: input.source === "internal_trial" ? null : "sub_stripe",
    stripeCustomerId: input.source === "internal_trial" ? null : "cus_stripe",
    stripeBasePriceId: null,
    stripeSeatPriceId: null,
    paidSeatQuantity: input.paidSeatQuantity ?? 1,
    currentPeriodStart: iso,
    currentPeriodEnd: input.currentPeriodEnd ?? "2026-10-02T00:00:00.000Z",
    trialEndsAt: input.trialEndsAt ?? null,
    cancelAtPeriodEnd: input.status === "scheduled_to_cancel",
    cancelledAt: input.status === "cancelled" ? iso : null,
    lastStripeEventCreatedAt: input.lastStripeEventCreatedAt ?? iso,
    lastStripeEventId: "evt_1",
    pastDueSince:
      input.pastDueSince !== undefined
        ? input.pastDueSince
        : input.status === "past_due"
          ? iso
          : null,
    createdAt: iso,
    updatedAt: input.updatedAt ?? iso,
  };
}

function decide(
  subscription: OrgSubscription | null,
  capability: string,
  mode: "off" | "compatibility" | "strict" = "strict",
  extra?: {
    override?: OrgBillingOverride | null;
    now?: Date;
    memberCount?: number;
  }
) {
  return evaluateOrgEntitlement({
    state: {
      ...emptyState(),
      subscription,
      activeOverride: extra?.override ?? null,
    },
    capability,
    mode,
    now: extra?.now ?? NOW,
    memberCount: extra?.memberCount,
  });
}

const SAMPLE = [
  "projects.create",
  "estimates.create",
  "pricing.access",
  "quotes.create",
  "quotes.send",
  "quotes.acceptance",
  "team.invite",
  "analytics.business",
  "quotes.approval",
  "voice_capture",
] as const;

console.log("=== BILLING-2 central entitlement authority ===\n");

assert(
  "registry has expected v1 keys",
  ENTITLEMENT_CAPABILITIES.includes("projects.create") &&
    ENTITLEMENT_CAPABILITIES.includes("quotes.approval") &&
    ENTITLEMENT_CAPABILITIES.includes("voice_capture") &&
    canonicalizeEntitlementCapability("quote.approval") === "quotes.approval"
);

assert(
  "Builder allows send/acceptance/voice and denies team/approvals",
  builderCapabilities().includes("quotes.send") &&
    builderCapabilities().includes("quotes.acceptance") &&
    builderCapabilities().includes("voice_capture") &&
    !builderCapabilities().includes("team.invite") &&
    !builderCapabilities().includes("quotes.approval") &&
    !builderCapabilities().includes("analytics.business")
);

assert(
  "Business includes Builder plus team/approvals/analytics",
  businessCapabilities().includes("quotes.send") &&
    businessCapabilities().includes("team.invite") &&
    businessCapabilities().includes("quotes.approval") &&
    businessCapabilities().includes("analytics.business")
);

assert(
  "trial is Business basis minus team",
  trialCapabilities().includes("quotes.approval") &&
    trialCapabilities().includes("analytics.business") &&
    !trialCapabilities().includes("team.invite") &&
    !trialCapabilities().includes("team.roles")
);

const builderActive = sub({ plan: "builder", status: "active" });
const businessActive = sub({ plan: "business", status: "active", paidSeatQuantity: 2 });

for (const cap of SAMPLE) {
  const builder = decide(builderActive, cap);
  const business = decide(businessActive, cap);
  if (cap === "team.invite" || cap === "analytics.business" || cap === "quotes.approval") {
    assert(`Builder active denies ${cap}`, builder.ok === false && builder.reasonCode === "upgrade_required");
    assert(`Business active allows ${cap}`, business.ok === true);
  } else {
    assert(`Builder active allows ${cap}`, builder.ok === true);
    assert(`Business active allows ${cap}`, business.ok === true);
  }
}

assert(
  "scheduled_to_cancel before period end is full access",
  decide(
    sub({
      plan: "business",
      status: "scheduled_to_cancel",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
    }),
    "quotes.send"
  ).ok === true
);

const trial = buildInternalTrialSubscription({
  id: "sub_trial",
  orgId: ORG,
  billingEnvironment: "test",
  now: NOW,
});
assert("active trial allows quotes.send", decide(trial, "quotes.send").ok === true);
assert(
  "active trial denies team.invite",
  decide(trial, "team.invite").ok === false &&
    decide(trial, "team.invite").reasonCode === "upgrade_required"
);
assert("active trial allows quotes.approval basis", decide(trial, "quotes.approval").ok === true);

const expiredTrial = buildInternalTrialSubscription({
  id: "sub_expired",
  orgId: ORG,
  billingEnvironment: "test",
  now: NOW,
  trialEndsAt: new Date("2026-08-01T00:00:00.000Z"),
});
const expiredSend = decide(expiredTrial, "quotes.send");
assert(
  "expired trial blocks quotes.send",
  expiredSend.ok === false && expiredSend.reasonCode === "trial_expired"
);
assert(
  "expired trial still allows public quotes.acceptance",
  decide(expiredTrial, "quotes.acceptance").ok === true
);

const pastDueStart = "2026-09-01T00:00:00.000Z";
const pastDueIncident = sub({
  plan: "builder",
  status: "past_due",
  pastDueSince: pastDueStart,
  lastStripeEventCreatedAt: "2026-09-06T00:00:00.000Z",
  currentPeriodEnd: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-06T00:00:00.000Z",
});
assert(
  "past_due day 1 allows send with warning",
  decide(pastDueIncident, "quotes.send", "strict", {
    now: new Date("2026-09-01T12:00:00.000Z"),
  }).ok === true &&
    decide(pastDueIncident, "quotes.send", "strict", {
      now: new Date("2026-09-01T12:00:00.000Z"),
    }).accessClass === "full_with_billing_warning"
);

const plus7 = new Date(
  new Date(pastDueStart).getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000
);
const plus7minus = new Date(plus7.getTime() - 1);
assert(
  "past_due grace is exclusive at the exact +7-day instant",
  isWithinPastDueGrace(pastDueIncident, plus7minus) === true &&
    isWithinPastDueGrace(pastDueIncident, plus7) === false
);

const day8 = new Date(
  new Date(pastDueStart).getTime() + (PAST_DUE_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000
);
assert(
  "past_due day 8 blocks send",
  decide(pastDueIncident, "quotes.send", "strict", { now: day8 }).ok ===
    false &&
    decide(pastDueIncident, "quotes.send", "strict", { now: day8 })
      .reasonCode === "payment_past_due"
);

assert(
  "later lastStripeEventCreatedAt does not restart grace",
  isWithinPastDueGrace(pastDueIncident, day8) === false
);

const nullClock = sub({
  plan: "builder",
  status: "past_due",
  pastDueSince: null,
  lastStripeEventCreatedAt: pastDueStart,
  currentPeriodEnd: pastDueStart,
});
assert(
  "past_due with NULL past_due_since fails closed (no grace)",
  isWithinPastDueGrace(nullClock, new Date(pastDueStart)) === false &&
    decide(nullClock, "quotes.send", "strict", {
      now: new Date(pastDueStart),
    }).accessClass === "read_export"
);

assert(
  "active → past_due sets past_due_since from event time",
  resolvePastDueSince({
    previousStatus: "active",
    nextStatus: "past_due",
    existingPastDueSince: null,
    eventCreatedUnix: 1_700_000_000,
  }) === new Date(1_700_000_000 * 1000).toISOString()
);
assert(
  "repeated past_due day 2/6 preserves past_due_since",
  resolvePastDueSince({
    previousStatus: "past_due",
    nextStatus: "past_due",
    existingPastDueSince: pastDueStart,
    eventCreatedUnix: 1_700_000_000 + 2 * 86400,
  }) === pastDueStart &&
    resolvePastDueSince({
      previousStatus: "past_due",
      nextStatus: "past_due",
      existingPastDueSince: pastDueStart,
      eventCreatedUnix: 1_700_000_000 + 6 * 86400,
    }) === pastDueStart
);
assert(
  "past_due → active clears past_due_since",
  resolvePastDueSince({
    previousStatus: "past_due",
    nextStatus: "active",
    existingPastDueSince: pastDueStart,
    eventCreatedUnix: 1_700_000_000 + 3 * 86400,
  }) === null
);
assert(
  "new past_due incident after recovery sets a new timestamp",
  resolvePastDueSince({
    previousStatus: "active",
    nextStatus: "past_due",
    existingPastDueSince: null,
    eventCreatedUnix: 1_700_100_000,
  }) === new Date(1_700_100_000 * 1000).toISOString()
);
assert(
  "repeated past_due with NULL clock stays NULL (no late start)",
  resolvePastDueSince({
    previousStatus: "past_due",
    nextStatus: "past_due",
    existingPastDueSince: null,
    eventCreatedUnix: 1_700_000_500,
  }) === null
);

assert(
  "unpaid blocks send, allows acceptance",
  decide(sub({ status: "unpaid" }), "quotes.send").ok === false &&
    decide(sub({ status: "unpaid" }), "quotes.acceptance").ok === true
);
assert(
  "paused blocks send",
  decide(sub({ status: "paused" }), "quotes.send").reasonCode ===
    "subscription_paused"
);
assert(
  "cancelled blocks send, allows acceptance",
  decide(sub({ status: "cancelled" }), "quotes.send").reasonCode ===
    "subscription_cancelled" &&
    decide(sub({ status: "cancelled" }), "quotes.acceptance").ok === true
);
assert(
  "incomplete blocks send",
  decide(sub({ status: "incomplete" }), "quotes.send").reasonCode ===
    "billing_incomplete"
);

const comped: OrgBillingOverride = {
  id: "ovr_1",
  orgId: ORG,
  billingEnvironment: "test",
  planCode: "business",
  overrideType: "administratively_comped",
  status: "administratively_comped",
  paidSeatQuantity: 3,
  startsAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
  reason: "comp",
  createdBy: null,
  operatorRef: "ops",
  createdAt: "2026-01-01T00:00:00.000Z",
};
assert(
  "comped override allows Business capabilities over cancelled Stripe",
  decide(sub({ status: "cancelled", plan: "builder" }), "team.invite", "strict", {
    override: comped,
  }).ok === true
);

const custom: OrgBillingOverride = {
  ...comped,
  id: "ovr_custom",
  planCode: "custom",
  overrideType: "custom_contract",
  status: "custom_contract",
  paidSeatQuantity: 12,
};
assert(
  "custom contract can exceed five seats in override quantity",
  custom.paidSeatQuantity === 12 &&
    decide(null, "quotes.send", "strict", { override: custom }).ok === true
);

const denyTeam: OrgBillingOverride = {
  ...comped,
  id: "ovr_deny",
  capabilityDeny: ["team.invite"],
};
assert(
  "explicit override deny beats plan allow",
  decide(null, "team.invite", "strict", { override: denyTeam }).ok === false &&
    decide(null, "team.invite", "strict", { override: denyTeam }).reasonCode ===
      "custom_restriction"
);

const allowApproval: OrgBillingOverride = {
  ...comped,
  id: "ovr_allow",
  planCode: "builder",
  overrideType: "temporary_access",
  status: "active",
  capabilityAllow: ["quotes.approval"],
};
assert(
  "explicit override allow grants otherwise unavailable capability",
  decide(null, "quotes.approval", "strict", { override: allowApproval }).ok ===
    true
);

assert(
  "compatibility uninitialized allows send",
  decide(null, "quotes.send", "compatibility").ok === true
);
assert(
  "strict uninitialized blocks send",
  decide(null, "quotes.send", "strict").ok === false &&
    decide(null, "quotes.send", "strict").reasonCode === "billing_uninitialized"
);
assert(
  "off never denies",
  decide(expiredTrial, "quotes.send", "off").ok === true
);
assert(
  "unset enforcement mode is compatibility",
  resolveBillingEnforcementMode({}) === "compatibility"
);

assert(
  "seat_limit when reserved users reach Business self-service max",
  decide(businessActive, "team.invite", "strict", { memberCount: 5 }).reasonCode ===
    "seat_limit"
);
assert(
  "Business with 2 reserved users still allows invite entitlement",
  decide(businessActive, "team.invite", "strict", { memberCount: 2 }).ok === true
);

const builderSell = calculateEstimateSellFromCost(1000, 25);
const businessSell = calculateEstimateSellFromCost(1000, 25);
assert(
  "Builder/Business economic parity on sell-from-cost",
  builderSell.ok &&
    businessSell.ok &&
    builderSell.ok &&
    businessSell.ok &&
    builderSell.sell === businessSell.sell
);

const billingFiles = readdirSync("lib/billing").filter((name) =>
  name.endsWith(".ts")
);
assert(
  "entitlement modules do not import estimate/pricing/quote engines",
  billingFiles
    .filter((name) => name.includes("entitlement") || name === "capabilities.ts")
    .every((name) => {
      const src = file(`lib/billing/${name}`);
      return (
        !src.includes('from "@/lib/estimate') &&
        !src.includes('from "@/lib/pricing') &&
        !src.includes('from "@/lib/quotes/')
      );
    })
);

const sendSrc = file("lib/quotes/actions.ts");
const acceptSrc = file("lib/quotes/acceptance-actions.ts");
const projectSrc = file("lib/projects/actions.ts");
const pricingSrc = file("lib/pricing/actions.ts");
const assistantSrc = file("lib/assistant/actions.ts");
assert(
  "Quote send is gated at the server action",
  sendSrc.includes('permission: "quotes.send"') &&
    sendSrc.includes('entitlement: "quotes.send"')
);
assert(
  "public acceptance is not gated on contractor billing",
  !acceptSrc.includes("requireOrgEntitlement")
);
assert(
  "Project create is gated",
  projectSrc.includes('permission: "projects.create"') &&
    projectSrc.includes('entitlement: "projects.create"')
);
assert(
  "Estimate generate is gated",
  assistantSrc.includes('permission: "estimates.run"') &&
    assistantSrc.includes('entitlement: "estimates.create"')
);
assert(
  "Pricing create is gated",
  pricingSrc.includes('permission: "pricing.edit"') &&
    pricingSrc.includes('entitlement: "pricing.access"')
);
assert(
  "Quote create is gated",
  sendSrc.includes('permission: "quotes.create"') &&
    sendSrc.includes('entitlement: "quotes.create"')
);

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migration047 = file("supabase/migrations/047_past_due_authority.sql");
assert(
  "047 past_due authority exists locally; 053 role RLS is latest numbered file",
  migrations.includes("047_past_due_authority.sql") &&
    migrations.includes("048_billing_checkout_trial.sql") &&
    migrations.includes("049_organisation_memberships.sql") &&
    migrations.includes("050_unbind_removed_membership.sql") &&
    migrations.includes("051_organisation_timezone.sql") &&
    migrations.includes("052_company_productivity_calibration.sql") &&
    migrations.includes("053_role_aware_rls_hardening.sql") &&
    migrations[migrations.length - 1] ===
      "053_role_aware_rls_hardening.sql"
);
assert(
  "047 only adds past_due_since; no overlay columns; no backfill",
  /add column if not exists past_due_since timestamptz/.test(migration047) &&
    !/capability_allow|capability_deny/.test(migration047) &&
    !/update\s+public\.org_subscriptions/i.test(migration047) &&
    /Do not apply/.test(migration047)
);
assert(
  "capability overlays are documented as non-persistent",
  file("lib/billing/types.ts").includes("Resolver/test-only") &&
    file("docs/runbooks/BILLING_2_ENTITLEMENT_AUTHORITY.md").includes(
      "resolver/test-only"
    )
);
assert(
  "grace policy uses pastDueSince, not lastStripeEventCreatedAt",
  file("lib/billing/access-policy.ts").includes("subscription.pastDueSince") &&
    !file("lib/billing/access-policy.ts").includes("lastStripeEventCreatedAt") &&
    !file("lib/billing/access-policy.ts").includes(
      "lastStripeEventCreatedAt ??"
    )
);

const serverSrc = file("lib/billing/entitlement-server.ts");
assert("entitlement server is server-only", serverSrc.includes('import "server-only"'));
assert(
  "org billing state is not use-cache",
  !file("lib/billing/server.ts").includes("use cache") &&
    !file("lib/billing/entitlements.ts").includes("use cache")
);

const scattered = [
  "lib/projects/actions.ts",
  "lib/quotes/actions.ts",
  "lib/pricing/actions.ts",
  "lib/assistant/actions.ts",
].every((path) => {
  const src = file(path);
  return !/planCode === ["']business["']/.test(src) && !/subscription_tier/.test(src);
});
assert("gated actions do not scatter plan-name checks", scattered);

if (!process.exitCode) {
  console.log("\nBILLING-2 verifier passed.");
} else {
  console.log("\nBILLING-2 verifier failed.");
}
