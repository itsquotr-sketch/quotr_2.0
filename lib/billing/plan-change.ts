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

/**
 * Business → Builder is deferred. BILLING-3 orgs have one user, but extra
 * Business seats arrive in BILLING-4 and would make an unvalidated
 * downgrade unsafe. Keep this seam; do not DB-flip.
 */
export function canDowngradeBusinessToBuilder(
  state: OrgBillingState
): PlanChangeGuard {
  void state;
  return {
    ok: false,
    errorCode: "downgrade_deferred_billing_4",
    errorSafe:
      "Downgrade to Builder is deferred until seat validation exists. Use Customer Portal to cancel, or stay on Business.",
  };
}
