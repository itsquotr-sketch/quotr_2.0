import { z } from "zod";
import { AIExtractionError } from "@/lib/ai/schema";

const workAreaProposalSchema = z.object({
  type: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional().default(""),
  action: z.enum(["add", "restore", "no_change"]).optional(),
});

const factProposalSchema = z.object({
  work_area_type: z.string().nullable(),
  key: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional().default(""),
  action: z.enum(["add", "update", "no_change"]).optional(),
});

const constraintProposalSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional().default(""),
  action: z.enum(["add", "update", "no_change"]).optional(),
});

export const noteProposalExtractionSchema = z.object({
  summary: z.string().optional().default(""),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  workAreas: z.array(workAreaProposalSchema).default([]),
  facts: z.array(factProposalSchema).default([]),
  constraints: z.array(constraintProposalSchema).default([]),
  warnings: z.array(z.string()).default([]),
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

export function validateNoteProposalExtraction(
  raw: unknown,
  allowedTypes: string[],
  catalogueTypes: string[]
): NoteProposalExtractionOutput {
  const parsed = noteProposalExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AIExtractionError("Note analysis failed schema validation.");
  }

  const allowedSet = new Set(allowedTypes);
  const catalogueSet = new Set(catalogueTypes);

  const workAreas = parsed.data.workAreas.filter(
    (wa) => allowedSet.has(wa.type) && catalogueSet.has(wa.type)
  );

  const facts = parsed.data.facts.filter((fact) => {
    if (fact.work_area_type === null) return true;
    if (!catalogueSet.has(fact.work_area_type)) return false;
    return allowedSet.has(fact.work_area_type);
  });

  const constraints = parsed.data.constraints.filter((row) =>
    VALID_CONSTRAINT_KEYS.has(row.key)
  );

  if (
    workAreas.length === 0 &&
    facts.length === 0 &&
    constraints.length === 0
  ) {
    throw new AIExtractionError(
      "No actionable updates were found in the site notes."
    );
  }

  return {
    ...parsed.data,
    workAreas,
    facts,
    constraints,
  };
}
