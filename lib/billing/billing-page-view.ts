import {
  formatExclusivePlusGst,
  PLAN_DISPLAY_CATALOGUE,
} from "@/lib/billing/display-catalogue";
import {
  canCreateSubscriptionCheckout,
} from "@/lib/billing/checkout-plan";
import {
  canDowngradeBusinessToBuilder,
  canUpgradeBuilderToBusiness,
} from "@/lib/billing/plan-change";
import {
  deriveTrialCountdown,
  formatTrialEndDate,
  type TrialCountdown,
} from "@/lib/billing/trial-countdown";
import type { OrgBillingState, SubscriptionSource, SubscriptionStatus } from "@/lib/billing/types";

export const BILLING_STATUS_LABELS: Record<string, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  scheduled_to_cancel: "Scheduled to cancel",
  cancelled: "Cancelled",
  paused: "Paused",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  administratively_comped: "Complimentary",
  custom_contract: "Custom",
  uninitialized: "Not started",
  trial_expired: "Trial ended",
};

export type BillingPageKind =
  | "trial"
  | "trial_expired"
  | "active"
  | "past_due"
  | "scheduled_to_cancel"
  | "cancelled"
  | "paused"
  | "unpaid"
  | "incomplete"
  | "comped"
  | "custom"
  | "uninitialized";

export type BillingPageView = {
  kind: BillingPageKind;
  statusLabel: string;
  source: SubscriptionSource | "override" | "none";
  planLabel: string | null;
  planCode: "builder" | "business" | "custom" | null;
  monthlyPriceLabel: string | null;
  trial: TrialCountdown | null;
  trialEndsOn: string | null;
  currentPeriodEnd: string | null;
  paidSeatQuantity: number | null;
  canCheckout: boolean;
  canManagePortal: boolean;
  canUpgradeToBusiness: boolean;
  canDowngradeToBuilder: boolean;
  checkoutBlockedReason: string | null;
};

function kindFromState(state: OrgBillingState): BillingPageKind {
  if (state.activeOverride) {
    const type = state.activeOverride.overrideType;
    if (type === "administratively_comped") return "comped";
    if (type === "custom_contract") return "custom";
    return "active";
  }
  if (state.effectiveTrialState === "trial_expired") return "trial_expired";
  if (state.effectiveTrialState === "trialing") return "trial";
  const status = state.subscription?.status as SubscriptionStatus | undefined;
  if (!state.subscription || !status) return "uninitialized";
  if (status === "administratively_comped") return "comped";
  if (status === "custom_contract") return "custom";
  if (status === "trialing") return "trial";
  if (
    status === "active" ||
    status === "past_due" ||
    status === "scheduled_to_cancel" ||
    status === "cancelled" ||
    status === "paused" ||
    status === "unpaid" ||
    status === "incomplete"
  ) {
    return status;
  }
  return "uninitialized";
}

export function buildBillingPageView(
  state: OrgBillingState,
  now: Date = new Date()
): BillingPageView {
  const kind = kindFromState(state);
  const sub = state.subscription;
  const planCode = state.activeOverride?.planCode ?? sub?.planCode ?? null;
  const display =
    planCode === "builder" || planCode === "business"
      ? PLAN_DISPLAY_CATALOGUE[planCode]
      : null;
  const checkout = canCreateSubscriptionCheckout(state);
  const upgrade = canUpgradeBuilderToBusiness(state);
  const downgrade = canDowngradeBusinessToBuilder(state);
  const trial =
    sub?.source === "internal_trial"
      ? deriveTrialCountdown({
          trialEndsAt: sub.trialEndsAt,
          effectiveTrialState: state.effectiveTrialState,
          now,
        })
      : null;

  const statusKey =
    kind === "trial"
      ? "trialing"
      : kind === "trial_expired"
        ? "trial_expired"
        : kind;

  return {
    kind,
    statusLabel: BILLING_STATUS_LABELS[statusKey] ?? "Billing",
    source: state.activeOverride
      ? "override"
      : (sub?.source ?? "none"),
    planLabel: display?.label ?? (planCode === "custom" ? "Custom" : null),
    planCode,
    monthlyPriceLabel: display
      ? formatExclusivePlusGst(display.exclusiveMonthlyNzd)
      : null,
    trial,
    trialEndsOn: trial ? formatTrialEndDate(trial.trialEndsAt) : null,
    currentPeriodEnd: sub?.currentPeriodEnd
      ? formatTrialEndDate(sub.currentPeriodEnd)
      : null,
    paidSeatQuantity: sub?.paidSeatQuantity ?? null,
    canCheckout: checkout.ok,
    canManagePortal: Boolean(
      state.customer?.stripeCustomerId &&
        sub?.source === "stripe" &&
        sub.status !== "cancelled"
    ),
    canUpgradeToBusiness: upgrade.ok,
    canDowngradeToBuilder: downgrade.ok,
    checkoutBlockedReason: checkout.ok ? null : checkout.errorSafe,
  };
}
