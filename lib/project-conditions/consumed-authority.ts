/**
 * EF02-D1 — single semantic authority for calculator-consumed Project Conditions.
 *
 * Copy / options come from the interview registry. Ask class is the same
 * contract Details (Clarify) already used: site_access and
 * material_carry_distance are ASK_NOW; occupied_site and working_hours are
 * ASSUME_IF_SKIPPED. Refine must not reclassify carry distance as advanced.
 */

import { getRegistryQuestion } from "@/lib/builder-interview/registry";
import { SHARED_CONSUMED_CONSTRAINT_KEYS } from "@/lib/estimate/consumed-facts";
import { isNotSureValue } from "@/lib/estimate/facts";

export const CONSUMED_PROJECT_CONDITION_KEYS = SHARED_CONSUMED_CONSTRAINT_KEYS;

export type ConsumedProjectConditionAskClass = "ASK_NOW" | "ASSUME_IF_SKIPPED";

export type ConsumedProjectConditionDef = {
  readonly key: (typeof SHARED_CONSUMED_CONSTRAINT_KEYS)[number];
  readonly questionKey: string;
  readonly label: string;
  readonly question: string;
  readonly inputType: "select" | "boolean" | "number" | "text" | "multi_select";
  readonly options: readonly string[];
  readonly askClass: ConsumedProjectConditionAskClass;
  readonly assumptionStatement: string;
  readonly disclosedValue: string | null;
};

const REGISTRY_QUESTION_KEY: Record<
  (typeof SHARED_CONSUMED_CONSTRAINT_KEYS)[number],
  string
> = {
  site_access: "interview.site.site_access",
  material_carry_distance: "interview.site.material_carry_distance",
  occupied_site: "interview.site.occupied_site",
  working_hours: "interview.site.working_hours",
  high_level_access: "interview.site.high_level_access",
};

const LABELS: Record<(typeof SHARED_CONSUMED_CONSTRAINT_KEYS)[number], string> = {
  site_access: "Site access",
  material_carry_distance: "Carry distance",
  occupied_site: "Occupied site",
  working_hours: "Working hours",
  high_level_access: "High-level access",
};

const ASSUMPTION_STATEMENT: Record<
  (typeof SHARED_CONSUMED_CONSTRAINT_KEYS)[number],
  string
> = {
  site_access: "Standard access",
  material_carry_distance: "Standard carry",
  occupied_site: "Unoccupied site",
  working_hours: "Normal working hours",
  high_level_access: "Mobile scaffold for work above 3.0 m",
};

const DISCLOSED_VALUE: Record<
  (typeof SHARED_CONSUMED_CONSTRAINT_KEYS)[number],
  string | null
> = {
  site_access: null,
  material_carry_distance: null,
  occupied_site: "No",
  working_hours: "No",
  high_level_access: "Mobile scaffold",
};

const LABOUR_ACCESS_WORK_AREA_TYPES = new Set([
  "deck",
  "fence",
  "retaining_wall",
  "bathroom",
  "internal_walls",
  "demolition",
  "kitchen",
]);

export function labourAccessWorkAreaPresent(
  workAreaTypes: readonly string[]
): boolean {
  return workAreaTypes.some((type) => LABOUR_ACCESS_WORK_AREA_TYPES.has(type));
}

export function consumedProjectConditionAskClass(
  key: string
): ConsumedProjectConditionAskClass | null {
  if (
    key === "site_access" ||
    key === "material_carry_distance" ||
    key === "high_level_access"
  ) {
    return "ASK_NOW";
  }
  if (key === "occupied_site" || key === "working_hours") {
    return "ASSUME_IF_SKIPPED";
  }
  return null;
}

export function isRequiredConsumedProjectCondition(key: string): boolean {
  return consumedProjectConditionAskClass(key) === "ASK_NOW";
}

