import { notFound } from "next/navigation";
import { buildAssistantState } from "@/lib/assistant/mappers";
import {
  ASSISTANT_ESTIMATE_COLUMNS,
  ASSISTANT_LINE_ITEM_COLUMNS,
  ASSISTANT_WORK_AREA_COLUMNS,
} from "@/lib/assistant/estimate-generation-result";
import type { AssistantState } from "@/lib/assistant/types";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { parseEstimateRequirementSnapshot } from "@/lib/estimate/requirement-snapshot";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import {
  getAuthOrgContext,
  requireAuthOrgContext,
  type AuthOrgContext,
} from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";

export {
  assertStage,
  canRunStageAction,
  isStageAtOrBeyond,
  stageIndex,
} from "@/lib/assistant/stage";

/**
 * Compatibility re-export of the authoritative auth-org helper.
 * Implementation lives in `lib/security/auth-org-context.ts`.
 */
export { getAuthOrgContext, requireAuthOrgContext };

export async function getAssistantStateWithContext(
  auth: AuthOrgContext,
  projectId: string
): Promise<AssistantState> {
  // Soft-deleted projects are not found — children stay stored but hidden from
  // normal active assistant queries (Batch 2A.4 / S1-017).
  const owned = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in owned) {
    notFound();
  }

  const { supabase, orgId } = auth;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, stage, brief_text, quality_level")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (projectError) {
    console.error("[getAssistantState] project query failed:", projectError.message);
    notFound();
  }

  if (!project) {
    notFound();
  }

  const [
    { data: workAreas },
    { data: questionBlocks },
    { data: questions },
    { data: constraints },
    { data: estimate },
    { data: projectFacts },
    { data: organisationSettings },
  ] = await Promise.all([
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
      .select(
        "id, question_block_id, work_area_id, key, label, question_text, input_type, options, required, unit, answer_value, sort_order"
      )
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
    supabase
      .from("organisation_settings")
      .select("default_margin_percent, default_gst_rate")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  const { data: lineItems } = estimate?.id
    ? await supabase
        .from("estimate_line_items")
        .select(ASSISTANT_LINE_ITEM_COLUMNS)
        .eq("estimate_id", estimate.id)
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true })
    : { data: [] };

  let requirementSnapshotRequirements: readonly EstimateRequirement[] = [];
  const snapshotId =
    estimate &&
    "latest_requirement_snapshot_id" in estimate &&
    typeof estimate.latest_requirement_snapshot_id === "string"
      ? estimate.latest_requirement_snapshot_id
      : null;
  if (snapshotId) {
    const { data: snapshotRow } = await supabase
      .from("estimate_requirement_snapshots")
      .select("payload")
      .eq("id", snapshotId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (snapshotRow?.payload) {
      try {
        requirementSnapshotRequirements =
          parseEstimateRequirementSnapshot(snapshotRow.payload).requirements;
      } catch {
        requirementSnapshotRequirements = [];
      }
    }
  }

  return buildAssistantState({
    project,
    workAreas: workAreas ?? [],
    questionBlocks: questionBlocks ?? [],
    questions: questions ?? [],
    constraints: constraints ?? [],
    estimate: estimate ?? null,
    lineItems: lineItems ?? [],
    projectFacts: projectFacts ?? [],
    defaultMarginPercent:
      organisationSettings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT,
    defaultGstRate: Number(organisationSettings?.default_gst_rate ?? 15),
    requirementSnapshotRequirements,
  });
}

export async function getAssistantState(
  projectId: string
): Promise<AssistantState> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    notFound();
  }
  return getAssistantStateWithContext(auth, projectId);
}
