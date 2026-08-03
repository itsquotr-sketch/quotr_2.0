import { z } from "zod";

/**
 * Shared Zod primitives for Stage 2A runtime validation.
 *
 * These helpers reject invalid, non-finite and unintended zero-coercion paths.
 * They do not perform commercial arithmetic.
 */

/** Finite number — rejects NaN, ±Infinity, and non-numbers. */
export const finiteNumberSchema = z.number().refine(
  (value) => Number.isFinite(value),
  "Value must be a finite number."
);

/** Finite number ≥ 0 — includes intentional zero. */
export const finiteNonNegativeNumberSchema = finiteNumberSchema.refine(
  (value) => value >= 0,
  "Value must be zero or greater."
);

/** Finite number > 0. */
export const finitePositiveNumberSchema = finiteNumberSchema.refine(
  (value) => value > 0,
  "Value must be greater than zero."
);

/**
 * Optional nullable finite non-negative number.
 * `null` / `undefined` stay absent — they are not coerced to zero.
 */
export const optionalNullableNonNegativeNumberSchema = z
  .union([finiteNonNegativeNumberSchema, z.null()])
  .optional();

/**
 * Required or optional monetary total (≥ 0 finite).
 * Empty strings and invalid strings are rejected (not coerced to 0).
 */
export const moneyAmountSchema = finiteNonNegativeNumberSchema;

export const optionalMoneyAmountSchema = finiteNonNegativeNumberSchema.optional();

export const uuidSchema = z.string().uuid("Must be a valid ID.");

export function trimmedStringSchema(
  max: number,
  options?: { min?: number; requiredMessage?: string }
) {
  const min = options?.min ?? 0;
  let schema = z.string().trim().max(max, `Must be ${max} characters or less.`);
  if (min > 0) {
    schema = schema.min(
      min,
      options?.requiredMessage ?? "This field is required."
    );
  }
  return schema;
}

/**
 * Accept a number that is already numeric. Reject strings, including "".
 * Use when the action layer already receives typed numbers (Server Actions).
 */
export function rejectNonFiniteMessage(label: string): string {
  return `${label} must be a finite number.`;
}

export function rejectNegativeMessage(label: string): string {
  return `${label} must be zero or greater.`;
}

/**
 * Percentage in [min, max] inclusive. Distinct from gross-margin / markup
 * domain helpers — use those for commercial settings.
 */
export function boundedPercentSchema(
  min: number,
  max: number,
  label: string
) {
  return finiteNumberSchema
    .refine((value) => value >= min, `${label} must be at least ${min}%.`)
    .refine((value) => value <= max, `${label} must be at most ${max}%.`);
}

/** GST / tax rate — conservative MVP bounds pending any tighter product rule. */
export const gstRatePercentSchema = boundedPercentSchema(0, 100, "GST rate");

/**
 * Reject stringy numeric inputs that should never silently become zero.
 * Useful when validating unknown/FormData-derived values before coercion.
 */
export function parseRequiredFiniteNumber(
  value: unknown,
  label: string
): { ok: true; value: number } | { ok: false; message: string } {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false, message: rejectNonFiniteMessage(label) };
    }
    return { ok: true, value };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return { ok: false, message: `${label} is required.` };
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return { ok: false, message: rejectNonFiniteMessage(label) };
    }
    return { ok: true, value: parsed };
  }

  if (value == null) {
    return { ok: false, message: `${label} is required.` };
  }

  return { ok: false, message: rejectNonFiniteMessage(label) };
}
