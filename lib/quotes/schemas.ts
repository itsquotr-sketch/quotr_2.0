import { z } from "zod";
import {
  gstRatePercentSchema,
  moneyAmountSchema,
  optionalNullableNonNegativeNumberSchema,
  trimmedStringSchema,
  uuidSchema,
} from "@/lib/security/numeric-validation";
import type { QuoteStatus } from "@/lib/quotes/types";

/**
 * Runtime Zod schemas for quote mutations (Stage 2A.2).
 *
 * These schemas reject invalid values only. They do not decide whether quote
 * totals should be recomputed or trusted — that remains Batch 2A.3 / Stage 2B.
 *
 * Zero-value notes:
 * - Quote items have `optional` and `visible` flags but no dedicated
 *   informational / no-charge type.
 * - Zero quantity / unit_price / total are permitted as intentional finite
 *   non-negative values where the product already supports blank or zero lines.
 */

export const QUOTE_STATUS_VALUES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "revised",
  "archived",
] as const satisfies readonly QuoteStatus[];

export const quoteStatusSchema = z.enum(QUOTE_STATUS_VALUES);

export const quoteInputSchema = z.object({
  title: trimmedStringSchema(200).optional(),
  issue_date: z.union([trimmedStringSchema(40), z.null()]).optional(),
  valid_until: z.union([trimmedStringSchema(40), z.null()]).optional(),
  scope_summary: z.union([trimmedStringSchema(10000), z.null()]).optional(),
  notes_to_client: z.union([trimmedStringSchema(10000), z.null()]).optional(),
  assumptions: z.array(trimmedStringSchema(2000)).optional(),
  exclusions: z.array(trimmedStringSchema(2000)).optional(),
  terms: z.union([trimmedStringSchema(10000), z.null()]).optional(),
});

export const quoteItemInputSchema = z.object({
  label: trimmedStringSchema(200, {
    min: 1,
    requiredMessage: "Label is required.",
  }),
  description: z.union([trimmedStringSchema(5000), z.null()]).optional(),
  quantity: optionalNullableNonNegativeNumberSchema,
  unit: z.union([trimmedStringSchema(40), z.null()]).optional(),
  unit_price: optionalNullableNonNegativeNumberSchema,
  total: moneyAmountSchema.optional(),
  visible: z.boolean().optional(),
  optional: z.boolean().optional(),
});

export const createQuoteFromPricingInputSchema = z.object({
  projectId: uuidSchema,
  pricingDocumentId: uuidSchema,
});

export const updateQuoteInputSchema = z.object({
  quoteId: uuidSchema,
  quote: quoteInputSchema,
});

export const updateQuoteItemInputSchema = z.object({
  quoteItemId: uuidSchema,
  item: quoteItemInputSchema,
});

export const setQuoteItemVisibleInputSchema = z.object({
  quoteItemId: uuidSchema,
  visible: z.boolean(),
});

export const deleteQuoteItemInputSchema = z.object({
  quoteItemId: uuidSchema,
});

export const quoteIdInputSchema = z.object({
  quoteId: uuidSchema,
});

export const reviseQuoteInputSchema = z.object({
  projectId: uuidSchema,
  quoteId: uuidSchema,
  revisionNote: trimmedStringSchema(2000).optional(),
});

export const reviseQuoteFromFinalPricingInputSchema = z.object({
  projectId: uuidSchema,
  quoteId: uuidSchema,
  pricingDocumentId: uuidSchema.optional(),
  revisionNote: trimmedStringSchema(2000).optional(),
});

export const quoteDocumentGstSchema = z.object({
  gst_rate: gstRatePercentSchema,
});

export type QuoteInputParsed = z.infer<typeof quoteInputSchema>;
export type QuoteItemInputParsed = z.infer<typeof quoteItemInputSchema>;
