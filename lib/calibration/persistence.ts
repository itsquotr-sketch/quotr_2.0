import "server-only";

import type { CalibrationAnswers, CalibrationComparison } from "@/lib/calibration/types";
import type {
  CalibrationEngineSnapshot,
  CalibrationResponseRecord,
} from "@/lib/calibration/persistence-types";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";

const ACTIVE_SELECT =
  "id, org_id, scenario_id, scenario_version, work_area_type, labour_hours, labour_cost, materials_cost, subcontractors_cost, other_cost, expected_total_cost, expected_sell, confidence, notes, engine_snapshot, response_metadata, status, supersedes_id, superseded_at, created_by, created_at, updated_at";

function mapRow(row: Record<string, unknown>): CalibrationResponseRecord {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    scenario_id: String(row.scenario_id),
    scenario_version: String(row.scenario_version),
    work_area_type: String(row.work_area_type),
    labour_hours:
      row.labour_hours == null ? null : Number(row.labour_hours),
    labour_cost: row.labour_cost == null ? null : Number(row.labour_cost),
    materials_cost:
      row.materials_cost == null ? null : Number(row.materials_cost),
    subcontractors_cost:
      row.subcontractors_cost == null
        ? null
        : Number(row.subcontractors_cost),
    other_cost: row.other_cost == null ? null : Number(row.other_cost),
    expected_total_cost:
      row.expected_total_cost == null
        ? null
        : Number(row.expected_total_cost),
    expected_sell:
      row.expected_sell == null ? null : Number(row.expected_sell),
    confidence:
      row.confidence === "low" ||
      row.confidence === "medium" ||
      row.confidence === "high"
        ? row.confidence
        : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    engine_snapshot:
      row.engine_snapshot && typeof row.engine_snapshot === "object"
        ? (row.engine_snapshot as CalibrationEngineSnapshot)
        : { version: 1 } as never,
    response_metadata:
      row.response_metadata && typeof row.response_metadata === "object"
        ? (row.response_metadata as Record<string, unknown>)
        : {},
    status: row.status === "superseded" ? "superseded" : "active",
    supersedes_id:
      row.supersedes_id == null ? null : String(row.supersedes_id),
    superseded_at:
      row.superseded_at == null ? null : String(row.superseded_at),
    created_by: String(row.created_by),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function buildCalibrationEngineSnapshot(
  comparison: CalibrationComparison
): CalibrationEngineSnapshot {
  return {
    version: 1,
    scenarioId: comparison.scenarioId,
    scenarioVersion: comparison.scenarioVersion,
    workAreaType: comparison.workAreaType,
    quotrRecommendedCost: comparison.quotrRecommendedCost,
    quotrRecommendedSell: comparison.quotrRecommendedSell,
    yourExpectedCost: comparison.yourExpectedCost,
    yourExpectedSell: comparison.yourExpectedSell,
    costDeltaPercent: comparison.costDeltaPercent,
    sellDeltaPercent: comparison.sellDeltaPercent,
    quotrLabourHours: comparison.quotrLabourHours,
    categories: comparison.categories,
  };
}

export async function listActiveCalibrationResponses(
  context: AuthOrgContext
): Promise<CalibrationResponseRecord[]> {
  const { data, error } = await context.supabase
    .from("calibration_responses")
    .select(ACTIVE_SELECT)
    .eq("org_id", context.orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("CALIBRATION_LIST_FAILED");
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getActiveCalibrationByScenario(
  context: AuthOrgContext,
  scenarioId: string
): Promise<CalibrationResponseRecord | null> {
  const { data, error } = await context.supabase
    .from("calibration_responses")
    .select(ACTIVE_SELECT)
    .eq("org_id", context.orgId)
    .eq("scenario_id", scenarioId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error("CALIBRATION_GET_FAILED");
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export type SaveCalibrationPersistenceInput = {
  scenarioId: string;
  scenarioVersion: string;
  workAreaType: string;
  answers: CalibrationAnswers;
  engineSnapshot: CalibrationEngineSnapshot;
  responseMetadata?: Record<string, unknown>;
};

export type SaveCalibrationPersistenceResult = {
  id: string;
  scenarioId: string;
  scenarioVersion: string;
  status: "active";
  supersededPriorId: string | null;
};

/**
 * Atomic supersede + insert via SECURITY INVOKER RPC.
 * Never writes rates / projects / estimates / quotes.
 */
export async function persistCalibrationResponse(
  context: AuthOrgContext,
  input: SaveCalibrationPersistenceInput
): Promise<SaveCalibrationPersistenceResult> {
  const { data, error } = await context.supabase.rpc(
    "save_calibration_response",
    {
      p_scenario_id: input.scenarioId,
      p_scenario_version: input.scenarioVersion,
      p_work_area_type: input.workAreaType,
      p_labour_hours: input.answers.labour_hours ?? null,
      p_labour_cost: input.answers.labour_cost ?? null,
      p_materials_cost: input.answers.materials_cost ?? null,
      p_subcontractors_cost: input.answers.subcontractors_cost ?? null,
      p_other_cost: input.answers.other_cost ?? null,
      p_expected_total_cost: input.answers.expected_total_cost ?? null,
      p_expected_sell: input.answers.expected_sell ?? null,
      p_confidence: input.answers.confidence ?? null,
      p_notes: input.answers.notes ?? null,
      p_engine_snapshot: input.engineSnapshot,
      p_response_metadata: input.responseMetadata ?? {},
    }
  );

  if (error || !data || typeof data !== "object") {
    throw new Error("CALIBRATION_SAVE_FAILED");
  }

  const payload = data as Record<string, unknown>;
  return {
    id: String(payload.id),
    scenarioId: String(payload.scenario_id),
    scenarioVersion: String(payload.scenario_version),
    status: "active",
    supersededPriorId:
      payload.superseded_prior_id == null
        ? null
        : String(payload.superseded_prior_id),
  };
}
