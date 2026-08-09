/**
 * Calibration MVP types (Stage 3.1C.3-R2D).
 * Evidence only — never company rate authority.
 */

export type CalibrationConfidence = "low" | "medium" | "high";

export type CalibrationQuestionId =
  | "labour_hours"
  | "labour_cost"
  | "materials_cost"
  | "subcontractors_cost"
  | "other_cost"
  | "expected_total_cost"
  | "expected_sell"
  | "confidence"
  | "notes";

export type CalibrationQuestionSpec = {
  id: CalibrationQuestionId;
  label: string;
  help?: string;
  kind: "number" | "confidence" | "text";
  optional?: boolean;
  unit?: string;
};

export type CalibrationScenarioFact = {
  key: string;
  value: unknown;
};

export type CalibrationScenarioConstraint = {
  key: string;
  label: string;
  value: unknown;
};

export type CalibrationScenario = {
  id: string;
  version: string;
  workAreaType: string;
  title: string;
  summary: string;
  jobBrief: string;
  /** Compact bullets for sticky / mobile reference while answering. */
  referenceHighlights: string[];
  facts: CalibrationScenarioFact[];
  constraints: CalibrationScenarioConstraint[];
  scopeItems: string[];
  questions: CalibrationQuestionSpec[];
};

export type CalibrationAnswers = {
  labour_hours?: number | null;
  labour_cost?: number | null;
  materials_cost?: number | null;
  subcontractors_cost?: number | null;
  other_cost?: number | null;
  expected_total_cost?: number | null;
  expected_sell?: number | null;
  confidence?: CalibrationConfidence | null;
  notes?: string | null;
};

export type CalibrationCategoryCompare = {
  category: "labour" | "materials" | "subcontractor";
  label: string;
  yourCost: number | null;
  quotrCost: number;
  comparable: boolean;
};

export type CalibrationComparison = {
  scenarioId: string;
  scenarioVersion: string;
  workAreaType: string;
  yourExpectedCost: number | null;
  quotrRecommendedCost: number;
  costDeltaPercent: number | null;
  yourExpectedSell: number | null;
  quotrRecommendedSell: number;
  sellDeltaPercent: number | null;
  categories: CalibrationCategoryCompare[];
  narrative: string;
  quotrLabourHours: number | null;
};

export const CALIBRATION_EVIDENCE_LABEL = "Calibration evidence";

/** Legacy gate code from R2D; Save no longer returns this after R2D.1. */
export const PERSISTENCE_GATE_CODE = "CALIBRATION_PERSISTENCE_GATED" as const;
