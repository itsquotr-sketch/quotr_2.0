/**
 * Estimate line → pricing commercial inputs (Batch 2B.6B / RECOVERY-1-R1).
 *
 * Estimate recommended_cost / recommended_sell are the upstream commercial
 * truth at Pricing creation. Notes unit rates are lineage/evidence only and
 * must not resurrect a stale paired sell after project GM rewrite.
 */

import { roundMoney } from "@/lib/commercial-engine/core/money";
import {
  interpretLineSellAuthority,
  type SellAuthority,
} from "@/lib/commercial-engine/core/cost-first-authority";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import { isAuthoritativePricingItemCalculation } from "@/lib/pricing/adoption-authority";
import {
  calculateAuthoritativePricingItem,
  type PersistedPricingItemMoneyFields,
} from "@/lib/pricing/commercial-engine-adapter";
import { buildPricingItemFieldsFromEstimateLineItem } from "@/lib/pricing/pricing-item-calculation";
import type { CalculationMode, PricingItemType } from "@/lib/pricing/types";

export type EstimateLineCommercialSource = {
  readonly id?: string;
  readonly category: string;
  readonly recommended_cost: number | null;
  readonly recommended_sell: number | null;
  readonly notes: string | null;
};

export type EstimateLineAuthoritativeResult =
  | {
      readonly ok: true;
      readonly fields: PersistedPricingItemMoneyFields;
      readonly legacyMode: CalculationMode;
      readonly itemTypeHint: PricingItemType | string;
      readonly sellAuthority: SellAuthority;
    }
  | { readonly ok: false; readonly error: string };

function mapCategoryHint(category: string): PricingItemType {
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

function moneyQuantityForDisplay(params: {
  calculationMode: CalculationMode;
  quantity: number | null;
  calculatedQuantity: number | null;
}): number | null {
  if (
    params.calculationMode === "productivity_labour" &&
    params.calculatedQuantity != null &&
    params.calculatedQuantity > 0
  ) {
    return params.calculatedQuantity;
  }
  if (params.quantity != null && params.quantity > 0) {
    return params.quantity;
  }
  return null;
}

function deriveDisplayUnitRate(total: number, quantity: number | null): number | null {
  if (quantity == null || quantity <= 0) {
    return total || null;
  }
  return roundMoney(total / quantity);
}

/**
 * Build authoritative money fields for a pricing item sourced from an estimate line.
 */
export function calculateAuthoritativeFieldsFromEstimateLine(
  lineItem: EstimateLineCommercialSource,
  requestId = "estimate-to-pricing"
): EstimateLineAuthoritativeResult {
  const legacy = buildPricingItemFieldsFromEstimateLineItem(lineItem);
  const itemType = mapCategoryHint(lineItem.category);
  const recommendedCost = Number(lineItem.recommended_cost ?? 0);
  const recommendedSell = Number(lineItem.recommended_sell ?? 0);
  const metadata = parseLineItemNotes(lineItem.notes).metadata;
  const sellAuthority = interpretLineSellAuthority({
    persisted: metadata.sellAuthority,
    sellDerivedFromMargin: metadata.sellDerivedFromMargin,
    sourceSellRate: metadata.sellRate,
    recommendedSell,
    quantity: metadata.quantity,
    labourHours: metadata.labourHours,
  });

  const displayQty = moneyQuantityForDisplay({
    calculationMode: legacy.calculationMode,
    quantity: legacy.quantity,
    calculatedQuantity: legacy.calculatedQuantity,
  });
  const unitCost = deriveDisplayUnitRate(recommendedCost, displayQty);
  const unitSell = deriveDisplayUnitRate(recommendedSell, displayQty);

  const engineInput = {
    requestId,
    itemType,
    calculationMode: "lump_sum" as const,
    quantity: legacy.quantity,
    unit: legacy.unit,
    totalCost: recommendedCost,
    totalSell: recommendedSell,
    sourceReferences: [
      "pricing:estimate_line",
      lineItem.id ?? "unknown-line",
    ],
  };

  const overlay = (
    base: PersistedPricingItemMoneyFields
  ): PersistedPricingItemMoneyFields => {
    const costKnown = !(recommendedCost === 0 && recommendedSell > 0);
    const grossProfit = costKnown
      ? roundMoney(recommendedSell - recommendedCost)
      : 0;
    const marginPercent =
      costKnown && recommendedSell > 0
        ? roundMoney((grossProfit / recommendedSell) * 100)
        : 0;
    const markupPercent =
      costKnown && recommendedCost > 0
        ? roundMoney((grossProfit / recommendedCost) * 100)
        : 0;
    return {
      ...base,
      calculationMode: legacy.calculationMode,
      quantity: legacy.quantity,
      unit: legacy.unit,
      unitCost,
      unitSell,
      productivityRate: legacy.productivityRate,
      productivityUnit: legacy.productivityUnit,
      calculatedQuantity: legacy.calculatedQuantity,
      totalCost: recommendedCost,
      totalSell: recommendedSell,
      grossProfit,
      marginPercent,
      markupPercent,
      costKnown,
    };
  };

  if (!isAuthoritativePricingItemCalculation()) {
    return {
      ok: true,
      legacyMode: legacy.calculationMode,
      itemTypeHint: itemType,
      sellAuthority,
      fields: overlay({
        quantity: legacy.quantity,
        unit: legacy.unit,
        unitCost,
        unitSell,
        totalCost: recommendedCost,
        totalSell: recommendedSell,
        grossProfit: legacy.grossProfit,
        marginPercent: legacy.marginPercent,
        markupPercent: legacy.markupPercent,
        calculationMode: legacy.calculationMode,
        productivityRate: legacy.productivityRate,
        productivityUnit: legacy.productivityUnit,
        calculatedQuantity: legacy.calculatedQuantity,
        costKnown: !(recommendedCost === 0 && recommendedSell > 0),
      }),
    };
  }

  const result = calculateAuthoritativePricingItem(engineInput);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    legacyMode: legacy.calculationMode,
    itemTypeHint: itemType,
    sellAuthority,
    fields: overlay(result.fields),
  };
}

/** Metadata-only parse for provenance (no money authority). */
export function readEstimateLineMetadata(notes: string | null | undefined) {
  return parseLineItemNotes(notes).metadata;
}
