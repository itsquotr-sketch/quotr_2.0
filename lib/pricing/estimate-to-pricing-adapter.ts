/**
 * Estimate line → pricing commercial inputs (Batch 2B.6B).
 *
 * Extracts mode/rates from estimate metadata, then runs the authoritative engine.
 * Does not import parity. Does not mutate estimates.
 *
 * Snapshot rule: estimate recommended_cost/recommended_sell are approved lump
 * commercial inputs when mode is lump_sum or rates are unavailable.
 * Quantity/productivity modes use rates (not stale derived totals).
 */

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
  const mode = legacy.calculationMode;

  const hasRateInputs =
    (legacy.unitCost != null && Number.isFinite(legacy.unitCost)) ||
    (legacy.unitSell != null && Number.isFinite(legacy.unitSell));

  // Prefer rate-based engine calc for qty/productivity when rates exist.
  // Otherwise treat estimate recommended totals as approved lump snapshot inputs.
  const useLumpSnapshot =
    mode === "lump_sum" ||
    !hasRateInputs ||
    (legacy.quantity == null || legacy.quantity <= 0);

  const engineInput = useLumpSnapshot
    ? {
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
      }
    : {
        requestId,
        itemType,
        calculationMode: mode,
        quantity: legacy.quantity,
        unit: legacy.unit,
        unitCost: legacy.unitCost,
        unitSell: legacy.unitSell,
        productivityRate: legacy.productivityRate,
        productivityUnit: legacy.productivityUnit,
        calculatedQuantity: legacy.calculatedQuantity,
        // Do not pass recommended totals — derived authority is the engine.
        sourceReferences: [
          "pricing:estimate_line",
          lineItem.id ?? "unknown-line",
        ],
      };

  if (!isAuthoritativePricingItemCalculation()) {
    return {
      ok: true,
      legacyMode: mode,
      itemTypeHint: itemType,
      fields: {
        quantity: legacy.quantity,
        unit: legacy.unit,
        unitCost: legacy.unitCost,
        unitSell: legacy.unitSell,
        totalCost: legacy.totalCost,
        totalSell: legacy.totalSell,
        grossProfit: legacy.grossProfit,
        marginPercent: legacy.marginPercent,
        markupPercent: legacy.markupPercent,
        calculationMode: legacy.calculationMode,
        productivityRate: legacy.productivityRate,
        productivityUnit: legacy.productivityUnit,
        calculatedQuantity: legacy.calculatedQuantity,
        costKnown: !(legacy.totalCost === 0 && legacy.totalSell > 0),
      },
    };
  }

  const result = calculateAuthoritativePricingItem(engineInput);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    legacyMode: mode,
    itemTypeHint: itemType,
    fields: result.fields,
  };
}

/** Metadata-only parse for provenance (no money authority). */
export function readEstimateLineMetadata(notes: string | null | undefined) {
  return parseLineItemNotes(notes).metadata;
}
