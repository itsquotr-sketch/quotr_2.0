import { buildRequirementId } from "@/lib/estimate/requirement-id";
import {
  isPricedInvariantSatisfied,
  type EstimateRequirement,
  type LabourRequirement,
  type MaterialRequirement,
  type PlantRequirement,
  type RequirementAssumption,
  type RequirementAssumptionSource,
  type RequirementConfidence,
  type RequirementKind,
  type RequirementRateSource,
  type SubcontractRequirement,
  type WasteRequirement,
} from "@/lib/estimate/requirements";

const KINDS: readonly RequirementKind[] = [
  "material",
  "labour",
  "plant",
  "subcontract",
  "waste",
];

const CONFIDENCES: readonly RequirementConfidence[] = [
  "high",
  "medium",
  "low",
];

const RATE_SOURCES: readonly RequirementRateSource[] = [
  "company",
  "project_override",
  "supplier",
  "benchmark",
  "hardcoded_legacy",
  "missing",
];

const ASSUMPTION_SOURCES: readonly RequirementAssumptionSource[] = [
  "calculator_default",
  "benchmark",
  "company_preference",
  "user_confirmed",
  "analysis_inference",
  "assumed_default",
];

export class RequirementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequirementValidationError";
  }
}

function isKind(value: string): value is RequirementKind {
  return (KINDS as readonly string[]).includes(value);
}

function isConfidence(value: string): value is RequirementConfidence {
  return (CONFIDENCES as readonly string[]).includes(value);
}

function isRateSource(value: string): value is RequirementRateSource {
  return (RATE_SOURCES as readonly string[]).includes(value);
}

