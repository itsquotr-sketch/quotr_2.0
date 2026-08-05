/**
 * Estimate presentation breakdowns — Batch 2B.9.
 * Groups lines for display; money rollups use the production estimate adapter.
 */

import { aggregateEstimateLines } from "@/lib/estimate/estimate-commercial-engine-adapter";
import { round2 } from "@/lib/estimate/facts";
import { sumByCategoryWithSplits } from "@/lib/estimate/category-breakdown";
import type { EstimateLineItemInput } from "@/lib/estimate/types";
import { inferDisplayCostKnown } from "@/lib/financial-presentation/format";

export type EstimatePresentationLine = {
  readonly workAreaName: string;
  readonly label: string;
  readonly category: string;
  readonly recommendedCost: number;
  readonly recommendedSell: number;
  readonly grossProfit: number;
  readonly marginPercent: number;
  readonly markupPercent?: number;
  readonly costLow: number;
  readonly costHigh: number;
  readonly sellLow: number;
  readonly sellHigh: number;
  readonly rateSource: string;
  readonly labourHours?: number;
  readonly includedInTotal?: boolean;
  readonly costComponents?: EstimateLineItemInput["costComponents"];
};

export type WorkAreaPresentationTotals<T extends EstimatePresentationLine = EstimatePresentationLine> = {
  readonly name: string;
  readonly cost: number;
  readonly sell: number;
  readonly profit: number;
  readonly marginPercent: number;
  readonly costKnown: boolean;
  readonly hours: number;
  readonly lineItemCount: number;
  readonly items: T[];
};

/**
 * Work-area rollup: sum persisted line money via commercial-engine aggregate.
 * Margin is derived from aggregate totals (not unrounded client division).
 */
export function presentEstimateWorkAreaTotals<T extends EstimatePresentationLine>(
  items: readonly T[]
): WorkAreaPresentationTotals<T>[] {
  const included = items.filter((item) => item.includedInTotal !== false);
  const byArea = new Map<string, T[]>();
  for (const item of included) {
    const name = item.workAreaName || "General";
    const list = byArea.get(name) ?? [];
    list.push(item);
    byArea.set(name, list);
  }

  return [...byArea.entries()].map(([name, areaItems]) => {
    const agg = aggregateEstimateLines(
      areaItems.map((item) => ({
        recommendedCost: item.recommendedCost,
        recommendedSell: item.recommendedSell,
        costLow: item.costLow,
        costHigh: item.costHigh,
        sellLow: item.sellLow,
        sellHigh: item.sellHigh,
        includedInTotal: item.includedInTotal,
        costKnown: inferDisplayCostKnown(
          item.recommendedCost,
          item.recommendedSell
        ),
      })),
      `estimate-work-area:${name}`
    );

    const hours = areaItems.reduce(
      (sum, item) => sum + (item.labourHours ?? 0),
      0
    );

    return {
      name,
      cost: agg.recommendedCost,
      sell: agg.recommendedSell,
      profit: agg.grossProfit,
      marginPercent: agg.marginPercent,
      costKnown: agg.costKnown,
      hours: round2(hours),
      lineItemCount: areaItems.length,
      items: areaItems,
    };
  });
}

/**
 * Category rollup for display. Uses domain split helper for cost allocation,
 * then rounds money with round2.
 */
export function presentEstimateCategoryTotals(
  items: readonly EstimatePresentationLine[]
) {
  const mapped: EstimateLineItemInput[] = items.map((item, index) => ({
    workAreaId: `wa-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category as EstimateLineItemInput["category"],
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent ?? 0,
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    rateSource: item.rateSource,
    sortOrder: index,
    includedInTotal: item.includedInTotal,
    costComponents: item.costComponents,
  }));

  const raw = sumByCategoryWithSplits(mapped);
  const rounded: typeof raw = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value) continue;
    const k = key as keyof typeof raw;
    rounded[k] = {
      cost: round2(value.cost),
      sell: round2(value.sell),
      profit: round2(value.profit),
    };
  }
  return rounded;
}

export function presentEstimateCategoryMargin(
  cost: number,
  sell: number,
  profit: number
): { marginPercent: number; costKnown: boolean } {
  const costKnown = inferDisplayCostKnown(cost, sell);
  if (!costKnown || sell <= 0) {
    return { marginPercent: 0, costKnown };
  }
  return {
    marginPercent: round2((profit / sell) * 100),
    costKnown: true,
  };
}
