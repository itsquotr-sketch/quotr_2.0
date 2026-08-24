/**
 * Package Quick Estimate readiness — distinct from detailed commercial completeness.
 *
 * HARD_MINIMUM for retaining wall:
 *   system/type, length, and height (constant XOR high/low).
 *
 * Project Conditions that are Level-1 assumable (access, carry, waste bin, …)
 * must not block Update Estimate / Generate when Clarify is primary.
 */

import { isNotSureValue } from "@/lib/estimate/facts";
import {
  retainingWallHasCoreHeight,
  retainingWallHasCoreLength,
  retainingWallMaterialReadiness,
} from "@/lib/estimate/calculators/retaining-wall";
import { filterEstimateBlockingProjectConditionKeys } from "@/lib/scopes/level1-blocking";
import type { EstimateFact } from "@/lib/estimate/types";
import { CLARIFY_IS_PRIMARY } from "@/lib/assistant/clarify/flags";

export type PackageQuickEstimateBlockerClass =
  | "HARD_MINIMUM"
  | "REQUIRED_PROJECT_CONDITION";

export type PackageQuickEstimateBlockerCategory =
  | "system"
  | "length"
  | "height"
  | "project_condition";

export type PackageQuickEstimateBlocker = {
  readonly key: string;
  readonly requiredness: PackageQuickEstimateBlockerClass;
  readonly declaredBy: string;
  readonly expected: string;
  readonly storedValue: unknown;
  readonly store: "project_facts" | "constraints";
  readonly uiMayShowAnswered: boolean;
  readonly calculatorConsumes: boolean;
  readonly category: PackageQuickEstimateBlockerCategory;
};

export type PackageQuickEstimateReadiness = {
  readonly ready: boolean;
  readonly blockers: readonly PackageQuickEstimateBlocker[];
  readonly builderCopy: string | null;
};

export type PackageQuickEstimateWorkArea = {
  readonly id: string;
  readonly type: string;
  readonly status?: string | null;
};

export type PackageQuickEstimateInput = {
  readonly workAreas: readonly PackageQuickEstimateWorkArea[];
  readonly facts: readonly EstimateFact[];
  readonly unresolvedRequiredProjectConditionKeys?: readonly string[];
};

/** Completeness: false / 0 / "No" are answers. Only null, undefined, "" are empty. */
export function canonicalValueIsPresent(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === "string" && isNotSureValue(value)) return false;
  return true;
}

export function packageQuickEstimateBlockingProjectConditionKeys(
  unresolvedRequiredKeys: readonly string[]
): string[] {
  return filterEstimateBlockingProjectConditionKeys(unresolvedRequiredKeys);
}

function factValue(
  facts: readonly EstimateFact[],
  workAreaId: string,
  key: string
): unknown {
  return facts.find((row) => row.key === key && row.work_area_id === workAreaId)
    ?.value;
}

