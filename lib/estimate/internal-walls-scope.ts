/**
 * WA-INTERNAL-WALLS-02 — job scope, structural gate, and question visibility.
 *
 * Estimating SoT is project_facts. This module maps display / legacy values
 * to canonical ids. It does not own framing or lining money.
 */

import { getStringFact, isNotSureValue } from "@/lib/estimate/facts";
import {
  hasCanonicalWallTypes,
  resolveInternalWallsWallTypes,
  storedInternalWallsWallTypes,
} from "@/lib/estimate/internal-walls-wall-types";
import type { EstimateFact } from "@/lib/estimate/types";

export const INTERNAL_WALLS_JOB_SCOPE_VALUES = [
  "new_partition",
  "extend_partition",
  "reline_existing",
  "infill_opening",
  "form_opening",
  "remove_partition",
  "mixed",
  "custom",
] as const;

export type InternalWallsJobScope =
  (typeof INTERNAL_WALLS_JOB_SCOPE_VALUES)[number];

export const INTERNAL_WALLS_JOB_SCOPE_FACT_KEY =
  "internal_walls.job_scope" as const;

export const INTERNAL_WALLS_JOB_SCOPE_OPTIONS = [
  "New partition",
  "Extend partition",
  "Reline existing",
  "Infill opening",
  "Form opening",
  "Remove partition",
  "Mixed",
  "Custom / other",
  "Not sure",
] as const;

const JOB_SCOPE_BY_NORMALISED: Record<string, InternalWallsJobScope> = {
  new_partition: "new_partition",
  "new partition": "new_partition",
  "new wall": "new_partition",
  "new internal wall": "new_partition",
  extend_partition: "extend_partition",
  "extend partition": "extend_partition",
  reline_existing: "reline_existing",
  "reline existing": "reline_existing",
  reline: "reline_existing",
  infill_opening: "infill_opening",
  "infill opening": "infill_opening",
  "close opening": "infill_opening",
  form_opening: "form_opening",
  "form opening": "form_opening",
  "new opening": "form_opening",
  remove_partition: "remove_partition",
  "remove partition": "remove_partition",
  "remove wall": "remove_partition",
  mixed: "mixed",
  custom: "custom",
  "custom / other": "custom",
  "custom/other": "custom",
};

export const INTERNAL_WALLS_STRUCTURAL_VALUES = [
  "no",
  "yes",
  "not_sure",
] as const;

export type InternalWallsStructuralInvolvement =
  (typeof INTERNAL_WALLS_STRUCTURAL_VALUES)[number];

export const INTERNAL_WALLS_STRUCTURAL_FACT_KEY =
  "internal_walls.structural_involvement" as const;

export const INTERNAL_WALLS_STRUCTURAL_OPTIONS = [
  "No",
  "Yes",
  "Not sure",
] as const;

const STRUCTURAL_BY_NORMALISED: Record<
  string,
  InternalWallsStructuralInvolvement
> = {
  no: "no",
  yes: "yes",
  not_sure: "not_sure",
  "not sure": "not_sure",
};

export const INTERNAL_WALLS_LEGACY_QUESTION_KEYS = [
  "internal_walls.length_lm",
  "internal_walls.height_m",
  "internal_walls.framing_type",
  "internal_walls.wall_lining_type",
  "internal_walls.plasterboard_type",
  "internal_walls.lining_sides",
  "internal_walls.fire_or_acoustic",
  "internal_walls.skirtings_included",
  "internal_walls.skirting_length_lm",
  "internal_walls.demolition_included",
  "internal_walls.stopping_included",
  "internal_walls.painting_included",
  "internal_walls.insulation_included",
] as const;

export function parseInternalWallsJobScope(
  value: unknown
): InternalWallsJobScope | null {
  if (value == null || isNotSureValue(value)) return null;
  const normalised = String(value).trim().toLowerCase();
  if (!normalised) return null;
  return JOB_SCOPE_BY_NORMALISED[normalised] ?? null;
}

export function jobScopeDisplay(
  value: InternalWallsJobScope | null
): string | null {
  if (!value) return null;
  if (value === "new_partition") return "New partition";
  if (value === "extend_partition") return "Extend partition";
  if (value === "reline_existing") return "Reline existing";
  if (value === "infill_opening") return "Infill opening";
  if (value === "form_opening") return "Form opening";
  if (value === "remove_partition") return "Remove partition";
  if (value === "mixed") return "Mixed";
  return "Custom / other";
}

export function parseInternalWallsStructuralInvolvement(
  value: unknown
): InternalWallsStructuralInvolvement | null {
  if (value == null) return null;
  if (isNotSureValue(value)) return "not_sure";
  const normalised = String(value).trim().toLowerCase();
  return STRUCTURAL_BY_NORMALISED[normalised] ?? null;
}

export function resolveInternalWallsJobScope(params: {
  jobScope?: unknown;
  demolitionIncluded?: unknown;
  framingType?: unknown;
}): InternalWallsJobScope | null {
  const direct = parseInternalWallsJobScope(params.jobScope);
  if (direct) return direct;
  return null;
}

export function mapLegacyFactsToJobScopeCandidate(params: {
  demolitionIncluded?: boolean | null;
  framingType?: string | null;
}): InternalWallsJobScope | null {
  const framing = params.framingType?.toLowerCase() ?? "";
  if (framing.includes("existing")) return "reline_existing";
  if (params.demolitionIncluded === true) return "remove_partition";
  return null;
}

