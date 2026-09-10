/**
 * EF02-D1 — stable semantic identity for capture/edit fields.
 *
 * Presentation IDs (`check:`, `hard:`, `fact:`, `pc:`, `refine:`) are surface-
 * local and must not be used to decide whether two rows are the same field.
 *
 * Nested Internal Walls candidate identity (temporary `"new"` wall-type ids)
 * is intentionally out of this generic helper. Do not pass wallTypeId /
 * openingId here until a dedicated IW follow-up.
 */

export type QuestionSemanticIdentity = {
  readonly workAreaId?: string | null;
  readonly factKey?: string | null;
  readonly constraintKey?: string | null;
};

export function questionSemanticKey(
  identity: QuestionSemanticIdentity
): string | null {
  const constraintKey = identity.constraintKey?.trim() ?? "";
  if (constraintKey) {
    return `constraint:${constraintKey}`;
  }
  const factKey = identity.factKey?.trim() ?? "";
  if (!factKey) return null;
  const workAreaId = identity.workAreaId?.trim() ?? "";
  if (workAreaId) {
    return `fact:${workAreaId}:${factKey}`;
  }
  return `fact:${factKey}`;
}

export function isNestedRefineIdentity(row: {
  readonly wallTypeId?: string | null;
  readonly openingId?: string | null;
}): boolean {
  return Boolean(row.wallTypeId || row.openingId);
}
