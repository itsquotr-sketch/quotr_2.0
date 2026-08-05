/**
 * Pricing section / document presentation totals — Batch 2B.9.
 * Uses production authoritative aggregate. No ad hoc React formulas.
 */

import {
  calculateAuthoritativeDocumentTotals,
  inferPersistedLineCostKnown,
} from "@/lib/pricing/authoritative-document-totals";
import type { PricingDocument, PricingItem } from "@/lib/pricing/types";

export type PricingSectionPresentationTotals = {
  readonly subtotalCost: number;
  readonly subtotalSell: number;
  readonly grossProfit: number;
  readonly marginPercent: number;
  readonly markupPercent: number;
  readonly costKnown: boolean;
};

/**
 * Work-area / section rollup for pricing UI (GST not applied at section level).
 */
export function presentPricingSectionTotals(
  items: readonly Pick<PricingItem, "total_cost" | "total_sell" | "cost_known">[]
): PricingSectionPresentationTotals {
  const result = calculateAuthoritativeDocumentTotals(
    items.map((item) => ({
      total_cost: item.total_cost,
      total_sell: item.total_sell,
      cost_known: item.cost_known,
    })),
    0,
    "pricing-section-presentation"
  );

  if (!result.ok) {
    return {
      subtotalCost: 0,
      subtotalSell: 0,
      grossProfit: 0,
      marginPercent: 0,
      markupPercent: 0,
      costKnown: true,
    };
  }

  const t = result.totals;
  return {
    subtotalCost: t.subtotalCost,
    subtotalSell: t.subtotalSell,
    grossProfit: t.grossProfit,
    marginPercent: t.marginPercent,
    markupPercent: t.markupPercent,
    costKnown: t.costKnown,
  };
}

/**
 * Document-level profitability display flag from persisted totals.
 * Prefer item-level cost_known when rendering lines.
 */
export function presentPricingDocumentCostKnown(
  document: Pick<PricingDocument, "subtotal_cost" | "subtotal_sell">
): boolean {
  return inferPersistedLineCostKnown({
    total_cost: document.subtotal_cost,
    total_sell: document.subtotal_sell,
  });
}
