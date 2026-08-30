import "server-only";

import { buildAssistantMutationResult } from "@/lib/assistant/assistant-mutation-result";
import { ASSISTANT_ESTIMATE_COLUMNS, ASSISTANT_WORK_AREA_COLUMNS } from "@/lib/assistant/estimate-generation-result";
import { buildAssistantState } from "@/lib/assistant/mappers";
import type { AssistantMutationResult } from "@/lib/assistant/types";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";

export type LoadAssistantMutationError = { error: string };

const ASSISTANT_QUESTION_COLUMNS =
  "id, question_block_id, work_area_id, key, label, question_text, input_type, options, required, unit, answer_value, sort_order";

/**
 * Re-read persisted Assistant fact/question/constraint/stale state the same
 * way SSR does, after the canonical mutation writes have finished.
 * Does not load estimate line items — fact mutation does not regenerate money.
 */
export async function loadAssistantMutationResult(
  auth: AuthOrgContext,
  projectId: string
): Promise<AssistantMutationResult | LoadAssistantMutationError> {
  const owned = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in owned) {
    return { error: "Project not found." };
  }

  const { supabase, orgId } = auth;

  const [
    { data: project },
    { data: workAreas },
    { data: questionBlocks },
    { data: questions },
    { data: constraints },
    { data: estimate },
    { data: projectFacts },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, stage, brief_text, quality_level")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("work_areas")
      .select(ASSISTANT_WORK_AREA_COLUMNS)
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("question_blocks")
      .select("id, stage, title, description, status, sort_order, created_at")
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("questions")
      .select(ASSISTANT_QUESTION_COLUMNS)
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("constraints")
      .select("id, key, label, value, source, created_at")
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("estimates")
      .select(ASSISTANT_ESTIMATE_COLUMNS)
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("project_facts")
      .select("key, work_area_id, value, source")
      .eq("project_id", projectId)
      .eq("org_id", orgId),
  ]);

  if (!project) {
    return { error: "Project not found." };
  }

  const state = buildAssistantState({
    project,
    workAreas: workAreas ?? [],
    questionBlocks: questionBlocks ?? [],
    questions: questions ?? [],
    constraints: constraints ?? [],
    estimate: estimate ?? null,
    lineItems: [],
    projectFacts: projectFacts ?? [],
    defaultMarginPercent: DEFAULT_MARGIN_PERCENT,
  });

  return buildAssistantMutationResult({
    projectId,
    state,
    estimateStale: Boolean(estimate?.is_stale),
    hasEstimate: Boolean(estimate?.id),
  });
}
