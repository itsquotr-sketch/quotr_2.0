import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import { normalizeBooleanForUi } from "@/lib/scopes/fact-values";
import { hidePergolaQuestion } from "@/lib/scopes/pergola-questions";
import { pergolaScope } from "@/lib/scopes/templates/pergola";
import type { ScopeQuestionTemplate } from "@/lib/scopes/types";

const DIMENSIONS = new Set([
  "length_m",
  "width_m",
  "height_m",
  "post_count",
  "embedment_m",
  "hole_diameter_m",
  "hole_depth_m",
  "rafter_spacing_mm",
  "beam_lm",
  "rafter_lm",
  "roof_area_m2",
  "attachment_lm",
  "removal_area_m2",
  "gutter_lm",
]);

const MATERIALS = new Set([
  "material",
  "timber_type",
  "post_section",
  "post_treatment",
  "post_specification",
  "frame_section",
  "frame_specification",
  "roof_type",
  "roofing_type",
]);

const STRUCTURE = new Set([
  "foundation_method",
  "treatment_confirmed",
  "base_confirmed",
  "ground",
  "excavation_method",
  "spoil",
  "concrete_bags",
  "bag_yield_m3",
  "frame_layout",
  "frame_design_confirmed",
  "rafter_direction",
  "waste_percent",
  "engineering_or_consent_status",
]);

const ZERO_IS_VALID = new Set(["fixings_count", "waste_percent"]);

export const PERGOLA_DETAILS_FACT_ORDER = new Map(
  pergolaScope.questions.map((question, index) => [question.factKey ?? question.key, index])
);

export type PergolaDetailsSection = "dimensions" | "materials" | "structure" | "scope";

export function pergolaDetailsSectionId(
  factKey: string | null | undefined
): PergolaDetailsSection | null {
  if (!factKey?.startsWith("pergola.")) return null;
  const name = factKey.slice("pergola.".length);
  if (DIMENSIONS.has(name)) return "dimensions";
  if (MATERIALS.has(name)) return "materials";
  if (STRUCTURE.has(name)) return "structure";
  return "scope";
}

function displayValue(
  question: ScopeQuestionTemplate,
  raw: unknown
): ClarifyCandidate["currentValue"] | undefined {
  if (!hasFactValue(raw)) return undefined;
  if (isNotSureValue(raw)) return "Not sure";
  if (question.inputType === "number") {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  if (question.options?.some((option) => /^yes$/i.test(option))) {
    const choice = normalizeBooleanForUi(raw);
    if (choice && question.options.includes(choice)) return choice;
  }
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "boolean") return raw;
  return undefined;
}

/**
 * Applicable pergola questions for Details.
 * Known values stay editable. Missing values stay visible. Not sure stays
 * unresolved. None of these block a partial estimate.
 */
export function pergolaClarifyCandidates(input: {
  readonly workAreas: readonly {
    readonly id: string;
    readonly type: string;
    readonly name: string;
    readonly status: string;
  }[];
  readonly facts: readonly {
    readonly key: string;
    readonly work_area_id: string | null;
    readonly value: unknown;
  }[];
}): ClarifyCandidate[] {
  const candidates: ClarifyCandidate[] = [];
  for (const area of input.workAreas) {
    if (area.status === "excluded" || area.type !== "pergola") continue;
    const stored = new Map(
      input.facts
        .filter((fact) => fact.work_area_id === area.id)
        .map((fact) => [fact.key, fact.value])
    );
    for (const question of pergolaScope.questions) {
      const key = question.factKey ?? question.key;
      const name = key.startsWith("pergola.") ? key.slice("pergola.".length) : key;
      if (hidePergolaQuestion(key, (factName) => stored.get(`pergola.${factName}`))) {
        continue;
      }
      const currentValue = displayValue(question, stored.get(key));
      candidates.push({
        id: `pergola:${area.id}:${key}`,
        source: "scope_fact",
        workAreaId: area.id,
        workAreaName: area.name,
        workAreaType: area.type,
        factKey: key,
        constraintKey: null,
        questionKey: key,
        label: question.label,
        question: question.questionText,
        askClass: "ASSUME_IF_SKIPPED",
        inputType: question.inputType === "number" ? "number" : "select",
        currentValue,
        unit: question.unit,
        options: question.options,
        writeTarget: "FACT",
        write: null,
        blocksEstimate: false,
        assumable: false,
        rankScore: question.priority,
        rankReason: "Pergola details",
        assumptionStatement: null,
        allowZero: ZERO_IS_VALID.has(name),
        allowNotSure: question.inputType === "number",
        retainAnswered: true,
      });
    }
  }
  return candidates;
}
