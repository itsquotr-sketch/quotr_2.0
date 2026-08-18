import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import { getEstimatePriorityClass } from "@/lib/scopes/estimate-priority";
import { getLevel1BlockingClass } from "@/lib/scopes/level1-blocking";
import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import type { ComposeClarifyInput } from "@/lib/assistant/clarify/types";

const KNOWN_GEOMETRY_KEYS = new Set([
  "deck.length_m",
  "deck.width_m",
  "deck.area_m2",
  "deck.board_material",
  "deck.board_width_mm",
  "deck.height_m",
  "deck.level",
  "deck.substructure_included",
]);

function factValue(
  facts: ComposeClarifyInput["facts"],
  key: string,
  workAreaId: string | null
): unknown {
  const row = facts.find(
    (f) =>
      f.key === key &&
      (workAreaId == null || f.work_area_id === workAreaId)
  );
  return row?.value;
}

export function isKnownValue(value: unknown): boolean {
  return hasFactValue(value) && !isNotSureValue(value);
}

export function isAdvancedStructuralKey(key: string): boolean {
  const template = getQuestionTemplateByKey(key);
  if (!template) {
    return /joist|bearer|footing|grade|treatment|engineering|consent|centres/i.test(
      key
    );
  }
  const cls = getEstimatePriorityClass(template);
  return cls === "P2" || cls === "P3";
}

export function decidedJobPlanFactKeys(
  input: ComposeClarifyInput
): Set<string> {
  const keys = new Set<string>();
  for (const card of input.jobPlan.cards) {
    for (const item of [...card.included, ...card.notIncluded]) {
      if (item.sourceFactKey) keys.add(`${card.workAreaId}::${item.sourceFactKey}`);
    }
  }
  return keys;
}

export function shouldSuppressKnownSpec(
  key: string,
  workAreaId: string,
  input: ComposeClarifyInput
): boolean {
  if (!KNOWN_GEOMETRY_KEYS.has(key) && key !== "deck.board_material") {
    const value = factValue(input.facts, key, workAreaId);
    if (isKnownValue(value) && !key.includes("existing_deck_removal")) {
      if (
        key === "deck.length_m" ||
        key === "deck.width_m" ||
        key === "deck.area_m2" ||
        key === "deck.height_m" ||
        key === "deck.board_material" ||
        key === "deck.board_width_mm" ||
        key === "deck.substructure_included"
      ) {
        return true;
      }
    }
  }
  if (KNOWN_GEOMETRY_KEYS.has(key) && isKnownValue(factValue(input.facts, key, workAreaId))) {
    return true;
  }
  const decided = decidedJobPlanFactKeys(input);
  if (decided.has(`${workAreaId}::${key}`)) return true;
  return false;
}

export function constraintIsKnown(
  constraints: ComposeClarifyInput["constraints"],
  key: string
): boolean {
  const row = constraints.find((c) => c.key === key);
  return isKnownValue(row?.value);
}

export function isLowLevelDeck(
  facts: ComposeClarifyInput["facts"],
  workAreaId: string
): boolean {
  const height = factValue(facts, "deck.height_m", workAreaId);
  const level = factValue(facts, "deck.level", workAreaId);
  if (typeof height === "number" && height <= 1) return true;
  if (typeof level === "string" && /ground|low/i.test(level)) return true;
  return false;
}

export function stepsAreRelevant(
  input: ComposeClarifyInput,
  workAreaId: string
): boolean {
  const brief = input.briefText ?? "";
  if (/\bsteps?\b|\bstairs?\b/i.test(brief)) return true;
  if (!isLowLevelDeck(input.facts, workAreaId)) return true;
  return false;
}

export function shouldAskBalustrade(
  input: ComposeClarifyInput,
  workAreaId: string
): boolean {
  if (isKnownValue(factValue(input.facts, "deck.balustrade_required", workAreaId))) {
    return false;
  }
  return !isLowLevelDeck(input.facts, workAreaId);
}

/** Brief already supplied this Project Condition — do not re-ask. */
export function briefImpliesConstraint(
  brief: string | null,
  key: string
): boolean {
  const text = brief ?? "";
  if (!text.trim()) return false;
  if (key === "site_access") {
    return /restricted access|difficult access|easy access|rear access|site access|limited access/i.test(
      text
    );
  }
  if (key === "material_carry_distance") {
    return /carry|carting|\d+\s*[–-]\s*\d+\s*m/i.test(text);
  }
  if (key === "waste_bin_access") {
    return /waste bin|skip bin|waste handling/i.test(text);
  }
  if (key === "occupied_site") {
    return /occupied|live.?in|residents remain/i.test(text);
  }
  if (key === "working_hours") {
    return /working hours|after hours|weekend work/i.test(text);
  }
  return false;
}

export function blockingClassForKey(key: string): ReturnType<typeof getLevel1BlockingClass> {
  const template = getQuestionTemplateByKey(key);
  if (!template) return "REFINEMENT";
  return getLevel1BlockingClass(template);
}