function retainingWallHardMinimumBlockers(
  workAreaId: string,
  facts: readonly EstimateFact[]
): PackageQuickEstimateBlocker[] {
  const out: PackageQuickEstimateBlocker[] = [];
  if (!retainingWallHasCoreLength(facts, workAreaId)) {
    out.push({
      key: "retaining_wall.length_m",
      requiredness: "HARD_MINIMUM",
      declaredBy: "lib/estimate/calculators/retaining-wall.ts#RETAINING_WALL_HARD_MINIMUM_FACT_KEYS",
      expected: "positive length (m)",
      storedValue: factValue(facts, workAreaId, "retaining_wall.length_m"),
      store: "project_facts",
      uiMayShowAnswered: false,
      calculatorConsumes: true,
      category: "length",
    });
  }
  if (!retainingWallHasCoreHeight(facts, workAreaId)) {
    out.push({
      key: "retaining_wall.height_m",
      requiredness: "HARD_MINIMUM",
      declaredBy:
        "lib/estimate/calculators/retaining-wall.ts#resolveWallHeight (constant XOR high/low)",
      expected: "constant height_m XOR height_high_m + height_low_m",
      storedValue: {
        height_m: factValue(facts, workAreaId, "retaining_wall.height_m"),
        height_high_m: factValue(facts, workAreaId, "retaining_wall.height_high_m"),
        height_low_m: factValue(facts, workAreaId, "retaining_wall.height_low_m"),
      },
      store: "project_facts",
      uiMayShowAnswered: false,
      calculatorConsumes: true,
      category: "height",
    });
  }
  const material = retainingWallMaterialReadiness(facts, workAreaId);
  if (material !== "SUPPORTED") {
    out.push({
      key: "retaining_wall.material",
      requiredness: "HARD_MINIMUM",
      declaredBy: "lib/estimate/calculators/retaining-wall.ts#retainingWallMaterialReadiness",
      expected: "timber | concrete sleeper | masonry (supported family)",
      storedValue: factValue(facts, workAreaId, "retaining_wall.material"),
      store: "project_facts",
      uiMayShowAnswered: material === "UNSUPPORTED_EXPLICIT",
      calculatorConsumes: true,
      category: "system",
    });
  }
  return out;
}

export function builderCopyForPackageQuickEstimateBlockers(
  blockers: readonly PackageQuickEstimateBlocker[]
): string | null {
  if (blockers.length === 0) return null;
  const categories = new Set(blockers.map((row) => row.category));
  if (categories.has("system") && categories.has("length") && categories.has("height")) {
    return "Add the retaining wall type, length, and height to update this estimate.";
  }
  if (categories.has("length") && categories.has("height") && categories.has("system")) {
    return "Add the retaining wall type, length, and height to update this estimate.";
  }
  const rwBits: string[] = [];
  if (categories.has("system")) rwBits.push("type");
  if (categories.has("length")) rwBits.push("length");
  if (categories.has("height")) rwBits.push("height");
  if (rwBits.length > 0) {
    if (rwBits.length === 1) {
      return `Add the retaining wall ${rwBits[0]} to update this estimate.`;
    }
    if (rwBits.length === 2) {
      return `Add the retaining wall ${rwBits[0]} and ${rwBits[1]} to update this estimate.`;
    }
    return "Add the retaining wall type, length, and height to update this estimate.";
  }
  return "Complete the remaining project information before generating the estimate.";
}

export function evaluatePackageQuickEstimateReadiness(
  input: PackageQuickEstimateInput
): PackageQuickEstimateReadiness {
  const blockers: PackageQuickEstimateBlocker[] = [];
  const confirmed = input.workAreas.filter(
    (wa) => wa.status == null || wa.status === "confirmed"
  );

  for (const wa of confirmed) {
    if (wa.type === "retaining_wall") {
      blockers.push(...retainingWallHardMinimumBlockers(wa.id, input.facts));
    }
  }

  const pcBlocking = packageQuickEstimateBlockingProjectConditionKeys(
    input.unresolvedRequiredProjectConditionKeys ?? []
  );
  for (const key of pcBlocking) {
    blockers.push({
      key,
      requiredness: "REQUIRED_PROJECT_CONDITION",
      declaredBy: "lib/project-conditions/applicability.ts (non-assumable required)",
      expected: "canonical constraint value",
      storedValue: undefined,
      store: "constraints",
      uiMayShowAnswered: false,
      calculatorConsumes: false,
      category: "project_condition",
    });
  }

  return {
    ready: blockers.length === 0,
    blockers,
    builderCopy: builderCopyForPackageQuickEstimateBlockers(blockers),
  };
}

/**
 * Client Update Estimate / server Generate: when Clarify is primary, do not
 * treat Level-1-assumable Project Conditions as hard blockers.
 */
export function shouldUseAssumableProjectConditionGenerateGate(): boolean {
  return CLARIFY_IS_PRIMARY;
}
