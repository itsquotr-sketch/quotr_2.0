import type { PricingItemType } from "@/lib/pricing/types";

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export type PricingItemTotalsInput = {
  quantity?: number | null;
  unitCost?: number | null;
  unitSell?: number | null;
  totalCost?: number | null;
  totalSell?: number | null;
  itemType?: PricingItemType;
};

export type PricingItemTotals = {
  quantity: number | null;
  unitCost: number | null;
  unitSell: number | null;
  totalCost: number;
  totalSell: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent: number;
};

function isLumpSumType(itemType?: PricingItemType): boolean {
  return itemType === "allowance" || itemType === "contingency";
}

export function calculatePricingItemTotals(
  input: PricingItemTotalsInput
): PricingItemTotals {
  const quantity =
    input.quantity != null && !Number.isNaN(input.quantity)
      ? input.quantity
      : null;
  const unitCost =
    input.unitCost != null && !Number.isNaN(input.unitCost)
      ? roundMoney(input.unitCost)
      : null;
  const unitSell =
    input.unitSell != null && !Number.isNaN(input.unitSell)
      ? roundMoney(input.unitSell)
      : null;

  let totalCost =
    input.totalCost != null && !Number.isNaN(input.totalCost)
      ? roundMoney(input.totalCost)
      : 0;
  let totalSell =
    input.totalSell != null && !Number.isNaN(input.totalSell)
      ? roundMoney(input.totalSell)
      : 0;

  const canDeriveFromUnits =
    quantity != null &&
    quantity > 0 &&
    unitCost != null &&
    unitSell != null &&
    !isLumpSumType(input.itemType);

  if (canDeriveFromUnits) {
    totalCost = roundMoney(quantity * unitCost);
    totalSell = roundMoney(quantity * unitSell);
  } else if (
    quantity != null &&
    quantity > 0 &&
    unitCost != null &&
    (totalSell === 0 || input.totalSell == null) &&
    !isLumpSumType(input.itemType)
  ) {
    totalCost = roundMoney(quantity * unitCost);
  } else if (
    quantity != null &&
    quantity > 0 &&
    unitSell != null &&
    (totalCost === 0 || input.totalCost == null) &&
    !isLumpSumType(input.itemType)
  ) {
    totalSell = roundMoney(quantity * unitSell);
  }

  const grossProfit = roundMoney(totalSell - totalCost);
  const marginPercent =
    totalSell > 0 ? roundPercent((grossProfit / totalSell) * 100) : 0;
  const markupPercent =
    totalCost > 0 ? roundPercent((grossProfit / totalCost) * 100) : 0;

  return {
    quantity,
    unitCost,
    unitSell,
    totalCost,
    totalSell,
    grossProfit,
    marginPercent,
    markupPercent,
  };
}

export type DocumentTotals = {
  subtotalCost: number;
  subtotalSell: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent: number;
  gstAmount: number;
  totalInclGst: number;
};

export function calculateDocumentTotals(
  items: Array<{ total_cost: number; total_sell: number }>,
  gstRate: number
): DocumentTotals {
  const subtotalCost = roundMoney(
    items.reduce((sum, item) => sum + (item.total_cost ?? 0), 0)
  );
  const subtotalSell = roundMoney(
    items.reduce((sum, item) => sum + (item.total_sell ?? 0), 0)
  );
  const grossProfit = roundMoney(subtotalSell - subtotalCost);
  const marginPercent =
    subtotalSell > 0 ? roundPercent((grossProfit / subtotalSell) * 100) : 0;
  const markupPercent =
    subtotalCost > 0 ? roundPercent((grossProfit / subtotalCost) * 100) : 0;
  const gstAmount = roundMoney(subtotalSell * (gstRate / 100));
  const totalInclGst = roundMoney(subtotalSell + gstAmount);

  return {
    subtotalCost,
    subtotalSell,
    grossProfit,
    marginPercent,
    markupPercent,
    gstAmount,
    totalInclGst,
  };
}

export function mapEstimateCategoryToItemType(
  category: string
): PricingItemType {
  switch (category) {
    case "labour":
      return "labour";
    case "materials":
      return "material";
    case "subcontractor":
      return "subcontractor";
    case "allowance":
      return "allowance";
    case "contingency":
      return "contingency";
    default:
      return "other";
  }
}

export function defaultDeliveryMethod(
  itemType: PricingItemType
): import("@/lib/pricing/types").DeliveryMethod {
  switch (itemType) {
    case "labour":
    case "material":
    case "equipment":
      return "in_house";
    case "subcontractor":
      return "subcontracted";
    case "allowance":
    case "contingency":
      return "allowance";
    default:
      return "not_sure";
  }
}

export function cleanClientLabel(label: string): string {
  return label
    .replace(/\([^)]*internal[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function addDaysIsoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function textListToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function arrayToTextList(items: string[]): string {
  return items.join("\n");
}
