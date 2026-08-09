/**
 * Calibration persistence types (Stage 3.1C.3-R2D.1).
 * Evidence only — never company rate authority.
 */

import type {
  CalibrationAnswers,
  CalibrationCategoryCompare,
  CalibrationConfidence,
} from "@/lib/calibration/types";

export type CalibrationResponseStatus = "active" | "superseded";

export type CalibrationEngineSnapshot = {
  version: 1;
  scenarioId: string;
  scenarioVersion: string;
  workAreaType: string;
  quotrRecommendedCost: number;
  quotrRecommendedSell: number;
  yourExpectedCost: number | null;
  yourExpectedSell: number | null;
  costDeltaPercent: number | null;
  sellDeltaPercent: number | null;
  quotrLabourHours: number | null;
  categories: CalibrationCategoryCompare[];
};

export type CalibrationResponseRecord = {
  id: string;
  org_id: string;
  scenario_id: string;
  scenario_version: string;
  work_area_type: string;
  labour_hours: number | null;
  labour_cost: number | null;
  materials_cost: number | null;
  subcontractors_cost: number | null;
  other_cost: number | null;
  expected_total_cost: number | null;
  expected_sell: number | null;
  confidence: CalibrationConfidence | null;
  notes: string | null;
  engine_snapshot: CalibrationEngineSnapshot | Record<string, unknown>;
  response_metadata: Record<string, unknown>;
  status: CalibrationResponseStatus;
  supersedes_id: string | null;
  superseded_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CalibrationScenarioStatus = {
  scenarioId: string;
  workAreaType: string;
  calibrated: boolean;
  latest: CalibrationResponseRecord | null;
};

export function answersFromRecord(
  record: CalibrationResponseRecord
): CalibrationAnswers {
  return {
    labour_hours: record.labour_hours,
    labour_cost: record.labour_cost,
    materials_cost: record.materials_cost,
    subcontractors_cost: record.subcontractors_cost,
    other_cost: record.other_cost,
    expected_total_cost: record.expected_total_cost,
    expected_sell: record.expected_sell,
    confidence: record.confidence,
    notes: record.notes,
  };
}
