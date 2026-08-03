/**
 * Batch 2A.2 focused verification — runtime validation schemas and helpers.
 *
 * Run: npx --yes tsx scripts/verify-batch-2a2-validation.ts
 *
 * Exercises exported production schemas/helpers. No production data.
 */
import { DEFAULT_MARGIN_PERCENT } from "../lib/estimate/constants";
import {
  MAX_GROSS_MARGIN_PERCENT,
  MIN_GROSS_MARGIN_PERCENT,
  validateMarginPercent,
} from "../lib/security/margin-validation";
import {
  MAX_MARKUP_PERCENT,
  validateMarkupPercent,
} from "../lib/security/markup-validation";
import {
  finiteNonNegativeNumberSchema,
  parseRequiredFiniteNumber,
} from "../lib/security/numeric-validation";
import {
  addPricingItemInputSchema,
  calculationModeSchema,
  createPricingFromEstimateInputSchema,
  pricingDocumentInputSchema,
  pricingItemInputSchema,
} from "../lib/pricing/schemas";
import {
  createQuoteFromPricingInputSchema,
  quoteItemInputSchema,
  quoteStatusSchema,
  updateQuoteInputSchema,
} from "../lib/quotes/schemas";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function schemaOk(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) {
  return schema.safeParse(value).success;
}

console.log("=== Batch 2A.2 validation verification ===\n");

console.log("--- Gross margin ---\n");
assert("default company gross margin constant is 20", DEFAULT_MARGIN_PERCENT === 20);
assert("min gross margin constant is 0", MIN_GROSS_MARGIN_PERCENT === 0);
assert("max gross margin constant is 95", MAX_GROSS_MARGIN_PERCENT === 95);
assert("gross margin 0 accepted", validateMarginPercent(0).ok);
assert("gross margin 20 accepted", validateMarginPercent(20).ok);
assert("gross margin 95 accepted", validateMarginPercent(95).ok);
assert("gross margin negative rejected", !validateMarginPercent(-1).ok);
assert("gross margin 95.01 rejected", !validateMarginPercent(95.01).ok);
assert("gross margin 100 rejected", !validateMarginPercent(100).ok);
assert("gross margin NaN rejected", !validateMarginPercent(Number.NaN).ok);
assert("gross margin Infinity rejected", !validateMarginPercent(Number.POSITIVE_INFINITY).ok);
assert("gross margin -Infinity rejected", !validateMarginPercent(Number.NEGATIVE_INFINITY).ok);
assert(
  "gross margin invalid string path rejected via parseRequiredFiniteNumber",
  !parseRequiredFiniteNumber("abc", "Gross margin").ok
);

console.log("\n--- Markup ---\n");
assert("markup 0 accepted", validateMarkupPercent(0).ok);
assert("markup 1000 accepted", validateMarkupPercent(1000).ok);
assert("markup negative rejected", !validateMarkupPercent(-1).ok);
assert("markup above 1000 rejected", !validateMarkupPercent(1000.1).ok);
assert("markup NaN rejected", !validateMarkupPercent(Number.NaN).ok);
assert("markup Infinity rejected", !validateMarkupPercent(Number.POSITIVE_INFINITY).ok);
assert("max markup constant is 1000", MAX_MARKUP_PERCENT === 1000);

console.log("\n--- Numeric fields ---\n");
assert(
  "valid positive quantity accepted",
  schemaOk(finiteNonNegativeNumberSchema, 3)
);
assert(
  "intentional zero accepted",
  schemaOk(finiteNonNegativeNumberSchema, 0)
);
assert(
  "negative quantity rejected",
  !schemaOk(finiteNonNegativeNumberSchema, -1)
);
assert(
  "NaN rejected by finite non-negative schema",
  !schemaOk(finiteNonNegativeNumberSchema, Number.NaN)
);
assert(
  "Infinity rejected by finite non-negative schema",
  !schemaOk(finiteNonNegativeNumberSchema, Number.POSITIVE_INFINITY)
);
assert(
  "empty string does not silently become zero",
  !parseRequiredFiniteNumber("", "Quantity").ok
);
assert(
  "whitespace string does not silently become zero",
  !parseRequiredFiniteNumber("   ", "Quantity").ok
);
assert(
  "null does not silently become zero",
  !parseRequiredFiniteNumber(null, "Quantity").ok
);

const validQuantityRate = {
  internal_label: "Labour",
  client_label: "Labour",
  item_type: "labour",
  delivery_method: "in_house",
  calculation_mode: "quantity_rate",
  quantity: 2,
  unit_cost: 60,
  unit_sell: 80,
  total_cost: 120,
  total_sell: 160,
};

assert(
  "valid quantity-rate pricing item accepted",
  schemaOk(pricingItemInputSchema, validQuantityRate)
);
assert(
  "negative rate rejected on pricing item",
  !schemaOk(pricingItemInputSchema, {
    ...validQuantityRate,
    unit_cost: -10,
  })
);
assert(
  "negative total rejected on pricing item",
  !schemaOk(pricingItemInputSchema, {
    ...validQuantityRate,
    total_sell: -1,
  })
);

