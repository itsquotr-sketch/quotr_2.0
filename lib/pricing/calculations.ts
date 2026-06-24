import type { PricingItemType } from "@/lib/pricing/types";
import {
  calculatePricingItemEdit as calculateModeAwarePricingItemEdit,
  calculatePricingItemTotalsForSave,
  type PricingItemEditField,
} from "@/lib/pricing/pricing-item-calculation";

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export type PricingItemTotalsInput = {
  quantity?: number | null;
  unit?: string | null;
  unitCost?: number | null;
  unitSell?: number | null;
  totalCost?: number | null;
  totalSell?: number | null;
  itemType?: PricingItemType;
  calculationMode?: import("@/lib/pricing/types").CalculationMode | null;
  productivityRate?: number | null;
  productivityUnit?: string | null;
  calculatedQuantity?: number | null;
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
  calculationMode?: import("@/lib/pricing/types").CalculationMode;
  productivityRate?: number | null;
  productivityUnit?: string | null;
  calculatedQuantity?: number | null;
};

export type { PricingItemEditField };

export type PricingItemEditInput = PricingItemTotalsInput & {
  changedField: PricingItemEditField;
};

export function calculatePricingItemEdit(
  input: PricingItemEditInput
): PricingItemTotals {
  const result = calculateModeAwarePricingItemEdit(input);
  return {
    quantity: result.quantity,
    unitCost: result.unitCost,
    unitSell: result.unitSell,
    totalCost: result.totalCost,
    totalSell: result.totalSell,
    grossProfit: result.grossProfit,
    marginPercent: result.marginPercent,
    markupPercent: result.markupPercent,
    calculationMode: result.calculationMode,
    productivityRate: result.productivityRate,
    productivityUnit: result.productivityUnit,
    calculatedQuantity: result.calculatedQuantity,
  };
}

export function calculatePricingItemTotals(
  input: PricingItemTotalsInput
): PricingItemTotals {
  const result = calculatePricingItemTotalsForSave(input);
  return {
    quantity: result.quantity,
    unitCost: result.unitCost,
    unitSell: result.unitSell,
    totalCost: result.totalCost,
    totalSell: result.totalSell,
    grossProfit: result.grossProfit,
    marginPercent: result.marginPercent,
    markupPercent: result.markupPercent,
    calculationMode: result.calculationMode,
    productivityRate: result.productivityRate,
    productivityUnit: result.productivityUnit,
    calculatedQuantity: result.calculatedQuantity,
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
