import {
  RequirementValidationError,
  assertRequirement,
} from "@/lib/estimate/requirement-validate";
import type {
  EstimateRequirement,
  RequirementKind,
} from "@/lib/estimate/requirements";

const KIND_ORDER: Record<RequirementKind, number> = {
  material: 0,
  labour: 1,
  plant: 2,
  subcontract: 3,
  waste: 4,
};

function cloneRequirement(requirement: EstimateRequirement): EstimateRequirement {
  const assumptions = requirement.assumptions.map((assumption) => ({
    ...assumption,
  }));
  const provenance = {
    ...requirement.provenance,
    factKeys: [...requirement.provenance.factKeys],
    constraintKeys: [...requirement.provenance.constraintKeys],
  };

  if (requirement.kind === "material") {
    return {
      ...requirement,
      assumptions,
      provenance,
      conversion: requirement.conversion
        ? { ...requirement.conversion }
        : undefined,
    };
  }

  if (requirement.kind === "labour") {
    return {
      ...requirement,
      assumptions,
      provenance,
      productivityBasis: { ...requirement.productivityBasis },
      adjustmentRef: {
        factors: requirement.adjustmentRef.factors.map((factor) => ({
          ...factor,
        })),
      },
    };
  }

  return {
    ...requirement,
    assumptions,
    provenance,
  };
}

export function compareRequirements(
  left: EstimateRequirement,
  right: EstimateRequirement
): number {
  if (left.workAreaId !== right.workAreaId) {
    return left.workAreaId < right.workAreaId ? -1 : 1;
  }
  const kindDelta = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
  if (kindDelta !== 0) return kindDelta;
  if (left.componentKey !== right.componentKey) {
    return left.componentKey < right.componentKey ? -1 : 1;
  }
  const leftVariant = left.variantKey ?? "";
  const rightVariant = right.variantKey ?? "";
  if (leftVariant !== rightVariant) {
    return leftVariant < rightVariant ? -1 : 1;
  }
  if (left.requirementId !== right.requirementId) {
    return left.requirementId < right.requirementId ? -1 : 1;
  }
  return 0;
}

export function sortRequirements(
  requirements: readonly EstimateRequirement[]
): EstimateRequirement[] {
  return [...requirements].sort(compareRequirements);
}

export function normalizeRequirement(
  requirement: EstimateRequirement
): EstimateRequirement {
  assertRequirement(requirement);
  return cloneRequirement(requirement);
}

export function normalizeRequirements(
  requirements: readonly EstimateRequirement[] | null | undefined
): readonly EstimateRequirement[] {
  if (!requirements || requirements.length === 0) {
    return [];
  }

  const normalized = requirements.map(normalizeRequirement);
  const seen = new Map<string, string>();
  for (const requirement of normalized) {
    const previous = seen.get(requirement.requirementId);
    if (previous) {
      throw new RequirementValidationError(
        `duplicate requirementId "${requirement.requirementId}" (also ${previous})`
      );
    }
    seen.set(
      requirement.requirementId,
      `${requirement.workAreaId}:${requirement.kind}:${requirement.componentKey}`
    );
  }

  return sortRequirements(normalized);
}

/**
 * Collect optional calculator envelopes into one project-level list.
 * Missing or empty `requirements` is valid. Does not affect estimate money.
 */
export function collectRequirements(
  calculatorResults: readonly {
    requirements?: readonly EstimateRequirement[];
  }[]
): readonly EstimateRequirement[] {
  const collected: EstimateRequirement[] = [];
  for (const result of calculatorResults) {
    if (!result.requirements || result.requirements.length === 0) {
      continue;
    }
    collected.push(...result.requirements);
  }
  return normalizeRequirements(collected);
}
