/**
 * BILLING-UI-01 — Trial banner uses effective entitlement precedence.
 * Fixtures only. No live Stripe. No account-specific IDs.
 *
 * Run: npx tsx scripts/verify-billing-ui-01.ts
 */
import { readFileSync } from "node:fs";
import { resolveEffectiveAccessPolicy } from "../lib/billing/access-policy";
import { evaluateOrgEntitlement } from "../lib/billing/entitlements";
import { canCreatePaidSeatInvitation } from "../lib/billing/seat-mutation-gate";
import { assembleOrgBillingState } from "../lib/billing/state";
import { buildInternalTrialSubscription } from "../lib/billing/trial";
import {
  deriveTrialCountdown,
  resolveTrialBannerNotice,
  trialBannerNotice,
} from "../lib/billing/trial-countdown";
import type {
  OrgBillingOverride,
  OrgBillingState,
  OrgSubscription,
} from "../lib/billing/types";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

const NOW = new Date("2026-09-17T12:00:00.000Z");
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function emptyState(orgId: string): OrgBillingState {
  return {
    orgId,
    billingEnvironment: "test",
    customer: null,
    subscription: null,
    activeOverride: null,
    effectiveTrialState: null,
  };
}

function expiredTrial(orgId: string): OrgSubscription {
  return buildInternalTrialSubscription({
    id: `sub-expired-${orgId.slice(0, 8)}`,
    orgId,
    billingEnvironment: "test",
    now: new Date("2026-09-01T00:00:00.000Z"),
    trialEndsAt: new Date("2026-09-16T10:28:40.435Z"),
  });
}

function activeTrial(orgId: string, daysLeft: number): OrgSubscription {
  const ends = new Date(NOW.getTime() + daysLeft * 24 * 60 * 60 * 1000);
  return buildInternalTrialSubscription({
    id: `sub-active-${orgId.slice(0, 8)}`,
    orgId,
    billingEnvironment: "test",
    now: NOW,
    trialEndsAt: ends,
  });
}

