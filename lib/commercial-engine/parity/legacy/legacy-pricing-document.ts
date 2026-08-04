/**
 * COMPARISON-ONLY legacy pricing document aggregate.
 * Source: lib/pricing/calculations.ts calculateDocumentTotals (C-26 / LEG-P-03).
 * @deprecated Do not use in production paths.
 */

import { calculateDocumentTotals } from "@/lib/pricing/calculations";
import { DEFAULT_GST_RATE } from "@/lib/pricing/status";
import type { NormalizedFinancialOutputs } from "../types";

/** @deprecated comparison-only — reproduces LEG-P-03 exactly */
export function legacyCalculatePricingDocument(
  items: Array<{ total_cost: number; total_sell: number }>,
  gstRate: number
): NormalizedFinancialOutputs {
  const result = calculateDocumentTotals(items, gstRate);
  return Object.freeze({
    totalCost: result.subtotalCost,
    totalSell: result.subtotalSell,
    grossProfit: result.grossProfit,
    grossMarginPercent: result.marginPercent,
    markupPercent: result.markupPercent,
    gstAmount: result.gstAmount,
    totalInclGst: result.totalInclGst,
    gstRatePercent: gstRate,
    costKnown: !(result.subtotalCost === 0 && result.subtotalSell > 0),
  });
}

/**
 * Reproduce C-28 createPricingFromEstimate GST bug behaviour for comparison:
 * document labelled with orgGstRate but recalc uses DEFAULT_GST_RATE (15).
 * Historical evidence only — live path fixed in Batch 2B.5.
 * @deprecated comparison-only
 */
export function legacyCreatePricingFromEstimateGstBug(params: {
  items: Array<{ total_cost: number; total_sell: number }>;
  orgGstRate: number;
}): {
  readonly labelledGstRate: number;
  readonly recalculatedWith: number;
  readonly insertPathTotals: NormalizedFinancialOutputs;
  readonly postRecalcTotals: NormalizedFinancialOutputs;
} {
  const labelledGstRate = params.orgGstRate;
  const recalculatedWith = DEFAULT_GST_RATE;
  return Object.freeze({
    labelledGstRate,
    recalculatedWith,
    insertPathTotals: legacyCalculatePricingDocument(
      params.items,
      labelledGstRate
    ),
    postRecalcTotals: legacyCalculatePricingDocument(
      params.items,
      recalculatedWith
    ),
  });
}

/**
 * Corrected createPricingFromEstimate GST wiring (Batch 2B.5 / LEG-P-05):
 * insert labelling and post-item recalc use the same organisation GST rate.
 * @deprecated comparison-only — mirrors live lib/pricing/gst-source + actions
 */
export function legacyCreatePricingFromEstimateGstCorrected(params: {
  items: Array<{ total_cost: number; total_sell: number }>;
  orgGstRate: number;
}): {
  readonly labelledGstRate: number;
  readonly recalculatedWith: number;
  readonly insertPathTotals: NormalizedFinancialOutputs;
  readonly postRecalcTotals: NormalizedFinancialOutputs;
} {
  const labelledGstRate = params.orgGstRate;
  const recalculatedWith = params.orgGstRate;
  const totals = legacyCalculatePricingDocument(params.items, labelledGstRate);
  return Object.freeze({
    labelledGstRate,
    recalculatedWith,
    insertPathTotals: totals,
    postRecalcTotals: totals,
  });
}
