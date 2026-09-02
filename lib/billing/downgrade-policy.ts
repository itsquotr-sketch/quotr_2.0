import type { OrgBillingState, PlanCode } from "@/lib/billing/types";
import type { SeatReservationSnapshot } from "@/lib/team/capacity";
import { reservedSeatCount } from "@/lib/team/capacity";

export type PlanChangeGuard =
  | { ok: true; stripeSubscriptionId: string; fromPlan: PlanCode; toPlan: PlanCode }
  | { ok: false; errorCode: string; errorSafe: string };

export type DowngradeTeamSnapshot = SeatReservationSnapshot & {
  pendingActivationCount: number;
  extraSeatItemQuantity: number;
  paidSeatQuantity: number;
};

const TEAM_BLOCK_MESSAGE =
  "Remove additional team members and pending invitations before switching to Builder.";

/**
 * Business → Builder is scheduled for the end of the current billing period
 * after the company is already down to one person. Immediate plan flip is
 * not used: it would create credits and cut remaining paid Business time.
 */
export const BUSINESS_TO_BUILDER_TIMING = "end_of_current_period" as const;

export function isTeamSafeForBuilderDowngrade(
  snapshot: DowngradeTeamSnapshot
): boolean {
  return (
    snapshot.activeMemberCount === 1 &&
    snapshot.pendingBillingCount === 0 &&
    snapshot.validPendingInviteCount === 0 &&
    snapshot.pendingActivationCount === 0 &&
    snapshot.paidSeatQuantity === 1 &&
    snapshot.extraSeatItemQuantity === 0 &&
    reservedSeatCount(snapshot) === 1
  );
}

export function canDowngradeBusinessToBuilder(
  state: OrgBillingState,
  team: DowngradeTeamSnapshot | null = null
): PlanChangeGuard {
  if (state.activeOverride) {
    return {
      ok: false,
      errorCode: "override_blocks_plan_change",
      errorSafe: "Billing overrides cannot be changed through self-service downgrade.",
    };
  }
  const sub = state.subscription;
  if (!sub || sub.source !== "stripe" || !sub.stripeSubscriptionId) {
    return {
      ok: false,
      errorCode: "downgrade_requires_stripe_subscription",
      errorSafe: "Downgrade is available on an active Business subscription.",
    };
  }
  if (sub.planCode !== "business") {
    return {
      ok: false,
      errorCode: "downgrade_plan_unsupported",
      errorSafe: "Only Quotr Business can switch to Builder.",
    };
  }
  if (sub.status === "cancelled" || sub.status === "incomplete") {
    return {
      ok: false,
      errorCode: "downgrade_status_blocked",
      errorSafe: "Manage billing to resolve the current subscription status first.",
    };
  }
  if (team == null) {
    return {
      ok: false,
      errorCode: "downgrade_team_state_required",
      errorSafe: TEAM_BLOCK_MESSAGE,
    };
  }
  if (!isTeamSafeForBuilderDowngrade(team)) {
    return {
      ok: false,
      errorCode: "downgrade_team_not_reduced",
      errorSafe: TEAM_BLOCK_MESSAGE,
    };
  }
  return {
    ok: true,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    fromPlan: "business",
    toPlan: "builder",
  };
}

export type BuilderDowngradeScheduleParams = {
  timing: typeof BUSINESS_TO_BUILDER_TIMING;
  endBehavior: "release";
  currentPlan: "business";
  nextPlan: "builder";
  prorationBehavior: "none";
};

export function buildBusinessToBuilderScheduleIntent(): BuilderDowngradeScheduleParams {
  return {
    timing: BUSINESS_TO_BUILDER_TIMING,
    endBehavior: "release",
    currentPlan: "business",
    nextPlan: "builder",
    prorationBehavior: "none",
  };
}
