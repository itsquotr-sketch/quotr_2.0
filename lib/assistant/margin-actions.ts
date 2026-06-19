"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import {
  applyMarginToAmounts,
  sumLineItemTotals,
  validateTargetMarginPercent,
} from "@/lib/estimate/margin-override";
import { getDefaultMarginPercent } from "@/lib/estimate/rates";
import type { OrganisationSettings } from "@/components/setup/types";

const updateMarginSchema = z.object({
  projectId: z.string().uuid(),
  targetMarginPercent: z.number().nullable(),
});

const DEFAULT_ORGANISATION_SETTINGS: OrganisationSettings = {
  id: "",
  org_id: "",
  default_margin_percent: 33.33,
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

function revalidateAssistantPaths(projectId: string) {
  revalidatePath("/app/dashboard");
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

  if (targetMarginPercent != null) {
    const validationError = validateTargetMarginPercent(targetMarginPercent);
    if (validationError) {
      return { error: validationError };
    }
  }

  const [{ data: estimate }, { data: organisationSettings }] = await Promise.all([
    supabase
      .from("estimates")
      .select("id")
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

  const { data: lineItems } = await supabase
    .from("estimate_line_items")
    .select(
      "id, recommended_cost, cost_low, cost_high, sell_low, sell_high, recommended_sell, gross_profit, margin_percent, markup_percent"
    )
    .eq("estimate_id", estimate.id)
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
      ...amounts,
    };
  });

  for (const item of updatedLineItems) {
    const { error } = await supabase
      .from("estimate_line_items")
      .update({
        recommended_sell: item.recommendedSell,
        sell_low: item.sellLow,
        sell_high: item.sellHigh,
        gross_profit: item.grossProfit,
        margin_percent: item.marginPercent,
        markup_percent: item.markupPercent,
      })
      .eq("id", item.id)
      .eq("estimate_id", estimate.id);

    if (error) {
      return { error: error.message };
    }
  }

  const totals = sumLineItemTotals(updatedLineItems);

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

  revalidateAssistantPaths(projectId);
  return { success: true };
}
