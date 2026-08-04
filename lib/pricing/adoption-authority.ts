/**
 * Batch 2B.6A — temporary calculation authority switch for pricing item mutations.
 *
 * Default: authoritative commercial engine.
 * Rollback: set to "legacy" (or revert this commit) — never dual-write.
 * Not a public UI feature flag.
 */

export type PricingItemCalculationAuthority = "authoritative" | "legacy";

/**
 * Internal rollback constant. Change to `"legacy"` only for emergency rollback
 * of Batch 2B.6A item CRUD paths. Prefer `git revert` of the 2B.6A commit.
 */
export const PRICING_ITEM_CALCULATION_AUTHORITY: PricingItemCalculationAuthority =
  "authoritative";

export function isAuthoritativePricingItemCalculation(): boolean {
  return PRICING_ITEM_CALCULATION_AUTHORITY === "authoritative";
}
