"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  applyMarginToAmounts,
  sumLineItemTotals,
  validateTargetMarginPercent,
} from "@/lib/estimate/margin-override";
import { getDefaultMarginPercent } from "@/lib/estimate/rates";
import { assertOrgOwnsProject } from "@/lib/security/org-ownership";
import type { OrganisationSettings } from "@/components/setup/types";

const updateMarginSchema = z.object({
  projectId: z.string().uuid(),
  targetMarginPercent: z.number().nullable(),
});

const DEFAULT_ORGANISATION_SETTINGS: OrganisationSettings = {
  id: "",
  org_id: "",
  default_margin_percent: DEFAULT_MARGIN_PERCENT,
  default_contingency_percent: 10,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};

function revalidateProjectPath(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
}

export async function updateEstimateMargin(
  input: z.infer<typeof updateMarginSchema>
): Promise<AssistantActionState> {
  const parsed = updateMarginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid margin update." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const { projectId, targetMarginPercent } = parsed.data;

  const ownedProject = await assertOrgOwnsProject(context, projectId);
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
  }

  if (targetMarginPercent != null) {
    const validationError = validateTargetMarginPercent(targetMarginPercent);
    if (validationError) {
      return { error: validationError };
    }
  }

  const [{ data: estimate }, { data: organisationSettings }] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, is_stale")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("organisation_settings")
      .select(
        "id, org_id, default_margin_percent, default_contingency_percent, budget_rate_factor, premium_rate_factor, currency, country, region, onboarding_status, onboarding_step, onboarding_completed_at, prefer_user_rates, allow_benchmark_rates, show_profit_in_estimates"
      )
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  if (!estimate) {
    return { error: "No estimate exists for this project yet." };
  }

  if (estimate.is_stale) {
    return { error: "Regenerate the estimate before adjusting margin." };
  }

  const { data: lineItems } = await supabase
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", estimate.id)
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true });

  if (!lineItems?.length) {
    return { error: "Estimate has no line items to update." };
  }

  const settings = organisationSettings ?? DEFAULT_ORGANISATION_SETTINGS;
  const marginPercent =
    targetMarginPercent ?? getDefaultMarginPercent(settings);

  const updatedLineItems = lineItems.map((item) => {
    const amounts = applyMarginToAmounts(
      Number(item.recommended_cost ?? 0),
      marginPercent,
      settings
    );

    return {
      id: item.id,
      org_id: item.org_id,
      project_id: item.project_id,
      estimate_id: item.estimate_id,
      work_area_id: item.work_area_id,
      work_area_name: item.work_area_name,
      label: item.label,
      category: item.category,
      cost_low: amounts.costLow,
      cost_high: amounts.costHigh,
      recommended_cost: amounts.recommendedCost,
      sell_low: amounts.sellLow,
      sell_high: amounts.sellHigh,
      recommended_sell: amounts.recommendedSell,
      gross_profit: amounts.grossProfit,
      margin_percent: amounts.marginPercent,
      markup_percent: amounts.markupPercent,
      rate_source: item.rate_source,
      notes: item.notes,
      sort_order: item.sort_order,
    };
  });

  const { error: upsertError } = await supabase
    .from("estimate_line_items")
    .upsert(updatedLineItems, { onConflict: "id" });

  if (upsertError) {
    return { error: upsertError.message };
  }

  const totals = sumLineItemTotals(
    updatedLineItems.map((item) => ({
      recommendedCost: item.recommended_cost,
      recommendedSell: item.recommended_sell,
      grossProfit: item.gross_profit,
      costLow: item.cost_low,
      costHigh: item.cost_high,
      sellLow: item.sell_low,
      sellHigh: item.sell_high,
    }))
  );

  const { error: estimateError } = await supabase
    .from("estimates")
    .update({
      target_margin_percent: targetMarginPercent,
      recommended_sell: totals.recommendedSell,
      sell_low: totals.sellLow,
      sell_high: totals.sellHigh,
      gross_profit: totals.grossProfit,
      margin_percent: totals.marginPercent,
      markup_percent: totals.markupPercent,
    })
    .eq("id", estimate.id)
    .eq("project_id", projectId);

  if (estimateError) {
    return { error: estimateError.message };
  }

  revalidateProjectPath(projectId);
  return { success: true };
}
