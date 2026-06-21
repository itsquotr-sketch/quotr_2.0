import { z } from "zod";
import { AIExtractionError } from "@/lib/ai/schema";

export const NOTE_ANALYSIS_NO_UPDATES_MESSAGE =
  "Quotr could not find clear updates in these notes.";

const workAreaProposalSchema = z.object({
  type: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  action: z.enum(["add", "restore", "no_change"]).optional(),
});

const factProposalSchema = z.object({
  work_area_type: z.string().nullable(),
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  action: z.enum(["add", "update", "no_change"]).optional(),
});

const constraintProposalSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  action: z.enum(["add", "update", "no_change"]).optional(),
});

/** Strict internal schema for normalised note analysis output. */
export const noteProposalExtractionSchema = z.object({
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  workAreas: z.array(workAreaProposalSchema),
  facts: z.array(factProposalSchema),
  constraints: z.array(constraintProposalSchema),
  warnings: z.array(z.string()),
});

export type NoteProposalExtractionOutput = z.infer<
  typeof noteProposalExtractionSchema
>;

const VALID_CONSTRAINT_KEYS = new Set([
  "site_access",
  "site_slope",
  "material_carry_distance",
  "working_hours",
]);

export function validateNormalisedNoteAnalysis(
  output: NoteProposalExtractionOutput
): NoteProposalExtractionOutput {
  const parsed = noteProposalExtractionSchema.safeParse(output);
  if (!parsed.success) {
    throw new AIExtractionError(
      "Normalised note analysis failed internal validation.",
      "NOTE_ANALYSIS_INTERNAL"
    );
  }
  return parsed.data;
}

export function validateNoteProposalExtraction(
  raw: NoteProposalExtractionOutput,
  allowedTypes: string[],
  catalogueTypes: string[]
): NoteProposalExtractionOutput {
  const parsed = validateNormalisedNoteAnalysis(raw);

  const allowedSet = new Set(allowedTypes);
  const catalogueSet = new Set(catalogueTypes);

  const workAreas = parsed.workAreas.filter(
    (wa) => allowedSet.has(wa.type) && catalogueSet.has(wa.type)
  );

  const facts = parsed.facts.filter((fact) => {
    if (fact.work_area_type === null) return true;
    if (!catalogueSet.has(fact.work_area_type)) return false;
    return allowedSet.has(fact.work_area_type);
  });

  const constraints = parsed.constraints.filter((row) =>
    VALID_CONSTRAINT_KEYS.has(row.key)
  );

  if (
    workAreas.length === 0 &&
    facts.length === 0 &&
    constraints.length === 0
  ) {
    throw new AIExtractionError(
      NOTE_ANALYSIS_NO_UPDATES_MESSAGE,
      "NOTE_ANALYSIS_NO_UPDATES"
    );
  }

  return {
    ...parsed,
    workAreas,
    facts,
    constraints,
  };
}
