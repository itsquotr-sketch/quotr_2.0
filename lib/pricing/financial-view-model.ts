/**
 * Pricing financial view model for UI — Batch 2B.9.
 * Maps persisted/authoritative values; does not recalculate money.
 */

import { presentPricingDocumentCostKnown } from "@/lib/pricing/presentation-section-totals";
import type { PricingDocument, PricingItem } from "@/lib/pricing/types";
import {
  formatMoneyOrDash,
  formatProfitabilityDisplay,
} from "@/lib/financial-presentation/format";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";

export function pricingItemViewModel(item: PricingItem) {
  const profitability = formatProfitabilityDisplay({
    costKnown: item.cost_known,
    grossProfit: item.gross_profit,
    marginPercent: item.margin_percent,
    markupPercent: item.markup_percent,
  });

  return {
    totalCost: item.total_cost,
    totalSell: item.total_sell,
    costKnown: item.cost_known,
    manuallyEdited: item.manually_edited,
    totalSellFormatted: formatPricingMoney(item.total_sell),
    totalCostFormatted: formatPricingMoney(item.total_cost),
    profitLabel: profitability.profitLabel,
    marginLabel: profitability.marginLabel,
    markupLabel: profitability.markupLabel,
  };
}

export function pricingDocumentViewModel(document: PricingDocument) {
  const costKnown = presentPricingDocumentCostKnown(document);
  const profitability = formatProfitabilityDisplay({
    costKnown,
    grossProfit: document.gross_profit,
    marginPercent: document.margin_percent,
    markupPercent: document.markup_percent,
  });

  return {
    costKnown,
    subtotalCostFormatted: formatPricingMoney(document.subtotal_cost),
    subtotalSellFormatted: formatPricingMoney(document.subtotal_sell),
    gstRate: document.gst_rate,
    gstAmountFormatted: formatPricingMoney(document.gst_amount),
    totalInclGstFormatted: formatPricingMoney(document.total_incl_gst),
    profitLabel: profitability.profitLabel,
    marginLabel: profitability.marginLabel,
    gstLabel: `GST (${document.gst_rate}%)`,
  };
}

export { formatMoneyOrDash, formatPricingPercent };
