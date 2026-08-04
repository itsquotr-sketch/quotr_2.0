/**
 * Batch 2B.6A/B — temporary calculation authority switch for pricing-domain paths.
 *
 * Default: authoritative commercial engine.
 * Rollback: set to "legacy" (or revert the adoption commit) — never dual-write.
 * Not a public UI feature flag.
 *
 * Covers item CRUD (2B.6A), create-from-estimate, document GST aggregate,
 * and recalibration money fields (2B.6B).
 */

export type PricingItemCalculationAuthority = "authoritative" | "legacy";

/**
 * Internal rollback constant. Change to `"legacy"` only for emergency rollback.
 * Prefer `git revert` of the adoption commit(s).
 */
export const PRICING_ITEM_CALCULATION_AUTHORITY: PricingItemCalculationAuthority =
  "authoritative";

export function isAuthoritativePricingItemCalculation(): boolean {
  return PRICING_ITEM_CALCULATION_AUTHORITY === "authoritative";
}
