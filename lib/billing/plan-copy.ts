/**
 * Customer-facing plan comparison copy (BETA-1).
 * Entitlement registry may keep future keys; Billing must not promise them.
 */

export const BUILDER_PLAN_HEADLINE =
  "For sole traders and independent builders.";

export const BUILDER_PLAN_SUMMARY =
  "Quotr estimating and quoting, 1 user, company rates, and client quote send and acceptance.";

export const BUSINESS_PLAN_HEADLINE =
  "For builders who work with a small team.";

export const BUSINESS_PLAN_SUMMARY =
  "First user included. Add up to 5 people. Shared company workspace and rates. Additional users $35 + GST/month.";

/** Strings that must never appear on Billing / plan comparison. */
export const FORBIDDEN_PLAN_MARKETING_PHRASES = [
  "Core estimating accuracy",
  "Business analytics",
  "voice capture",
  "concept visual",
  "quote approval",
  "multiple quote templates",
  "margin guardrails",
  "governed rates",
  "team audit",
  "Coming soon",
] as const;
