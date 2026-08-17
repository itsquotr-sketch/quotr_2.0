import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENT_CALIBRATION_VERSION } from "@/lib/estimate/calibration-version";
import { generationRequiresRequirementSnapshot } from "@/lib/estimate/component-authority";
import { buildLineItemNotes } from "@/lib/estimate/line-items";
import {
  buildPersistEstimateGenerationV1,
  isAtomicPersistRpcUnavailable,
  persistEstimateGenerationViaRpc,
} from "@/lib/estimate/persist-estimate-generation";
import {
  buildSnapshotPayloadForEstimate,
  createGenerationId,
} from "@/lib/estimate/requirement-snapshot-persist";
import { createSupabaseRequirementSnapshotStore } from "@/lib/estimate/requirement-snapshot-store";
import type { EstimateResult } from "@/lib/estimate/types";
import { toUserError, USER_ERRORS } from "@/lib/errors/user-message";

type PersistEstimateSnapshot =
  | {
      ok: true;
      generationId: string;
      snapshotId: string;
      schemaVersion: string;
    }
  | { ok: false; generationId: string; reason: string };

type PersistEstimateResult =
  | { success: true; estimateId: string; snapshot: PersistEstimateSnapshot }
  | { error: string };

function buildEstimatePayload(
  orgId: string,
  projectId: string,
  estimateResult: EstimateResult,
  status: "draft" | "ready" | "failed",
  isStale: boolean,
  generationId: string | null,
  latestSnapshotId: string | null
) {
  // REQ-4A: append-only requirement snapshots, not editable requirement rows.
  // Requirement objects are not commercial authority and are not written onto
  // estimate_line_items. Do not persist requirement rows onto estimates.
  return {
    org_id: orgId,
    project_id: projectId,
    status,
    is_stale: isStale,
    cost_low: estimateResult.costLow,
    cost_high: estimateResult.costHigh,
    sell_low: estimateResult.sellLow,
    sell_high: estimateResult.sellHigh,
    recommended_cost: estimateResult.recommendedCost,
    recommended_sell: estimateResult.recommendedSell,
    gross_profit: estimateResult.grossProfit,
    margin_percent: estimateResult.marginPercent,
    markup_percent: estimateResult.markupPercent,
    confidence: estimateResult.confidence,
    rate_source_summary: estimateResult.rateSourceSummary,
    assumptions: estimateResult.assumptions,
    missing_info: estimateResult.missingInfo,
    exclusions: estimateResult.exclusions,
    assumption_metadata: estimateResult.assumptionMetadata ?? {},
    generated_at: new Date().toISOString(),
    calibration_version: CURRENT_CALIBRATION_VERSION,
    requirement_generation_id: generationId,
    latest_requirement_snapshot_id: latestSnapshotId,
  };
}

function withoutSnapshotLinkColumns<T extends Record<string, unknown>>(
  payload: T
): Omit<
  T,
  "requirement_generation_id" | "latest_requirement_snapshot_id"
> {
  const rest = { ...payload };
  delete rest.requirement_generation_id;
  delete rest.latest_requirement_snapshot_id;
  return rest;
}

function isMissingSnapshotSchemaError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("requirement_generation_id") ||
    message.includes("latest_requirement_snapshot_id") ||
    message.includes("estimate_requirement_snapshots")
  );
}

async function markEstimateFailed(
  supabase: SupabaseClient,
  estimateId: string
): Promise<void> {
  await supabase
    .from("estimates")
    .update({ status: "failed", is_stale: true })
    .eq("id", estimateId);
}

async function markPricingRecalibration(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string
): Promise<void> {
  const { markPricingDocumentsNeedingRecalibration } = await import(
    "@/lib/pricing/recalibration"
  );
  await markPricingDocumentsNeedingRecalibration(supabase, orgId, projectId);
}

/**
 * SHADOW/legacy compatibility only. Never used when any component is
 * REQUIREMENT_AUTHORITATIVE. Prefer persist_estimate_generation_v1.
 */
