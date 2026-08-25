import type { QualityLevel } from "@/components/assistant/types";
import type { OrganisationSettings } from "@/components/setup/types";
import type { EstimateConstraint, EstimateProject } from "@/lib/estimate/types";

/**
 * Quality factor policy
 * ---------------------
 * - Applies to finish-sensitive or complexity-sensitive construction labour/materials.
 * - Does NOT apply to demolition, carting, drainage, backfill, waste removal, or
 *   other non-finish-dependent labour (use NO_FINISH_QUALITY_FACTOR).
 * - Bathroom/kitchen package assumptions may embed finish level inside allowances
 *   rather than multiplying all labour directly — avoid double-applying quality factors.
 */

const QUALITY_FACTORS: Record<QualityLevel, number> = {
  budget: 0.9,
  standard: 1.0,
  premium: 1.15,
  unknown: 1.0,
};

function getConstraintValue(
  constraints: EstimateConstraint[],
  key: string
): string | null {
  const row = constraints.find((constraint) => constraint.key === key);
  if (!row || row.value === null || row.value === undefined) return null;
  return String(row.value).trim();
}

export function getQualityFactor(
  project: EstimateProject,
  organisationSettings: OrganisationSettings | null
): number {
  const level = project.qualityLevel ?? "unknown";
  const base = QUALITY_FACTORS[level] ?? 1;

  if (level === "budget" && organisationSettings?.budget_rate_factor) {
    return organisationSettings.budget_rate_factor;
  }

  if (level === "premium" && organisationSettings?.premium_rate_factor) {
    return organisationSettings.premium_rate_factor;
  }

  return base;
}

export type CarryDistanceCategory = "short" | "moderate" | "long" | "unknown";

function extractFirstNumber(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : null;
}

/**
 * Parses material carry distance into a metre category for labour adjustment.
 *
 * Categories:
 * - short (<=10 m): no carry adjustment
 * - moderate (>10 m and <=30 m): +0.05 labour factor
 * - long (>30 m): +0.10 labour factor
 * - unknown / not sure: conservative moderate (+0.05)
 *
 * Expected inputs: "<10m", "10–30m", "10-30m", ">30m", "15–30m", "45m", "45 m",
 * "Not sure", "unknown", or free text containing a number.
 *
 * Regression cases:
 * - "10–30m" -> moderate (not long — old string match on "30" was wrong)
 * - ">30m" / "45m" -> long
 * - "Not sure" -> unknown (moderate allowance, no crash)
 */
export function parseCarryDistanceCategory(
  value: string | null | undefined
): CarryDistanceCategory {
  if (!value) return "short";

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "not sure" ||
    normalized === "unknown" ||
    normalized === "unsure" ||
    normalized === "n/a"
  ) {
    return "unknown";
  }

  if (
    normalized.startsWith("<") ||
    normalized.includes("under ") ||
    normalized.includes("less than")
  ) {
    return "short";
  }

  if (
    normalized.startsWith(">") ||
    normalized.includes("over ") ||
    normalized.includes("more than")
  ) {
    const threshold = extractFirstNumber(normalized);
    if (threshold == null || threshold >= 30) {
      return "long";
    }
    if (threshold > 10) {
      return "moderate";
    }
    return "short";
  }

  const rangeMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/
  );
  if (rangeMatch) {
    const upper = Number.parseFloat(rangeMatch[2]);
    if (upper <= 10) return "short";
    if (upper <= 30) return "moderate";
    return "long";
  }

  const singleValue = extractFirstNumber(normalized);
  if (singleValue != null) {
    if (singleValue <= 10) return "short";
    if (singleValue <= 30) return "moderate";
    return "long";
  }

  return "unknown";
}

export type LabourAdjustmentParts = {
  accessAddend: number;
  carryAddend: number;
  slopeAddend: number;
  occupiedAddend: number;
  hoursAddend: number;
};

const LABOUR_ADJUSTMENT_CAP = 1.35;

