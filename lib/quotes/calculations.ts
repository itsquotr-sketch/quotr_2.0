import { roundMoney } from "@/lib/pricing/calculations";

/**
 * Legacy quote money helpers — retained for parity (LEG-Q-01 / LEG-Q-02)
 * and `QUOTE_CALCULATION_AUTHORITY = "legacy"` rollback.
 *
 * Production create/recalc paths use
 * `lib/quotes/quote-commercial-engine-adapter.ts` (Batch 2B.8).
 */

export type QuoteTotals = {
  subtotal: number;
  gstAmount: number;
  totalInclGst: number;
};

export function calculateQuoteTotals(
  items: Array<{ total: number; visible: boolean }>,
  gstRate: number
): QuoteTotals {
  const subtotal = roundMoney(
    items
      .filter((item) => item.visible)
      .reduce((sum, item) => sum + (item.total ?? 0), 0)
  );
  const safeGstRate = gstRate != null && !Number.isNaN(gstRate) ? gstRate : 15;
  const gstAmount = roundMoney(subtotal * (safeGstRate / 100));
  const totalInclGst = roundMoney(subtotal + gstAmount);

  return { subtotal, gstAmount, totalInclGst };
}

/**
 * CD-22: prefer supplied total over qty × unit_price (approved quote-domain policy).
 */
export function calculateQuoteItemTotal(input: {
  quantity?: number | null;
  unitPrice?: number | null;
  total?: number | null;
}): number {
  if (input.total != null && !Number.isNaN(input.total)) {
    return roundMoney(input.total);
  }

  const quantity =
    input.quantity != null && !Number.isNaN(input.quantity)
      ? input.quantity
      : null;
  const unitPrice =
    input.unitPrice != null && !Number.isNaN(input.unitPrice)
      ? input.unitPrice
      : null;

  if (quantity != null && quantity > 0 && unitPrice != null) {
    return roundMoney(quantity * unitPrice);
  }

  return 0;
}
