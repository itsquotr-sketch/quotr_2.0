/**
 * FOUNDATION-R1 — EstimateRequirement type freeze.
 *
 * Types only. Calculators must NOT emit these objects in this batch.
 * Quantity authority for a future generate; money remains line items +
 * cost-first commercial engine.
 *
 * Single-consumption: LabourRequirement.baseHours are unadjusted.
 * Project Condition productivity is referenced once via adjustmentRef —
 * never baked into each task and reapplied at rollup.
 */

export const ESTIMATE_REQUIREMENT_CONTRACT_VERSION = "foundation-r1.0" as const;

export type RequirementKind =
  | "material"
  | "labour"
  | "plant"
  | "subcontract"
  | "waste";

export type RequirementConfidence = "high" | "medium" | "low";

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
  description: string;
  confidence: RequirementConfidence;
  assumptions: string[];
  provenance: RequirementProvenance;
  priced: boolean;
};

export type MaterialRateSource =
  | "company"
  | "benchmark"
  | "hardcoded_legacy"
  | "missing";

export type MaterialRequirement = EstimateRequirementBase & {
  kind: "material";
  materialKey: string | null;
  category: string;
  specification?: string;
  baseQuantity: number;
  baseUnit: string;
  wasteFactor: number;
  purchaseQuantity: number;
  purchaseUnit: string;
  conversion?: { from: string; to: string; factor: number };
  rateSource: MaterialRateSource;
  unitCost: number | null;
  totalCost: number | null;
};

/**
 * Project productivity is applied once at rollup:
 * adjustedHours = baseHours × projectConditionFactor × qualityFactor
 *
 * Do not encode site_access / carry / occupied / hours into baseHours
 * and also multiply by the same factor.
 */
export type LabourAdjustmentRef = {
  projectConditionFactorKey: "project.labour_productivity";
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
  rateProvenance: MaterialRateSource;
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

/** FOUNDATION-R1: calculators must not populate this. Reserved for REQ-1. */
export type CalculatorRequirementsEmit = {
  readonly requirements?: readonly EstimateRequirement[];
};
