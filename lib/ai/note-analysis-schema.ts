import { z } from "zod";

const nullableString = z.union([z.string(), z.null()]).optional();
const nullableNumberOrString = z
  .union([z.number(), z.string(), z.null()])
  .optional();

/** Permissive schema for a single raw AI fact — accepts null optionals. */
export const rawNoteAnalysisFactSchema = z
  .object({
    work_area_type: nullableString,
    workAreaType: nullableString,
    work_area_id: nullableString,
    workAreaId: nullableString,
    key: nullableString,
    label: nullableString,
    value: z.unknown().optional(),
    proposedValue: z.unknown().optional(),
    unit: nullableString,
    confidence: nullableNumberOrString,
    rationale: nullableString,
    reason: nullableString,
    action: nullableString,
  })
  .passthrough();

/** Permissive schema for a single raw AI work area proposal. */
export const rawNoteAnalysisWorkAreaSchema = z
  .object({
    type: nullableString,
    label: nullableString,
    confidence: nullableNumberOrString,
    rationale: nullableString,
    reason: nullableString,
    action: nullableString,
  })
  .passthrough();

/** Permissive schema for a single raw AI constraint proposal. */
export const rawNoteAnalysisConstraintSchema = z
  .object({
    key: nullableString,
    label: nullableString,
    value: z.unknown().optional(),
    proposedValue: z.unknown().optional(),
    unit: nullableString,
    confidence: nullableNumberOrString,
    rationale: nullableString,
    reason: nullableString,
    action: nullableString,
  })
  .passthrough();

function coerceArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

/** Unwrap alternative top-level field names from AI output. */
export function unwrapRawNoteAnalysisPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const source = raw as Record<string, unknown>;

  return {
    summary: source.summary,
    confidence: source.confidence,
    workAreas: coerceArray(
      source.workAreas ??
        source.work_areas ??
        source.proposedWorkAreas ??
        source.proposed_work_areas
    ),
    facts: coerceArray(
      source.facts ?? source.proposedFacts ?? source.proposed_facts
    ),
    constraints: coerceArray(
      source.constraints ??
        source.proposedConstraints ??
        source.proposed_constraints
    ),
    warnings: coerceArray(source.warnings),
  };
}

export const rawNoteAnalysisResponseSchema = z
  .object({
    summary: nullableString,
    confidence: nullableNumberOrString,
    workAreas: z.array(z.unknown()).optional().default([]),
    facts: z.array(z.unknown()).optional().default([]),
    constraints: z.array(z.unknown()).optional().default([]),
    warnings: z.array(z.unknown()).optional().default([]),
  })
  .passthrough();

export type RawNoteAnalysisResponse = z.infer<
  typeof rawNoteAnalysisResponseSchema
>;

/**
 * Parse raw AI JSON with a tolerant schema. Returns null if structurally unusable.
 */
export function parseRawNoteAnalysisResponse(
  raw: unknown
): RawNoteAnalysisResponse | null {
  const unwrapped = unwrapRawNoteAnalysisPayload(raw);
  const parsed = rawNoteAnalysisResponseSchema.safeParse(unwrapped);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export type RawNoteAnalysisFact = z.infer<typeof rawNoteAnalysisFactSchema>;
export type RawNoteAnalysisWorkArea = z.infer<
  typeof rawNoteAnalysisWorkAreaSchema
>;
export type RawNoteAnalysisConstraint = z.infer<
  typeof rawNoteAnalysisConstraintSchema
>;

export function parseRawFact(item: unknown): RawNoteAnalysisFact | null {
  const parsed = rawNoteAnalysisFactSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

export function parseRawWorkArea(item: unknown): RawNoteAnalysisWorkArea | null {
  const parsed = rawNoteAnalysisWorkAreaSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

export function parseRawConstraint(
  item: unknown
): RawNoteAnalysisConstraint | null {
  const parsed = rawNoteAnalysisConstraintSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}
