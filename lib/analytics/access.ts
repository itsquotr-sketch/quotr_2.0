import type { EntitlementReasonCode } from "@/lib/billing/entitlement-reasons";

/**
 * Analytics read access follows the existing capability catalogue.
 * There is no analytics role permission. Viewers already read projects and
 * quotes through organisation membership, and Analytics uses that same read.
 */
export type AnalyticsTier = "personal" | "business";

export function analyticsTierFromDecisions(input: {
  personalOk: boolean;
  businessOk: boolean;
}): "denied" | AnalyticsTier {
  if (!input.personalOk) return "denied";
  return input.businessOk ? "business" : "personal";
}

/** Tables a tier is allowed to read. Personal never includes variation adjustments. */
export function analyticsTablesForTier(tier: AnalyticsTier): readonly string[] {
  const personal = [
    "organisation_settings",
    "projects",
    "quote_events",
    "accepted_commercial_snapshots",
  ] as const;
  if (tier === "personal") return personal;
  return [...personal, "variation_accepted_adjustments"];
}

export function businessAnalyticsUpgradeCopy(
  reasonCode: EntitlementReasonCode | null
): string {
  if (
    reasonCode === "trial_expired" ||
    reasonCode === "subscription_cancelled"
  ) {
    return "Acceptance rate, pipeline, send-to-accept timing, and accepted variation adjustments need an active Business plan.";
  }
  if (
    reasonCode === "payment_past_due" ||
    reasonCode === "subscription_unpaid" ||
    reasonCode === "subscription_paused" ||
    reasonCode === "billing_incomplete"
  ) {
    return "Acceptance rate, pipeline, send-to-accept timing, and accepted variation adjustments are paused until billing is up to date.";
  }
  return "Acceptance rate, pipeline, send-to-accept timing, and accepted variation adjustments are included with Business.";
}

/** Direct Business calls return this shape and no measures. */
export function deniedBusinessAnalytics(input: {
  message: string | null;
  reasonCode: EntitlementReasonCode | null;
  upgradeTarget: "builder" | "business" | "builder_or_business" | null;
}): {
  ok: false;
  error: string;
  reasonCode: EntitlementReasonCode | null;
  upgradeTarget: "builder" | "business" | "builder_or_business" | null;
} {
  return {
    ok: false,
    error: input.message ?? "This is not included on the current plan.",
    reasonCode: input.reasonCode,
    upgradeTarget: input.upgradeTarget,
  };
}
