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

export function getLabourAdjustmentFactor(
  constraints: EstimateConstraint[]
): number {
  let factor = 1;

  const access = getConstraintValue(constraints, "site_access")?.toLowerCase();
  if (access === "difficult") {
    factor += 0.1;
  } else if (access === "moderate") {
    factor += 0.05;
  }

  const slope = getConstraintValue(constraints, "site_slope")?.toLowerCase();
  if (slope === "yes" || slope === "true" || slope === "difficult") {
    factor += 0.05;
  }

  const carry = getConstraintValue(constraints, "material_carry_distance");
  const carryCategory = parseCarryDistanceCategory(carry);

  if (carryCategory === "long") {
    factor += 0.1;
  } else if (carryCategory === "moderate" || carryCategory === "unknown") {
    factor += 0.05;
  }

  const rwAccess = constraints.find(
    (constraint) => constraint.key === "retaining_wall.access"
  );
  if (String(rwAccess?.value).toLowerCase() === "difficult") {
    factor += 0.05;
  }

  // Cap compound site adjustment to avoid runaway labour loading in v1.
  return Math.min(factor, 1.35);
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

  if (notes.length === 0) return "";
  return `(${notes.join("; ")})`;
}

export function hasPoorAccess(constraints: EstimateConstraint[]): boolean {
  const access = getConstraintValue(constraints, "site_access")?.toLowerCase();
  return access === "difficult" || access === "moderate";
}

/** Work-area access fact (deck.access, fence.access, etc.) as a labour multiplier. */
export function getWorkAreaAccessFactor(
  accessValue: string | null | undefined
): number {
  if (!accessValue) return 1;
  const lower = accessValue.toLowerCase();
  if (lower.includes("difficult") || lower.includes("poor")) return 1.1;
  if (lower.includes("moderate")) return 1.05;
  return 1;
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