async function persistEstimateResultLegacyMultiCall(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  estimateResult: EstimateResult,
  generationId: string
): Promise<PersistEstimateResult> {
  const snapshotStore = createSupabaseRequirementSnapshotStore(supabase);
  const lineItemRows = estimateResult.lineItems.map((item) => ({
    org_id: orgId,
    project_id: projectId,
    work_area_id: item.workAreaId,
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
    markup_percent: item.markupPercent ?? null,
    rate_source: item.rateSource,
    notes: buildLineItemNotes(item),
    sort_order: item.sortOrder,
    component_key: item.componentKey ?? null,
  }));

  let snapshotSchemaAvailable = true;

  async function writeEstimateRow(
    payload: ReturnType<typeof buildEstimatePayload>,
    existingId: string | null
  ): Promise<{ id?: string; error: { message: string } | null }> {
    const attempt = snapshotSchemaAvailable
      ? payload
      : withoutSnapshotLinkColumns(payload);
    if (existingId) {
      const { error } = await supabase
        .from("estimates")
        .update(attempt)
        .eq("id", existingId);
      if (error && snapshotSchemaAvailable && isMissingSnapshotSchemaError(error.message)) {
        snapshotSchemaAvailable = false;
        const retry = await supabase
          .from("estimates")
          .update(withoutSnapshotLinkColumns(payload))
          .eq("id", existingId);
        return { error: retry.error };
      }
      return { error };
    }
    const { data, error } = await supabase
      .from("estimates")
      .insert(attempt)
      .select("id")
      .single();
    if (error && snapshotSchemaAvailable && isMissingSnapshotSchemaError(error.message)) {
      snapshotSchemaAvailable = false;
      const retry = await supabase
        .from("estimates")
        .insert(withoutSnapshotLinkColumns(payload))
        .select("id")
        .single();
      return { id: retry.data?.id, error: retry.error };
    }
    return { id: data?.id, error };
  }

  const { data: existingEstimate } = await supabase
    .from("estimates")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  let estimateId: string;

  if (existingEstimate) {
    estimateId = existingEstimate.id;
    const staging = await writeEstimateRow(
      buildEstimatePayload(
        orgId,
        projectId,
        estimateResult,
        "draft",
        true,
        generationId,
        null
      ),
      estimateId
    );
    if (staging.error) {
      return {
        error: toUserError(
          staging.error,
          "persistEstimate-staging",
          USER_ERRORS.estimateSaveFailed
        ),
      };
    }
  } else {
    const inserted = await writeEstimateRow(
      buildEstimatePayload(
        orgId,
        projectId,
        estimateResult,
        "draft",
        true,
        generationId,
        null
      ),
      null
    );
    if (inserted.error || !inserted.id) {
      return {
        error: toUserError(
          inserted.error,
          "persistEstimate-insert",
          USER_ERRORS.estimateSaveFailed
        ),
      };
    }
    estimateId = inserted.id;
  }

  const { error: deleteError } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", estimateId);

  if (deleteError) {
    await markEstimateFailed(supabase, estimateId);
    return {
      error: toUserError(
        deleteError,
        "persistEstimate-delete-line-items",
        USER_ERRORS.estimateSaveFailed
      ),
    };
  }

  if (lineItemRows.length > 0) {
    const { error: lineItemsError } = await supabase
      .from("estimate_line_items")
      .insert(
        lineItemRows.map((row) => ({
          ...row,
          estimate_id: estimateId,
        }))
      );

    if (lineItemsError) {
      await markEstimateFailed(supabase, estimateId);
      return {
        error: toUserError(
          lineItemsError,
          "persistEstimate-insert-line-items",
          USER_ERRORS.estimateSaveFailed
        ),
      };
    }
  }

  let snapshot: PersistEstimateSnapshot = {
    ok: false,
    generationId,
    reason: snapshotSchemaAvailable ? "not_attempted" : "schema_unavailable",
  };
  if (snapshotSchemaAvailable) {
    try {
      const payload = buildSnapshotPayloadForEstimate({
        generationId,
        result: estimateResult,
      });
      const inserted = await snapshotStore.insert({
        orgId,
        projectId,
        estimateId,
        generationId,
        payload,
      });
      snapshot = {
        ok: true,
        generationId,
        snapshotId: inserted.id,
        schemaVersion: inserted.schemaVersion,
      };
    } catch (error) {
      snapshot = {
        ok: false,
        generationId,
        reason:
          error instanceof Error
            ? error.message
            : "requirement snapshot insert failed",
      };
    }
  }

  const finalize = await writeEstimateRow(
    buildEstimatePayload(
      orgId,
      projectId,
      estimateResult,
      "ready",
      false,
      generationId,
      snapshot.ok ? snapshot.snapshotId : null
    ),
    estimateId
  );

  if (finalize.error) {
    await markEstimateFailed(supabase, estimateId);
    return {
      error: toUserError(
        finalize.error,
        "persistEstimate-finalize",
        USER_ERRORS.estimateSaveFailed
      ),
    };
  }

  await markPricingRecalibration(supabase, orgId, projectId);

  return { success: true, estimateId, snapshot };
}

export async function persistEstimateResult(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  estimateResult: EstimateResult
): Promise<PersistEstimateResult> {
  const generationId = createGenerationId();
  const payload = buildPersistEstimateGenerationV1({
    projectId,
    generationId,
    estimateResult,
  });

  const rpc = await persistEstimateGenerationViaRpc(supabase, payload);
  if (rpc.ok) {
    await markPricingRecalibration(supabase, orgId, projectId);
    return {
      success: true,
      estimateId: rpc.result.estimate_id,
      snapshot: {
        ok: true,
        generationId: rpc.result.generation_id,
        snapshotId: rpc.result.snapshot_id,
        schemaVersion:
          typeof payload.snapshot.schemaVersion === "string"
            ? payload.snapshot.schemaVersion
            : "estimate-requirement-snapshot-v1",
      },
    };
  }

  if (
    isAtomicPersistRpcUnavailable(rpc.message) &&
    !generationRequiresRequirementSnapshot()
  ) {
    return persistEstimateResultLegacyMultiCall(
      supabase,
      orgId,
      projectId,
      estimateResult,
      generationId
    );
  }

  return {
    error: toUserError(
      rpc.message,
      "persistEstimate-atomic",
      USER_ERRORS.estimateSaveFailed
    ),
  };
}
