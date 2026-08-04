/**
 * Stable shadow-parity classifications — Batch 2B.4.
 */

export const PARITY_CLASSIFICATIONS = Object.freeze([
  "EXACT_MATCH",
  "MATCH_WITH_ROUNDING_DIFFERENCE",
  "MATCH_AFTER_INPUT_NORMALISATION",
  "LEGACY_INCONSISTENCY",
  "APPROVED_ENGINE_CORRECTION",
  "MISSING_LEGACY_INPUT",
  "UNSUPPORTED_LEGACY_MODE",
  "PERSISTENCE_ONLY_DIFFERENCE",
  "PRESENTATION_ONLY_DIFFERENCE",
  "BLOCKING_ADOPTION_MISMATCH",
  "DEFERRED_WORKFLOW_DIFFERENCE",
] as const);

export type ParityClassification = (typeof PARITY_CLASSIFICATIONS)[number];

export function isParityClassification(
  value: string
): value is ParityClassification {
  return (PARITY_CLASSIFICATIONS as readonly string[]).includes(value);
}

/** Classifications that are acceptable without failing the parity runner. */
export const NON_FAILING_CLASSIFICATIONS: readonly ParityClassification[] =
  Object.freeze([
    "EXACT_MATCH",
    "MATCH_WITH_ROUNDING_DIFFERENCE",
    "MATCH_AFTER_INPUT_NORMALISATION",
    "LEGACY_INCONSISTENCY",
    "APPROVED_ENGINE_CORRECTION",
    "MISSING_LEGACY_INPUT",
    "UNSUPPORTED_LEGACY_MODE",
    "PERSISTENCE_ONLY_DIFFERENCE",
    "PRESENTATION_ONLY_DIFFERENCE",
    "DEFERRED_WORKFLOW_DIFFERENCE",
    // BLOCKING_ADOPTION_MISMATCH is allowed only when registered in known-mismatches
  ]);
