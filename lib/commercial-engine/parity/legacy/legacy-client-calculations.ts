/**
 * COMPARISON-ONLY client-side calculation reproductions.
 * @deprecated Do not use in production paths.
 */

import type { NormalizedFinancialOutputs } from "../types";

/** Reproduce C-35 / LEG-UI-01 profit preview triad. */
export function legacyClientProfitPreview(
  totalCost: number,
  totalSell: number
): NormalizedFinancialOutputs {
  const grossProfit = Math.round((totalSell - totalCost) * 100) / 100;
  const marginPercent =
    totalSell > 0
      ? Math.round((grossProfit / totalSell) * 100 * 100) / 100
      : 0;
  const markupPercent =
    totalCost > 0
      ? Math.round((grossProfit / totalCost) * 100 * 100) / 100
      : 0;
  return Object.freeze({
    totalCost,
    totalSell,
    grossProfit,
    grossMarginPercent: marginPercent,
    markupPercent,
    gstAmount: null,
    totalInclGst: null,
    gstRatePercent: null,
    costKnown: true,
  });
}

/** Reproduce C-36 unrounded work-area margin. */
export function legacyClientUnroundedMargin(
  cost: number,
  sell: number
): { profit: number; marginPercent: number } {
  const profit = sell - cost;
  return {
    profit,
    marginPercent: sell > 0 ? (profit / sell) * 100 : 0,
  };
}
