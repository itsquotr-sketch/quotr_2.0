import type { OrgBillingState, PlanCode, SubscriptionStatus } from "@/lib/billing/types";

export type PlanChangeGuard =
  | { ok: true; stripeSubscriptionId: string; fromPlan: PlanCode; toPlan: PlanCode }
  | { ok: false; errorCode: string; errorSafe: string };

/**
 * Builder → Business via Stripe subscription item update + webhook.
 * Never flips plan_code in the database.
 */
export function canUpgradeBuilderToBusiness(
  state: OrgBillingState
): PlanChangeGuard {
  if (state.activeOverride) {
    return {
      ok: false,
      errorCode: "override_blocks_plan_change",
      errorSafe: "Billing overrides cannot be changed through self-service upgrade.",
    };
  }
  const sub = state.subscription;
  if (!sub || sub.source !== "stripe" || !sub.stripeSubscriptionId) {
    return {
      ok: false,
      errorCode: "upgrade_requires_stripe_subscription",
      errorSafe: "Upgrade to Business is available after an active Builder subscription.",
    };
  }
  if (sub.planCode === "business") {
    return {
      ok: false,
      errorCode: "already_business",
      errorSafe: "This organisation is already on Quotr Business.",
    };
  }
  if (sub.planCode !== "builder") {
    return {
      ok: false,
      errorCode: "upgrade_plan_unsupported",
      errorSafe: "This plan cannot be upgraded through self-service.",
    };
  }
  const allowed: SubscriptionStatus[] = [
    "active",
    "past_due",
    "scheduled_to_cancel",
    "trialing",
  ];
  if (!allowed.includes(sub.status)) {
    return {
      ok: false,
      errorCode: "upgrade_status_blocked",
      errorSafe: "Manage billing to resolve the current subscription status first.",
    };
  }
  return {
    ok: true,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    fromPlan: "builder",
    toPlan: "business",
  };
}

export {
  canDowngradeBusinessToBuilder,
  isTeamSafeForBuilderDowngrade,
  buildBusinessToBuilderScheduleIntent,
  BUSINESS_TO_BUILDER_TIMING,
  type DowngradeTeamSnapshot,
} from "@/lib/billing/downgrade-policy";
