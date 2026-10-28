/**
 * Pricing financial view model for UI — Batch 2B.9.
 * Maps persisted/authoritative values; does not recalculate money.
 */

import { presentPricingDocumentCostKnown } from "@/lib/pricing/presentation-section-totals";
import type { PricingDocument, PricingItem } from "@/lib/pricing/types";
import {
  COST_UNKNOWN_LABEL,
  formatMoneyOrDash,
  formatProfitabilityDisplay,
} from "@/lib/financial-presentation/format";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import { presentGstForRegistration } from "@/lib/pricing/gst-presentation";
import { isReplacedSubcontractPlaceholder } from "@/lib/pricing/replaced-subcontract-line";
import { isManualScopePricingRequiredNote } from "@/lib/work-areas/scope-items/pricing-bridge";

export function pricingItemViewModel(item: PricingItem) {
  if (isReplacedSubcontractPlaceholder(item)) {
    return {
      totalCost: item.total_cost,
      totalSell: item.total_sell,
      costKnown: false,
      pricingRequired: false,
      manuallyEdited: item.manually_edited,
      totalSellFormatted: "Not on the quote",
      totalCostFormatted: "Replaced",
      profitLabel: "—",
      marginLabel: "—",
      markupLabel: "—",
    };
  }
  const sell = Number(item.total_sell ?? 0);
  const unpricedSell = !Number.isFinite(sell) || sell <= 0;
  const pricingRequired =
    (isManualScopePricingRequiredNote(item.notes_internal) && unpricedSell) ||
    (item.cost_known === false && unpricedSell);
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
      : item.cost_known === false
        ? COST_UNKNOWN_LABEL
        : formatPricingMoney(item.total_cost),
    profitLabel: profitability.profitLabel,
    marginLabel: profitability.marginLabel,
    markupLabel: profitability.markupLabel,
  };
}

/**
 * A stored gross_profit of 0 is only a complete result when every line cost
 * is known. Mixed documents keep the known-cost sum in subtotal_cost and
 * must not present that 0 as profit or a margin.
 */
export function pricingDocumentCostComplete(
  items: readonly Pick<PricingItem, "cost_known">[] | undefined
): boolean | null {
  if (items == null) return null;
  return items.every((item) => item.cost_known !== false);
}

export function pricingDocumentViewModel(
  document: PricingDocument,
  items?: readonly Pick<PricingItem, "cost_known">[],
  gstRegistered?: boolean | null
) {
  const fromItems = pricingDocumentCostComplete(items);
  const costKnown =
    fromItems == null ? presentPricingDocumentCostKnown(document) : fromItems;
  const profitability = formatProfitabilityDisplay({
    costKnown,
    grossProfit: costKnown ? document.gross_profit : 0,
    marginPercent: costKnown ? document.margin_percent : 0,
    markupPercent: costKnown ? document.markup_percent : 0,
  });
  const knownCostFormatted = formatPricingMoney(document.subtotal_cost);
  const directCostLabel = costKnown
    ? knownCostFormatted
    : document.subtotal_cost > 0
      ? `Known cost ${knownCostFormatted}`
      : COST_UNKNOWN_LABEL;

  const gst = presentGstForRegistration({
    gstRegistered,
    gstRate: document.gst_rate,
    gstAmount: document.gst_amount,
    subtotalExGst: document.subtotal_sell,
    totalInclGst: document.total_incl_gst,
  });
  const gstWithheld = gst.registration === "unset" || gst.registration === "not_registered";

  return {
    costKnown,
    costIncomplete: !costKnown,
    knownCostFormatted,
    directCostLabel,
    subtotalCostFormatted: knownCostFormatted,
    subtotalSellFormatted: formatPricingMoney(document.subtotal_sell),
    gstRate: gstWithheld ? 0 : document.gst_rate,
    gstAmountFormatted: gst.registration === "unset"
      ? "Not decided"
      : formatPricingMoney(gst.gstAmount),
    totalInclGstFormatted: formatPricingMoney(gst.inclGst),
    gstRegistration: gst.registration,
    profitLabel: profitability.profitLabel,
    marginLabel: profitability.marginLabel,
    gstLabel: gst.gstLabel,
    showGst: gst.showGst,
  };
}

export { formatMoneyOrDash, formatPricingPercent };