export function getLabourAdjustmentParts(
  constraints: readonly EstimateConstraint[]
): LabourAdjustmentParts {
  const list = [...constraints];
  let accessAddend = 0;
  const access = getConstraintValue(list, "site_access")?.toLowerCase();
  if (
    access === "difficult" ||
    access === "very poor" ||
    access === "verypoor" ||
    access === "restricted"
  ) {
    accessAddend = 0.1;
  } else if (access === "moderate") {
    accessAddend = 0.05;
  }

  let slopeAddend = 0;
  const slope = getConstraintValue(list, "site_slope")?.toLowerCase();
  if (slope === "yes" || slope === "true" || slope === "difficult") {
    slopeAddend = 0.05;
  }

  let carryAddend = 0;
  const carry = getConstraintValue(list, "material_carry_distance");
  const carryCategory = parseCarryDistanceCategory(carry);
  if (carryCategory === "long") {
    carryAddend = 0.1;
  } else if (carryCategory === "moderate" || carryCategory === "unknown") {
    carryAddend = 0.05;
  }

  return {
    accessAddend,
    carryAddend,
    slopeAddend,
    occupiedAddend: isOccupiedSiteRestriction(list) ? 0.05 : 0,
    hoursAddend: isWorkingHoursRestriction(list) ? 0.05 : 0,
  };
}

function composeLabourAdjustmentFromParts(
  parts: LabourAdjustmentParts,
  includeMaterialCarry: boolean
): number {
  const factor =
    1 +
    parts.accessAddend +
    (includeMaterialCarry ? parts.carryAddend : 0) +
    parts.slopeAddend +
    parts.occupiedAddend +
    parts.hoursAddend;
  return Math.min(factor, LABOUR_ADJUSTMENT_CAP);
}

export function getLabourAdjustmentFactor(
  constraints: EstimateConstraint[]
): number {
  return composeLabourAdjustmentFromParts(
    getLabourAdjustmentParts(constraints),
    true
  );
}

/**
 * Per-intent Project Conditions labour modifier.
 * Site access, slope, occupied, and hours may apply to on-site work.
 * Material carry applies only when the intent moves incoming materials.
 * Spoil/export is never this carry key — use waste/spoil/carting facts.
 */
export function getIntentLabourAdjustmentFactor(params: {
  readonly constraints: readonly EstimateConstraint[];
  readonly workAreaAccess?: string | null;
  readonly includeMaterialCarry: boolean;
}): number {
  const constraints = [...params.constraints];
  const factor = composeLabourAdjustmentFromParts(
    getLabourAdjustmentParts(constraints),
    params.includeMaterialCarry
  );
  if (projectSiteAccessAlreadyApplied(constraints)) {
    return factor;
  }
  return factor * getWorkAreaAccessFactor(params.workAreaAccess);
}

function isAffirmativeRestriction(value: string | null): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  if (
    lower === "no" ||
    lower === "false" ||
    lower === "none" ||
    lower === "not sure" ||
    lower === "unknown" ||
    lower === "unsure"
  ) {
    return false;
  }
  return (
    lower === "yes" ||
    lower === "true" ||
    lower.includes("restrict") ||
    lower.includes("occupied") ||
    lower.includes("after hours") ||
    lower.includes("limited")
  );
}

export function isOccupiedSiteRestriction(
  constraints: EstimateConstraint[]
): boolean {
  return isAffirmativeRestriction(getConstraintValue(constraints, "occupied_site"));
}

export function isWorkingHoursRestriction(
  constraints: EstimateConstraint[]
): boolean {
  return isAffirmativeRestriction(getConstraintValue(constraints, "working_hours"));
}

/**
 * Stage 3.2.2-R1 + FOUNDATION-R1 — One real-world site-access condition → one labour effect.
 *
 * When project `site_access` already contributes via getLabourAdjustmentFactor,
 * do NOT also multiply by a WA access Fact (deck.access / fence.access / …).
 * WA access only applies when project site_access is absent.
 * Easy / Not sure on the project key is still the project answer (no WA fallback multiply).
 *
 * Carry, occupied site, and working hours are separate legitimate multipliers
 * inside getLabourAdjustmentFactor (once). Haulage *allowance* $ lines remain
 * discrete carting cost, never a second access labour multiply.
 */
