/**
 * Markup validation (Stage 2A).
 *
 * Markup = Gross profit ÷ Cost (when cost > 0).
 * This is distinct from gross margin (gross profit ÷ selling price).
 * Do not convert markup to margin or margin to markup in Stage 2A.
 */

import { z } from "zod";
import { finiteNumberSchema } from "@/lib/security/numeric-validation";

export const MIN_MARKUP_PERCENT = 0;
export const MAX_MARKUP_PERCENT = 1000;

export class InvalidMarkupPercentError extends Error {
  constructor(markupPercent: number) {
    super(
      `Invalid markup percent: ${markupPercent}. Must be between ${MIN_MARKUP_PERCENT}% and ${MAX_MARKUP_PERCENT}% inclusive.`
    );
    this.name = "InvalidMarkupPercentError";
  }
}

export function validateMarkupPercent(
  markup: number
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(markup)) {
    return { ok: false, message: "Markup must be a finite number." };
  }
  if (markup < MIN_MARKUP_PERCENT) {
    return {
      ok: false,
      message: `Markup must be at least ${MIN_MARKUP_PERCENT}%.`,
    };
  }
  if (markup > MAX_MARKUP_PERCENT) {
    return {
      ok: false,
      message: `Markup must be at most ${MAX_MARKUP_PERCENT}%.`,
    };
  }
  return { ok: true };
}

export function assertMarkupPercent(markupPercent: number): number {
  const result = validateMarkupPercent(markupPercent);
  if (!result.ok) {
    throw new InvalidMarkupPercentError(markupPercent);
  }
  return markupPercent;
}

export const markupPercentSchema = finiteNumberSchema.superRefine(
  (value, ctx) => {
    const result = validateMarkupPercent(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message });
    }
  }
);

export const optionalNullableMarkupPercentSchema = z
  .union([markupPercentSchema, z.null()])
  .optional();

export type MarkupPercent = z.infer<typeof markupPercentSchema>;
