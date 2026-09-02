/**
 * Quote-facing entitlement keys and evaluation.
 *
 * Server enforcement lives in `@/lib/billing/entitlement-server`
 * (`requireOrgEntitlement`, `hasOrgEntitlement`).
 *
 * Quote send: requireOrgEntitlement(orgId, "quotes.send") at the send action.
 * Public client "quotes.acceptance" is transaction completion of an already
 * issued Quote and is not gated on contractor billing.
 *
 * Canonical: quotes.approval. Legacy alias: quote.approval.
 */
export {
  evaluateOrgEntitlement,
  hasOrgEntitlementFromState,
} from "@/lib/billing/entitlements";
export type { EntitlementDecision } from "@/lib/billing/entitlements";
export type { EntitlementCapability } from "@/lib/billing/capabilities";
export type { QuoteEntitlementKey } from "@/lib/billing/entitlement-compat";
