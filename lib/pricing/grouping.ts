import type { PricingItem, PricingItemType, PricingWorkArea } from "@/lib/pricing/types";
import { groupItemsByWorkArea } from "@/lib/pricing/mappers";

export type PricingGroupBy = "work_area" | "cost_type" | "all";

export type PricingItemGroup = {
  key: string;
  title: string;
  workArea: PricingWorkArea | null;
  items: PricingItem[];
};

/**
 * Canonical pricing item_type → Cost Type grouping labels.
 * Waste is a requirement kind, not a pricing item_type — not a group here.
 */
export const COST_TYPE_GROUPS: Array<{
  key: string;
  label: string;
  types: PricingItemType[];
}> = [
  { key: "material", label: "Materials", types: ["material"] },
  { key: "labour", label: "Labour", types: ["labour"] },
  { key: "plant", label: "Plant", types: ["equipment"] },
  { key: "subcontract", label: "Subcontractors", types: ["subcontractor"] },
  { key: "allowance", label: "Allowances", types: ["allowance"] },
  { key: "other", label: "Other", types: ["contingency", "other"] },
];

export function costTypeLabelForItemType(itemType: PricingItemType): string {
  return (
    COST_TYPE_GROUPS.find((group) => group.types.includes(itemType))?.label ??
    "Other"
  );
}

export function isManuallyAddedPricingItem(item: PricingItem): boolean {
  return item.source_estimate_line_item_id == null;
}

export function groupPricingItems(
  items: PricingItem[],
  workAreas: PricingWorkArea[],
  groupBy: PricingGroupBy
): PricingItemGroup[] {
  if (groupBy === "all") {
    return [
      {
        key: "all",
        title: "All items",
        workArea: null,
        items: [...items].sort((a, b) => a.sort_order - b.sort_order),
      },
    ];
  }

  if (groupBy === "cost_type") {
    const groups: PricingItemGroup[] = COST_TYPE_GROUPS.map((group) => ({
      key: group.key,
      title: group.label,
      workArea: null,
      items: items
        .filter((item) => group.types.includes(item.item_type))
        .sort((a, b) => a.sort_order - b.sort_order),
    }));

    const knownTypes = new Set(COST_TYPE_GROUPS.flatMap((group) => group.types));
    const leftover = items.filter((item) => !knownTypes.has(item.item_type));
    if (leftover.length > 0) {
      const other = groups.find((group) => group.key === "other");
      if (other) {
        other.items = [...other.items, ...leftover].sort(
          (a, b) => a.sort_order - b.sort_order
        );
      }
    }

    return groups.filter((group) => group.items.length > 0);
  }

  return groupItemsByWorkArea(items, workAreas).map((section) => ({
    key: section.workArea?.id ?? "general",
    title: section.workArea?.name ?? "General",
    workArea: section.workArea,
    items: section.items,
  }));
}
