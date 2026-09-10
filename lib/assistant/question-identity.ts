/**
 * Canonical semantic identity for capture/edit fields.
 *
 * Presentation IDs (`check:`, `hard:`, `fact:`, `pc:`, `refine:`) are
 * surface-local. Semantic identity is shared across Clarify, Refine, overlay,
 * and focus targeting.
 *
 * Flat facts: workAreaId + factKey.
 * Nested Internal Walls: workAreaId + factKey + nestedItemId (wallTypeId)
 *   + optional componentId (openingId).
 *
 * Do not persist draft nested ids. They exist only so pre-creation Clarify
 * rows stay stable across recomposition.
 */

export type QuestionSemanticIdentity = {
  readonly workAreaId?: string | null;
  readonly factKey?: string | null;
  readonly constraintKey?: string | null;
  readonly nestedItemId?: string | null;
  readonly componentId?: string | null;
};

export type QuestionPresentationSurface =
  | "hard"
  | "fact"
  | "refine"
  | "check"
  | "pc";

const PLACEHOLDER_NESTED_IDS = new Set(["new", "none", ""]);

export function isPlaceholderNestedId(
  value: string | null | undefined
): boolean {
  const trimmed = value?.trim() ?? "";
  return PLACEHOLDER_NESTED_IDS.has(trimmed);
}

export function normalizeNestedId(
  value: string | null | undefined
): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || PLACEHOLDER_NESTED_IDS.has(trimmed)) return undefined;
  return trimmed;
}

/**
 * Stable unpersisted nested-item identity for a Work Area that has no Wall
 * Type yet. Derived from workAreaId so recomposition does not mint a new id.
 * Not a persisted Wall Type UUID and not passed to applyInternalWallsFactWrite.
 */
export function draftNestedItemId(workAreaId: string): string {
  return `draft:${workAreaId}`;
}

export function isInternalWallsNestedFactKey(factKey: string): boolean {
  return (
    factKey.startsWith("internal_walls.wall_type.") ||
    factKey.startsWith("internal_walls.opening.")
  );
}

export function isInternalWallsOpeningFactKey(factKey: string): boolean {
  return factKey.startsWith("internal_walls.opening.");
}

export function wallTypeQuestionIdentity(params: {
  workAreaId: string;
  factKey: string;
  wallTypeId?: string | null;
  openingId?: string | null;
}): QuestionSemanticIdentity {
  const nested = isInternalWallsNestedFactKey(params.factKey);
  const nestedItemId = nested
    ? (normalizeNestedId(params.wallTypeId) ??
      draftNestedItemId(params.workAreaId))
    : undefined;
  return {
    workAreaId: params.workAreaId,
    factKey: params.factKey,
    nestedItemId,
    componentId: isInternalWallsOpeningFactKey(params.factKey)
      ? normalizeNestedId(params.openingId)
      : undefined,
  };
}

export function identityFromCaptureRow(row: {
  readonly workAreaId?: string | null;
  readonly workAreaType?: string | null;
  readonly factKey?: string | null;
  readonly constraintKey?: string | null;
  readonly wallTypeId?: string | null;
  readonly openingId?: string | null;
}): QuestionSemanticIdentity {
  const constraintKey = row.constraintKey?.trim() ?? "";
  if (constraintKey) {
    return { constraintKey };
  }
  const factKey = row.factKey?.trim() ?? "";
  const workAreaId = row.workAreaId?.trim() ?? "";
  if (
    workAreaId &&
    factKey &&
    (row.workAreaType === "internal_walls" ||
      isInternalWallsNestedFactKey(factKey))
  ) {
    return wallTypeQuestionIdentity({
      workAreaId,
      factKey,
      wallTypeId: row.wallTypeId,
      openingId: row.openingId,
    });
  }
  return {
    workAreaId: row.workAreaId,
    factKey: row.factKey,
    nestedItemId: normalizeNestedId(row.wallTypeId),
    componentId: normalizeNestedId(row.openingId),
  };
}

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
  const nestedItemId = normalizeNestedId(identity.nestedItemId);
  const componentId = normalizeNestedId(identity.componentId);
  const parts = ["fact"];
  if (workAreaId) parts.push(workAreaId);
  parts.push(factKey);
  if (nestedItemId) {
    parts.push(nestedItemId);
    if (componentId) parts.push(componentId);
  }
  return parts.join(":");
}

export function questionPresentationId(
  surface: QuestionPresentationSurface,
  identity: QuestionSemanticIdentity
): string | null {
  const semantic = questionSemanticKey(identity);
  if (!semantic) return null;
  const rest = semantic.replace(/^(fact|constraint):/, "");
  return `${surface}:${rest}`;
}

export function overlayFactSemanticKey(row: {
  readonly work_area_id?: string | null;
  readonly key: string;
  readonly wallTypeId?: string | null;
  readonly openingId?: string | null;
}): string {
  return (
    questionSemanticKey(
      identityFromCaptureRow({
        workAreaId: row.work_area_id,
        factKey: row.key,
        wallTypeId: row.wallTypeId,
        openingId: row.openingId,
      })
    ) ?? `fact:${row.key}`
  );
}

export function isNestedRefineIdentity(row: {
  readonly wallTypeId?: string | null;
  readonly openingId?: string | null;
}): boolean {
  return Boolean(
    normalizeNestedId(row.wallTypeId) || normalizeNestedId(row.openingId)
  );
}

export function candidateMatchesFocus(
  row: {
    readonly id: string;
    readonly semanticKey?: string | null;
    readonly workAreaId?: string | null;
    readonly workAreaType?: string | null;
    readonly factKey?: string | null;
    readonly constraintKey?: string | null;
    readonly wallTypeId?: string | null;
    readonly openingId?: string | null;
  },
  focusKey: string | null | undefined
): boolean {
  if (!focusKey) return false;
  const identity = identityFromCaptureRow(row);
  const semantic = questionSemanticKey(identity);
  if (
    focusKey === row.id ||
    (row.semanticKey != null && focusKey === row.semanticKey) ||
    (semantic != null && focusKey === semantic)
  ) {
    return true;
  }
  const presentation = questionPresentationId(
    "refine",
    identity
  );
  if (presentation != null && focusKey === presentation) return true;
  if (row.constraintKey && focusKey === row.constraintKey) return true;
  if (!row.factKey || focusKey !== row.factKey) return false;
  const nestedItemId = normalizeNestedId(identity.nestedItemId);
  if (nestedItemId) return false;
  return true;
}