function paidBusiness(orgId: string): OrgSubscription {
  const iso = NOW.toISOString();
  return {
    id: `sub-paid-${orgId.slice(0, 8)}`,
    orgId,
    billingEnvironment: "test",
    planCode: "business",
    status: "active",
    source: "stripe",
    stripeSubscriptionId: "sub_stripe_biz",
    stripeCustomerId: "cus_stripe_biz",
    stripeBasePriceId: "price_base",
    stripeSeatPriceId: "price_seat",
    paidSeatQuantity: 1,
    currentPeriodStart: iso,
    currentPeriodEnd: "2026-10-17T00:00:00.000Z",
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    lastStripeEventCreatedAt: iso,
    lastStripeEventId: "evt_1",
    pastDueSince: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

function compedBusiness(orgId: string, status: string = "administratively_comped"): OrgBillingOverride {
  const iso = NOW.toISOString();
  return {
    id: `ov-${orgId.slice(0, 8)}`,
    orgId,
    billingEnvironment: "test",
    planCode: "business",
    overrideType: "administratively_comped",
    status,
    paidSeatQuantity: 5,
    startsAt: iso,
    expiresAt: null,
    reason: "fixture complimentary business",
    createdBy: null,
    operatorRef: "ops:fixture",
    createdAt: iso,
  };
}

function stateFor(input: {
  orgId: string;
  subscription: OrgSubscription | null;
  override?: OrgBillingOverride | null;
}): OrgBillingState {
  return assembleOrgBillingState({
    orgId: input.orgId,
    billingEnvironment: "test",
    customer: null,
    subscription: input.subscription,
    overrides: input.override ? [input.override] : [],
    now: NOW,
  });
}

function noticeFor(state: OrgBillingState) {
  return resolveTrialBannerNotice({
    subscription: state.subscription,
    activeOverride: state.activeOverride,
    effectiveTrialState: state.effectiveTrialState,
    now: NOW,
  });
}

const layoutSrc = readFileSync("app/(protected)/app/layout.tsx", "utf8");
const countdownSrc = readFileSync("lib/billing/trial-countdown.ts", "utf8");

assert(
  "layout uses resolveTrialBannerNotice (effective entitlement)",
  /resolveTrialBannerNotice/.test(layoutSrc) &&
    !/subscription\?\.source === "internal_trial"/.test(layoutSrc)
);
assert(
  "resolver documents canonical precedence / no raw-source-only banner",
  /policy\.source !== "internal_trial"/.test(countdownSrc) &&
    /resolveEffectiveAccessPolicy/.test(countdownSrc)
);

// --- A. Comped Business + expired historical trial ---
const compedExpired = stateFor({
  orgId: ORG_A,
  subscription: expiredTrial(ORG_A),
  override: compedBusiness(ORG_A),
});
const policyA = resolveEffectiveAccessPolicy({
  subscription: compedExpired.subscription,
  activeOverride: compedExpired.activeOverride,
  now: NOW,
});
const noticeA = noticeFor(compedExpired);
const accessA = evaluateOrgEntitlement({
  state: compedExpired,
  capability: "projects.create",
  mode: "compatibility",
  now: NOW,
});
assert(
  "A: effective access is Business / override",
  policyA.source === "override" &&
    policyA.planCode === "business" &&
    policyA.accessClass === "full" &&
    policyA.trialExpired === false
);
assert("A: banner hidden", noticeA === null);
assert(
  "A: Subscribe warning copy absent",
  noticeA === null ||
    !/Subscribe now to keep creating and sending work/.test(
      `${noticeA.title} ${noticeA.message}`
    )
);
assert("A: projects.create allowed", accessA.ok === true);

// --- B. Paid Business ---
const paid = stateFor({ orgId: ORG_A, subscription: paidBusiness(ORG_A) });
const noticeB = noticeFor(paid);
assert(
  "B: paid Business hides trial banner",
  resolveEffectiveAccessPolicy({
    subscription: paid.subscription,
    activeOverride: paid.activeOverride,
    now: NOW,
  }).source === "stripe" && noticeB === null
);

// --- C. Active trial ---
const active = stateFor({ orgId: ORG_A, subscription: activeTrial(ORG_A, 14) });
const noticeC = noticeFor(active);
const countdownC = deriveTrialCountdown({
  trialEndsAt: active.subscription!.trialEndsAt,
  effectiveTrialState: active.effectiveTrialState,
  now: NOW,
});
assert(
  "C: active trial shows countdown banner",
  noticeC != null &&
    noticeC.tone === "subtle" &&
    countdownC?.daysRemaining === 14 &&
    !noticeC.message.toLowerCase().includes("ended")
);

// --- D. Expired trial, no override ---
const expiredOnly = stateFor({
  orgId: ORG_A,
  subscription: expiredTrial(ORG_A),
});
const noticeD = noticeFor(expiredOnly);
assert(
  "D: expired trial shows Trial ended",
  noticeD?.tone === "expired" &&
    noticeD.title === "Trial ended" &&
    /Choose a plan/.test(noticeD.ctaLabel)
);

// --- E. Revoked override + expired trial ---
const revoked = stateFor({
  orgId: ORG_A,
  subscription: expiredTrial(ORG_A),
  override: compedBusiness(ORG_A, "revoked"),
});
assert(
  "E: revoked override does not stay active",
  revoked.activeOverride === null
);
const noticeE = noticeFor(revoked);
assert(
  "E: Trial ended returns after revoke",
  noticeE?.tone === "expired" && noticeE.title === "Trial ended"
);

// --- F. Cross-tenant isolation ---
const orgAComped = stateFor({
  orgId: ORG_A,
  subscription: expiredTrial(ORG_A),
  override: compedBusiness(ORG_A),
});
const orgBExpired = stateFor({
  orgId: ORG_B,
  subscription: expiredTrial(ORG_B),
});
assert(
  "F: comped org A hides banner; org B still shows Trial ended",
  noticeFor(orgAComped) === null && noticeFor(orgBExpired)?.tone === "expired"
);
assert(
  "F: billingEnvironment stays test for both fixtures",
  orgAComped.billingEnvironment === "test" &&
    orgBExpired.billingEnvironment === "test" &&
    orgAComped.activeOverride?.billingEnvironment === "test"
);

// --- G. No flash: initial rendered notice for comped has no expired copy ---
const initialCompedNotice = resolveTrialBannerNotice({
  subscription: expiredTrial(ORG_A),
  activeOverride: compedBusiness(ORG_A),
  effectiveTrialState: "trial_expired",
  now: NOW,
});
assert(
  "G: comped initial notice is null (no expired-trial flash copy)",
  initialCompedNotice === null
);
assert(
  "G: layout resolves billing server-side before AppShell (no client billing fetch for banner)",
  /await Promise\.all\(/.test(layoutSrc) &&
    /getOrgBillingState\(auth\.orgId\)/.test(layoutSrc) &&
    /billingNotice=\{billingNotice\}/.test(layoutSrc) &&
    !/useEffect[\s\S]*billingNotice/.test(layoutSrc)
);

// --- H. Access non-regression + seat gate ---
assert(
  "H: comped Business allows project creation",
  evaluateOrgEntitlement({
    state: orgAComped,
    capability: "projects.create",
    mode: "compatibility",
    now: NOW,
  }).ok === true
);
assert(
  "H: ordinary expired test account remains restricted",
  evaluateOrgEntitlement({
    state: orgBExpired,
    capability: "projects.create",
    mode: "compatibility",
    now: NOW,
  }).ok === false
);
assert(
  "H: Stripe seat gate unchanged under complimentary override",
  canCreatePaidSeatInvitation(orgAComped).ok === false
);

// Sanity: raw countdown alone would still show expired — banner must use policy
const rawWouldShow = trialBannerNotice(
  deriveTrialCountdown({
    trialEndsAt: expiredTrial(ORG_A).trialEndsAt,
    effectiveTrialState: "trial_expired",
    now: NOW,
  })
);
assert(
  "raw countdown still expired; effective resolver overrides it for comps",
  rawWouldShow?.tone === "expired" && noticeFor(orgAComped) === null
);

assert("empty uninitialized has no banner", noticeFor(emptyState(ORG_A)) === null);

if (process.exitCode) {
  console.log("\nBILLING-UI-01 FAILED");
} else {
  console.log("\nBILLING-UI-01 PASSED");
}
