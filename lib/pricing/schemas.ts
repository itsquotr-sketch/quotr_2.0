import { z } from "zod";
import {
  gstRatePercentSchema,
  moneyAmountSchema,
  optionalMoneyAmountSchema,
  optionalNullableNonNegativeNumberSchema,
  trimmedStringSchema,
  uuidSchema,
} from "@/lib/security/numeric-validation";
import {
  grossMarginPercentSchema,
} from "@/lib/security/margin-validation";
import {
  markupPercentSchema,
  optionalNullableMarkupPercentSchema,
} from "@/lib/security/markup-validation";
import type {
  CalculationMode,
  DeliveryMethod,
  PricingItemType,
} from "@/lib/pricing/types";

/**
 * Runtime Zod schemas for pricing mutations (Stage 2A.2).
 *
 * These schemas validate inputs only. They do not change pricing arithmetic.
 * Server-action wiring is Batch 2A.3.
 *
 * Zero-value notes:
 * - New blank pricing items are created with total_cost/total_sell = 0 today.
 * - `optional` marks optional quote lines; there is no dedicated
 *   informational / no-charge item type in the current model.
 * - Zero quantities/totals are therefore permitted as finite non-negative
 *   values; invalid/missing values must not be coerced to zero.
 */

export const CALCULATION_MODES = [
  "quantity_rate",
  "productivity_labour",
  "lump_sum",
] as const satisfies readonly CalculationMode[];

export const PRICING_ITEM_TYPE_VALUES = [
  "labour",
  "material",
  "subcontractor",
  "allowance",
  "contingency",
  "equipment",
  "other",
] as const satisfies readonly PricingItemType[];

export const DELIVERY_METHOD_VALUES = [
  "in_house",
  "subcontracted",
  "allowance",
  "not_sure",
] as const satisfies readonly DeliveryMethod[];

export const calculationModeSchema = z.enum(CALCULATION_MODES);
export const pricingItemTypeSchema = z.enum(PRICING_ITEM_TYPE_VALUES);
export const deliveryMethodSchema = z.enum(DELIVERY_METHOD_VALUES);

const pricingItemBaseSchema = z.object({
  internal_label: trimmedStringSchema(200, {
    min: 1,
    requiredMessage: "Internal label is required.",
  }),
  client_label: trimmedStringSchema(200, {
    min: 1,
    requiredMessage: "Client label is required.",
  }),
  internal_description: z
    .union([trimmedStringSchema(5000), z.null()])
    .optional(),
  client_description: z.union([trimmedStringSchema(5000), z.null()]).optional(),
  quantity: optionalNullableNonNegativeNumberSchema,
  unit: z.union([trimmedStringSchema(40), z.null()]).optional(),
  unit_cost: optionalNullableNonNegativeNumberSchema,
  unit_sell: optionalNullableNonNegativeNumberSchema,
  total_cost: optionalMoneyAmountSchema,
  total_sell: optionalMoneyAmountSchema,
  item_type: pricingItemTypeSchema,
  delivery_method: deliveryMethodSchema,
  visible_on_quote: z.boolean().optional(),
  optional: z.boolean().optional(),
  notes_internal: z.union([trimmedStringSchema(5000), z.null()]).optional(),
  notes_client: z.union([trimmedStringSchema(5000), z.null()]).optional(),
  work_area_id: z.union([uuidSchema, z.null()]).optional(),
  calculation_mode: z.union([calculationModeSchema, z.null()]).optional(),
  productivity_rate: optionalNullableNonNegativeNumberSchema,
  productivity_unit: z.union([trimmedStringSchema(40), z.null()]).optional(),
  calculated_quantity: optionalNullableNonNegativeNumberSchema,
  /**
   * Derived commercial fields are not part of PricingItemInput today, but may
   * be validated before persistence in Batch 2A.3 when present.
   */
  margin_percent: grossMarginPercentSchema.optional(),
  markup_percent: markupPercentSchema.optional(),
});

