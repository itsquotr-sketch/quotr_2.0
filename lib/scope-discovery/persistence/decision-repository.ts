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
): Promise<readonly ScopeDiscoveryDecisionRow[]> {
  const { data, error } = await ctx.supabase
    .from("scope_discovery_decisions")
    .select(
      "id, org_id, project_id, suggestion_id, decision_type, decided_by, decided_at"
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

  return (data as ScopeDiscoveryDecisionRow[]) ?? [];
}
