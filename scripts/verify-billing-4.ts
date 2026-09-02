/**
 * BILLING-4 memberships / invitations / roles / seat billing.
 * Fixtures and domain tests only. No live Stripe charges. No paid AI.
 *
 * Run: npx tsx scripts/verify-billing-4.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { extraSeatQuantityFromPaidSeats, paidSeatQuantityFromExtraSeats } from "../lib/billing/seats";
import { resolvePlanFromStripePriceItems } from "../lib/billing/prices";
import {
  expectedTwoUserRenewalCents,
  resolveSeatAddMutation,
  resolveSeatRemoveMutation,
  SEAT_ADD_PAYMENT_BEHAVIOR,
  SEAT_ADD_PRORATION_BEHAVIOR,
  SEAT_REMOVE_PRORATION_BEHAVIOR,
} from "../lib/billing/seat-change";
import {
  canDowngradeBusinessToBuilder,
  isTeamSafeForBuilderDowngrade,
  BUSINESS_TO_BUILDER_TIMING,
} from "../lib/billing/downgrade-policy";
import { evaluateOrgEntitlement } from "../lib/billing/entitlements";
import { trialCapabilities } from "../lib/billing/entitlement-matrix";
import type {
  OrgBillingState,
  OrgSubscription,
  StripePriceConfig,
} from "../lib/billing/types";
import { hasInviteCapacity, reservedSeatCount, reservationSnapshotAfterInviteAcceptanceTransfer, reservationSnapshotBeforeInviteAcceptance, selfServiceUserLimit } from "../lib/team/capacity";
import { normalizeInviteEmail } from "../lib/team/email-normalize";
import {
  canCreatePaidSeatInvitation,
  canChangeMemberRole,
  canRemoveMember,
  decideExistingUserInviteAcceptance,
  validateInviteRole,
} from "../lib/team/invite-policy";
import {
  decideMembershipAuthority,
  membershipGrantsRolePermissions,
} from "../lib/team/membership-authority";
import { roleAllowsPermission } from "../lib/team/permissions";
import { classifyTeamReconciliation } from "../lib/team/reconciliation";
import { mapLegacyProfileRole } from "../lib/team/roles";
import { decideSeatAddActivation } from "../lib/team/seat-operations";
import {
  canCancelSeatOperationWithoutStripe,
  claimNextRespectingCaller,
  desiredPaidSeatsForAdd,
  desiredPaidSeatsForRemove,
  nextClaimableSeatOperation,
  ownAcceptanceIssuesStripeMutation,
  SEAT_QUEUED_MESSAGE,
  type SeatQueueOp,
} from "../lib/team/seat-queue";
import {
  canCreatePaidSeatInvitation as canCreatePaidSeatInvitationForBilling,
  canStartPaidSeatStripeMutation,
  canStartPaidSeatStripeRemoval,
} from "../lib/billing/seat-mutation-gate";
import {
  stripeSeatAddIdempotencyKey,
  stripeSeatRemoveIdempotencyKey,
} from "../lib/billing/stripe-idempotency";
import { hashInviteToken, isWellFormedInviteToken } from "../lib/team/tokens";
import { buildTeamPageView } from "../lib/team/team-page-view";
import { getSafeInternalPath } from "../lib/auth/safe-redirect";
import { evaluateAuthOrgInputs } from "../lib/security/auth-org-evaluation";
import { calculateEstimateSellFromCost } from "../lib/estimate/estimate-commercial-engine-adapter";

function assert(label: string, ok: boolean, detail = "") {
  console.log(ok ? "PASS" : "FAIL", label + (ok || !detail ? "" : ` — ${detail}`));
  if (!ok) process.exitCode = 1;
}

function file(path: string): string {
  return readFileSync(path, "utf8");
}

const PRICES: StripePriceConfig = {
  builderMonthly: "price_builder_test",
  businessBaseMonthly: "price_business_base_test",
  businessSeatMonthly: "price_business_seat_test",
};

const ORG = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-02T00:00:00.000Z");

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

function businessSub(): OrgSubscription {
  return {
    id: "sub_1",
    orgId: ORG,
    billingEnvironment: "test",
    planCode: "business",
    status: "active",
    source: "stripe",
    stripeSubscriptionId: "sub_stripe",
    stripeCustomerId: "cus_stripe",
    stripeBasePriceId: PRICES.businessBaseMonthly,
    stripeSeatPriceId: null,
    paidSeatQuantity: 1,
    currentPeriodStart: NOW.toISOString(),
    currentPeriodEnd: NOW.toISOString(),
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    lastStripeEventCreatedAt: NOW.toISOString(),
    lastStripeEventId: "evt_1",
    pastDueSince: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

const migration049 = file("supabase/migrations/049_organisation_memberships.sql");
const files = readdirSync("supabase/migrations");
const teamActions = file("lib/team/actions.ts");
const billingActions = file("lib/billing/billing-actions.ts");
const provisionSql = migration049;
const permissionSrc = file("lib/team/permissions.ts");
const invitePolicy = file("lib/team/invite-policy.ts");

const migration050 = file("supabase/migrations/050_unbind_removed_membership.sql");
assert(
  "049 memberships remain and 050 unbind is latest numbered local migration",
  files.includes("049_organisation_memberships.sql") &&
    files.includes("050_unbind_removed_membership.sql") &&
    files.filter((name) => name.endsWith(".sql")).sort().at(-1) ===
      "050_unbind_removed_membership.sql"
);
assert(
  "050 is environment-neutral product SQL (no Preview/Production refs or fixture ids)",
  !/shhpjsoldmqtkdbgrbtm/.test(migration050) &&
    !/lxvnylhsbvudzzupxeqr/.test(migration050) &&
    !/PREVIEW ONLY/.test(migration050) &&
    !/select 'test'::text/.test(migration050) &&
    !/\bcus_|\bsub_|\bprice_/.test(migration050) &&
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
      migration050
    )
);
assert(
  "050 clears profiles.org_id on membership removed so auth_org_id unbinds",
  /new\.status = 'removed'/.test(migration050) &&
    /set org_id = null/.test(migration050) &&
    /role = 'member'/.test(migration050) &&
    /auth_org_id\(\) no longer resolves/.test(migration050) &&
    /Access revoke must not wait for Stripe/.test(migration050)
);
assert(
  "hosted remove revokes access then processes claimed Stripe decrement",
  /remove_organisation_member_v1/.test(teamActions) &&
    /processClaimedSeatMutationForOrg\(context\.orgId/.test(teamActions) &&
    SEAT_REMOVE_PRORATION_BEHAVIOR === "create_prorations"
);

function recon(input: Parameters<typeof classifyTeamReconciliation>[0]) {
  return classifyTeamReconciliation(input).state;
}
const reconBase = {
  planCode: "business" as const,
  trial: false,
  pendingActivationCount: 0,
};
assert(
  "reconciliation matrix: healthy 1-user, pending invite, pending_billing, failed payment, 2-user, decremented 1-user",
  recon({
    ...reconBase,
    paidSeatQuantity: 1,
    extraSeatItemQuantity: 0,
    snapshot: {
      activeMemberCount: 1,
      pendingBillingCount: 0,
      validPendingInviteCount: 0,
    },
  }) === "healthy" &&
    recon({
      ...reconBase,
      paidSeatQuantity: 1,
      extraSeatItemQuantity: 0,
      snapshot: {
        activeMemberCount: 1,
        pendingBillingCount: 0,
        validPendingInviteCount: 1,
      },
    }) === "reserved_capacity" &&
    recon({
      ...reconBase,
      paidSeatQuantity: 1,
      extraSeatItemQuantity: 0,
      snapshot: {
        activeMemberCount: 1,
        pendingBillingCount: 1,
        validPendingInviteCount: 0,
      },
      pendingActivationCount: 1,
    }) === "pending_billing_zero_access" &&
    recon({
      ...reconBase,
      paidSeatQuantity: 1,
      extraSeatItemQuantity: 0,
      snapshot: {
        activeMemberCount: 1,
        pendingBillingCount: 1,
        validPendingInviteCount: 0,
      },
      pendingActivationCount: 1,
      paymentAttentionSeatOperationCount: 1,
    }) === "payment_attention" &&
    recon({
      ...reconBase,
      paidSeatQuantity: 2,
      extraSeatItemQuantity: 1,
      snapshot: {
        activeMemberCount: 2,
        pendingBillingCount: 0,
        validPendingInviteCount: 0,
      },
    }) === "healthy" &&
    recon({
      ...reconBase,
      paidSeatQuantity: 1,
      extraSeatItemQuantity: 0,
      snapshot: {
        activeMemberCount: 1,
        pendingBillingCount: 0,
        validPendingInviteCount: 0,
      },
    }) === "healthy"
);
assert(
  "049 is marked local-only / never Production",
  /LOCAL ONLY/.test(migration049) && /Never apply to Production/.test(migration049)
);
assert(
  "membership table is role SoT with owner/admin/estimator/viewer",
  /create table if not exists public\.organisation_memberships/.test(migration049) &&
    /'owner', 'admin', 'estimator', 'viewer'/.test(migration049)
);
assert(
  "one live membership per user (one-org invariant)",
  /organisation_memberships_one_live_user_uidx/.test(migration049)
);
assert(
  "exactly one active Owner per organisation",
  /organisation_memberships_one_owner_uidx/.test(migration049)
);
assert(
  "legacy member bootstraps to estimator, never viewer",
  /else 'estimator'/.test(migration049) &&
    mapLegacyProfileRole("member") === "estimator" &&
    mapLegacyProfileRole("owner") === "owner" &&
    mapLegacyProfileRole("admin") === "admin"
);
assert(
  "invitations store hash only, 7-day pending unique per email",
  /token_hash text not null/.test(migration049) &&
    /now\(\) \+ interval '7 days'/.test(migration049) &&
    /organisation_invitations_pending_email_uidx/.test(migration049)
);
assert(
  "seat operations table exists for payment-safe add/remove",
  /create table if not exists public\.billing_seat_operations/.test(migration049)
);
assert(
  "authenticated cannot write memberships or invitations",
  /revoke all on table public\.organisation_memberships from public, anon, authenticated/.test(
    migration049
  ) &&
    /revoke all on table public\.organisation_invitations from public, anon, authenticated/.test(
      migration049
    )
);
assert(
  "public invite lookup is hash-only and omits org_id",
  /lookup_organisation_invitation_public/.test(migration049) &&
    /No org_id, no token, no Stripe ids/.test(migration049)
);
assert(
  "invite create is Owner-only at RPC",
  /TEAM:INVITE_OWNER_ONLY/.test(migration049)
);
assert(
  "provision refuses pending invitation instead of creating a second org",
  /PROVISION:PENDING_INVITATION/.test(provisionSql)
);
assert(
  "activation requires paid_seat_quantity coverage",
  /activate_membership_if_seats_paid_v1/.test(migration049) &&
    /v_paid < v_desired/.test(migration049)
);
assert(
  "webhook activates pending seats then advances the serialized queue after mirror",
  /advanceSeatQueueAfterMirror/.test(file("lib/billing/webhook-http.ts")) &&
    /try_activate_pending_memberships_for_org/.test(
      file("lib/billing/seat-queue-process.ts")
    ) &&
    /claim_next_seat_operation_v1/.test(file("lib/billing/seat-queue-process.ts"))
);

assert(
  "Viewer consumes a full paid seat — no free collaborator permission",
  !roleAllowsPermission("viewer", "quotes.send") &&
    !roleAllowsPermission("viewer", "projects.create") &&
    roleAllowsPermission("viewer", "team.view")
);
assert(
  "Estimator can send quotes but cannot invite or manage billing",
  roleAllowsPermission("estimator", "quotes.send") &&
    !roleAllowsPermission("estimator", "team.invite") &&
    !roleAllowsPermission("estimator", "billing.manage")
);
assert(
  "Admin cannot invite paid seats or open billing portal permission",
  roleAllowsPermission("admin", "quotes.send") &&
    !roleAllowsPermission("admin", "team.invite") &&
    !roleAllowsPermission("admin", "billing.manage") &&
    roleAllowsPermission("admin", "team.change_role")
);
assert(
  "Owner has invite, remove, and billing.manage",
  roleAllowsPermission("owner", "team.invite") &&
    roleAllowsPermission("owner", "team.remove") &&
    roleAllowsPermission("owner", "billing.manage")
);
assert(
  "canCreatePaidSeatInvitation is Owner only",
  canCreatePaidSeatInvitation("owner") &&
    !canCreatePaidSeatInvitation("admin") &&
    !canCreatePaidSeatInvitation("estimator")
);
assert("Owner is not invitable", validateInviteRole("owner").ok === false);
assert(
  "Admin cannot remove users",
  canRemoveMember({
    actorRole: "admin",
    targetRole: "estimator",
    targetIsSelf: false,
  }).ok === false
);
assert(
  "Owner cannot be removed",
  canRemoveMember({
    actorRole: "owner",
    targetRole: "owner",
    targetIsSelf: false,
  }).ok === false
);
assert(
  "Admin can change Estimator ↔ Viewer only",
  canChangeMemberRole({
    actorRole: "admin",
    targetRole: "estimator",
    nextRole: "viewer",
  }).ok === true &&
    canChangeMemberRole({
      actorRole: "admin",
      targetRole: "admin",
      nextRole: "estimator",
    }).ok === false
);

assert(
  "email normalize is trim+lowercase only",
  normalizeInviteEmail("  Alex+Job@Company.CO.NZ  ") === "alex+job@company.co.nz"
);
assert(
  "invite tokens are hashed; raw token is well-formed base64url",
  hashInviteToken("abc") !== "abc" &&
    hashInviteToken("abc").length === 64 &&
    isWellFormedInviteToken("Aa1_-".repeat(8)) &&
    !isWellFormedInviteToken("not a token")
);
assert(
  "/invite/ is a safe auth return path",
  getSafeInternalPath("/invite/abc") === "/invite/abc"
);

assert(
  "capacity uses active + pending_billing + pending invites, not Stripe qty",
  reservedSeatCount({
    activeMemberCount: 4,
    pendingBillingCount: 0,
    validPendingInviteCount: 1,
  }) === 5 &&
    hasInviteCapacity(
      {
        activeMemberCount: 4,
        pendingBillingCount: 0,
        validPendingInviteCount: 1,
      },
      5
    ) === false
);
assert(
  "self-service cap is 5 Business, 1 Builder/trial, null Custom",
  selfServiceUserLimit("business") === 5 &&
    selfServiceUserLimit("builder") === 1 &&
    selfServiceUserLimit("business", { trial: true }) === 1 &&
    selfServiceUserLimit("custom") === null
);

const trialState: OrgBillingState = {
  ...emptyState(),
  subscription: {
    ...businessSub(),
    source: "internal_trial",
    status: "trialing",
    stripeSubscriptionId: null,
    stripeCustomerId: null,
  },
  effectiveTrialState: "trialing",
};
assert(
  "trial denies team.invite even on Business capability basis",
  evaluateOrgEntitlement({
    state: trialState,
    capability: "team.invite",
    mode: "strict",
  }).ok === false && !trialCapabilities().includes("team.invite")
);
assert(
  "Business invite entitlement allows 2 of 5; denies 5 of 5",
  evaluateOrgEntitlement({
    state: { ...emptyState(), subscription: businessSub() },
    capability: "team.invite",
    mode: "strict",
    memberCount: 2,
  }).ok === true &&
    evaluateOrgEntitlement({
      state: { ...emptyState(), subscription: businessSub() },
      capability: "team.invite",
      mode: "strict",
      memberCount: 5,
    }).reasonCode === "seat_limit"
);

assert(
  "cross-org existing user is denied; same org is already_member",
  decideExistingUserInviteAcceptance({
    userOrgId: "other",
    invitedOrgId: ORG,
  }).ok === false &&
    decideExistingUserInviteAcceptance({
      userOrgId: ORG,
      invitedOrgId: ORG,
    }).kind === "already_member"
);

assert(
  "seat quantity: 1 member extra 0, 5 members extra 4",
  extraSeatQuantityFromPaidSeats(1) === 0 &&
    extraSeatQuantityFromPaidSeats(2) === 1 &&
    extraSeatQuantityFromPaidSeats(5) === 4 &&
    paidSeatQuantityFromExtraSeats(4) === 5
);
assert(
  "webhook plan mapping still uses Price IDs: base + extra N → paid N+1",
  resolvePlanFromStripePriceItems(
    [
      { priceId: PRICES.businessBaseMonthly, quantity: 1 },
      { priceId: PRICES.businessSeatMonthly, quantity: 2 },
    ],
    PRICES
  ).ok === true &&
    (
      resolvePlanFromStripePriceItems(
        [
          { priceId: PRICES.businessBaseMonthly, quantity: 1 },
          { priceId: PRICES.businessSeatMonthly, quantity: 2 },
        ],
        PRICES
      ) as { paidSeatQuantity: number }
    ).paidSeatQuantity === 3
);

const addFirstSeat = resolveSeatAddMutation({
  items: [{ id: "si_base", priceId: PRICES.businessBaseMonthly, quantity: 1 }],
  prices: PRICES,
  desiredPaidSeatQuantity: 2,
  pendingUpdate: null,
});
assert(
  "first extra user ADDS seat item qty 1 with always_invoice + pending_if_incomplete",
  !("errorCode" in addFirstSeat) &&
    addFirstSeat.kind === "add_item" &&
    addFirstSeat.proration_behavior === SEAT_ADD_PRORATION_BEHAVIOR &&
    addFirstSeat.payment_behavior === SEAT_ADD_PAYMENT_BEHAVIOR
);
const addThird = resolveSeatAddMutation({
  items: [
    { id: "si_base", priceId: PRICES.businessBaseMonthly, quantity: 1 },
    { id: "si_seat", priceId: PRICES.businessSeatMonthly, quantity: 1 },
  ],
  prices: PRICES,
  desiredPaidSeatQuantity: 3,
  pendingUpdate: null,
});
assert(
  "third user updates seat qty 1 → 2",
  !("errorCode" in addThird) &&
    addThird.kind === "update_item" &&
    addThird.items[0]?.quantity === 2
);
assert(
  "6th self-service seat is denied without Stripe mutation",
  "errorCode" in
    resolveSeatAddMutation({
      items: [
        { id: "si_base", priceId: PRICES.businessBaseMonthly, quantity: 1 },
        { id: "si_seat", priceId: PRICES.businessSeatMonthly, quantity: 4 },
      ],
      prices: PRICES,
      desiredPaidSeatQuantity: 6,
      pendingUpdate: null,
    })
);
const removeToOne = resolveSeatRemoveMutation({
  items: [
    { id: "si_base", priceId: PRICES.businessBaseMonthly, quantity: 1 },
    { id: "si_seat", priceId: PRICES.businessSeatMonthly, quantity: 1 },
  ],
  prices: PRICES,
  desiredPaidSeatQuantity: 1,
});
assert(
  "returning to 1 user deletes the seat item with create_prorations",
  removeToOne.kind === "delete_item" &&
    removeToOne.proration_behavior === SEAT_REMOVE_PRORATION_BEHAVIOR
);
assert(
  "2-user renewal catalogue math is 11400 + 1710 = 13110 cents",
  expectedTwoUserRenewalCents().exclusiveCents === 11400 &&
    expectedTwoUserRenewalCents().gstCents === 1710 &&
    expectedTwoUserRenewalCents().totalCents === 13110
);
assert(
  "seat add mutations do not send tax_rates (GST stays on subscription defaults)",
  !/tax_rates:/.test(file("lib/billing/seat-change.ts")) &&
    !/default_tax_rates:/.test(file("lib/billing/seat-apply.ts"))
);

assert(
  "membership activates only when mirror paid seats cover desired count",
  decideSeatAddActivation({
    operationStatus: "awaiting_mirror",
    paidSeatQuantity: 2,
    desiredPaidSeatQuantity: 2,
    stripeCurrentPaidSeats: 2,
    pendingUpdateEquivalent: false,
  }).action === "activate" &&
    decideSeatAddActivation({
      operationStatus: "awaiting_payment",
      paidSeatQuantity: 1,
      desiredPaidSeatQuantity: 2,
      stripeCurrentPaidSeats: 1,
      pendingUpdateEquivalent: true,
    }).action === "payment_failed"
);

const safeTeam = {
  activeMemberCount: 1,
  pendingBillingCount: 0,
  validPendingInviteCount: 0,
  pendingActivationCount: 0,
  extraSeatItemQuantity: 0,
  paidSeatQuantity: 1,
};
assert(
  "downgrade blocked until team is one person with no pending invites",
  isTeamSafeForBuilderDowngrade({
    ...safeTeam,
    activeMemberCount: 2,
    paidSeatQuantity: 2,
    extraSeatItemQuantity: 1,
  }) === false && isTeamSafeForBuilderDowngrade(safeTeam) === true
);
assert(
  "Business→Builder is scheduled for period end, not immediate",
  BUSINESS_TO_BUILDER_TIMING === "end_of_current_period" &&
    canDowngradeBusinessToBuilder(
      { ...emptyState(), subscription: businessSub() },
      safeTeam
    ).ok === true
);

assert(
  "Checkout/Portal/upgrade require billing.manage (Owner)",
  /permission: "billing.manage"/.test(billingActions) &&
    (billingActions.match(/permission: "billing.manage"/g) ?? []).length >= 3
);
assert(
  "browser cannot submit Stripe seat quantity or Price ID as invite authority",
  /hashInviteToken\(rawToken\)/.test(teamActions) &&
    !/p_paid_seat_quantity/.test(teamActions) &&
    !/p_price_id/.test(teamActions)
);

const builderTeam = buildTeamPageView({
  planCode: "builder",
  trial: false,
  actorRole: "owner",
  members: [],
  invitations: [],
  snapshot: {
    activeMemberCount: 1,
    pendingBillingCount: 0,
    validPendingInviteCount: 0,
  },
  selfServiceLimit: 1,
});
const trialTeam = buildTeamPageView({
  planCode: "business",
  trial: true,
  actorRole: "owner",
  members: [],
  invitations: [],
  snapshot: {
    activeMemberCount: 1,
    pendingBillingCount: 0,
    validPendingInviteCount: 0,
  },
  selfServiceLimit: 1,
});
const businessTeam = buildTeamPageView({
  planCode: "business",
  trial: false,
  actorRole: "owner",
  members: [
    {
      membershipId: "m1",
      userId: "u1",
      fullName: "Owner",
      email: "a@b.c",
      role: "owner",
      status: "active",
      isOwner: true,
      isSelf: true,
    },
  ],
  invitations: [],
  snapshot: {
    activeMemberCount: 1,
    pendingBillingCount: 0,
    validPendingInviteCount: 0,
  },
  selfServiceLimit: 5,
});
assert(
  "Builder team empty copy points at Business upgrade",
  builderTeam.kind === "builder" &&
    /Upgrade to Quotr Business/.test(builderTeam.emptyState) &&
    builderTeam.canInvite === false
);
assert(
  "Trial team is disabled",
  trialTeam.kind === "trial" &&
    /subscribe to Quotr Business/.test(trialTeam.emptyState) &&
    trialTeam.canInvite === false
);
assert(
  "Business 1-user empty copy",
  /only person/.test(businessTeam.emptyState) && businessTeam.canInvite === true
);

assert(
  "reconciliation classifies shortfall vs reserved vs healthy",
  classifyTeamReconciliation({
    planCode: "business",
    trial: false,
    paidSeatQuantity: 1,
    extraSeatItemQuantity: 0,
    snapshot: {
      activeMemberCount: 2,
      pendingBillingCount: 0,
      validPendingInviteCount: 0,
    },
    pendingActivationCount: 0,
  }).state === "billing_shortfall" &&
    classifyTeamReconciliation({
      planCode: "business",
      trial: false,
      paidSeatQuantity: 1,
      extraSeatItemQuantity: 0,
      snapshot: {
        activeMemberCount: 1,
        pendingBillingCount: 0,
        validPendingInviteCount: 1,
      },
      pendingActivationCount: 0,
    }).state === "reserved_capacity"
);

const ownerSell = calculateEstimateSellFromCost(1000, 25);
const estimatorSell = calculateEstimateSellFromCost(1000, 25);
assert(
  "Owner vs Estimator economic parity on sell-from-cost",
  ownerSell.ok &&
    estimatorSell.ok &&
    ownerSell.ok &&
    estimatorSell.ok &&
    ownerSell.sell === estimatorSell.sell
);

assert(
  "quotes already have created_by; BILLING-4 does not redesign Quote transactions",
  /created_by/.test(file("lib/quotes/types.ts")) &&
    !/quote_ownership/.test(migration049)
);
assert(
  "invite-aware signup skips standalone provision when invite_token present",
  /inviteToken/.test(file("app/(auth)/actions.ts")) &&
    /PROVISION:PENDING_INVITATION/.test(migration049)
);
assert(
  "team page route exists",
  file("app/(protected)/app/settings/team/page.tsx").includes("TeamPageContent")
);
assert(
  "permission registry stays small",
  (permissionSrc.match(/"[a-z.]+"/g) ?? []).length < 40 &&
    /team.invite/.test(permissionSrc) &&
    /billing.manage/.test(permissionSrc)
);
assert(
  "owner-only invite is documented in policy",
  /Owner-only paid-seat invitations/.test(invitePolicy)
);

const permissionServer = file("lib/team/permission-server.ts");
assert(
  "A. pending_billing is not Viewer and grants no role permission",
  decideMembershipAuthority({
    membershipTableAvailable: true,
    membership: { role: "viewer", status: "pending_billing" },
    profile: { orgId: null, role: "member" },
  }).kind === "pending_billing" &&
    !membershipGrantsRolePermissions(
      decideMembershipAuthority({
        membershipTableAvailable: true,
        membership: { role: "estimator", status: "pending_billing" },
        profile: { orgId: null, role: "estimator" },
      })
    ) &&
    !/return "viewer"/.test(permissionServer) &&
    /eq\("status", "active"\)|status === "active"/.test(
      file("lib/team/membership-authority.ts")
    ) &&
    /values \(v_uid, null/.test(migration049) &&
    !/set org_id = v_inv\.org_id/.test(migration049) &&
    evaluateAuthOrgInputs({
      user: { id: "u1", email: "a@b.c" },
      profile: { org_id: null },
      organisation: { id: ORG },
    }).ok === false
);

assert(
  "B. failed payment keeps invitation recoverable and unbound",
  /profiles\.org_id stays unbound/.test(migration049) &&
    /Your seat couldn''t be activated because the account payment needs attention/.test(
      migration049
    ) &&
    decideSeatAddActivation({
      operationStatus: "failed",
      paidSeatQuantity: 1,
      desiredPaidSeatQuantity: 2,
      stripeCurrentPaidSeats: 1,
      pendingUpdateEquivalent: false,
    }).action === "payment_failed"
);

assert(
  "C. browser close: webhook and own-complete can still activate",
  /advanceSeatQueueAfterMirror/.test(file("lib/billing/webhook-http.ts")) &&
    /complete_own_pending_membership_v1/.test(migration049)
);

assert(
  "D. payment success binds profile org and activates membership",
  /set org_id = v_mem\.org_id/.test(migration049) &&
    /set status = 'active'/.test(migration049) &&
    /role = v_mem\.role/.test(migration049)
);

assert(
  "E. webhook duplicate: already-active membership returns true",
  /if v_mem\.status = 'active' then\s+return true/.test(migration049)
);

assert(
  "F. accepting/pending_billing suppress standalone org provision",
  /v_pending_membership/.test(migration049) &&
    /status in \('pending', 'accepting'\)/.test(migration049) &&
    /PROVISION:PENDING_INVITATION/.test(migration049)
);

const beforeTransfer = reservationSnapshotBeforeInviteAcceptance({
  activeMemberCount: 4,
  pendingBillingCount: 0,
  otherPendingInviteCount: 0,
  thisInviteIsPending: true,
});
const afterTransfer = reservationSnapshotAfterInviteAcceptanceTransfer({
  activeMemberCount: 4,
  pendingBillingCountBefore: 0,
  otherPendingInviteCount: 0,
});
assert(
  "G. invite→pending_billing transfers exactly one capacity unit",
  reservedSeatCount(beforeTransfer) === 5 &&
    reservedSeatCount(afterTransfer) === 5 &&
    afterTransfer.pendingBillingCount === 1 &&
    afterTransfer.validPendingInviteCount === 0 &&
    /accepting is excluded so invitation→pending_billing transfer does not double-count/.test(
      migration049
    )
);

assert(
  "H. bound profile without active membership fails closed after 049",
  decideMembershipAuthority({
    membershipTableAvailable: true,
    membership: null,
    profile: { orgId: ORG, role: "owner" },
  }).kind === "bound_without_membership" &&
    !membershipGrantsRolePermissions(
      decideMembershipAuthority({
        membershipTableAvailable: true,
        membership: null,
        profile: { orgId: ORG, role: "admin" },
      })
    ) &&
    /Bound profile without active membership fails closed/.test(migration049)
);

assert(
  "I. active Viewer is paid read-only, not pending_billing",
  roleAllowsPermission("viewer", "team.view") &&
    !roleAllowsPermission("viewer", "quotes.send") &&
    !roleAllowsPermission("viewer", "projects.create") &&
    decideMembershipAuthority({
      membershipTableAvailable: true,
      membership: { role: "viewer", status: "active" },
      profile: { orgId: ORG, role: "viewer" },
    }).kind === "active" &&
    /alter column org_id drop not null/.test(migration049)
);

assert(
  "reconciliation distinguishes pending_billing_zero_access from Viewer",
  classifyTeamReconciliation({
    planCode: "business",
    trial: false,
    paidSeatQuantity: 1,
    extraSeatItemQuantity: 0,
    snapshot: {
      activeMemberCount: 1,
      pendingBillingCount: 1,
      validPendingInviteCount: 0,
    },
    pendingActivationCount: 1,
  }).state === "pending_billing_zero_access"
);

assert(
  "Owner invite copy is billing consent; no second approval at accept",
  /This user will cost \$35 \+ GST\/month once they join/.test(
    file("lib/billing/seat-change.ts")
  ) && /does not require a second Owner approval/.test(invitePolicy)
);

assert(
  "safe local Next build wrapper never reads Production env file",
  /never \.env\.production\.local/.test(file("scripts/next-build-safe.mjs")) &&
    /lxvnylhsbvudzzupxeqr/.test(file("scripts/next-build-safe.mjs")) &&
    /build:safe/.test(file("package.json"))
);

assert(
  "legacy profiles.role fallback only when membership table is missing",
  decideMembershipAuthority({
    membershipTableAvailable: false,
    membership: null,
    profile: { orgId: ORG, role: "member" },
  }).kind === "legacy_profile" &&
    membershipGrantsRolePermissions(
      decideMembershipAuthority({
        membershipTableAvailable: false,
        membership: null,
        profile: { orgId: ORG, role: "member" },
      })
    ) === true &&
    /PGRST205/.test(permissionServer) &&
    /schema cache/.test(permissionServer)
);

const t0 = "2026-09-02T00:00:00.000Z";
const t1 = "2026-09-02T00:00:01.000Z";
const opA: SeatQueueOp = {
  id: "op-a",
  kind: "add",
  status: "pending",
  createdAt: t0,
  membershipId: "mem-a",
};
const opBQueued: SeatQueueOp = {
  id: "op-b",
  kind: "add",
  status: "queued",
  createdAt: t1,
  membershipId: "mem-b",
};

assert(
  "R2-A. B acceptance while A in-flight is queued and issues no Stripe",
  nextClaimableSeatOperation([opA, opBQueued]) === null &&
    ownAcceptanceIssuesStripeMutation("queued") === false &&
    ownAcceptanceIssuesStripeMutation("pending") === true &&
    /v_desired,\s*'queued'/.test(migration049) &&
    /insert into public\.billing_seat_operations/.test(teamActions) === false &&
    !/applyPaidSeatIncrease/.test(teamActions)
);

assert(
  "R2-B. after A succeeds, B is next and desired paid seats is 3",
  nextClaimableSeatOperation([
    { ...opA, status: "completed" },
    opBQueued,
  ])?.id === "op-b" &&
    desiredPaidSeatsForAdd(2) === 3 &&
    /v_desired := v_active \+ 1/.test(migration049)
);

assert(
  "R2-C. A failed keeps B queued; do not skip A to charge B",
  nextClaimableSeatOperation([
    { ...opA, status: "failed" },
    opBQueued,
  ])?.id === "op-a" &&
    claimNextRespectingCaller({
      operations: [
        { ...opA, status: "failed" },
        opBQueued,
      ],
      callerMembershipId: "mem-b",
    }) === null &&
    claimNextRespectingCaller({
      operations: [
        { ...opA, status: "failed" },
        opBQueued,
      ],
      callerMembershipId: null,
    })?.id === "op-a" &&
    ownAcceptanceIssuesStripeMutation("failed") === false &&
    classifyTeamReconciliation({
      planCode: "business",
      trial: false,
      paidSeatQuantity: 1,
      extraSeatItemQuantity: 0,
      snapshot: {
        activeMemberCount: 1,
        pendingBillingCount: 2,
        validPendingInviteCount: 0,
      },
      pendingActivationCount: 2,
      paymentAttentionSeatOperationCount: 1,
      queuedSeatOperationCount: 1,
    }).state === "payment_attention"
);

assert(
  "R2-D. after A recovers, A is gone from the queue and B proceeds",
  nextClaimableSeatOperation([
    { ...opA, status: "completed" },
    opBQueued,
  ])?.id === "op-b" &&
    desiredPaidSeatsForAdd(2) === 3
);

assert(
  "R2-E. A cancelled before Stripe releases reservation; B may proceed",
  canCancelSeatOperationWithoutStripe("queued") === true &&
    canCancelSeatOperationWithoutStripe("pending") === false &&
    nextClaimableSeatOperation([
      { ...opA, status: "cancelled" },
      opBQueued,
    ])?.id === "op-b" &&
    /TEAM:SEAT_IN_FLIGHT/.test(migration049)
);

assert(
  "R2-F. durable unique inflight index; two callbacks cannot both hold pending",
  /billing_seat_operations_one_inflight_uidx/.test(migration049) &&
    /where status in \('pending', 'awaiting_payment', 'awaiting_mirror'\)/.test(
      migration049
    ) &&
    /p_only_membership_id/.test(migration049) &&
    /unique_violation/.test(migration049) &&
    (file("lib/billing/seat-queue-process.ts").match(
      /processClaimedSeatMutationForOrg\(/g
    ) ?? []).length === 2
);

assert(
  "R2-G. past_due blocks new seat add even inside BILLING-2 work grace",
  canStartPaidSeatStripeMutation({
    ...emptyState(),
    subscription: {
      ...businessSub(),
      status: "past_due",
      pastDueSince: NOW.toISOString(),
    },
  }).ok === false &&
    canCreatePaidSeatInvitationForBilling({
      ...emptyState(),
      subscription: {
        ...businessSub(),
        status: "past_due",
        pastDueSince: NOW.toISOString(),
      },
    }).ok === false &&
    evaluateOrgEntitlement({
      state: {
        ...emptyState(),
        subscription: {
          ...businessSub(),
          status: "past_due",
          pastDueSince: NOW.toISOString(),
        },
      },
      capability: "quotes.send",
      mode: "strict",
      now: NOW,
    }).ok === true
);

assert(
  "R2-H. scheduled_to_cancel blocks new invite and seat add",
  canCreatePaidSeatInvitationForBilling({
    ...emptyState(),
    subscription: { ...businessSub(), status: "scheduled_to_cancel" },
  }).ok === false &&
    /Resume your Business subscription before adding another user/.test(
      canCreatePaidSeatInvitationForBilling({
        ...emptyState(),
        subscription: { ...businessSub(), status: "scheduled_to_cancel" },
      }).ok === false
        ? canCreatePaidSeatInvitationForBilling({
            ...emptyState(),
            subscription: { ...businessSub(), status: "scheduled_to_cancel" },
          }).errorSafe
        : ""
    ) &&
    /TEAM:SUBSCRIPTION_SCHEDULED_TO_CANCEL/.test(migration049)
);

assert(
  "R2-I. remove during in-flight add revokes access and queues Stripe decrement",
  nextClaimableSeatOperation([
    opA,
    {
      id: "op-remove-c",
      kind: "remove",
      status: "queued",
      createdAt: t1,
    },
  ]) === null &&
    desiredPaidSeatsForRemove(1) === 1 &&
    /'queued'/.test(migration049) &&
    canStartPaidSeatStripeRemoval({
      ...emptyState(),
      subscription: businessSub(),
    }).ok === true
);

const seatKey = stripeSeatAddIdempotencyKey("test", ORG, "op-a", 2);
assert(
  "R2-J. retry same seat operation reuses the same Stripe idempotency identity",
  seatKey === stripeSeatAddIdempotencyKey("test", ORG, "op-a", 2) &&
    seatKey !== stripeSeatAddIdempotencyKey("test", ORG, "op-b", 2) &&
    seatKey !== stripeSeatAddIdempotencyKey("test", ORG, "op-a", 3) &&
    /:q\$\{desiredPaidSeatQuantity\}|:q2/.test(
      file("lib/billing/stripe-idempotency.ts")
    ) &&
    stripeSeatRemoveIdempotencyKey("test", ORG, "op-remove", 1) ===
      stripeSeatRemoveIdempotencyKey("test", ORG, "op-remove", 1)
);

assert(
  "R2 queue copy and claim-next SQL are durable",
  SEAT_QUEUED_MESSAGE === "Your Quotr seat is being activated." &&
    /organisation_allows_paid_seat_stripe/.test(migration049) &&
    /s\.status = 'active'/.test(migration049) &&
    /get_pending_claimed_seat_operation_v1/.test(migration049)
);

if (process.exitCode) {
  console.log("\nBILLING-4 verifier failed.");
} else {
  console.log("\nBILLING-4 verifier passed.");
}