function requireFiniteMoney(
  value: number | undefined,
  path: string,
  ctx: z.RefinementCtx,
  message: string
) {
  if (value == null || !Number.isFinite(value) || value < 0) {
    ctx.addIssue({ code: "custom", path: [path], message });
  }
}

/**
 * Pricing item mutation input with calculation-mode specific requirements.
 * Lump-sum must supply finite non-negative totals and never bypass validation.
 */
export const pricingItemInputSchema = pricingItemBaseSchema.superRefine(
  (data, ctx) => {
    const mode = data.calculation_mode ?? null;

    if (mode === "lump_sum") {
      requireFiniteMoney(
        data.total_cost,
        "total_cost",
        ctx,
        "Lump-sum total cost must be a finite number zero or greater."
      );
      requireFiniteMoney(
        data.total_sell,
        "total_sell",
        ctx,
        "Lump-sum total sell must be a finite number zero or greater."
      );
      return;
    }

    if (mode === "quantity_rate") {
      if (data.quantity == null) {
        ctx.addIssue({
          code: "custom",
          path: ["quantity"],
          message: "Quantity is required for quantity-rate items.",
        });
      }
      return;
    }

    if (mode === "productivity_labour") {
      if (data.productivity_rate == null && data.calculated_quantity == null) {
        ctx.addIssue({
          code: "custom",
          path: ["productivity_rate"],
          message:
            "Productivity rate or calculated hours are required for productivity-labour items.",
        });
      }
    }
  }
);

export const pricingDocumentInputSchema = z.object({
  title: trimmedStringSchema(200).optional(),
  client_name: z.union([trimmedStringSchema(200), z.null()]).optional(),
  site_address: z.union([trimmedStringSchema(500), z.null()]).optional(),
  valid_until: z.union([trimmedStringSchema(40), z.null()]).optional(),
  scope_summary: z.union([trimmedStringSchema(10000), z.null()]).optional(),
  assumptions: z.array(trimmedStringSchema(2000)).optional(),
  exclusions: z.array(trimmedStringSchema(2000)).optional(),
  terms: z.union([trimmedStringSchema(10000), z.null()]).optional(),
  internal_notes: z.union([trimmedStringSchema(10000), z.null()]).optional(),
  gst_rate: gstRatePercentSchema.optional(),
});

export const createPricingFromEstimateInputSchema = z.object({
  projectId: uuidSchema,
  estimateId: uuidSchema.optional(),
});

export const addPricingItemInputSchema = z.object({
  pricingDocumentId: uuidSchema,
  projectId: uuidSchema,
  workAreaId: z.union([uuidSchema, z.null()]).optional(),
  itemType: pricingItemTypeSchema.optional(),
  deliveryMethod: deliveryMethodSchema.optional(),
});

export const updatePricingItemInputSchema = z.object({
  pricingItemId: uuidSchema,
  item: pricingItemInputSchema,
});

export const duplicatePricingItemInputSchema = z.object({
  pricingItemId: uuidSchema,
});

export const deletePricingItemInputSchema = z.object({
  pricingItemId: uuidSchema,
});

export const updatePricingDocumentInputSchema = z.object({
  pricingDocumentId: uuidSchema,
  document: pricingDocumentInputSchema,
});

export const markPricingReviewedInputSchema = z.object({
  pricingDocumentId: uuidSchema,
});

/** Validate derived gross-margin / markup pair without changing formulas. */
export const derivedCommercialPercentsSchema = z.object({
  margin_percent: grossMarginPercentSchema,
  markup_percent: markupPercentSchema,
});

export type PricingItemInputParsed = z.infer<typeof pricingItemInputSchema>;
export type PricingDocumentInputParsed = z.infer<
  typeof pricingDocumentInputSchema
>;

export {
  optionalNullableMarkupPercentSchema,
  moneyAmountSchema,
};
