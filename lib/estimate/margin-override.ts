import type { OrganisationSettings } from "@/components/setup/types";
import { round2 } from "@/lib/estimate/facts";
import {
  aggregateEstimateLines,
  applyAuthoritativeMarginToAmounts,
} from "@/lib/estimate/estimate-commercial-engine-adapter";
import { deriveSellFromCost } from "@/lib/estimate/rates";

/**
 * Pure legacy sell-from-cost triad — retained for parity (LEG-E-01 / LEG-E-15).
 * Production margin paths use applyMarginToAmounts → commercial engine.
 */
export function recalculateSellFromCost(
  recommendedCost: number,
  marginPercent: number
) {
  const recommendedSell = deriveSellFromCost(recommendedCost, marginPercent);
  const grossProfit = round2(recommendedSell - recommendedCost);
  const margin =
    recommendedSell > 0
      ? round2((grossProfit / recommendedSell) * 100)
      : 0;
  const markup =
    recommendedCost > 0
      ? round2((grossProfit / recommendedCost) * 100)
      : 0;

  return {
    recommendedSell,
    grossProfit,
    marginPercent: margin,
    markupPercent: markup,
  };
}

/** Production: engine sell-from-margin + domain range factors. */
export function applyMarginToAmounts(
  recommendedCost: number,
  marginPercent: number,
  organisationSettings: OrganisationSettings | null
) {
  return applyAuthoritativeMarginToAmounts(
    recommendedCost,
    marginPercent,
    organisationSettings
  );
}

/**
 * Pure legacy sum — retained for parity (LEG-E-16).
 * Does not filter includedInTotal. Production uses aggregateEstimateLineTotals.
 */
export function sumLineItemTotals(
  lineItems: {
    recommendedCost: number;
    recommendedSell: number;
    grossProfit: number;
    costLow: number;
    costHigh: number;
    sellLow: number;
    sellHigh: number;
  }[]
) {
  const recommendedCost = round2(
    lineItems.reduce((sum, item) => sum + item.recommendedCost, 0)
  );
  const recommendedSell = round2(
    lineItems.reduce((sum, item) => sum + item.recommendedSell, 0)
  );
  const grossProfit = round2(recommendedSell - recommendedCost);
  const marginPercent =
    recommendedSell > 0
      ? round2((grossProfit / recommendedSell) * 100)
      : 0;
  const markupPercent =
    recommendedCost > 0
      ? round2((grossProfit / recommendedCost) * 100)
      : 0;

  return {
    recommendedCost,
    recommendedSell,
    grossProfit,
    marginPercent,
    markupPercent,
    costLow: round2(lineItems.reduce((sum, item) => sum + item.costLow, 0)),
    costHigh: round2(lineItems.reduce((sum, item) => sum + item.costHigh, 0)),
    sellLow: round2(lineItems.reduce((sum, item) => sum + item.sellLow, 0)),
    sellHigh: round2(lineItems.reduce((sum, item) => sum + item.sellHigh, 0)),
  };
}

/**
 * Authoritative estimate aggregation (filters includedInTotal !== false, no GST).
 * Prefer this over sumLineItemTotals for production paths.
 */
export function aggregateEstimateLineTotals(
  lineItems: {
    recommendedCost: number;
    recommendedSell: number;
    costLow: number;
    costHigh: number;
    sellLow: number;
    sellHigh: number;
    includedInTotal?: boolean;
    costKnown?: boolean;
  }[]
) {
  return aggregateEstimateLines(lineItems);
}

export function applyTargetMarginToLineItems<T extends {
  recommendedCost: number;
  recommendedSell?: number;
  costLow?: number;
  costHigh?: number;
  sellLow?: number;
  sellHigh?: number;
  grossProfit?: number;
  marginPercent?: number;
  markupPercent?: number;
}>(
  lineItems: T[],
  targetMarginPercent: number,
  organisationSettings: OrganisationSettings | null
): T[] {
  return lineItems.map((item) => {
    const amounts = applyMarginToAmounts(
      item.recommendedCost,
      targetMarginPercent,
      organisationSettings
    );
    return {
      ...item,
      costLow: amounts.costLow,
      costHigh: amounts.costHigh,
      sellLow: amounts.sellLow,
      sellHigh: amounts.sellHigh,
      recommendedSell: amounts.recommendedSell,
      grossProfit: amounts.grossProfit,
      marginPercent: amounts.marginPercent,
      markupPercent: amounts.markupPercent,
    };
  });
}

export const MARGIN_MIN_PERCENT = 0;
export const MARGIN_MAX_PERCENT = 95;

export function validateTargetMarginPercent(value: number): string | null {
  if (!Number.isFinite(value)) {
    return "Enter a valid gross margin percentage.";
  }
  if (value < MARGIN_MIN_PERCENT || value > MARGIN_MAX_PERCENT) {
    return `Gross margin must be between ${MARGIN_MIN_PERCENT}% and ${MARGIN_MAX_PERCENT}%.`;
  }
  return null;
}
