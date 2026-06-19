import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLineItemNotes } from "@/lib/estimate/line-items";
import type { EstimateResult } from "@/lib/estimate/types";

type PersistEstimateResult =
  | { success: true; estimateId: string }
  | { error: string };

export async function persistEstimateResult(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  estimateResult: EstimateResult
): Promise<PersistEstimateResult> {
  const estimatePayload = {
    org_id: orgId,
    project_id: projectId,
    status: "ready",
    is_stale: false,
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
    const { error: updateError } = await supabase
      .from("estimates")
      .update(estimatePayload)
      .eq("id", existingEstimate.id);

    if (updateError) {
      return { error: updateError.message };
    }
    estimateId = existingEstimate.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("estimates")
      .insert(estimatePayload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { error: insertError?.message ?? "Failed to save estimate." };
    }
    estimateId = inserted.id;
  }

  const { error: deleteError } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", estimateId);

  if (deleteError) {
    return { error: deleteError.message };
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
      return { error: lineItemsError.message };
    }
  }

  return { success: true, estimateId };
}
