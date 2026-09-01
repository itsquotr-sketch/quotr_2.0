/**
 * Future billing seam. Do not hard-code plan names.
 *
 * Builder + Business: quotes.send, quotes.acceptance
 * Business additionally: quote.approval, margin.guardrails, team roles/audit.
 *
 * QUOTE-DELIVERY-01 and QUOTE-ACCEPTANCE-01 must call this at the
 * server boundary against the issuer organisation. BILLING-1 stores
 * subscription authority but does not enforce it. Until BILLING-2,
 * known Quote capabilities remain allowed. Do not trust a browser plan value.
 */
export type QuoteEntitlementKey =
  | "quotes.send"
  | "quotes.acceptance"
  | "quote.approval"
  | "margin.guardrails";

export function requireOrgEntitlement(
  _orgId: string,
  entitlement: QuoteEntitlementKey
): { ok: true } | { ok: false; error: string } {
  if (entitlement === "quotes.send" || entitlement === "quotes.acceptance") {
    return { ok: true };
  }
  return {
    ok: false,
    error: "This capability is not available on the current plan.",
  };
}
