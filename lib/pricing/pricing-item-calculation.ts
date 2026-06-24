import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import type { PricingItem, PricingItemType } from "@/lib/pricing/types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export type CalculationMode =
  | "quantity_rate"
  | "productivity_labour"
  | "lump_sum";

export type PricingItemEditField =
  | "quantity"
  | "unitCost"
  | "unitSell"
  | "totalCost"
  | "totalSell"
  | "productivityRate"
  | "calculatedQuantity";

export type PricingItemCalculationInput = {
  calculationMode?: CalculationMode | null;
  quantity?: number | null;
  unit?: string | null;
  unitCost?: number | null;
  unitSell?: number | null;
  totalCost?: number | null;
  totalSell?: number | null;
  productivityRate?: number | null;
  productivityUnit?: string | null;
  calculatedQuantity?: number | null;
  changedField?: PricingItemEditField;
  itemType?: PricingItemType;
};

export type PricingItemCalculationFields = {
  calculationMode: CalculationMode;
  quantity: number | null;
  unit: string | null;
  unitCost: number | null;
  unitSell: number | null;
  productivityRate: number | null;
  productivityUnit: string | null;
  calculatedQuantity: number | null;
  totalCost: number;
  totalSell: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent: number;
};

const MONEY_TOLERANCE = 0.02;

function isLumpSumType(itemType?: PricingItemType): boolean {
  return itemType === "allowance" || itemType === "contingency";
}

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

function quantitiesRoughlyMatch(
  left: number | null | undefined,
  right: number | null | undefined
): boolean {
  if (left == null || right == null) {
    return false;
  }
  return Math.abs(left - right) <= MONEY_TOLERANCE;
}

function computeProfitFields(
  fields: Omit<
    PricingItemCalculationFields,
    "grossProfit" | "marginPercent" | "markupPercent"
  >
): PricingItemCalculationFields {
  const grossProfit = roundMoney(fields.totalSell - fields.totalCost);
  const marginPercent =
    fields.totalSell > 0
      ? roundPercent((grossProfit / fields.totalSell) * 100)
      : 0;
  const markupPercent =
    fields.totalCost > 0
      ? roundPercent((grossProfit / fields.totalCost) * 100)
      : 0;

  return {
    ...fields,
    grossProfit,
    marginPercent,
    markupPercent,
  };
}

export function formatProductivityUnit(
  productivityUnit: string | null | undefined
): string {
  if (!productivityUnit) {
    return "unit";
  }
  return productivityUnit;
}

export function formatProductivityLabel(
  productivityRate: number | null | undefined,
  productivityUnit: string | null | undefined
): string {
  if (productivityRate == null) {
    return "—";
  }
  return `${productivityRate} hrs/${formatProductivityUnit(productivityUnit)}`;
}

function parseEstimateMetadata(notes: string | null | undefined) {
  return parseLineItemNotes(notes).metadata;
}

export function inferCalculationMode(
  input: PricingItemCalculationInput
): CalculationMode {
  if (input.calculationMode) {
    return input.calculationMode;
  }

  if (isLumpSumType(input.itemType)) {
    return "lump_sum";
  }

  const quantity = normalizeQuantity(input.quantity);
  const unitCost = normalizeMoneyNullable(input.unitCost);
  const totalCost = roundMoney(input.totalCost ?? 0);

  if (input.productivityRate != null && input.productivityRate > 0) {
    return "productivity_labour";
  }

  if (input.calculatedQuantity != null && input.calculatedQuantity > 0) {
    if (
      quantity != null &&
      quantity > 0 &&
      !quantitiesRoughlyMatch(quantity, input.calculatedQuantity)
    ) {
      return "productivity_labour";
    }
  }

  if (input.itemType === "labour" && quantity != null && quantity > 0) {
    if (unitCost != null && unitCost > 0 && totalCost > 0) {
      const impliedHours = roundMoney(totalCost / unitCost);
      if (
        !quantitiesRoughlyMatch(impliedHours, quantity) &&
        impliedHours > quantity
      ) {
        return "productivity_labour";
      }
    }
  }

  if (quantity == null || quantity <= 0) {
    return "lump_sum";
  }

  if (unitCost != null && totalCost > 0) {
    const directTotal = roundMoney(quantity * unitCost);
    if (quantitiesRoughlyMatch(directTotal, totalCost)) {
      return "quantity_rate";
    }
  }

  if (input.itemType === "labour") {
    return "lump_sum";
  }

  return "quantity_rate";
}

