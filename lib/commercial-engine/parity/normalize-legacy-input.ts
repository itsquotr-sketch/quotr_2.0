/**
 * Optional legacy input normalisation helpers — Batch 2B.4.
 * Distinguishes null/unknown from zero. Pure.
 */

export function coerceNullableNumber(
  value: unknown
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

/** Preserve intentional zero; only treat missing/NaN as null. */
export function nullIfMissingNumber(
  value: number | null | undefined
): number | null {
  if (value === undefined) return null;
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  return value;
}
