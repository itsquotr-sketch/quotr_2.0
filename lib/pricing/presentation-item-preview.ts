/**
 * Pricing item edit preview — Batch 2B.9.
 *
 * Field cascade (qty ↔ rates ↔ totals) uses the existing pure edit helper for
 * input shaping, then money is taken from the production commercial-engine
 * adapter. UI must import this module — not legacy calculatePricingItemEdit.
 */

import { calculateAuthoritativePricingItem } from "@/lib/pricing/commercial-engine-adapter";
import {
  calculatePricingItemEdit,
  type PricingItemCalculationFields,
  type PricingItemCalculationInput,
  type PricingItemEditField,
} from "@/lib/pricing/pricing-item-calculation";

export type PricingItemEditPreview = PricingItemCalculationFields & {
  readonly costKnown: boolean;
  readonly isPreview: true;
};

/**
 * Resolve draft pricing-item fields for the edit form preview.
 * Labelled as preview — persistence still runs the server authoritative path.
 */
export function previewPricingItemEdit(
  input: PricingItemCalculationInput
): PricingItemEditPreview {
  const shaped = calculatePricingItemEdit(input);
  const mode = shaped.calculationMode;

  const engine = calculateAuthoritativePricingItem({
    requestId: "pricing-item-edit-preview",
    calculationMode: mode,
    quantity: shaped.quantity,
    unit: shaped.unit,
    unitCost: shaped.unitCost,
    unitSell: shaped.unitSell,
    totalCost: mode === "lump_sum" ? shaped.totalCost : undefined,
    totalSell: mode === "lump_sum" ? shaped.totalSell : undefined,
    productivityRate: shaped.productivityRate,
    productivityUnit: shaped.productivityUnit,
    calculatedQuantity: shaped.calculatedQuantity,
    itemType: input.itemType,
    sourceReferences: ["pricing:item-edit-preview"],
  });

  if (!engine.ok) {
    // Controlled fallback: shaped totals only if engine rejects (invalid draft).
    return {
      ...shaped,
      costKnown: !(shaped.totalCost === 0 && shaped.totalSell > 0),
      isPreview: true,
    };
  }

  const f = engine.fields;
  return {
    calculationMode: f.calculationMode,
    quantity: f.quantity,
    unit: f.unit ?? shaped.unit,
    unitCost: f.unitCost,
    unitSell: f.unitSell,
    productivityRate: f.productivityRate,
    productivityUnit: f.productivityUnit ?? shaped.productivityUnit,
    calculatedQuantity: f.calculatedQuantity,
    totalCost: f.totalCost,
    totalSell: f.totalSell,
    grossProfit: f.grossProfit,
    marginPercent: f.marginPercent,
    markupPercent: f.markupPercent,
    costKnown: f.costKnown,
    isPreview: true,
  };
}

export type { PricingItemEditField };