export function resolvePricingItemCalculation(
  input: PricingItemCalculationInput
): PricingItemCalculationFields {
  const calculationMode = inferCalculationMode(input);
  const quantity = normalizeQuantity(input.quantity);
  const unitCost = normalizeMoneyNullable(input.unitCost);
  const unitSell = normalizeMoneyNullable(input.unitSell);
  const totalCost = roundMoney(input.totalCost ?? 0);
  const totalSell = roundMoney(input.totalSell ?? 0);

  let productivityRate = normalizeMoneyNullable(input.productivityRate);
  let productivityUnit = input.productivityUnit ?? input.unit ?? null;
  let calculatedQuantity = normalizeMoneyNullable(input.calculatedQuantity);

  if (calculationMode === "productivity_labour") {
    if (
      calculatedQuantity == null &&
      quantity != null &&
      productivityRate != null &&
      productivityRate > 0
    ) {
      calculatedQuantity = roundMoney(quantity * productivityRate);
    }

    if (
      calculatedQuantity == null &&
      quantity != null &&
      quantity > 0 &&
      unitCost != null &&
      unitCost > 0 &&
      totalCost > 0
    ) {
      calculatedQuantity = roundMoney(totalCost / unitCost);
      if (productivityRate == null) {
        productivityRate = roundMoney(calculatedQuantity / quantity);
      }
    }

    if (
      productivityRate == null &&
      quantity != null &&
      quantity > 0 &&
      calculatedQuantity != null &&
      calculatedQuantity > 0
    ) {
      productivityRate = roundMoney(calculatedQuantity / quantity);
    }
  }

  return computeProfitFields({
    calculationMode,
    quantity,
    unit: input.unit ?? null,
    unitCost,
    unitSell,
    productivityRate,
    productivityUnit,
    calculatedQuantity,
    totalCost,
    totalSell,
  });
}

export function buildPricingItemFieldsFromEstimateLineItem(lineItem: {
  category: string;
  recommended_cost: number | null;
  recommended_sell: number | null;
  notes: string | null;
}): PricingItemCalculationFields {
  const metadata = parseEstimateMetadata(lineItem.notes);
  const recommendedCost = Number(lineItem.recommended_cost ?? 0);
  const recommendedSell = Number(lineItem.recommended_sell ?? 0);
  const itemType = mapEstimateCategoryToCalculationItemType(lineItem.category);
  const quantity = metadata.quantity ?? null;
  const unit = metadata.unit ?? null;
  const totalCost = roundMoney(recommendedCost);
  const totalSell = roundMoney(recommendedSell);

  if (isLumpSumType(itemType)) {
    return computeProfitFields({
      calculationMode: "lump_sum",
      quantity,
      unit,
      unitCost:
        quantity && quantity > 0
          ? roundMoney(totalCost / quantity)
          : totalCost || null,
      unitSell:
        quantity && quantity > 0
          ? roundMoney(totalSell / quantity)
          : totalSell || null,
      productivityRate: null,
      productivityUnit: null,
      calculatedQuantity: null,
      totalCost,
      totalSell,
    });
  }

  const hasProductivity =
    itemType === "labour" &&
    ((metadata.productivityRate != null && metadata.productivityRate > 0) ||
      (metadata.labourHours != null && metadata.labourHours > 0));

  if (hasProductivity) {
    const productivityRate = metadata.productivityRate ?? null;
    const calculatedQuantity =
      metadata.labourHours ??
      (quantity != null && productivityRate != null
        ? roundMoney(quantity * productivityRate)
        : null);
    const unitCost =
      metadata.costRate ??
      (calculatedQuantity && calculatedQuantity > 0
        ? roundMoney(totalCost / calculatedQuantity)
        : null);
    const unitSell =
      metadata.sellRate ??
      (calculatedQuantity && calculatedQuantity > 0
        ? roundMoney(totalSell / calculatedQuantity)
        : null);

    return computeProfitFields({
      calculationMode: "productivity_labour",
      quantity,
      unit,
      unitCost,
      unitSell,
      productivityRate,
      productivityUnit: metadata.productivityUnit ?? unit,
      calculatedQuantity,
      totalCost,
      totalSell,
    });
  }

  const unitCost =
    metadata.costRate ??
    (quantity && quantity > 0 ? roundMoney(totalCost / quantity) : null);
  const unitSell =
    metadata.sellRate ??
    (quantity && quantity > 0 ? roundMoney(totalSell / quantity) : null);

  if (quantity == null || quantity <= 0) {
    return computeProfitFields({
      calculationMode: "lump_sum",
      quantity,
      unit,
      unitCost: unitCost ?? (totalCost || null),
      unitSell: unitSell ?? (totalSell || null),
      productivityRate: null,
      productivityUnit: null,
      calculatedQuantity: null,
      totalCost,
      totalSell,
    });
  }

  return computeProfitFields({
    calculationMode: "quantity_rate",
    quantity,
    unit,
    unitCost,
    unitSell,
    productivityRate: null,
    productivityUnit: null,
    calculatedQuantity: null,
    totalCost,
    totalSell,
  });
}

