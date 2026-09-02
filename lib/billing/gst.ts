/**
 * NZ SaaS GST for Stripe Checkout / subscription updates.
 * Optional at build time. Missing env must not invent 15%.
 * Price tax_behavior=exclusive does not attach GST by itself.
 */

export type CheckoutGstMode =
  | "exclusive_no_gst_line"
  | "exclusive_plus_configured_gst";

export function checkoutGstMode(taxRateId: string | null): CheckoutGstMode {
  return taxRateId ? "exclusive_plus_configured_gst" : "exclusive_no_gst_line";
}

export function stripeLineItemTaxRates(
  taxRateId: string | null
): { tax_rates: string[] } | Record<string, never> {
  return taxRateId ? { tax_rates: [taxRateId] } : {};
}

export function stripeDefaultTaxRates(
  taxRateId: string | null
): { default_tax_rates: string[] } | Record<string, never> {
  return taxRateId ? { default_tax_rates: [taxRateId] } : {};
}

function taxRateIdOf(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

/**
 * Whether a Stripe invoice (including an immediate upgrade proration invoice)
 * carries the configured NZ GST tax rate. Failed payment of that invoice must
 * not change Quotr plan authority.
 */
export function invoiceIncludesConfiguredTaxRate(
  invoice: {
    default_tax_rates?: Array<string | { id?: string } | null> | null;
    lines?: {
      data?: Array<{
        tax_rates?: Array<string | { id?: string } | null> | null;
      }>;
    } | null;
  },
  taxRateId: string
): boolean {
  const defaults = invoice.default_tax_rates ?? [];
  if (defaults.some((rate) => taxRateIdOf(rate) === taxRateId)) {
    return true;
  }
  const lines = invoice.lines?.data ?? [];
  return lines.some((line) =>
    (line.tax_rates ?? []).some((rate) => taxRateIdOf(rate) === taxRateId)
  );
}
