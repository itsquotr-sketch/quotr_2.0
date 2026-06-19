import type { OrganisationSettings } from "@/components/setup/types";
import { round2 } from "@/lib/estimate/facts";
import { deriveSellFromCost, getRangeFactors } from "@/lib/estimate/rates";

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

export function applyMarginToAmounts(
  recommendedCost: number,
  marginPercent: number,
  organisationSettings: OrganisationSettings | null
) {
  const sells = recalculateSellFromCost(recommendedCost, marginPercent);
  const { low, high } = getRangeFactors(organisationSettings);

  return {
    recommendedCost: round2(recommendedCost),
    ...sells,
    sellLow: round2(sells.recommendedSell * low),
    sellHigh: round2(sells.recommendedSell * high),
    costLow: round2(recommendedCost * low),
    costHigh: round2(recommendedCost * high),
  };
}

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

export const MARGIN_MIN_PERCENT = 1;
export const MARGIN_MAX_PERCENT = 70;

export function validateTargetMarginPercent(value: number): string | null {
  if (!Number.isFinite(value)) {
    return "Enter a valid margin percentage.";
  }
  if (value < MARGIN_MIN_PERCENT || value > MARGIN_MAX_PERCENT) {
    return `Margin must be between ${MARGIN_MIN_PERCENT}% and ${MARGIN_MAX_PERCENT}%.`;
  }
  return null;
}
