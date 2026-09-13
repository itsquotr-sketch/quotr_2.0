import "server-only";

import {
  planAssistantMutationResultReloads,
  type AssistantMutationResultReuse,
} from "@/lib/assistant/assistant-mutation-result-reload";
import { buildAssistantMutationResult } from "@/lib/assistant/assistant-mutation-result";
import { ASSISTANT_ESTIMATE_COLUMNS, ASSISTANT_WORK_AREA_COLUMNS } from "@/lib/assistant/estimate-generation-result";
import { buildAssistantState } from "@/lib/assistant/mappers";
import type { AssistantMutationResult } from "@/lib/assistant/types";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import { loadOrganisationSettingsRow } from "@/lib/settings/organisation-settings-reader";

export type LoadAssistantMutationError = { error: string };

const ASSISTANT_QUESTION_COLUMNS =
  "id, question_block_id, work_area_id, key, label, question_text, input_type, options, required, unit, answer_value, sort_order";

/**
 * Re-read persisted Assistant fact/question/constraint/stale state the same
 * way SSR does, after the canonical mutation writes have finished.
 * Does not load estimate line items — fact mutation does not regenerate money.
 *
 * PERFORMANCE-01C-4 — ownership, project_facts, estimates, questions, and
 * project rows stay fresh. organisation_settings uses the 01B request-scoped
 * reader. work_areas may be threaded from the scalar Details path only.
 */
export async function loadAssistantMutationResult(
  auth: AuthOrgContext,
  projectId: string,
  reuse?: AssistantMutationResultReuse | null
): Promise<AssistantMutationResult | LoadAssistantMutationError> {
  const owned = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in owned) {
    return { error: "Project not found." };
  }

  const plan = planAssistantMutationResultReloads(reuse);
  const { supabase, orgId } = auth;
  const reusedWorkAreas = plan.workAreas === "reuse" ? reuse?.workAreas ?? [] : null;

  const [
    { data: project },
    workAreasResult,
    { data: questionBlocks },
    { data: questions },
    { data: constraints },
    { data: estimate },
    { data: projectFacts },
    organisationSettings,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, stage, brief_text, quality_level")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    reusedWorkAreas
      ? Promise.resolve({ data: reusedWorkAreas })
      : supabase
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
    loadOrganisationSettingsRow(orgId),
  ]);

  if (!project) {
    return { error: "Project not found." };
  }

  const workAreas = [...(workAreasResult.data ?? [])] as Array<{
    id: string;
    type: string;
    name: string;
    status: string;
    ai_confidence: number | null;
    summary: string | null;
    quote_description: string | null;
    sort_order: number;
  }>;

  const state = buildAssistantState({
    project,
    workAreas,
    questionBlocks: questionBlocks ?? [],
    questions: questions ?? [],
    constraints: constraints ?? [],
    estimate: estimate ?? null,
    lineItems: [],
    projectFacts: projectFacts ?? [],
    defaultMarginPercent:
      (organisationSettings?.default_margin_percent as number | null | undefined) ??
      DEFAULT_MARGIN_PERCENT,
    defaultGstRate: Number(organisationSettings?.default_gst_rate ?? 15),
  });

  return buildAssistantMutationResult({
    projectId,
    state,
    estimateStale: Boolean(estimate?.is_stale),
    hasEstimate: Boolean(estimate?.id),
  });
}
