/**
 * COMPARISON-ONLY legacy quote calculators.
 * Source: lib/quotes/calculations.ts (C-30 / C-31).
 * @deprecated Do not use in production paths.
 */

import {
  calculateQuoteItemTotal,
  calculateQuoteTotals,
} from "@/lib/quotes/calculations";
import type { NormalizedFinancialOutputs } from "../types";

/** @deprecated comparison-only — LEG-Q-01 */
export function legacyCalculateQuoteDocument(
  items: Array<{ total: number; visible: boolean }>,
  gstRate: number
): NormalizedFinancialOutputs {
  const result = calculateQuoteTotals(items, gstRate);
  return Object.freeze({
    totalCost: null,
    totalSell: result.subtotal,
    grossProfit: null,
    grossMarginPercent: null,
    markupPercent: null,
    gstAmount: result.gstAmount,
    totalInclGst: result.totalInclGst,
    gstRatePercent: gstRate != null && !Number.isNaN(gstRate) ? gstRate : 15,
    costKnown: null,
  });
}

/** @deprecated comparison-only — LEG-Q-02 */
export function legacyCalculateQuoteItemTotal(input: {
  quantity?: number | null;
  unitPrice?: number | null;
  total?: number | null;
}): number {
  return calculateQuoteItemTotal(input);
}
