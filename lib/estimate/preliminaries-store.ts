import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganisationRate } from "@/components/setup/types";
import { upsertScopedFact } from "@/lib/assistant/scope-persistence";
import {
  planFromFacts,
  PRELIMINARIES_FACT_KEY,
  PRELIMINARIES_WORK_AREA_NAME,
  PRELIMINARIES_WORK_AREA_TYPE,
} from "@/lib/estimate/preliminaries";
import type { EstimateContext } from "@/lib/estimate/types";

/** Company labour rows generation uses. Sell is omitted; preliminaries derive sell from margin. */
export async function loadCaptureLabourRates(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrganisationRate[]> {
  const { data } = await supabase
    .from("rates")
    .select(
      "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, active"
    )
    .eq("org_id", orgId)
    .eq("active", true)
    .eq("rate_type", "labour");
  return (data ?? []).flatMap((row) => {
    const cost = Number(row.cost_rate);
    if (!row.item_key || !Number.isFinite(cost) || cost <= 0) return [];
    const rate: OrganisationRate = {
      id: String(row.id),
      rate_type: "labour",
      trade: typeof row.trade === "string" ? row.trade : null,
      work_area_type: typeof row.work_area_type === "string" ? row.work_area_type : null,
      item_key: String(row.item_key),
      label: typeof row.label === "string" ? row.label : "Labour",
      unit: typeof row.unit === "string" && row.unit ? row.unit : "h",
      cost_rate: cost,
      sell_rate: null,
      markup_percent: null,
      active: true,
    };
    return [rate];
  });
}

export async function preparePreliminariesForEstimate(params: {
  supabase: SupabaseClient;
  orgId: string;
  projectId: string;
  context: EstimateContext;
}): Promise<{ context: EstimateContext } | { error: string }> {
  const plan = planFromFacts(
    params.context.facts,
    params.context.briefText,
    params.context.confirmedWorkAreas
      .map((area) => area.quoteDescription?.trim() ?? "")
      .filter((text) => text.length > 0)
  );
  if (plan.items.length === 0 && !plan.deliveryWindow && (plan.reviews ?? []).length === 0) {
    return { context: params.context };
  }

  const saved = await upsertScopedFact(params.supabase, {
    orgId: params.orgId,
    projectId: params.projectId,
    workAreaId: null,
    key: PRELIMINARIES_FACT_KEY,
    label: "Preliminaries",
    value: plan,
    source: "user",
  });
  if (!saved.ok) return { error: saved.error };

  const facts = params.context.facts.filter(
    (fact) => !(fact.work_area_id == null && fact.key === PRELIMINARIES_FACT_KEY)
  );
  facts.push({
    key: PRELIMINARIES_FACT_KEY,
    work_area_id: null,
    value: plan,
    source: "user",
  });

  if (plan.items.length === 0) {
    return { context: { ...params.context, facts } };
  }

  const { data: existing, error: existingError } = await params.supabase
    .from("work_areas")
    .select("id, type, name, summary, status, sort_order")
    .eq("project_id", params.projectId)
    .eq("org_id", params.orgId)
    .eq("type", PRELIMINARIES_WORK_AREA_TYPE)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) return { error: existingError.message };

  let area = existing;
  if (area && area.status === "excluded") {
    return { context: { ...params.context, facts } };
  }
  if (area && area.status !== "confirmed") {
    const { error } = await params.supabase
      .from("work_areas")
      .update({ status: "confirmed", name: PRELIMINARIES_WORK_AREA_NAME })
      .eq("id", area.id)
      .eq("project_id", params.projectId);
    if (error) return { error: error.message };
    area = { ...area, status: "confirmed", name: PRELIMINARIES_WORK_AREA_NAME };
  }
  if (!area) {
    const { data: inserted, error } = await params.supabase
      .from("work_areas")
      .insert({
        org_id: params.orgId,
        project_id: params.projectId,
        type: PRELIMINARIES_WORK_AREA_TYPE,
        name: PRELIMINARIES_WORK_AREA_NAME,
        status: "confirmed",
        sort_order: 900,
      })
      .select("id, type, name, summary, status, sort_order")
      .single();
    if (error || !inserted) return { error: error?.message ?? "Could not add preliminaries." };
    area = inserted;
  }

  const confirmedWorkAreas = params.context.confirmedWorkAreas.filter(
    (row) => row.id !== area.id
  );
  confirmedWorkAreas.push({
    id: area.id,
    type: area.type,
    name: area.name,
    summary: area.summary,
    sort_order: area.sort_order ?? 900,
  });

  return {
    context: {
      ...params.context,
      facts,
      confirmedWorkAreas,
    },
  };
}
