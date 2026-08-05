/**
 * Quote financial view model for UI / print — Batch 2B.9.
 * Always returns stored snapshot values. Never recalculates.
 */

import type { Quote, QuoteItem } from "@/lib/quotes/types";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";

export function quoteDocumentViewModel(quote: Quote) {
  return {
    status: quote.status,
    revisionNumber: quote.revision_number,
    isHistorical:
      quote.status !== "draft" || Boolean(quote.superseded_by_quote_id),
    subtotalFormatted: formatPricingMoney(quote.subtotal),
    gstRate: quote.gst_rate,
    gstAmountFormatted: formatPricingMoney(quote.gst_amount),
    totalInclGstFormatted: formatPricingMoney(quote.total_incl_gst),
    gstLabel: `GST (${quote.gst_rate}%)`,
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
