/**
 * Batch 2B.8 — temporary calculation authority switch for quote-domain paths.
 * Batch 2B.10 decision: **RETAIN** (documented rollback knob; default authoritative).
 *
 * Default: authoritative commercial engine.
 * Rollback: set to "legacy" or prefer `git revert`. Does not affect pricing/estimate switches.
 * Not a public UI feature flag. Not environment-driven.
 *
 * Covers: create/refresh snapshot aggregates, draft item recalculation,
 * visibility/delete aggregates. Does not rewrite historical quote rows.
 */

export type QuoteCalculationAuthority = "authoritative" | "legacy";

/**
 * Internal rollback constant. Change to `"legacy"` only for emergency rollback.
 * Prefer `git revert` of the adoption commit.
 */
export const QUOTE_CALCULATION_AUTHORITY: QuoteCalculationAuthority =
  "authoritative";

export function isAuthoritativeQuoteCalculation(): boolean {
  return QUOTE_CALCULATION_AUTHORITY === "authoritative";
}