function isAssumptionSource(value: string): value is RequirementAssumptionSource {
  return (ASSUMPTION_SOURCES as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function fail(message: string): never {
  throw new RequirementValidationError(message);
}

function assertRequirementIdShape(requirement: EstimateRequirement): void {
  const canonical = buildRequirementId({
    workAreaId: requirement.workAreaId,
    kind: requirement.kind,
    componentKey: requirement.componentKey,
    variantKey: requirement.variantKey,
  });
  if (requirement.requirementId === canonical) {
    return;
  }

  const indexMatch = requirement.requirementId.match(/^(.*):#(\d+)$/);
  if (!requirement.variantKey && indexMatch) {
    const withoutIndex = buildRequirementId({
      workAreaId: requirement.workAreaId,
      kind: requirement.kind,
      componentKey: requirement.componentKey,
    });
    if (indexMatch[1] === withoutIndex) {
      return;
    }
  }

  fail(
    `requirementId "${requirement.requirementId}" does not match deterministic identity for ${requirement.workAreaId}:${requirement.kind}:${requirement.componentKey}`
  );
}

function assertAssumptions(
  requirementId: string,
  assumptions: readonly RequirementAssumption[]
): void {
  if (!Array.isArray(assumptions)) {
    fail(`${requirementId}: assumptions must be an array`);
  }
  for (const assumption of assumptions) {
    if (!isNonEmptyString(assumption.key)) {
      fail(`${requirementId}: assumption key is required`);
    }
    if (!isNonEmptyString(assumption.text)) {
      fail(`${requirementId}: assumption text is required`);
    }
    if (!isAssumptionSource(assumption.source)) {
      fail(`${requirementId}: assumption source is invalid`);
    }
  }
}

function assertMoneyWhenPriced(
  requirement: EstimateRequirement,
  cost: number | null | undefined,
  label: string
): void {
  if (!requirement.priced) {
    return;
  }
  if (!isNonNegativeNumber(cost)) {
    fail(
      `${requirement.requirementId}: priced=true requires non-null non-negative ${label}`
    );
  }
}

function assertMaterial(requirement: MaterialRequirement): void {
  if (!isNonNegativeNumber(requirement.baseQuantity)) {
    fail(`${requirement.requirementId}: baseQuantity must be >= 0`);
  }
  if (!isNonNegativeNumber(requirement.wasteFactor)) {
    fail(`${requirement.requirementId}: wasteFactor must be >= 0`);
  }
  if (!isNonNegativeNumber(requirement.purchaseQuantity)) {
    fail(`${requirement.requirementId}: purchaseQuantity must be >= 0`);
  }
  if (!isNonEmptyString(requirement.baseUnit)) {
    fail(`${requirement.requirementId}: baseUnit is required`);
  }
  if (!isNonEmptyString(requirement.purchaseUnit)) {
    fail(`${requirement.requirementId}: purchaseUnit is required`);
  }
  if (!isRateSource(requirement.rateSource)) {
    fail(`${requirement.requirementId}: rateSource is invalid`);
  }
  if (requirement.conversion) {
    if (
      !isNonEmptyString(requirement.conversion.from) ||
      !isNonEmptyString(requirement.conversion.to) ||
      !isFiniteNumber(requirement.conversion.factor) ||
      requirement.conversion.factor <= 0
    ) {
      fail(`${requirement.requirementId}: conversion metadata is invalid`);
    }
    if (
      requirement.conversion.sourceUnitCost != null &&
      !isNonNegativeNumber(requirement.conversion.sourceUnitCost)
    ) {
      fail(`${requirement.requirementId}: conversion sourceUnitCost cannot be negative`);
    }
    if (
      requirement.conversion.basis != null &&
      !isNonEmptyString(requirement.conversion.basis)
    ) {
      fail(`${requirement.requirementId}: conversion basis must be a non-empty string when set`);
    }
  }
  if (requirement.priced) {
    if (requirement.rateSource === "missing") {
      fail(
        `${requirement.requirementId}: priced=true material cannot have rateSource missing`
      );
    }
    assertMoneyWhenPriced(requirement, requirement.unitCost, "unitCost");
    assertMoneyWhenPriced(requirement, requirement.totalCost, "totalCost");
  } else if (requirement.unitCost != null && !isNonNegativeNumber(requirement.unitCost)) {
    fail(`${requirement.requirementId}: unitCost cannot be negative`);
  } else if (
    requirement.totalCost != null &&
    !isNonNegativeNumber(requirement.totalCost)
  ) {
    fail(`${requirement.requirementId}: totalCost cannot be negative`);
  }
  if (requirement.rateEvidence) {
    const evidence = requirement.rateEvidence;
    if (!isNonEmptyString(evidence.sourceName) || !isNonEmptyString(evidence.sourceURL)) {
      fail(`${requirement.requirementId}: rateEvidence source is incomplete`);
    }
    if (!isNonEmptyString(evidence.gstBasis) || !isNonEmptyString(evidence.sourceUnit)) {
      fail(`${requirement.requirementId}: rateEvidence GST/unit is incomplete`);
    }
    if (!isNonNegativeNumber(evidence.sourcePrice) || !isNonNegativeNumber(evidence.normalizedRateExGst)) {
      fail(`${requirement.requirementId}: rateEvidence prices must be non-negative`);
    }
    if (!isNonEmptyString(evidence.researchedAt) || !isNonEmptyString(evidence.verifiedAt)) {
      fail(`${requirement.requirementId}: rateEvidence dates are required`);
    }
    if (!isNonEmptyString(evidence.normalizedRateUnit)) {
      fail(`${requirement.requirementId}: rateEvidence normalizedRateUnit is required`);
    }
  }
}

function assertLabour(requirement: LabourRequirement): void {
  if (!isNonEmptyString(requirement.trade)) {
    fail(`${requirement.requirementId}: labour trade is required`);
  }
  if (!isNonNegativeNumber(requirement.baseHours)) {
    fail(`${requirement.requirementId}: baseHours must be >= 0`);
  }
  if (!isNonNegativeNumber(requirement.adjustedHours)) {
    fail(`${requirement.requirementId}: adjustedHours must be >= 0`);
  }
  if (!isNonEmptyString(requirement.rateKey)) {
    fail(`${requirement.requirementId}: labour rateKey is required`);
  }
  if (!isRateSource(requirement.rateProvenance)) {
    fail(`${requirement.requirementId}: rateProvenance is invalid`);
  }
  if (
    !requirement.productivityBasis ||
    !isNonNegativeNumber(requirement.productivityBasis.hoursPerUnit) ||
    !isNonNegativeNumber(requirement.productivityBasis.quantity) ||
    !isNonEmptyString(requirement.productivityBasis.unit)
  ) {
    fail(`${requirement.requirementId}: productivityBasis is invalid`);
  }
  if (
    !requirement.adjustmentRef ||
    !Array.isArray(requirement.adjustmentRef.factors)
  ) {
    fail(`${requirement.requirementId}: adjustmentRef.factors is required`);
  }
  for (const factor of requirement.adjustmentRef.factors) {
    if (!isNonEmptyString(factor.key) || !isFiniteNumber(factor.value)) {
      fail(`${requirement.requirementId}: adjustment factor is invalid`);
    }
  }
  if (requirement.priced) {
    if (requirement.rateProvenance === "missing") {
      fail(
        `${requirement.requirementId}: priced=true labour cannot have rateProvenance missing`
      );
    }
    assertMoneyWhenPriced(requirement, requirement.hourlyCost, "hourlyCost");
    assertMoneyWhenPriced(requirement, requirement.totalCost, "totalCost");
  } else if (
    requirement.hourlyCost != null &&
    !isNonNegativeNumber(requirement.hourlyCost)
  ) {
    fail(`${requirement.requirementId}: hourlyCost cannot be negative`);
  } else if (
    requirement.totalCost != null &&
    !isNonNegativeNumber(requirement.totalCost)
  ) {
    fail(`${requirement.requirementId}: totalCost cannot be negative`);
  }
}

function assertOptionalNonNegative(
  requirementId: string,
  value: number | null | undefined,
  label: string
): void {
  if (value == null) return;
  if (!isNonNegativeNumber(value)) {
    fail(`${requirementId}: ${label} cannot be negative`);
  }
}

function assertPlant(requirement: PlantRequirement): void {
  assertOptionalNonNegative(requirement.requirementId, requirement.hours, "hours");
  assertOptionalNonNegative(
    requirement.requirementId,
    requirement.quantity,
    "quantity"
  );
  assertOptionalNonNegative(
    requirement.requirementId,
    requirement.unitCost,
    "unitCost"
  );
  assertOptionalNonNegative(
    requirement.requirementId,
    requirement.totalCost,
    "totalCost"
  );
  assertMoneyWhenPriced(requirement, requirement.totalCost, "totalCost");
}

function assertSubcontract(requirement: SubcontractRequirement): void {
  assertOptionalNonNegative(
    requirement.requirementId,
    requirement.allowanceCost,
    "allowanceCost"
  );
  assertOptionalNonNegative(
    requirement.requirementId,
    requirement.quotedCost,
    "quotedCost"
  );
  assertOptionalNonNegative(
    requirement.requirementId,
    requirement.totalCost,
    "totalCost"
  );
  assertMoneyWhenPriced(requirement, requirement.totalCost, "totalCost");
}

function assertWaste(requirement: WasteRequirement): void {
  assertOptionalNonNegative(
    requirement.requirementId,
    requirement.quantity,
    "quantity"
  );
  assertOptionalNonNegative(
    requirement.requirementId,
    requirement.totalCost,
    "totalCost"
  );
  assertMoneyWhenPriced(requirement, requirement.totalCost, "totalCost");
}

export function assertRequirement(requirement: EstimateRequirement): void {
  if (!isNonEmptyString(requirement.requirementId)) {
    fail("requirementId is required");
  }
  if (!isKind(requirement.kind)) {
    fail(`${requirement.requirementId}: kind is not recognised`);
  }
  if (!isNonEmptyString(requirement.workAreaId)) {
    fail(`${requirement.requirementId}: workAreaId is required`);
  }
  if (!isNonEmptyString(requirement.workAreaType)) {
    fail(`${requirement.requirementId}: workAreaType is required`);
  }
  if (!isNonEmptyString(requirement.componentKey)) {
    fail(`${requirement.requirementId}: componentKey is required`);
  }
  if (!isNonEmptyString(requirement.description)) {
    fail(`${requirement.requirementId}: description is required`);
  }
  if (!isConfidence(requirement.confidence)) {
    fail(`${requirement.requirementId}: confidence must be high, medium, or low`);
  }
  if (typeof requirement.priced !== "boolean") {
    fail(`${requirement.requirementId}: priced must be boolean`);
  }
  if (!requirement.provenance || !isNonEmptyString(requirement.provenance.calculatorSource)) {
    fail(`${requirement.requirementId}: provenance.calculatorSource is required`);
  }
  if (!Array.isArray(requirement.provenance.factKeys)) {
    fail(`${requirement.requirementId}: provenance.factKeys must be an array`);
  }
  if (!Array.isArray(requirement.provenance.constraintKeys)) {
    fail(`${requirement.requirementId}: provenance.constraintKeys must be an array`);
  }
  assertAssumptions(requirement.requirementId, requirement.assumptions);
  assertRequirementIdShape(requirement);
  if (!isPricedInvariantSatisfied(requirement)) {
    fail(
      `${requirement.requirementId}: priced=true requires resolved pricing fields for kind ${requirement.kind}`
    );
  }

  switch (requirement.kind) {
    case "material":
      assertMaterial(requirement);
      return;
    case "labour":
      assertLabour(requirement);
      return;
    case "plant":
      assertPlant(requirement);
      return;
    case "subcontract":
      assertSubcontract(requirement);
      return;
    case "waste":
      assertWaste(requirement);
      return;
  }
}