export function projectSiteAccessAlreadyApplied(
  constraints: EstimateConstraint[]
): boolean {
  // Any stored project site_access (including Easy / Not sure) is the authority.
  // WA access Facts must not multiply on top.
  const access = getConstraintValue(constraints, "site_access");
  return Boolean(access && access.trim());
}

export function getCombinedLabourAccessFactor(params: {
  readonly constraints: EstimateConstraint[];
  readonly workAreaAccess?: string | null;
}): number {
  const constraintFactor = getLabourAdjustmentFactor(params.constraints);
  if (projectSiteAccessAlreadyApplied(params.constraints)) {
    return constraintFactor;
  }
  return (
    constraintFactor * getWorkAreaAccessFactor(params.workAreaAccess)
  );
}

export function getConstraintNotes(constraints: EstimateConstraint[]): string {
  const notes: string[] = [];

  const access = getConstraintValue(constraints, "site_access");
  if (access && access !== "Easy") {
    notes.push(`site access ${access.toLowerCase()}`);
  }

  const carry = getConstraintValue(constraints, "material_carry_distance");
  if (carry && !carry.startsWith("<")) {
    notes.push(`carry distance ${carry}`);
  }

  if (isOccupiedSiteRestriction(constraints)) {
    notes.push("occupied site");
  }
  if (isWorkingHoursRestriction(constraints)) {
    notes.push("restricted working hours");
  }

  if (notes.length === 0) return "";
  return `(${notes.join("; ")})`;
}

export function hasPoorAccess(constraints: EstimateConstraint[]): boolean {
  const access = getConstraintValue(constraints, "site_access")?.toLowerCase();
  return access === "difficult" || access === "moderate";
}

/** Work-area access fact (deck.access, fence.access, bathroom.access, etc.) as a labour multiplier. */
export function getWorkAreaAccessFactor(
  accessValue: string | null | undefined
): number {
  if (!accessValue) return 1;
  const lower = accessValue.toLowerCase();
  // "Restricted" is a common AI/owner phrasing for difficult site access.
  if (
    lower.includes("difficult") ||
    lower.includes("poor") ||
    lower.includes("restrict")
  ) {
    return 1.1;
  }
  if (lower.includes("moderate")) return 1.05;
  return 1;
}

/**
 * @deprecated FOUNDATION-R1 — project `site_access` is the authority.
 * Prefer getCombinedLabourAccessFactor. Kept for verify-script compatibility.
 * Project constraint wins when present; WA value is legacy-only fallback.
 */
export function resolveWorkAreaAccessValue(params: {
  readonly workAreaAccess: string | null | undefined;
  readonly constraints: EstimateConstraint[];
}): string | null {
  const project = getConstraintValue(params.constraints, "site_access");
  if (project) return project;
  if (params.workAreaAccess && String(params.workAreaAccess).trim()) {
    return String(params.workAreaAccess).trim();
  }
  return null;
}

/** Fence/pergola slope or ground condition labour multiplier. */
export function getSlopeLabourFactor(
  slopeValue: string | null | undefined
): number {
  if (!slopeValue) return 1;
  const lower = slopeValue.toLowerCase();
  if (
    lower.includes("steep") ||
    lower.includes("slop") ||
    lower.includes("difficult")
  ) {
    return 1.1;
  }
  if (lower.includes("moderate") || lower.includes("undulating")) {
    return 1.05;
  }
  return 1;
}

/** Fence height relative to 1.8 m standard — scales material allowance. */
export function getFenceHeightMaterialFactor(heightM: number | null): number {
  if (heightM == null || heightM <= 0) return 1;
  return Math.max(0.75, Math.min(1.5, heightM / 1.8));
}

const QUALITY_LABELS: Record<QualityLevel, string> = {
  budget: "Budget",
  standard: "Standard",
  premium: "Premium",
  unknown: "Unknown",
};

export function getQualityFactorNote(
  project: EstimateProject
): string | null {
  const level = project.qualityLevel;
  if (!level || level === "unknown") return null;
  return `Project quality/spec level applied: ${QUALITY_LABELS[level]}`;
}
