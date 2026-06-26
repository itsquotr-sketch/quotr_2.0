import { z } from "zod";
import { filterEmbeddedDemolitionWorkAreas } from "@/lib/scopes/demolition-rules";

export class AIExtractionError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AIExtractionError";
    this.code = code;
  }
}

const workAreaSchema = z.object({
  type: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional().default(""),
});

const factValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

const factSchema = z.object({
  work_area_type: z.string().nullable(),
  key: z.string(),
  label: z.string(),
  value: factValueSchema,
  unit: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export const aiExtractionSchema = z.object({
  workAreas: z.array(workAreaSchema),
  facts: z.array(factSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  possibleConstraints: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
});

export type AIExtractionOutput = z.infer<typeof aiExtractionSchema>;

export function validateAndFilterExtraction(
  raw: unknown,
  allowedTypes: string[],
  catalogueTypes: string[]
): AIExtractionOutput {
  const parsed = aiExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AIExtractionError("AI extraction failed schema validation.");
  }

  const allowedSet = new Set(allowedTypes);
  const catalogueSet = new Set(catalogueTypes);

  const workAreas = parsed.data.workAreas
    .filter((wa) => allowedSet.has(wa.type) && catalogueSet.has(wa.type))
    .reduce<Map<string, (typeof parsed.data.workAreas)[number]>>(
      (byType, wa) => {
        const existing = byType.get(wa.type);
        if (!existing || wa.confidence > existing.confidence) {
          byType.set(wa.type, wa);
        }
        return byType;
      },
      new Map()
    );

  const dedupedWorkAreas = filterEmbeddedDemolitionWorkAreas(
    Array.from(workAreas.values())
  );

  if (dedupedWorkAreas.length === 0) {
    throw new AIExtractionError("No valid work areas in extraction.");
  }

  const validWorkAreaTypes = new Set(dedupedWorkAreas.map((wa) => wa.type));

  const facts = parsed.data.facts.filter((fact) => {
    if (fact.work_area_type === null) return true;
    if (!catalogueSet.has(fact.work_area_type)) return false;
    if (!allowedSet.has(fact.work_area_type)) return false;
    return validWorkAreaTypes.has(fact.work_area_type);
  });

  return {
    ...parsed.data,
    workAreas: dedupedWorkAreas,
    facts,
  };
}
