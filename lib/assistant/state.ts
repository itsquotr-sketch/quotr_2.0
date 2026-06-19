import { notFound } from "next/navigation";
import { buildAssistantState } from "@/lib/assistant/mappers";
import type { AssistantState } from "@/lib/assistant/types";
import { createClient } from "@/lib/supabase/server";

export {
  assertStage,
  canRunStageAction,
  isStageAtOrBeyond,
  stageIndex,
} from "@/lib/assistant/stage";

async function getAuthOrgContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return null;
  }

  return { supabase, user, orgId: profile.org_id };
}

export async function getAssistantState(
  projectId: string
): Promise<AssistantState> {
  const context = await getAuthOrgContext();
  if (!context) {
    notFound();
  }

  const { supabase } = context;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, stage, brief_text, quality_level")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    notFound();
  }

  const [
    { data: workAreas },
    { data: questionBlocks },
    { data: questions },
    { data: constraints },
    { data: estimate },
    { data: projectFacts },
  ] = await Promise.all([
    supabase
      .from("work_areas")
      .select(
        "id, type, name, status, ai_confidence, summary, sort_order, created_at"
      )
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("question_blocks")
      .select("id, stage, title, description, status, sort_order, created_at")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("questions")
      .select(
        "id, question_block_id, work_area_id, key, label, question_text, input_type, options, required, unit, answer_value, sort_order"
      )
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("constraints")
      .select("id, key, label, value, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("estimates")
      .select(
        "id, cost_low, cost_high, sell_low, sell_high, recommended_cost, recommended_sell, gross_profit, margin_percent, markup_percent, confidence, rate_source_summary, assumptions, missing_info, exclusions"
      )
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("project_facts")
      .select("key, work_area_id, value, source")
      .eq("project_id", projectId),
  ]);

  const { data: lineItems } = estimate?.id
    ? await supabase
        .from("estimate_line_items")
        .select(
          "id, work_area_name, label, category, cost_low, cost_high, sell_low, sell_high, recommended_cost, recommended_sell, gross_profit, margin_percent, markup_percent, rate_source, notes, sort_order"
        )
        .eq("estimate_id", estimate.id)
        .order("sort_order", { ascending: true })
    : { data: [] };

  return buildAssistantState({
    project,
    workAreas: workAreas ?? [],
    questionBlocks: questionBlocks ?? [],
    questions: questions ?? [],
    constraints: constraints ?? [],
    estimate: estimate ?? null,
    lineItems: lineItems ?? [],
    projectFacts: projectFacts ?? [],
  });
}

export { getAuthOrgContext };
