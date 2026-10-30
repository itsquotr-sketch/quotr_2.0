import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertScopedFact } from "@/lib/assistant/scope-persistence";
import {
  planFromFacts,
  PRELIMINARIES_FACT_KEY,
  PRELIMINARIES_WORK_AREA_NAME,
  PRELIMINARIES_WORK_AREA_TYPE,
} from "@/lib/estimate/preliminaries";
import type { EstimateContext } from "@/lib/estimate/types";

export async function preparePreliminariesForEstimate(params: {
  supabase: SupabaseClient;
  orgId: string;
  projectId: string;
  context: EstimateContext;
}): Promise<{ context: EstimateContext } | { error: string }> {
  const plan = planFromFacts(params.context.facts, params.context.briefText);
  if (plan.items.length === 0 && !plan.deliveryWindow) {
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
