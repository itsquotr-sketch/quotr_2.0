/**
 * COMPARISON-ONLY legacy estimate money helpers.
 * Sources: rates.deriveSellFromCost, margin-override, summary-style triad.
 * @deprecated Do not use in production paths.
 */

import { deriveSellFromCost } from "@/lib/estimate/rates";
import {
  recalculateSellFromCost,
  sumLineItemTotals,
} from "@/lib/estimate/margin-override";
import type { NormalizedFinancialOutputs } from "../types";

/** @deprecated comparison-only — LEG-E-01 */
export function legacyDeriveSellFromCost(
  cost: number,
  marginPercent: number
): number {
  return deriveSellFromCost(cost, marginPercent);
}

/** @deprecated comparison-only — LEG-E-15 */
export function legacyRecalculateSellFromCost(
  cost: number,
  marginPercent: number
): NormalizedFinancialOutputs {
  const result = recalculateSellFromCost(cost, marginPercent);
  return Object.freeze({
    totalCost: cost,
    totalSell: result.recommendedSell,
    grossProfit: result.grossProfit,
    grossMarginPercent: result.marginPercent,
    markupPercent: result.markupPercent,
    gstAmount: null,
    totalInclGst: null,
    gstRatePercent: null,
    costKnown: true,
  });
}

/** @deprecated comparison-only — LEG-E-16 */
export function legacySumEstimateLineTotals(
  lines: Array<{ recommendedCost: number; recommendedSell: number }>
): NormalizedFinancialOutputs {
  const padded = lines.map((l) => ({
    recommendedCost: l.recommendedCost,
    recommendedSell: l.recommendedSell,
    grossProfit: l.recommendedSell - l.recommendedCost,
    costLow: l.recommendedCost,
    costHigh: l.recommendedCost,
    sellLow: l.recommendedSell,
    sellHigh: l.recommendedSell,
  }));
  const result = sumLineItemTotals(padded);
  return Object.freeze({
    totalCost: result.recommendedCost,
    totalSell: result.recommendedSell,
    grossProfit: result.grossProfit,
    grossMarginPercent: result.marginPercent,
    markupPercent: result.markupPercent,
    gstAmount: null,
    totalInclGst: null,
    gstRatePercent: null,
    costKnown: true,
  });
}
