import "server-only";

import type { AssistantStage } from "@/components/assistant/types";
import {
  ASSISTANT_ESTIMATE_COLUMNS,
  ASSISTANT_LINE_ITEM_COLUMNS,
  ASSISTANT_WORK_AREA_COLUMNS,
  buildEstimateGenerationResult,
  type EstimateGenerationResult,
  type PersistedEstimateRow,
  type PersistedLineItemRow,
  type PersistedWorkAreaRow,
} from "@/lib/assistant/estimate-generation-result";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import { getLatestPricingSummaryWithContext } from "@/lib/pricing/pricing-loaders";

export type LoadEstimateGenerationError = { error: string };

/**
 * Re-read the persisted estimate the same way SSR does, after
 * persist_estimate_generation_v1 has committed. Never builds commercial
 * totals from in-memory calculator output.
 */
export async function loadEstimateGenerationResult(
  auth: AuthOrgContext,
  projectId: string,
  options?: { generationId?: string | null }
): Promise<EstimateGenerationResult | LoadEstimateGenerationError> {
  const owned = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in owned) {
    return { error: "Project not found." };
  }

  const { supabase, orgId } = auth;

  const [
    { data: project },
    { data: workAreas },
    { data: estimate },
    pricingSummary,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, stage")
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
      .from("estimates")
      .select(ASSISTANT_ESTIMATE_COLUMNS)
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    getLatestPricingSummaryWithContext(auth, projectId),
  ]);

  if (!project) {
    return { error: "Project not found." };
  }

  if (!estimate?.id) {
    return { error: "Estimate not found." };
  }

  const { data: lineItems } = await supabase
    .from("estimate_line_items")
    .select(ASSISTANT_LINE_ITEM_COLUMNS)
    .eq("estimate_id", estimate.id)
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true });

  let snapshotPayload: unknown;
  const snapshotId =
    estimate.latest_requirement_snapshot_id &&
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
    snapshotPayload = snapshotRow?.payload;
  }

  return buildEstimateGenerationResult({
    projectId,
    stage: project.stage as AssistantStage,
    estimateRow: estimate as PersistedEstimateRow,
    lineItems: (lineItems ?? []) as PersistedLineItemRow[],
    workAreas: (workAreas ?? []) as PersistedWorkAreaRow[],
    snapshotPayload,
    generationId:
      options?.generationId ??
      (typeof estimate.requirement_generation_id === "string"
        ? estimate.requirement_generation_id
        : null),
    pricingSummary,
  });
}
