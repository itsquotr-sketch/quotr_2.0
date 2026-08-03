/**
 * Gross-margin validation (Stage 2A).
 *
 * Gross margin = Gross profit ÷ Selling price.
 * This is distinct from markup (gross profit ÷ cost). Do not convert between them.
 *
 * Sell-from-cost uses divisor `(1 - margin/100)`. Values at or above 100% make
 * that calculation invalid; the product ceiling is 95% inclusive.
 */

import { z } from "zod";
import { finiteNumberSchema } from "@/lib/security/numeric-validation";

export const MIN_GROSS_MARGIN_PERCENT = 0;
export const MAX_GROSS_MARGIN_PERCENT = 95;

/** @deprecated Prefer MIN_GROSS_MARGIN_PERCENT — retained as alias for existing imports. */
export const MIN_MARGIN_PERCENT = MIN_GROSS_MARGIN_PERCENT;
/** @deprecated Prefer MAX_GROSS_MARGIN_PERCENT — retained as alias for existing imports. */
export const MAX_MARGIN_PERCENT = MAX_GROSS_MARGIN_PERCENT;

export class InvalidMarginPercentError extends Error {
  constructor(marginPercent: number) {
    super(
      `Invalid gross margin percent: ${marginPercent}. Must be between ${MIN_GROSS_MARGIN_PERCENT}% and ${MAX_GROSS_MARGIN_PERCENT}% inclusive. Values at or above 100% are invalid for sell-price calculation.`
    );
    this.name = "InvalidMarginPercentError";
  }
}

export function validateMarginPercent(
  margin: number
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(margin)) {
    return { ok: false, message: "Gross margin must be a finite number." };
  }
  if (margin < MIN_GROSS_MARGIN_PERCENT) {
    return {
      ok: false,
      message: `Gross margin must be at least ${MIN_GROSS_MARGIN_PERCENT}%.`,
    };
  }
  if (margin > MAX_GROSS_MARGIN_PERCENT) {
    return {
      ok: false,
      message: `Gross margin must be at most ${MAX_GROSS_MARGIN_PERCENT}%. Values at or above 100% are invalid for sell-price calculation.`,
    };
  }
  return { ok: true };
}

/** Alias emphasising that this validates gross margin, not markup. */
export const validateGrossMarginPercent = validateMarginPercent;

export function assertMarginPercentForEstimating(marginPercent: number): number {
  const result = validateMarginPercent(marginPercent);
  if (!result.ok) {
    throw new InvalidMarginPercentError(marginPercent);
  }
  return marginPercent;
}

export const grossMarginPercentSchema = finiteNumberSchema.superRefine(
  (value, ctx) => {
    const result = validateMarginPercent(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message });
    }
  }
);

export type GrossMarginPercent = z.infer<typeof grossMarginPercentSchema>;
