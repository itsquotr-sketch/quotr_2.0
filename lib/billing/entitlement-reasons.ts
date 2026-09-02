import type { EntitlementCapability } from "@/lib/billing/capabilities";

export const ENTITLEMENT_REASON_CODES = [
  "upgrade_required",
  "trial_expired",
  "payment_past_due",
  "subscription_unpaid",
  "subscription_paused",
  "subscription_cancelled",
  "billing_incomplete",
  "seat_limit",
  "custom_restriction",
  "billing_uninitialized",
] as const;
export type EntitlementReasonCode = (typeof ENTITLEMENT_REASON_CODES)[number];

export type UpgradeTarget = "builder" | "business" | "builder_or_business" | null;

export function denialReasonForAccessClass(input: {
  trialExpired: boolean;
  billingStatus: string;
  withinPastDueGrace: boolean;
}): EntitlementReasonCode | null {
  if (input.trialExpired) return "trial_expired";
  if (input.billingStatus === "incomplete") return "billing_incomplete";
  if (input.billingStatus === "unpaid") return "subscription_unpaid";
  if (input.billingStatus === "paused") return "subscription_paused";
  if (input.billingStatus === "cancelled") return "subscription_cancelled";
  if (input.billingStatus === "past_due") return "payment_past_due";
  if (input.billingStatus === "uninitialized") return "billing_uninitialized";
  return null;
}

export function entitlementDenialMessage(input: {
  capability: EntitlementCapability;
  reasonCode: EntitlementReasonCode;
  trialTeamDenied?: boolean;
}): string {
  if (input.reasonCode === "trial_expired") {
    return "Your 14-day trial has ended. Choose Quotr Builder or Business to continue creating and sending new work.";
  }
  if (
    input.reasonCode === "payment_past_due" ||
    input.reasonCode === "subscription_unpaid"
  ) {
    return "Your subscription payment needs attention. Update billing to continue creating new work.";
  }
  if (input.reasonCode === "subscription_paused") {
    return "Your subscription is paused. Resume billing to continue creating new work.";
  }
  if (input.reasonCode === "subscription_cancelled") {
    return "Your subscription has ended. Choose Quotr Builder or Business to continue creating and sending new work.";
  }
  if (input.reasonCode === "billing_incomplete") {
    return "Finish setting up your subscription to continue creating new work.";
  }
  if (input.reasonCode === "seat_limit") {
    return "Your plan has no remaining user seats. Upgrade or add seats to invite another person.";
  }
  if (input.reasonCode === "custom_restriction") {
    return "This capability is not included in the current organisation agreement.";
  }
  if (input.reasonCode === "billing_uninitialized") {
    return "Billing is not initialized for this organisation yet.";
  }

  if (input.trialTeamDenied) {
    return "Team members are available on Quotr Business. Your trial is limited to one user.";
  }

  switch (input.capability) {
    case "team.invite":
    case "team.manage":
    case "team.assign_projects":
    case "team.roles":
      return "Team members are available on Quotr Business. Upgrade to invite up to five users.";
    case "analytics.business":
      return "Business analytics are available on Quotr Business.";
    case "quotes.approval":
      return "Quote approvals are available on Quotr Business.";
    case "margin.guardrails":
      return "Margin guardrails are available on Quotr Business.";
    case "quotes.templates.multiple":
      return "Multiple quote templates are available on Quotr Business.";
    case "company_rates.governed":
      return "Governed company rates are available on Quotr Business.";
    case "calibration.comprehensive":
      return "Comprehensive calibration is available on Quotr Business.";
    case "audit.team":
      return "Team audit history is available on Quotr Business.";
    default:
      return "This capability is not available on the current plan.";
  }
}

export function upgradeTargetForDenial(input: {
  reasonCode: EntitlementReasonCode;
  capability: EntitlementCapability;
}): UpgradeTarget {
  if (
    input.reasonCode === "trial_expired" ||
    input.reasonCode === "subscription_cancelled"
  ) {
    return "builder_or_business";
  }
  if (input.reasonCode === "upgrade_required") {
    return "business";
  }
  return null;
}
