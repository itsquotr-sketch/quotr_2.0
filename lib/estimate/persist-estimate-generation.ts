/**
 * REQ-TXN-01 — versioned atomic estimate-generation persistence contract.
 *
 * Calculation and snapshot serialization happen before the DB transaction.
 * The RPC persists one generation (estimate + lines + snapshot + pointer + ready)
 * in a single Postgres transaction.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENT_CALIBRATION_VERSION } from "@/lib/estimate/calibration-version";
import { snapshotRegisteredAuthorities } from "@/lib/estimate/component-authority";
import { buildLineItemNotes } from "@/lib/estimate/line-items";
import { buildSnapshotPayloadForEstimate } from "@/lib/estimate/requirement-snapshot-persist";
import type { EstimateResult } from "@/lib/estimate/types";

export const PERSIST_ESTIMATE_GENERATION_CONTRACT_VERSION =
  "persist-estimate-generation-v1" as const;

export const PERSIST_ESTIMATE_GENERATION_RPC = "persist_estimate_generation_v1";

export type PersistEstimateGenerationLineV1 = {
  workAreaId: string | null;
  workAreaName: string;
  label: string;
  category: string;
  costLow: number | null;
  costHigh: number | null;
  sellLow: number | null;
  sellHigh: number | null;
  recommendedCost: number | null;
  recommendedSell: number | null;
  grossProfit: number | null;
  marginPercent: number | null;
  markupPercent: number | null;
  rateSource: string | null;
  notes: string | null;
  sortOrder: number;
  componentKey: string | null;
};

export type PersistEstimateGenerationV1 = {
  contractVersion: typeof PERSIST_ESTIMATE_GENERATION_CONTRACT_VERSION;
  projectId: string;
  generationId: string;
  componentAuthorities: Array<{
    workAreaType: string;
    componentKey: string;
    authority: string;
  }>;
  estimate: {
    costLow: number;
    costHigh: number;
    sellLow: number;
    sellHigh: number;
    recommendedCost: number;
    recommendedSell: number;
    grossProfit: number;
    marginPercent: number;
    markupPercent: number;
    confidence: number;
    rateSourceSummary: string;
    assumptions: unknown;
    missingInfo: unknown;
    exclusions: unknown;
    assumptionMetadata: unknown;
    calibrationVersion: string;
  };
  lineItems: PersistEstimateGenerationLineV1[];
  snapshot: Record<string, unknown>;
};

export type PersistEstimateGenerationRpcResult = {
  estimate_id: string;
  generation_id: string;
  snapshot_id: string;
  status: string;
};

export type EstimateGenerationLink = {
  estimateId: string;
  requirementGenerationId: string | null;
  latestRequirementSnapshotId: string | null;
  status?: string | null;
  isStale?: boolean | null;
};

export type SnapshotGenerationLink =
  | {
      id: string;
      estimateId: string;
      generationId: string;
    }
  | null
  | undefined;

export function buildPersistEstimateGenerationV1(params: {
  projectId: string;
  generationId: string;
  estimateResult: EstimateResult;
}): PersistEstimateGenerationV1 {
  const snapshot = buildSnapshotPayloadForEstimate({
    generationId: params.generationId,
    result: params.estimateResult,
  });

  return {
    contractVersion: PERSIST_ESTIMATE_GENERATION_CONTRACT_VERSION,
    projectId: params.projectId,
    generationId: params.generationId,
    componentAuthorities: snapshotRegisteredAuthorities().map((entry) => ({
      workAreaType: entry.workAreaType,
      componentKey: entry.componentKey,
      authority: entry.authority,
    })),
    estimate: {
      costLow: params.estimateResult.costLow,
      costHigh: params.estimateResult.costHigh,
      sellLow: params.estimateResult.sellLow,
      sellHigh: params.estimateResult.sellHigh,
      recommendedCost: params.estimateResult.recommendedCost,
      recommendedSell: params.estimateResult.recommendedSell,
      grossProfit: params.estimateResult.grossProfit,
      marginPercent: params.estimateResult.marginPercent,
      markupPercent: params.estimateResult.markupPercent,
      confidence: params.estimateResult.confidence,
      rateSourceSummary: params.estimateResult.rateSourceSummary,
      assumptions: params.estimateResult.assumptions,
      missingInfo: params.estimateResult.missingInfo,
      exclusions: params.estimateResult.exclusions,
      assumptionMetadata: params.estimateResult.assumptionMetadata ?? {},
      calibrationVersion: CURRENT_CALIBRATION_VERSION,
    },
    lineItems: params.estimateResult.lineItems.map((item) => ({
      workAreaId: item.workAreaId ?? null,
      workAreaName: item.workAreaName,
      label: item.label,
      category: item.category,
      costLow: item.costLow,
      costHigh: item.costHigh,
      sellLow: item.sellLow,
      sellHigh: item.sellHigh,
      recommendedCost: item.recommendedCost,
      recommendedSell: item.recommendedSell,
      grossProfit: item.grossProfit,
      marginPercent: item.marginPercent,
      markupPercent: item.markupPercent ?? null,
      rateSource: item.rateSource,
      notes: buildLineItemNotes(item),
      sortOrder: item.sortOrder,
      componentKey: item.componentKey ?? null,
    })),
    snapshot: snapshot as unknown as Record<string, unknown>,
  };
}

export function isAtomicPersistRpcUnavailable(
  message: string | undefined
): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("persist_estimate_generation_v1") &&
    (lower.includes("schema cache") ||
      lower.includes("could not find the function") ||
      lower.includes("does not exist") ||
      lower.includes("pgrst202"))
  );
}

export function assertEstimateGenerationConsistent(
  estimate: EstimateGenerationLink,
  snapshot?: SnapshotGenerationLink
): { ok: true } | { ok: false; reason: string } {
  if (
    estimate.latestRequirementSnapshotId &&
    !estimate.requirementGenerationId
  ) {
    return { ok: false, reason: "snapshot_pointer_without_generation" };
  }
  if (
    estimate.requirementGenerationId &&
    !estimate.latestRequirementSnapshotId
  ) {
    return { ok: false, reason: "generation_without_snapshot_pointer" };
  }
  if (!snapshot) {
    return { ok: true };
  }
  if (snapshot.estimateId !== estimate.estimateId) {
    return { ok: false, reason: "snapshot_estimate_mismatch" };
  }
  if (snapshot.id !== estimate.latestRequirementSnapshotId) {
    return { ok: false, reason: "snapshot_pointer_mismatch" };
  }
  if (snapshot.generationId !== estimate.requirementGenerationId) {
    return { ok: false, reason: "generation_id_mismatch" };
  }
  return { ok: true };
}

/**
 * Pricing may copy from a finalized current generation.
 *
 * New atomic generations always have generation + snapshot pointers.
 * Historical pre-036 estimates may have both null and remain priceable.
 * Mixed/incomplete pointers are not ready.
 */