/**
 * ASK_NOW consumed keys block Ready only when a labour-access Work Area
 * actually requires them, or when high-level access is currently applicable.
 *
 * Ceilings consume site_access / occupancy for Details, but ordinary
 * ceiling-only Ready keeps the disclosed "Standard access" assumption.
 * Carry is not asked on ceiling-only jobs.
 */
export function consumedConditionIsReadyBlocking(
  key: string,
  workAreaTypes: readonly string[]
): boolean {
  if (!projectConsumesConsumedCondition(workAreaTypes, key)) return false;
  if (consumedProjectConditionAskClass(key) !== "ASK_NOW") return false;
  if (key === "high_level_access") return true;
  if (key === "site_access" || key === "material_carry_distance") {
    return labourAccessWorkAreaPresent(workAreaTypes);
  }
  return true;
}

export function projectConsumesConsumedCondition(
  workAreaTypes: readonly string[],
  key: string
): boolean {
  if (key === "site_access") {
    return workAreaTypes.some(
      (type) =>
        LABOUR_ACCESS_WORK_AREA_TYPES.has(type) || type === "ceilings"
    );
  }
  if (key === "material_carry_distance") {
    return workAreaTypes.some((type) => LABOUR_ACCESS_WORK_AREA_TYPES.has(type));
  }
  if (key === "high_level_access") {
    return workAreaTypes.some(
      (type) => type === "ceilings" || type === "internal_walls"
    );
  }
  if (key === "occupied_site" || key === "working_hours") {
    return workAreaTypes.some(
      (type) =>
        LABOUR_ACCESS_WORK_AREA_TYPES.has(type) ||
        type === "painting" ||
        type === "plastering" ||
        type === "ceilings"
    );
  }
  return false;
}

export function getRegistryQuestionByTargetKey(targetKey: string) {
  const consumed = keyIfConsumed(targetKey);
  if (consumed) {
    return getRegistryQuestion(REGISTRY_QUESTION_KEY[consumed]);
  }
  return getRegistryQuestion(`interview.site.${targetKey}`);
}

function keyIfConsumed(
  key: string
): (typeof SHARED_CONSUMED_CONSTRAINT_KEYS)[number] | null {
  return (SHARED_CONSUMED_CONSTRAINT_KEYS as readonly string[]).includes(key)
    ? (key as (typeof SHARED_CONSUMED_CONSTRAINT_KEYS)[number])
    : null;
}

export function getConsumedProjectConditionDef(
  key: string
): ConsumedProjectConditionDef | null {
  const consumed = keyIfConsumed(key);
  if (!consumed) return null;
  const registry = getRegistryQuestion(REGISTRY_QUESTION_KEY[consumed]);
  return {
    key: consumed,
    questionKey: registry?.questionKey ?? REGISTRY_QUESTION_KEY[consumed],
    label: LABELS[consumed],
    question: registry?.question ?? LABELS[consumed],
    inputType: registry?.inputType ?? "select",
    options: registry?.options ?? [],
    askClass: consumedProjectConditionAskClass(consumed) ?? "ASSUME_IF_SKIPPED",
    assumptionStatement: ASSUMPTION_STATEMENT[consumed],
    disclosedValue: DISCLOSED_VALUE[consumed],
  };
}

export function listConsumedProjectConditionDefs(): readonly ConsumedProjectConditionDef[] {
  return SHARED_CONSUMED_CONSTRAINT_KEYS.map(
    (key) => getConsumedProjectConditionDef(key)!
  );
}

export function projectConditionAssumptionStatement(key: string): string | null {
  return getConsumedProjectConditionDef(key)?.assumptionStatement ?? null;
}

export function disclosedProjectConditionForNotSure(
  key: string,
  value: unknown
): { value: string; source: "assumption" } | null {
  if (!isNotSureValue(value)) return null;
  const def = getConsumedProjectConditionDef(key);
  if (!def?.disclosedValue) return null;
  return { value: def.disclosedValue, source: "assumption" };
}

export function disclosedProjectConditionValue(key: string): string | null {
  return getConsumedProjectConditionDef(key)?.disclosedValue ?? null;
}
