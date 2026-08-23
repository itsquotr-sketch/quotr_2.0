/**
 * Shared commercial authority for a trusted physical requirement.
 *
 * PHYSICAL QUANTITY ≠ MATERIAL IDENTITY ≠ MATERIAL RATE.
 * A missing trusted rate must not erase a trusted quantity, and must not
 * silently price as $0.
 */

export type ComponentCommercialAuthority =
  | "DETAILED_PRICED"
  | "PRICING_REQUIRED"
  | "NOT_APPLICABLE";

export function resolveComponentCommercialAuthority(params: {
  applicable: boolean;
  hasTrustedPhysicalQuantity: boolean;
  hasTrustedRate: boolean;
}): ComponentCommercialAuthority {
  if (!params.applicable || !params.hasTrustedPhysicalQuantity) {
    return "NOT_APPLICABLE";
  }
  return params.hasTrustedRate ? "DETAILED_PRICED" : "PRICING_REQUIRED";
}

export function hasTrustedPhysicalQuantity(
  quantity: number | null | undefined
): boolean {
  return quantity != null && Number.isFinite(quantity) && quantity > 0;
}
