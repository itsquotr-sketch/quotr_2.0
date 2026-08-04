/**
 * COMPARISON-ONLY legacy pricing item calculator.
 * Reuses live pure helpers without changing call sites.
 * @deprecated Do not use in production paths. Not part of commercial-engine public API.
 */

import {
  calculatePricingItemTotals,
  type PricingItemTotalsInput,
} from "@/lib/pricing/calculations";
import type { NormalizedFinancialOutputs } from "../types";

/** @deprecated comparison-only */
export function legacyCalculatePricingItem(
  input: PricingItemTotalsInput
): NormalizedFinancialOutputs {
  const result = calculatePricingItemTotals(input);
  const costKnown = !(result.totalCost === 0 && result.totalSell > 0 && input.unitCost == null && input.totalCost == null);
  // Legacy always fabricates triad numbers — never null margin
  return Object.freeze({
    totalCost: result.totalCost,
    totalSell: result.totalSell,
    grossProfit: result.grossProfit,
    grossMarginPercent: result.marginPercent,
    markupPercent: result.markupPercent,
    gstAmount: null,
    totalInclGst: null,
    gstRatePercent: null,
    costKnown,
  });
}

/** Explicit sell-only lump path as legacy behaves (cost coerced to 0 → 100% margin). */
export function legacySellOnlyLumpProfit(
  totalSell: number
): NormalizedFinancialOutputs {
  const totalCost = 0;
  const grossProfit = Math.round((totalSell - totalCost) * 100) / 100;
  const marginPercent =
    totalSell > 0
      ? Math.round((grossProfit / totalSell) * 100 * 100) / 100
      : 0;
  return Object.freeze({
    totalCost,
    totalSell,
    grossProfit,
    grossMarginPercent: marginPercent,
    markupPercent: 0,
    gstAmount: null,
    totalInclGst: null,
    gstRatePercent: null,
    costKnown: false,
  });
}
