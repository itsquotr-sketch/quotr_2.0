/**
 * DECK-1D-B calibration types — diagnostic only.
 * Not imported by estimate calculators or commercial selection.
 */
export const DECK_CALIBRATION_BUCKET_STATES = [
  "NOT_REQUIRED",
  "PRICED",
  "UNPRICED",
  "NOT_MODELLED",
  "LEGACY_FALLBACK",
  "ALLOWANCE",
  "UNKNOWN",
] as const;

export type DeckCalibrationBucketState =
  (typeof DECK_CALIBRATION_BUCKET_STATES)[number];

export const DECK_CALIBRATION_STATUSES = [
  "NOT_COMPARABLE",
  "PARTIAL_COVERAGE",
  "DETAILED_BELOW_LEGACY_EXPLAINED",
  "DETAILED_ABOVE_LEGACY_EXPLAINED",
  "UNEXPLAINED_VARIANCE",
  "CALIBRATED",
] as const;

export type DeckCalibrationStatus =
  (typeof DECK_CALIBRATION_STATUSES)[number];

export const DECK_CALIBRATION_ECONOMIC_COMPLETENESS = [
  "COMPLETE",
  "INCOMPLETE",
  "NOT_COMPARABLE",
] as const;

export type DeckCalibrationEconomicCompleteness =
  (typeof DECK_CALIBRATION_ECONOMIC_COMPLETENESS)[number];

export const DECK_CALIBRATION_FIELD_CLASSES = [
  "REQUIRED",
  "HIGH_VALUE",
  "OPTIONAL",
] as const;

export type DeckCalibrationFieldClass =
  (typeof DECK_CALIBRATION_FIELD_CLASSES)[number];

export const DECK_CALIBRATION_SCOPE_REQUIREMENTS = [
  "REQUIRED",
  "NOT_REQUIRED",
  "UNKNOWN",
] as const;

export type DeckCalibrationScopeRequirement =
  (typeof DECK_CALIBRATION_SCOPE_REQUIREMENTS)[number];

export type DeckCalibrationCoverageOverride = {
  state: DeckCalibrationBucketState;
  note?: string;
};

export type DeckCalibrationEvidenceType =
  | "SYNTHETIC_ESTIMATE_FIXTURE"
  | "EXEMPLAR_ESTIMATE"
  | "REAL_JOB_PARTIAL_COMMERCIAL_EVIDENCE"
  | "REAL_JOB_FULL_COMMERCIAL_EVIDENCE";

export type DeckCalibrationFixture = {
  id: string;
  class:
    | "SIMPLE"
    | "MEDIUM"
    | "ELEVATED"
    | "PARTIAL-SPEC"
    | "CUSTOM-MATERIAL"
    | "REAL-JOB";
  evidenceType?: DeckCalibrationEvidenceType;
  sourceBrief?: string;
  actualCustomerSellExGst?: number | null;
  eligibility?: {
    eligibleForRateCalibration: boolean;
    eligibleForProductivityCalibration: boolean;
    eligibleForQuantityGolden: boolean;
    eligibleForArchitectureCalibration: boolean;
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
  notes: string[];
  limitations: string[];
  assumedFramingFacts: string[];
  qualityLevel?: "budget" | "standard" | "premium" | "unknown";
  facts: Record<string, string | number | boolean>;
  coverageOverrides?: Record<string, DeckCalibrationCoverageOverride>;
  realJob?: DeckCalibrationRealJobEvidence | null;
  template?: boolean;
  fields?: Array<{
    key: string;
    class: DeckCalibrationFieldClass;
    placeholder?: string;
    notes?: string;
  }>;
};

export type DeckCalibrationRealJobEvidence = {
  quotedSubstructureCost?: number | null;
  quotedSubstructureAllowance?: number | null;
  actualCustomerSellExGst?: number | null;
  actualFramingMaterialCost?: number | null;
  actualSupportsCost?: number | null;
  actualConcreteCost?: number | null;
  actualFixingsCost?: number | null;
  actualDeliveryOrPlantCost?: number | null;
  actualLabourHours?: number | null;
  actualLabourCost?: number | null;
  actualPgOrOverheadCost?: number | null;
  actualFinalCost?: number | null;
  notes?: string[];
};

export type DeckCalibrationChildRow = {
  componentKey: string;
  scopeRequirement: DeckCalibrationScopeRequirement;
  quantity: number | null;
  unit: string | null;
  identity: string | null;
  priced: boolean | null;
  rateSource: string | null;
  unitCost: number | null;
  totalCost: number | null;
  authority: string;
  bucketState: DeckCalibrationBucketState;
  economicGap: boolean;
};

export type DeckCalibrationBucket = {
  key: string;
  label: string;
  scopeRequirement: DeckCalibrationScopeRequirement;
  bucketState: DeckCalibrationBucketState;
  economicGap: boolean;
  knownModelGap: boolean;
  quantity: number | null;
  unit: string | null;
  cost: number | null;
  notes: string[];
};

export type DeckCalibrationReport = {
  fixtureId: string;
  fixtureClass: DeckCalibrationFixture["class"];
  comparisonLabel: "MATERIAL / SUBSTRUCTURE COMPARISON";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  notes: string[];
  limitations: string[];
  areaM2: number | null;
  legacy: {
    substructureCost: number | null;
    fixingsCost: number | null;
    fixingsLabel: "LEGACY CATCH-ALL FIXINGS";
    labourCost: number | null;
    labourLabel: "CURRENT LABOUR AUTHORITY";
    otherStructuralLines: Array<{ label: string; cost: number }>;
  };
  detailed: {
    children: DeckCalibrationChildRow[];
    partialPricedStructuralChildCost: number | null;
    partialLabel: "PARTIAL PRICED STRUCTURAL CHILD COST";
  };
  buckets: DeckCalibrationBucket[];
  economicGaps: string[];
  economicCompleteness: DeckCalibrationEconomicCompleteness;
  status: DeckCalibrationStatus;
  directionalLegacyVsPricedTimber: {
    label: string;
    legacyPackageCost: number | null;
    pricedDetailedSubtotal: number | null;
    difference: number | null;
    notCostReduction: true;
  };
  variance: {
    comparable: boolean;
    buckets: string;
    varianceDollars: number | null;
    variancePercent: number | null;
    missingCostExplanation: string;
  };
  realJob: {
    supplied: boolean;
    comparisons: Array<{ label: string; actual: number; model: number | null }>;
  };
  commercialSafety: {
    structuralChildrenContributeMoney: boolean;
    estimateSell: number;
  };
};
