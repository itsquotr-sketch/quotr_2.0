/**
 * EstimateRequirement contract.
 *
 * foundation-r1.0 — FOUNDATION-R1 planning/type freeze (pre independent review).
 * foundation-r1.1 — PHASE 0-R1 final pre-emission contract.
 *
 * Types + identity/invariant helpers. REQ-1 made the calculator envelope
 * possible. REQ-2.1 emits Deck surface MaterialRequirement (shadow).
 * REQ-3.1 emits Deck labour LabourRequirement (shadow). Other calculators
 * omit the field. Money remains line items + cost-first commercial engine
 * until REQ-4 promotion.
 *
 * Single-consumption: LabourRequirement.baseHours are unadjusted.
 * Project Condition productivity is referenced via adjustmentRef.factors —
 * never baked into each task and reapplied at rollup.
 * Do not encode site_access / carry / occupied / hours into baseHours
 * and also multiply by the same factor.
 */

export const ESTIMATE_REQUIREMENT_PLANNING_FREEZE_VERSION =
  "foundation-r1.0" as const;

export const ESTIMATE_REQUIREMENT_CONTRACT_VERSION = "foundation-r1.1" as const;

export type RequirementKind =
  | "material"
  | "labour"
  | "plant"
  | "subcontract"
  | "waste";

export type RequirementConfidence = "high" | "medium" | "low";

/**
 * Shared rate SOURCE. Do not encode unit conversion here.
 * Company $160/m² converted to $/lm remains source "company" plus
 * MaterialRequirement.conversion metadata.
 */
export type RequirementRateSource =
  | "company"
  | "project_override"
  | "supplier"
  | "benchmark"
  | "hardcoded_legacy"
  | "missing";

/** Alias — same semantics as RequirementRateSource. */
export type MaterialRateSource = RequirementRateSource;

export type RequirementAssumptionSource =
  | "calculator_default"
  | "benchmark"
  | "company_preference"
  | "user_confirmed"
  | "analysis_inference"
  | "assumed_default";

export type RequirementAssumption = {
  key: string;
  text: string;
  source: RequirementAssumptionSource;
};

export type RequirementProvenance = {
  calculatorSource: string;
  factKeys: string[];
  constraintKeys: string[];
  generatedAt?: string;
};

export type EstimateRequirementBase = {
  requirementId: string;
  kind: RequirementKind;
  workAreaId: string;
  workAreaType: string;
  componentKey: string;
  /** Semantic discriminator when the same component/kind can repeat. */
  variantKey?: string;
  description: string;
  confidence: RequirementConfidence;
  assumptions: readonly RequirementAssumption[];
  provenance: RequirementProvenance;
  /**
   * true = participates in commercial pricing AND required pricing fields
   * are resolved (non-null). false = physical/provenance only; not money
   * authority. Never priced=true with null cost fields.
   */
  priced: boolean;
};

export type MaterialRequirement = EstimateRequirementBase & {
  kind: "material";
  materialKey: string | null;
  category: string;
  specification?: string;
  baseQuantity: number;
  baseUnit: string;
  wasteFactor: number;
  /**
   * Continuous estimating purchase quantity after waste/conversion.
   * Future procurement pack/order quantities are separate fields.
   * Do not redefine this later as orderQuantity / packQuantity / stockLengthPlan.
   */
  purchaseQuantity: number;
  purchaseUnit: string;
  /**
   * Unit conversion provenance. Source remains company/benchmark/etc. —
   * conversion does not become a separate rate authority.
   * Optional sourceUnitCost / basis explain company m² → lm.
   */
  conversion?: {
    from: string;
    to: string;
    factor: number;
    sourceUnitCost?: number;
    basis?: string;
  };
  rateSource: RequirementRateSource;
  unitCost: number | null;
  totalCost: number | null;
};

export const PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY =
  "project.labour_productivity" as const;

/**
 * Provenance/calculation reference only.
 * Does not decide multiplicative vs additive vs capped composition (OD-PC-01).
 */
export type LabourAdjustmentFactorRef = {
  key: string;
  value: number;
};

export type LabourAdjustmentRef = {
  factors: readonly LabourAdjustmentFactorRef[];
};

export type LabourRequirement = EstimateRequirementBase & {
  kind: "labour";
  trade: string;
  baseHours: number;
  productivityBasis: {
    key: string | null;
    hoursPerUnit: number;
    unit: string;
    quantity: number;
  };
  adjustmentRef: LabourAdjustmentRef;
  adjustedHours: number;
  rateKey: string;
  hourlyCost: number | null;
  totalCost: number | null;
  rateProvenance: RequirementRateSource;
};

export type PlantRequirement = EstimateRequirementBase & {
  kind: "plant";
  plantKey?: string | null;
  hours?: number | null;
  quantity?: number | null;
  unit?: string;
  unitCost?: number | null;
  totalCost?: number | null;
};

/**
 * Reserved RFQ/cost authority states. Not required on live objects until
 * SUB-AUTH-01 / RFQ work. Do not treat as Phase-9 workflow fields now.
 */
export type SubcontractCostAuthority =
  | "allowance"
  | "benchmark"
  | "rfq_quoted"
  | "rfq_adopted";

export type SubcontractRequirement = EstimateRequirementBase & {
  kind: "subcontract";
  trade?: string;
  allowanceCost?: number | null;
  quotedCost?: number | null;
  totalCost?: number | null;
};

export type WasteRequirement = EstimateRequirementBase & {
  kind: "waste";
  wasteKey?: string | null;
  quantity?: number | null;
  unit?: string;
  totalCost?: number | null;
};

export type EstimateRequirement =
  | MaterialRequirement
  | LabourRequirement
  | PlantRequirement
  | SubcontractRequirement
  | WasteRequirement;

/**
 * Component-level pricing authority lifecycle. Implemented in REQ-4A as
 * external policy (`lib/estimate/component-authority.ts`). Requirements do
 * not store commercialAuthority.
 */
export type { ComponentCommercialAuthority as ComponentPricingAuthorityState } from "@/lib/estimate/component-authority";

/** Optional calculator envelope. REQ-2.1 Deck surface + REQ-3.1 Deck labour. Other calculators omit. */
export type CalculatorRequirementsEmit = {
  readonly requirements?: readonly EstimateRequirement[];
};

function isResolvedMoney(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

/** Zero is a real numeric value. Null is unresolved — not zero. */
export function requirementPricingFieldsAreResolved(
  requirement: EstimateRequirement
): boolean {
  switch (requirement.kind) {
    case "material":
      return (
        isResolvedMoney(requirement.unitCost) &&
        isResolvedMoney(requirement.totalCost)
      );
    case "labour":
      return (
        isResolvedMoney(requirement.hourlyCost) &&
        isResolvedMoney(requirement.totalCost)
      );
    case "plant":
      return isResolvedMoney(requirement.totalCost);
    case "subcontract":
      return isResolvedMoney(requirement.totalCost);
    case "waste":
      return isResolvedMoney(requirement.totalCost);
  }
}

/**
 * priced=true requires resolved pricing fields.
 * priced=false may carry physical qty with null costs (not money authority).
 * priced=true + totalCost=null is invalid — that is not "pricing required".
 */
export function isPricedInvariantSatisfied(
  requirement: EstimateRequirement
): boolean {
  if (!requirement.priced) {
    return true;
  }
  return requirementPricingFieldsAreResolved(requirement);
}