export function isEstimateReadyForPricing(
  estimate: EstimateGenerationLink,
  snapshot?: SnapshotGenerationLink
): { ok: true } | { ok: false; reason: string } {
  if (estimate.isStale) {
    return { ok: false, reason: "estimate_stale" };
  }
  const hasGeneration = Boolean(estimate.requirementGenerationId);
  const hasPointer = Boolean(estimate.latestRequirementSnapshotId);
  if (!hasGeneration && !hasPointer) {
    return { ok: true };
  }
  if (estimate.status && estimate.status !== "ready") {
    return { ok: false, reason: "estimate_not_ready" };
  }
  return assertEstimateGenerationConsistent(estimate, snapshot);
}

export async function persistEstimateGenerationViaRpc(
  supabase: SupabaseClient,
  payload: PersistEstimateGenerationV1
): Promise<
  | { ok: true; result: PersistEstimateGenerationRpcResult }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase.rpc(PERSIST_ESTIMATE_GENERATION_RPC, {
    p_payload: payload,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  const result = data as PersistEstimateGenerationRpcResult | null;
  if (
    !result ||
    typeof result.estimate_id !== "string" ||
    typeof result.generation_id !== "string" ||
    typeof result.snapshot_id !== "string" ||
    typeof result.status !== "string"
  ) {
    return { ok: false, message: "REQ_TXN:INVALID_RPC_RESULT" };
  }
  return { ok: true, result };
}
