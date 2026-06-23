import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLineItemNotes } from "@/lib/estimate/line-items";
import type { EstimateResult } from "@/lib/estimate/types";
import { toUserError, USER_ERRORS } from "@/lib/errors/user-message";

type PersistEstimateResult =
  | { success: true; estimateId: string }
  | { error: string };

function buildEstimatePayload(
  orgId: string,
  projectId: string,
  estimateResult: EstimateResult,
  status: "draft" | "ready" | "failed",
  isStale: boolean
) {
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
    generated_at: new Date().toISOString(),
  };
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

export async function persistEstimateResult(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  estimateResult: EstimateResult
): Promise<PersistEstimateResult> {
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
  }));

  const { data: existingEstimate } = await supabase
    .from("estimates")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  let estimateId: string;

  if (existingEstimate) {
    estimateId = existingEstimate.id;

    const { error: stagingError } = await supabase
      .from("estimates")
      .update(
        buildEstimatePayload(orgId, projectId, estimateResult, "draft", true)
      )
      .eq("id", estimateId);

    if (stagingError) {
      return {
        error: toUserError(
          stagingError,
          "persistEstimate-staging",
          USER_ERRORS.estimateSaveFailed
        ),
      };
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("estimates")
      .insert(
        buildEstimatePayload(orgId, projectId, estimateResult, "draft", true)
      )
      .select("id")
      .single();

    if (insertError || !inserted) {
      return {
        error: toUserError(
          insertError,
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

  const { error: finalizeError } = await supabase
    .from("estimates")
    .update(
      buildEstimatePayload(orgId, projectId, estimateResult, "ready", false)
    )
    .eq("id", estimateId);

  if (finalizeError) {
    await markEstimateFailed(supabase, estimateId);
    return {
      error: toUserError(
        finalizeError,
        "persistEstimate-finalize",
        USER_ERRORS.estimateSaveFailed
      ),
    };
  }

  const { markPricingDocumentsNeedingRecalibration } = await import(
    "@/lib/pricing/recalibration"
  );
  await markPricingDocumentsNeedingRecalibration(supabase, orgId, projectId);

  return { success: true, estimateId };
}
