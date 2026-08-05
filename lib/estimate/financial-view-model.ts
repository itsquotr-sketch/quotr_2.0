/**
 * Estimate financial view model for UI — Batch 2B.9.
 * Displays persisted authoritative values; confidence stays separate.
 */

import type { Estimate, EstimateLineItem } from "@/components/assistant/types";
import {
  formatProfitabilityDisplay,
  inferDisplayCostKnown,
} from "@/lib/financial-presentation/format";
import { formatCurrency, formatPercent } from "@/components/assistant/format";

export function estimateLineViewModel(item: EstimateLineItem) {
  const costKnown = inferDisplayCostKnown(
    item.recommendedCost,
    item.recommendedSell
  );
  const profitability = formatProfitabilityDisplay({
    costKnown,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
  });

  return {
    costKnown,
    recommendedCostFormatted: formatCurrency(item.recommendedCost),
    recommendedSellFormatted: formatCurrency(item.recommendedSell),
    profitLabel: profitability.profitLabel,
    marginLabel: profitability.marginLabel,
  };
}

export function estimateDocumentViewModel(estimate: Estimate) {
  const costKnown = inferDisplayCostKnown(
    estimate.recommendedCost,
    estimate.recommendedSell
  );
  const profitability = formatProfitabilityDisplay({
    costKnown,
    grossProfit: estimate.grossProfit,
    marginPercent: estimate.marginPercent,
    markupPercent: estimate.markupPercent,
  });

  return {
    costKnown,
    confidence: estimate.confidence,
    recommendedCostFormatted: formatCurrency(estimate.recommendedCost),
    recommendedSellFormatted: formatCurrency(estimate.recommendedSell),
    profitLabel: profitability.profitLabel,
    marginLabel: profitability.marginLabel,
    markupLabel:
      estimate.markupPercent != null
        ? profitability.markupLabel
        : null,
    // Confidence is metadata — never used as a money multiplier.
    confidenceFormatted: formatPercent(estimate.confidence),
  };
}
