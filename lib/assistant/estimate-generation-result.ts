/**
 * SYSTEM-PERFORMANCE-SPEED-1B-A — canonical Generate/Update estimate response.
 *
 * SERVER DB remains the persisted authority. This DTO is a projection of rows
 * already written by persist_estimate_generation_v1, mapped with the same
 * functions as SSR (`mapEstimate`). The client must not recalculate money.
 */

import type { AssistantStage } from "@/components/assistant/types";
import { mapEstimate } from "@/lib/assistant/mappers";
import type { EstimateGenerationResult } from "@/lib/assistant/types";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import type { PersistEstimateGenerationV1 } from "@/lib/estimate/persist-estimate-generation";
import { parseEstimateRequirementSnapshot } from "@/lib/estimate/requirement-snapshot";
import type { PricingSummary } from "@/lib/pricing/types";

export type { EstimateGenerationResult };

export const ASSISTANT_ESTIMATE_COLUMNS =
  "id, cost_low, cost_high, sell_low, sell_high, recommended_cost, recommended_sell, gross_profit, margin_percent, markup_percent, is_stale, calibration_version, target_margin_percent, confidence, rate_source_summary, assumptions, missing_info, exclusions, assumption_metadata, latest_requirement_snapshot_id, requirement_generation_id";

export const ASSISTANT_LINE_ITEM_COLUMNS =
  "id, work_area_name, label, category, cost_low, cost_high, sell_low, sell_high, recommended_cost, recommended_sell, gross_profit, margin_percent, markup_percent, rate_source, notes, sort_order, component_key";

export const ASSISTANT_WORK_AREA_COLUMNS =
  "id, type, name, status, ai_confidence, summary, quote_description, sort_order, created_at";

export type PersistedEstimateRow = {
  id: string;
  cost_low: number | null;
  cost_high: number | null;
  sell_low: number | null;
  sell_high: number | null;
  recommended_cost: number | null;
  recommended_sell: number | null;
  gross_profit: number | null;
  margin_percent: number | null;
  markup_percent: number | null;
  is_stale?: boolean | null;
  calibration_version?: string | null;
  target_margin_percent?: number | null;
  confidence: number | null;
  rate_source_summary: string | null;
  assumptions: unknown;
  missing_info: unknown;
  exclusions: unknown;
  assumption_metadata?: unknown;
  latest_requirement_snapshot_id?: string | null;
  requirement_generation_id?: string | null;
};

export type PersistedLineItemRow = {
  id: string;
  work_area_name: string;
  label: string;
  category: string;
  cost_low: number | null;
  cost_high: number | null;
  sell_low: number | null;
  sell_high: number | null;
  recommended_cost: number | null;
  recommended_sell: number | null;
  gross_profit: number | null;
  margin_percent: number | null;
  markup_percent: number | null;
  rate_source: string | null;
  notes: string | null;
  sort_order: number;
  component_key?: string | null;
};

export type PersistedWorkAreaRow = {
  id: string;
  type: string;
  name: string;
  status: string;
  ai_confidence: number | null;
  summary: string | null;
  quote_description: string | null;
  sort_order: number;
};

export { shouldApplyEstimateGeneration } from "@/lib/assistant/estimate-generation-apply";
export type { AppliedEstimateGeneration } from "@/lib/assistant/estimate-generation-apply";

export function buildEstimateGenerationResult(input: {
  projectId: string;
  stage: AssistantStage;
  estimateRow: PersistedEstimateRow;
  lineItems: readonly PersistedLineItemRow[];
  workAreas: readonly PersistedWorkAreaRow[];
  snapshotPayload?: unknown;
  generationId?: string | null;
  pricingSummary?: PricingSummary | null;
}): EstimateGenerationResult {
  const generationId =
    input.generationId ??
    input.estimateRow.requirement_generation_id ??
    "";

  let requirementSnapshotRequirements: readonly EstimateRequirement[] = [];
  if (input.snapshotPayload) {
    try {
      requirementSnapshotRequirements = parseEstimateRequirementSnapshot(
        input.snapshotPayload
      ).requirements;
    } catch {
      requirementSnapshotRequirements = [];
    }
  }

  return {
    projectId: input.projectId,
    estimateId: input.estimateRow.id,
    generationId,
    stage: input.stage,
    stale: Boolean(input.estimateRow.is_stale),
    estimate: mapEstimate(
      input.estimateRow,
      [...input.lineItems],
      [...input.workAreas]
    ),
    requirementSnapshotRequirements,
    pricingSummary: input.pricingSummary ?? null,
  };
}

/**
 * Reconstruct the DB-shaped rows that persist_estimate_generation_v1 writes.
 * Used for response-vs-reload parity without a live database.
 */
export function persistPayloadToEstimateRows(input: {
  payload: PersistEstimateGenerationV1;
  estimateId: string;
  snapshotId: string;
  workAreas: readonly PersistedWorkAreaRow[];
}): {
  estimateRow: PersistedEstimateRow;
  lineItems: PersistedLineItemRow[];
  workAreas: readonly PersistedWorkAreaRow[];
  snapshotPayload: unknown;
} {
  const { payload, estimateId, snapshotId } = input;
  return {
    estimateRow: {
      id: estimateId,
      cost_low: payload.estimate.costLow,
      cost_high: payload.estimate.costHigh,
      sell_low: payload.estimate.sellLow,
      sell_high: payload.estimate.sellHigh,
      recommended_cost: payload.estimate.recommendedCost,
      recommended_sell: payload.estimate.recommendedSell,
      gross_profit: payload.estimate.grossProfit,
      margin_percent: payload.estimate.marginPercent,
      markup_percent: payload.estimate.markupPercent,
      is_stale: false,
      calibration_version: payload.estimate.calibrationVersion,
      target_margin_percent: null,
      confidence: payload.estimate.confidence,
      rate_source_summary: payload.estimate.rateSourceSummary,
      assumptions: payload.estimate.assumptions,
      missing_info: payload.estimate.missingInfo,
      exclusions: payload.estimate.exclusions,
      assumption_metadata: payload.estimate.assumptionMetadata,
      latest_requirement_snapshot_id: snapshotId,
      requirement_generation_id: payload.generationId,
    },
    lineItems: payload.lineItems.map((item, index) => ({
      id: `${estimateId}-line-${index}`,
      work_area_name: item.workAreaName,
      label: item.label,
      category: item.category,
      cost_low: item.costLow,
      cost_high: item.costHigh,
      sell_low: item.sellLow,
      sell_high: item.sellHigh,
      recommended_cost: item.recommendedCost,
      recommended_sell: item.recommendedSell,
      gross_profit: item.grossProfit,
      margin_percent: item.marginPercent,
      markup_percent: item.markupPercent,
      rate_source: item.rateSource,
      notes: item.notes,
      sort_order: item.sortOrder,
      component_key: item.componentKey,
    })),
    workAreas: input.workAreas,
    snapshotPayload: payload.snapshot,
  };
}