export function isMatureInternalWallsPath(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  const jobScope = parseInternalWallsJobScope(
    getStringFact(
      params.facts as EstimateFact[],
      params.workAreaId,
      INTERNAL_WALLS_JOB_SCOPE_FACT_KEY
    )
  );
  if (jobScope) return true;
  return hasCanonicalWallTypes(params.facts, params.workAreaId);
}

export function structuralGateApplies(
  jobScope: InternalWallsJobScope | null
): boolean {
  return (
    jobScope === "form_opening" ||
    jobScope === "remove_partition" ||
    jobScope === "infill_opening" ||
    jobScope === "mixed"
  );
}

export function structuralBlocksEstimate(
  jobScope: InternalWallsJobScope | null,
  structural: InternalWallsStructuralInvolvement | null
): boolean {
  if (!structuralGateApplies(jobScope)) return false;
  return structural === "yes" || structural === "not_sure";
}

export function wallTypesRequiredForScope(
  jobScope: InternalWallsJobScope | null
): boolean {
  return (
    jobScope === "new_partition" ||
    jobScope === "extend_partition" ||
    jobScope === "reline_existing" ||
    jobScope === "form_opening" ||
    jobScope === "infill_opening" ||
    jobScope === "mixed" ||
    jobScope === "custom"
  );
}

export function resolveInternalWallsScopeState(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): {
  jobScope: InternalWallsJobScope | null;
  structural: InternalWallsStructuralInvolvement | null;
  mature: boolean;
  wallTypeCount: number;
  canonicalWallTypeCount: number;
} {
  const jobScope = parseInternalWallsJobScope(
    getStringFact(
      params.facts as EstimateFact[],
      params.workAreaId,
      INTERNAL_WALLS_JOB_SCOPE_FACT_KEY
    )
  );
  const structural = parseInternalWallsStructuralInvolvement(
    getStringFact(
      params.facts as EstimateFact[],
      params.workAreaId,
      INTERNAL_WALLS_STRUCTURAL_FACT_KEY
    )
  );
  const resolved = resolveInternalWallsWallTypes(params);
  const canonical = storedInternalWallsWallTypes(
    params.facts,
    params.workAreaId
  );
  return {
    jobScope,
    structural,
    mature: isMatureInternalWallsPath(params),
    wallTypeCount: resolved.types.length,
    canonicalWallTypeCount: canonical.length,
  };
}

const WALL_TYPE_FIELD_KEYS = new Set([
  "internal_walls.wall_type.label",
  "internal_walls.wall_type.frame_system",
  "internal_walls.wall_type.frame_size",
  "internal_walls.wall_type.length_lm",
  "internal_walls.wall_type.height_m",
  "internal_walls.wall_type.stud_centres_mm",
  "internal_walls.wall_type.same_lining_both_sides",
  "internal_walls.wall_type.side_a_lined",
  "internal_walls.wall_type.side_a_product",
  "internal_walls.wall_type.side_a_thickness_mm",
  "internal_walls.wall_type.side_a_sheet_length_mm",
  "internal_walls.wall_type.side_a_layers",
  "internal_walls.wall_type.side_b_lined",
  "internal_walls.wall_type.side_b_product",
  "internal_walls.wall_type.side_b_thickness_mm",
  "internal_walls.wall_type.side_b_sheet_length_mm",
  "internal_walls.wall_type.side_b_layers",
  "internal_walls.wall_type.has_openings",
]);

export function shouldHideInternalWallsQuestion(params: {
  factKey: string;
  jobScope: InternalWallsJobScope | null;
  mature: boolean;
  nextWallTypeField: string | null;
  structuralApplies: boolean;
}): boolean {
  const key = params.factKey;
  if (key === INTERNAL_WALLS_JOB_SCOPE_FACT_KEY) return false;

  if (
    (INTERNAL_WALLS_LEGACY_QUESTION_KEYS as readonly string[]).includes(key)
  ) {
    return params.mature;
  }

  if (key === INTERNAL_WALLS_STRUCTURAL_FACT_KEY) {
    return !params.structuralApplies;
  }

  if (WALL_TYPE_FIELD_KEYS.has(key)) {
    if (!params.mature && params.jobScope == null) return true;
    if (params.jobScope === "remove_partition") return true;
    if (key === "internal_walls.wall_type.frame_size") {
      return params.nextWallTypeField !== key;
    }
    if (
      key === "internal_walls.wall_type.side_a_thickness_mm" ||
      key === "internal_walls.wall_type.side_a_sheet_length_mm" ||
      key === "internal_walls.wall_type.side_b_thickness_mm" ||
      key === "internal_walls.wall_type.side_b_sheet_length_mm" ||
      key === "internal_walls.wall_type.side_a_lined" ||
      key === "internal_walls.wall_type.side_b_lined" ||
      key === "internal_walls.wall_type.label"
    ) {
      return true;
    }
    if (params.nextWallTypeField == null) {
      return true;
    }
    return key !== params.nextWallTypeField;
  }

  if (
    key === "internal_walls.wall_type.has_openings" ||
    key.startsWith("internal_walls.opening.")
  ) {
    if (!params.mature && params.jobScope == null) return true;
    if (params.jobScope === "remove_partition") return true;
    if (params.nextWallTypeField == null) return true;
    return key !== params.nextWallTypeField;
  }

  return false;
}
