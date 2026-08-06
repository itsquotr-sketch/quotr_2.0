import { mapDecisionInsert } from "./mappers";
import {
  assertProjectOwnedByOrg,
  mapDbError,
  type PersistenceAuthContext,
} from "./context";
import {
  PERSISTENCE_ERROR_CODES,
  ScopeDiscoveryPersistenceError,
} from "./errors";
import type {
  PersistDecisionInput,
  ScopeDiscoveryDecisionRow,
} from "./types";

/**
 * Append a decision event.
 * Does not create Work Areas — createdWorkAreaId must remain null in this batch.
 */
export async function insertDiscoveryDecision(
  ctx: PersistenceAuthContext,
  input: PersistDecisionInput
): Promise<ScopeDiscoveryDecisionRow> {
  if (input.createdWorkAreaId !== null) {
    throw new ScopeDiscoveryPersistenceError(
      PERSISTENCE_ERROR_CODES.VALIDATION_FAILED,
      "Work Area creation from discovery decisions is not enabled in this batch."
    );
  }

  await assertProjectOwnedByOrg(ctx, input.projectId);

  const row = mapDecisionInsert(input, ctx.orgId, ctx.userId);
  const { data, error } = await ctx.supabase
    .from("scope_discovery_decisions")
    .insert(row)
    .select(
      "id, org_id, project_id, suggestion_id, decision_type, decided_by, decided_at"
    )
    .single();

  if (error || !data) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to persist discovery decision."
      )
    );
  }

  return data as ScopeDiscoveryDecisionRow;
}

export async function listDecisionsForSuggestion(
  ctx: PersistenceAuthContext,
  suggestionId: string
): Promise<readonly DiscoveryDecisionDetailRow[]> {
  const { data, error } = await ctx.supabase
    .from("scope_discovery_decisions")
    .select(
      "id, org_id, project_id, suggestion_id, decision_type, decided_by, decided_at, created_work_area_id, reason_code, user_note, modified_title, modified_description, modified_work_area_type, source_revision, run_id"
    )
    .eq("suggestion_id", suggestionId)
    .eq("org_id", ctx.orgId)
    .order("decided_at", { ascending: true });

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to list discovery decisions."
      )
    );
  }

  return (data as DiscoveryDecisionDetailRow[]) ?? [];
}

export interface DiscoveryDecisionDetailRow extends ScopeDiscoveryDecisionRow {
  readonly created_work_area_id: string | null;
  readonly reason_code: string | null;
  readonly user_note: string | null;
  readonly modified_title: string | null;
  readonly modified_description: string | null;
  readonly modified_work_area_type: string | null;
  readonly source_revision: string;
  readonly run_id: string;
}

export async function listDecisionsForProject(
  ctx: PersistenceAuthContext,
  projectId: string,
  limit = 200
): Promise<readonly DiscoveryDecisionDetailRow[]> {
  await assertProjectOwnedByOrg(ctx, projectId);

  const { data, error } = await ctx.supabase
    .from("scope_discovery_decisions")
    .select(
      "id, org_id, project_id, suggestion_id, decision_type, decided_by, decided_at, created_work_area_id, reason_code, user_note, modified_title, modified_description, modified_work_area_type, source_revision, run_id"
    )
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .order("decided_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to list discovery decisions."
      )
    );
  }

  return (data as DiscoveryDecisionDetailRow[]) ?? [];
}

export async function listDecisionsForRun(
  ctx: PersistenceAuthContext,
  runId: string
): Promise<readonly DiscoveryDecisionDetailRow[]> {
  const { data, error } = await ctx.supabase
    .from("scope_discovery_decisions")
    .select(
      "id, org_id, project_id, suggestion_id, decision_type, decided_by, decided_at, created_work_area_id, reason_code, user_note, modified_title, modified_description, modified_work_area_type, source_revision, run_id"
    )
    .eq("run_id", runId)
    .eq("org_id", ctx.orgId)
    .order("decided_at", { ascending: true });

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to list discovery decisions."
      )
    );
  }

  return (data as DiscoveryDecisionDetailRow[]) ?? [];
}