function mapEstimateCategoryToCalculationItemType(
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

export function pricingItemToCalculationInput(
  item: PricingItem
): PricingItemCalculationInput {
  return {
    calculationMode: item.calculation_mode,
    quantity: item.quantity,
    unit: item.unit,
    unitCost: item.unit_cost,
    unitSell: item.unit_sell,
    totalCost: item.total_cost,
    totalSell: item.total_sell,
    productivityRate: item.productivity_rate,
    productivityUnit: item.productivity_unit,
    calculatedQuantity: item.calculated_quantity,
    itemType: item.item_type,
  };
}

export type PricingItemEditResult = PricingItemCalculationFields;

export function calculatePricingItemEdit(
  input: PricingItemCalculationInput
): PricingItemEditResult {
  const resolved = resolvePricingItemCalculation(input);
  const changedField = input.changedField;
  const calculationMode = resolved.calculationMode;

  let quantity = resolved.quantity;
  let unitCost = resolved.unitCost;
  let unitSell = resolved.unitSell;
  let totalCost = resolved.totalCost;
  let totalSell = resolved.totalSell;
  let productivityRate = resolved.productivityRate;
  let calculatedQuantity = resolved.calculatedQuantity;

  if (!changedField) {
    return computeProfitFields({
      calculationMode,
      quantity,
      unit: resolved.unit,
      unitCost,
      unitSell,
      productivityRate,
      productivityUnit: resolved.productivityUnit,
      calculatedQuantity,
      totalCost,
      totalSell,
    });
  }

  switch (calculationMode) {
    case "quantity_rate": {
      switch (changedField) {
        case "quantity":
          quantity = normalizeQuantity(input.quantity);
          if (quantity != null && quantity > 0) {
            if (unitCost != null) {
              totalCost = roundMoney(quantity * unitCost);
            }
            if (unitSell != null) {
              totalSell = roundMoney(quantity * unitSell);
            }
          }
          break;
        case "unitCost":
          unitCost = normalizeMoneyNullable(input.unitCost);
          if (quantity != null && quantity > 0 && unitCost != null) {
            totalCost = roundMoney(quantity * unitCost);
          }
          break;
        case "unitSell":
          unitSell = normalizeMoneyNullable(input.unitSell);
          if (quantity != null && quantity > 0 && unitSell != null) {
            totalSell = roundMoney(quantity * unitSell);
          }
          break;
        case "totalCost":
          totalCost = roundMoney(input.totalCost ?? 0);
          if (quantity != null && quantity > 0) {
            unitCost = roundMoney(totalCost / quantity);
          }
          break;
        case "totalSell":
          totalSell = roundMoney(input.totalSell ?? 0);
          if (quantity != null && quantity > 0) {
            unitSell = roundMoney(totalSell / quantity);
          }
          break;
      }
      break;
    }

    case "productivity_labour": {
      const applyHourlyTotals = () => {
        if (calculatedQuantity != null && calculatedQuantity > 0) {
          if (unitCost != null) {
            totalCost = roundMoney(calculatedQuantity * unitCost);
          }
          if (unitSell != null) {
            totalSell = roundMoney(calculatedQuantity * unitSell);
          }
        }
      };

      switch (changedField) {
        case "quantity":
          quantity = normalizeQuantity(input.quantity);
          if (
            quantity != null &&
            productivityRate != null &&
            productivityRate > 0
          ) {
            calculatedQuantity = roundMoney(quantity * productivityRate);
          }
          applyHourlyTotals();
          break;
        case "productivityRate":
          productivityRate = normalizeMoneyNullable(input.productivityRate);
          if (
            quantity != null &&
            productivityRate != null &&
            productivityRate > 0
          ) {
            calculatedQuantity = roundMoney(quantity * productivityRate);
          }
          applyHourlyTotals();
          break;
        case "calculatedQuantity":
          calculatedQuantity = normalizeMoneyNullable(input.calculatedQuantity);
          if (
            calculatedQuantity != null &&
            quantity != null &&
            quantity > 0
          ) {
            productivityRate = roundMoney(calculatedQuantity / quantity);
          }
          applyHourlyTotals();
          break;
        case "unitCost":
          unitCost = normalizeMoneyNullable(input.unitCost);
          applyHourlyTotals();
          break;
        case "unitSell":
          unitSell = normalizeMoneyNullable(input.unitSell);
          applyHourlyTotals();
          break;
        case "totalCost":
          totalCost = roundMoney(input.totalCost ?? 0);
          if (calculatedQuantity != null && calculatedQuantity > 0) {
            unitCost = roundMoney(totalCost / calculatedQuantity);
          }
          break;
        case "totalSell":
          totalSell = roundMoney(input.totalSell ?? 0);
          if (calculatedQuantity != null && calculatedQuantity > 0) {
            unitSell = roundMoney(totalSell / calculatedQuantity);
          }
          break;
      }
      break;
    }

    case "lump_sum":
    default:
      if (changedField === "totalCost") {
        totalCost = roundMoney(input.totalCost ?? 0);
      }
      if (changedField === "totalSell") {
        totalSell = roundMoney(input.totalSell ?? 0);
      }
      if (changedField === "unitCost") {
        unitCost = normalizeMoneyNullable(input.unitCost);
      }
      if (changedField === "unitSell") {
        unitSell = normalizeMoneyNullable(input.unitSell);
      }
      if (changedField === "quantity") {
        quantity = normalizeQuantity(input.quantity);
      }
      break;
  }

  return computeProfitFields({
    calculationMode,
    quantity,
    unit: input.unit ?? resolved.unit,
    unitCost,
    unitSell,
    productivityRate,
    productivityUnit: input.productivityUnit ?? resolved.productivityUnit,
    calculatedQuantity,
    totalCost,
    totalSell,
  });
}

function forwardTotalsMatchStored(
  resolved: PricingItemCalculationFields
): boolean {
  if (resolved.calculationMode === "lump_sum") {
    return true;
  }

  if (resolved.calculationMode === "productivity_labour") {
    const hours = resolved.calculatedQuantity;
    if (hours == null || hours <= 0) {
      return true;
    }
    const expectedCost =
      resolved.unitCost != null
        ? roundMoney(hours * resolved.unitCost)
        : resolved.totalCost;
    const expectedSell =
      resolved.unitSell != null
        ? roundMoney(hours * resolved.unitSell)
        : resolved.totalSell;
    return (
      quantitiesRoughlyMatch(expectedCost, resolved.totalCost) &&
      quantitiesRoughlyMatch(expectedSell, resolved.totalSell)
    );
  }

  if (resolved.quantity == null || resolved.quantity <= 0) {
    return true;
  }

  const expectedCost =
    resolved.unitCost != null
      ? roundMoney(resolved.quantity * resolved.unitCost)
      : resolved.totalCost;
  const expectedSell =
    resolved.unitSell != null
      ? roundMoney(resolved.quantity * resolved.unitSell)
      : resolved.totalSell;

  return (
    quantitiesRoughlyMatch(expectedCost, resolved.totalCost) &&
    quantitiesRoughlyMatch(expectedSell, resolved.totalSell)
  );
}

export function calculatePricingItemTotalsForSave(
  input: PricingItemCalculationInput
): PricingItemCalculationFields {
  const resolved = resolvePricingItemCalculation(input);

  if (forwardTotalsMatchStored(resolved)) {
    return resolved;
  }

  if (resolved.calculationMode === "lump_sum") {
    return resolved;
  }

  if (resolved.calculationMode === "productivity_labour") {
    return calculatePricingItemEdit({
      ...input,
      calculationMode: resolved.calculationMode,
      changedField: "unitCost",
    });
  }

  if (resolved.quantity != null && resolved.quantity > 0) {
    return calculatePricingItemEdit({
      ...input,
      calculationMode: resolved.calculationMode,
      changedField: "quantity",
    });
  }

  return resolved;
}
