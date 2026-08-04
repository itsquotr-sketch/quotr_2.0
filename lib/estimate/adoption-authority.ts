/**
 * Batch 2B.7 — temporary authority switch for estimate-domain money.
 *
 * Default: authoritative commercial engine.
 * Rollback: set to "legacy" or git revert. Does not affect pricing-domain switch.
 */

export type EstimateCalculationAuthority = "authoritative" | "legacy";

export const ESTIMATE_CALCULATION_AUTHORITY: EstimateCalculationAuthority =
  "authoritative";

export function isAuthoritativeEstimateCalculation(): boolean {
  return ESTIMATE_CALCULATION_AUTHORITY === "authoritative";
}
