import type { QualityLevel } from "@/components/assistant/types";
import type { OrganisationSettings } from "@/components/setup/types";
import type { EstimateConstraint, EstimateProject } from "@/lib/estimate/types";

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

  const carry = getConstraintValue(
    constraints,
    "material_carry_distance"
  )?.toLowerCase();

  if (carry?.includes("30") || carry?.includes(">")) {
    factor += 0.1;
  } else if (carry?.includes("10") || carry?.includes("30")) {
    factor += 0.05;
  }

  const rwAccess = constraints.find(
    (constraint) => constraint.key === "retaining_wall.access"
  );
  if (String(rwAccess?.value).toLowerCase() === "difficult") {
    factor += 0.05;
  }

  return factor;
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
