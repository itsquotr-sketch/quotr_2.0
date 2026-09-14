/**
 * EST-BENCHMARK-01A — relevance for Project Conditions.
 *
 * Conditions are asked once at Project level. Work Area facts (including
 * Ceiling portion height_m) remain the height authority. High-level access
 * equipment is a Project Condition that becomes relevant from those facts.
 */

import type { BuilderInterviewInput } from "@/lib/builder-interview/types";
import type { CanonicalProjectConditionKey } from "@/lib/project-conditions/canonical";
import {
  HIGH_LEVEL_ACCESS_KEY,
  HIGH_LEVEL_ACCESS_THRESHOLD_M,
} from "@/lib/project-conditions/library";

type ProjectConditionReadinessClass = "required" | "assumable" | "optional";

const CEILINGS_PORTIONS_FACT_KEY = "ceilings.portions";
const INTERNAL_WALLS_WALL_TYPES_FACT_KEY = "internal_walls.wall_types";

export function collectInteriorWorkingHeightsM(
  facts: readonly { readonly key: string; readonly value: unknown }[]
): number[] {
  const heights: number[] = [];
  for (const fact of facts) {
    if (fact.key === CEILINGS_PORTIONS_FACT_KEY) {
      const portions = parseNamedArray(fact.value, "portions");
      for (const row of portions) {
        pushPositive(heights, row.height_m);
      }
    }
    if (fact.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY) {
      const types = parseNamedArray(fact.value, "types");
      for (const row of types) {
        pushPositive(heights, row.height_m);
      }
    }
    if (
      fact.key === "ceilings.portion.height_m" ||
      fact.key === "internal_walls.wall_type.height_m"
    ) {
      pushPositive(heights, fact.value);
    }
  }
  return heights;
}

export function interiorWorkingHeightRequiresHighAccess(
  facts: readonly { readonly key: string; readonly value: unknown }[]
): boolean {
  if (collectInteriorWorkingHeightsM(facts).some((h) => h > HIGH_LEVEL_ACCESS_THRESHOLD_M)) {
    return true;
  }
  return facts.some((fact) => {
    if (fact.key !== "ceilings.access") return false;
    const value = String(fact.value ?? "").toLowerCase();
    return value === "high" || value.includes("difficult");
  });
}

export function scaffoldQuestionWouldBeAsked(
  facts: readonly { readonly key: string; readonly value: unknown }[]
): boolean {
  return interiorWorkingHeightRequiresHighAccess(facts);
}

function parseNamedArray(
  value: unknown,
  nestedKey: string
): readonly Record<string, unknown>[] {
  if (!value || typeof value !== "object") return [];
  const root = value as Record<string, unknown>;
  const nested = root[nestedKey];
  if (Array.isArray(nested)) {
    return nested.filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object"
    );
  }
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object"
    );
  }
  return [];
}

function pushPositive(into: number[], value: unknown): void {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(n) && n > 0) into.push(n);
}

const INTERIOR_LABOUR_TYPES = new Set([
  "ceilings",
  "internal_walls",
  "bathroom",
  "kitchen",
  "painting",
  "plastering",
  "doors",
  "flooring",
]);

export function workAreaTypesConsumeSiteAccess(
  types: readonly string[]
): boolean {
  return types.some(
    (type) =>
      INTERIOR_LABOUR_TYPES.has(type) ||
      type === "deck" ||
      type === "fence" ||
      type === "retaining_wall" ||
      type === "demolition"
  );
}

export function applyHighLevelAccessRelevance(
  input: BuilderInterviewInput,
  add: (
    key: CanonicalProjectConditionKey,
    readiness: ProjectConditionReadinessClass,
    reason: string
  ) => void
): void {
  if (!interiorWorkingHeightRequiresHighAccess(input.facts)) return;
  add(
    HIGH_LEVEL_ACCESS_KEY,
    "required",
    "Working height above 3.0 m — high-level access method is commercially material"
  );
}
