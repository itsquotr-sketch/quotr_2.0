import { quoteItemsForBaseTotal } from "@/lib/quotes/presentation";
import { calculateAuthoritativeQuoteTotals } from "@/lib/quotes/quote-commercial-engine-adapter";

/**
 * Snapshot / draft-recalc policy: optional lines persist but do not enter
 * the base Quote sell/GST totals. Does not change engine formulas or
 * inclusion_rule (visible_only). Callers pass only included lines into the
 * existing adapter.
 */
export function calculateQuoteBaseTotalsFromItems(
  items: readonly {
    total?: number | null;
    visible?: boolean;
    optional?: boolean;
  }[],
  gstRatePercent: number,
  requestId = "quote-base-totals"
) {
  return calculateAuthoritativeQuoteTotals(
    quoteItemsForBaseTotal(items).map((item) => ({
      total: item.total ?? 0,
      visible: true,
    })),
    gstRatePercent,
    requestId
  );
}
