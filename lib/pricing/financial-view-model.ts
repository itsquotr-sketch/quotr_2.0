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
import { presentStoredGst } from "@/lib/pricing/gst-presentation";
import { isManualScopePricingRequiredNote } from "@/lib/work-areas/scope-items/pricing-bridge";

export function pricingItemViewModel(item: PricingItem) {
  const pricingRequired = isManualScopePricingRequiredNote(
    item.notes_internal
  );
  const profitability = formatProfitabilityDisplay({
    costKnown: pricingRequired ? false : item.cost_known,
    grossProfit: item.gross_profit,
    marginPercent: item.margin_percent,
    markupPercent: item.markup_percent,
  });

  return {
    totalCost: item.total_cost,
    totalSell: item.total_sell,
    costKnown: pricingRequired ? false : item.cost_known,
    pricingRequired,
    manuallyEdited: item.manually_edited,
    totalSellFormatted: pricingRequired
      ? "Pricing required"
      : formatPricingMoney(item.total_sell),
    totalCostFormatted: pricingRequired
      ? "—"
      : formatPricingMoney(item.total_cost),
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

  const gst = presentStoredGst({
    gstRate: document.gst_rate,
    gstAmount: document.gst_amount,
    subtotalExGst: document.subtotal_sell,
    totalInclGst: document.total_incl_gst,
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
    gstLabel: gst.gstLabel,
    showGst: gst.showGst,
  };
}

export { formatMoneyOrDash, formatPricingPercent };
