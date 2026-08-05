/**
 * Batch 2B.7 — temporary authority switch for estimate-domain money.
 * Batch 2B.10 decision: **RETAIN** (documented rollback knob; default authoritative).
 *
 * Default: authoritative commercial engine.
 * Rollback: set to "legacy" or prefer `git revert`. Does not affect pricing-domain switch.
 * Not a public UI feature flag. Not environment-driven.
 */

export type EstimateCalculationAuthority = "authoritative" | "legacy";

export const ESTIMATE_CALCULATION_AUTHORITY: EstimateCalculationAuthority =
  "authoritative";

export function isAuthoritativeEstimateCalculation(): boolean {
  return ESTIMATE_CALCULATION_AUTHORITY === "authoritative";
}
