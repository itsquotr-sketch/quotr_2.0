/**
 * Quote financial view model for UI / print — Batch 2B.9.
 * Always returns stored snapshot values. Never recalculates.
 */

import type { Quote, QuoteItem } from "@/lib/quotes/types";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import { presentStoredGst } from "@/lib/pricing/gst-presentation";

export function quoteDocumentViewModel(quote: Quote) {
  const gst = presentStoredGst({
    gstRate: quote.gst_rate,
    gstAmount: quote.gst_amount,
    subtotalExGst: quote.subtotal,
    totalInclGst: quote.total_incl_gst,
  });
  return {
    status: quote.status,
    revisionNumber: quote.revision_number,
    isHistorical:
      quote.status !== "draft" || Boolean(quote.superseded_by_quote_id),
    subtotalFormatted: formatPricingMoney(quote.subtotal),
    gstRate: quote.gst_rate,
    gstAmountFormatted: formatPricingMoney(quote.gst_amount),
    totalInclGstFormatted: formatPricingMoney(quote.total_incl_gst),
    gstLabel: gst.gstLabel,
    showGst: gst.showGst,
  };
}

export function quoteItemViewModel(item: QuoteItem) {
  return {
    visible: item.visible,
    totalFormatted: formatPricingMoney(item.total),
    unitPriceFormatted:
      item.unit_price != null ? formatPricingMoney(item.unit_price) : "—",
  };
}

export { formatPricingMoney, formatPricingPercent };
