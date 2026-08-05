import type { EstimateLineItemInput } from "@/lib/estimate/types";

export type CostComponentSplit = {
  labourCost: number;
  materialCost: number;
  subcontractorCost: number;
  allowanceCost: number;
};

export type CategoryBreakdownTotals = Partial<
  Record<
    "labour" | "materials" | "subcontractor" | "allowance" | "contingency" | "mixed",
    { cost: number; sell: number; profit: number }
  >
>;

function isMixedCategory(category: string): boolean {
  return category === "mixed";
}

/**
 * Resolve how a line item contributes to category summary totals.
 * Uses explicit costComponents when present; otherwise maps by category.
 */
export function resolveLineItemCategorySplit(
  item: EstimateLineItemInput
): CostComponentSplit | null {
  const components = item.costComponents;
  if (!components) return null;

  const labourCost = components.labourCost ?? 0;
  const materialCost = components.materialCost ?? 0;
  const subcontractorCost = components.subcontractorCost ?? 0;
  const allowanceCost = components.allowanceCost ?? 0;
  const total =
    labourCost + materialCost + subcontractorCost + allowanceCost;

  if (total <= 0) return null;

  const knownCategories = [
    labourCost > 0,
    materialCost > 0,
    subcontractorCost > 0,
    allowanceCost > 0,
  ].filter(Boolean).length;

  if (knownCategories <= 1) return null;

  return { labourCost, materialCost, subcontractorCost, allowanceCost };
}

export function sumByCategoryWithSplits(
  items: EstimateLineItemInput[]
): CategoryBreakdownTotals {
  const totals: CategoryBreakdownTotals = {};

  const add = (
    category: keyof CategoryBreakdownTotals,
    cost: number,
    sell: number
  ) => {
    if (!totals[category]) {
      totals[category] = { cost: 0, sell: 0, profit: 0 };
    }
    totals[category]!.cost += cost;
    totals[category]!.sell += sell;
    totals[category]!.profit += Math.round((sell - cost) * 100) / 100;
  };

  for (const item of items) {
    if (item.includedInTotal === false) continue;

    const split = resolveLineItemCategorySplit(item);
    if (split) {
      const totalSplit =
        split.labourCost +
        split.materialCost +
        split.subcontractorCost +
        split.allowanceCost;
      if (totalSplit > 0) {
        const costRatio = item.recommendedCost / totalSplit;
        const sellRatio =
          item.recommendedSell / Math.max(item.recommendedCost, 0.01);

        if (split.labourCost > 0) {
          add("labour", split.labourCost * costRatio, split.labourCost * costRatio * sellRatio);
        }
        if (split.materialCost > 0) {
          add(
            "materials",
            split.materialCost * costRatio,
            split.materialCost * costRatio * sellRatio
          );
        }
        if (split.subcontractorCost > 0) {
          add(
            "subcontractor",
            split.subcontractorCost * costRatio,
            split.subcontractorCost * costRatio * sellRatio
          );
        }
        if (split.allowanceCost > 0) {
          add(
            "allowance",
            split.allowanceCost * costRatio,
            split.allowanceCost * costRatio * sellRatio
          );
        }
        continue;
      }
    }

    if (isMixedCategory(item.category)) {
      add("mixed", item.recommendedCost, item.recommendedSell);
      continue;
    }

    const category = item.category as keyof CategoryBreakdownTotals;
    if (
      category === "labour" ||
      category === "materials" ||
      category === "subcontractor" ||
      category === "allowance" ||
      category === "contingency"
    ) {
      add(category, item.recommendedCost, item.recommendedSell);
    }
  }

  return totals;
}
