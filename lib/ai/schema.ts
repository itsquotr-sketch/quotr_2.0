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
  z.null(),
]);

const factSchema = z.object({
  work_area_type: z.string().nullable(),
  key: z.string(),
  label: z.string().optional().default(""),
  value: factValueSchema,
  unit: z.string().optional(),
  confidence: z.number().min(0).max(1).optional().default(0.8),
});

export const aiExtractionSchema = z.object({
  workAreas: z.array(workAreaSchema).default([]),
  facts: z.array(factSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  possibleConstraints: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional().default(0.7),
  warnings: z.array(z.string()).default([]),
});

export type AIExtractionOutput = z.infer<typeof aiExtractionSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lenient coercion so partial AI responses can still be recovered. */
export function coerceExtractionPayload(raw: unknown): AIExtractionOutput {
  if (!isRecord(raw)) {
    throw new AIExtractionError("AI extraction failed schema validation.");
  }

  const parsed = aiExtractionSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  const workAreasRaw = Array.isArray(raw.workAreas) ? raw.workAreas : [];
  const factsRaw = Array.isArray(raw.facts) ? raw.facts : [];

  const workAreas = workAreasRaw
    .filter(isRecord)
    .map((wa) => ({
      type: String(wa.type ?? ""),
      confidence:
        typeof wa.confidence === "number" && Number.isFinite(wa.confidence)
          ? Math.min(1, Math.max(0, wa.confidence))
          : 0.7,
      rationale: typeof wa.rationale === "string" ? wa.rationale : "",
    }))
    .filter((wa) => wa.type.length > 0);

  const facts = factsRaw
    .filter(isRecord)
    .map((fact) => {
      const value = fact.value;
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        (Array.isArray(value) && value.every((item) => typeof item === "string"))
      ) {
        return {
          work_area_type:
            fact.work_area_type === null
              ? null
              : String(fact.work_area_type ?? ""),
          key: String(fact.key ?? ""),
          label: String(fact.label ?? fact.key ?? ""),
          value,
          unit: typeof fact.unit === "string" ? fact.unit : undefined,
          confidence:
            typeof fact.confidence === "number" && Number.isFinite(fact.confidence)
              ? Math.min(1, Math.max(0, fact.confidence))
              : 0.8,
        };
      }
      return null;
    })
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null && fact.key.length > 0);

  if (workAreas.length === 0 && facts.length === 0) {
    throw new AIExtractionError("AI extraction failed schema validation.");
  }

  return {
    workAreas,
    facts,
    assumptions: Array.isArray(raw.assumptions)
      ? raw.assumptions.filter((item): item is string => typeof item === "string")
      : [],
    possibleConstraints: Array.isArray(raw.possibleConstraints)
      ? raw.possibleConstraints.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.min(1, Math.max(0, raw.confidence))
        : 0.7,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((item): item is string => typeof item === "string")
      : [],
  };
}

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
