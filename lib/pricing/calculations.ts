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

export type PricingItemEditField =
  | "quantity"
  | "unitCost"
  | "unitSell"
  | "totalCost"
  | "totalSell";

export type PricingItemEditInput = {
  quantity?: number | null;
  unitCost?: number | null;
  unitSell?: number | null;
  totalCost?: number | null;
  totalSell?: number | null;
  changedField: PricingItemEditField;
  itemType?: PricingItemType;
};

function normalizeQuantity(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function normalizeMoneyNullable(
  value: number | null | undefined
): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return roundMoney(value);
}

function computeProfitFields(
  quantity: number | null,
  unitCost: number | null,
  unitSell: number | null,
  totalCost: number,
  totalSell: number
): PricingItemTotals {
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

export function calculatePricingItemEdit(
  input: PricingItemEditInput
): PricingItemTotals {
  const isLumpSum = isLumpSumType(input.itemType);
  const quantity = normalizeQuantity(input.quantity);
  let unitCost = normalizeMoneyNullable(input.unitCost);
  let unitSell = normalizeMoneyNullable(input.unitSell);
  let totalCost = roundMoney(input.totalCost ?? 0);
  let totalSell = roundMoney(input.totalSell ?? 0);

  const hasQuantity = quantity != null && quantity > 0;

  switch (input.changedField) {
    case "quantity":
      if (!isLumpSum && hasQuantity) {
        if (unitCost != null) {
          totalCost = roundMoney(quantity! * unitCost);
        }
        if (unitSell != null) {
          totalSell = roundMoney(quantity! * unitSell);
        }
      }
      break;
    case "unitCost":
      unitCost = normalizeMoneyNullable(input.unitCost);
      if (!isLumpSum && hasQuantity && unitCost != null) {
        totalCost = roundMoney(quantity! * unitCost);
      }
      break;
    case "unitSell":
      unitSell = normalizeMoneyNullable(input.unitSell);
      if (!isLumpSum && hasQuantity && unitSell != null) {
        totalSell = roundMoney(quantity! * unitSell);
      }
      break;
    case "totalCost":
      totalCost = roundMoney(input.totalCost ?? 0);
      if (!isLumpSum && hasQuantity && quantity! > 0) {
        unitCost = roundMoney(totalCost / quantity!);
      }
      break;
    case "totalSell":
      totalSell = roundMoney(input.totalSell ?? 0);
      if (!isLumpSum && hasQuantity && quantity! > 0) {
        unitSell = roundMoney(totalSell / quantity!);
      }
      break;
  }

  return computeProfitFields(quantity, unitCost, unitSell, totalCost, totalSell);
}

export function calculatePricingItemTotals(
  input: PricingItemTotalsInput
): PricingItemTotals {
  const quantity = normalizeQuantity(input.quantity);
  const isLumpSum = isLumpSumType(input.itemType);
  const hasQuantity = quantity != null && quantity > 0;

  if (!isLumpSum && hasQuantity) {
    return calculatePricingItemEdit({
      quantity: input.quantity,
      unitCost: input.unitCost,
      unitSell: input.unitSell,
      totalCost: input.totalCost,
      totalSell: input.totalSell,
      changedField: "quantity",
      itemType: input.itemType,
    });
  }

  const unitCost = normalizeMoneyNullable(input.unitCost);
  const unitSell = normalizeMoneyNullable(input.unitSell);
  const totalCost = roundMoney(input.totalCost ?? 0);
  const totalSell = roundMoney(input.totalSell ?? 0);

  return computeProfitFields(quantity, unitCost, unitSell, totalCost, totalSell);
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