console.log("\n--- Calculation modes ---\n");
assert("quantity_rate mode accepted", schemaOk(calculationModeSchema, "quantity_rate"));
assert("productivity_labour mode accepted", schemaOk(calculationModeSchema, "productivity_labour"));
assert("lump_sum mode accepted", schemaOk(calculationModeSchema, "lump_sum"));
assert("unknown mode rejected", !schemaOk(calculationModeSchema, "magic"));

const validLumpSum = {
  internal_label: "Allowance",
  client_label: "Allowance",
  item_type: "allowance",
  delivery_method: "allowance",
  calculation_mode: "lump_sum",
  total_cost: 500,
  total_sell: 650,
};

assert("valid lump-sum accepted", schemaOk(pricingItemInputSchema, validLumpSum));
assert(
  "negative lump-sum rejected",
  !schemaOk(pricingItemInputSchema, { ...validLumpSum, total_sell: -5 })
);
assert(
  "non-finite lump-sum rejected",
  !schemaOk(pricingItemInputSchema, {
    ...validLumpSum,
    total_sell: Number.POSITIVE_INFINITY,
  })
);
assert(
  "missing required lump-sum total rejected",
  !schemaOk(pricingItemInputSchema, {
    internal_label: "Allowance",
    client_label: "Allowance",
    item_type: "allowance",
    delivery_method: "allowance",
    calculation_mode: "lump_sum",
  })
);
assert(
  "zero lump-sum totals accepted as intentional",
  schemaOk(pricingItemInputSchema, {
    ...validLumpSum,
    total_cost: 0,
    total_sell: 0,
  })
);

assert(
  "invalid quantity-rate missing quantity rejected",
  !schemaOk(pricingItemInputSchema, {
    ...validQuantityRate,
    quantity: null,
  })
);

assert(
  "valid productivity-labour accepted",
  schemaOk(pricingItemInputSchema, {
    internal_label: "Labour",
    client_label: "Labour",
    item_type: "labour",
    delivery_method: "in_house",
    calculation_mode: "productivity_labour",
    productivity_rate: 4,
    calculated_quantity: 8,
    unit_cost: 60,
    unit_sell: 80,
    total_cost: 480,
    total_sell: 640,
  })
);
assert(
  "invalid productivity-labour missing productivity fields rejected",
  !schemaOk(pricingItemInputSchema, {
    internal_label: "Labour",
    client_label: "Labour",
    item_type: "labour",
    delivery_method: "in_house",
    calculation_mode: "productivity_labour",
    total_cost: 100,
    total_sell: 120,
  })
);

console.log("\n--- IDs and document schemas ---\n");
const validUuid = "11111111-1111-4111-8111-111111111111";
assert(
  "valid create-pricing IDs accepted",
  schemaOk(createPricingFromEstimateInputSchema, { projectId: validUuid })
);
assert(
  "invalid project ID rejected",
  !schemaOk(createPricingFromEstimateInputSchema, { projectId: "not-a-uuid" })
);
assert(
  "valid add pricing item IDs accepted",
  schemaOk(addPricingItemInputSchema, {
    pricingDocumentId: validUuid,
    projectId: validUuid,
  })
);
assert(
  "unknown item type rejected",
  !schemaOk(pricingItemInputSchema, {
    ...validQuantityRate,
    item_type: "credit",
  })
);
assert(
  "valid pricing document gst accepted",
  schemaOk(pricingDocumentInputSchema, { gst_rate: 15 })
);
assert(
  "negative gst rejected",
  !schemaOk(pricingDocumentInputSchema, { gst_rate: -1 })
);

console.log("\n--- Quote inputs ---\n");
assert(
  "valid quote item accepted",
  schemaOk(quoteItemInputSchema, {
    label: "Deck labour",
    quantity: 10,
    unit_price: 80,
    total: 800,
  })
);
assert(
  "zero quote total accepted as intentional",
  schemaOk(quoteItemInputSchema, {
    label: "Included item",
    quantity: 0,
    unit_price: 0,
    total: 0,
    optional: true,
  })
);
assert(
  "negative quote quantity rejected",
  !schemaOk(quoteItemInputSchema, {
    label: "Deck labour",
    quantity: -1,
    unit_price: 80,
    total: 800,
  })
);
assert(
  "negative unit price rejected",
  !schemaOk(quoteItemInputSchema, {
    label: "Deck labour",
    quantity: 1,
    unit_price: -80,
    total: 80,
  })
);
assert(
  "negative total rejected",
  !schemaOk(quoteItemInputSchema, {
    label: "Deck labour",
    quantity: 1,
    unit_price: 80,
    total: -1,
  })
);
assert(
  "non-finite quote total rejected",
  !schemaOk(quoteItemInputSchema, {
    label: "Deck labour",
    total: Number.NaN,
  })
);
assert("valid quote status accepted", schemaOk(quoteStatusSchema, "draft"));
assert("invalid quote status rejected", !schemaOk(quoteStatusSchema, "paid"));
assert(
  "valid create quote from pricing IDs accepted",
  schemaOk(createQuoteFromPricingInputSchema, {
    projectId: validUuid,
    pricingDocumentId: validUuid,
  })
);
assert(
  "valid update quote payload accepted",
  schemaOk(updateQuoteInputSchema, {
    quoteId: validUuid,
    quote: { title: "Revised quote" },
  })
);

if (!process.exitCode) {
  console.log("\nBatch 2A.2 focused checks passed.");
} else {
  console.log("\nBatch 2A.2 focused checks failed.");
}
