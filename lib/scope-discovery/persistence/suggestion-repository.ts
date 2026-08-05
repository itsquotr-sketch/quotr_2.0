import { mapSuggestionInsert } from "./mappers";
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
  MarkSuggestionStaleInput,
  PersistSuggestionInput,
  ScopeDiscoverySuggestionRow,
} from "./types";

export async function insertDiscoverySuggestions(
  ctx: PersistenceAuthContext,
  inputs: readonly PersistSuggestionInput[]
): Promise<readonly ScopeDiscoverySuggestionRow[]> {
  if (inputs.length === 0) return [];

  const projectId = inputs[0].projectId;
  for (const input of inputs) {
    if (input.projectId !== projectId) {
      throw new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.VALIDATION_FAILED,
        "All suggestions in a batch must share one project."
      );
    }
  }

  await assertProjectOwnedByOrg(ctx, projectId);

  const rows = inputs.map((input) => mapSuggestionInsert(input, ctx.orgId));
  const { data, error } = await ctx.supabase
    .from("scope_discovery_suggestions")
    .insert(rows)
    .select(
      "id, org_id, project_id, run_id, suggestion_identity, suggestion_kind, original_status, evidence"
    );

  if (error || !data) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to persist discovery suggestions."
      )
    );
  }

  return data as ScopeDiscoverySuggestionRow[];
}

export async function markSuggestionStaleOrSuperseded(
  ctx: PersistenceAuthContext,
  input: MarkSuggestionStaleInput
): Promise<void> {
  await assertProjectOwnedByOrg(ctx, input.projectId);

  const { error } = await ctx.supabase
    .from("scope_discovery_suggestions")
    .update({
      stale_reason: input.staleReason,
      superseded_by_suggestion_id: input.supersededBySuggestionId,
    })
    .eq("id", input.suggestionId)
    .eq("org_id", ctx.orgId)
    .eq("project_id", input.projectId);

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to mark suggestion stale."
      )
    );
  }
}

export async function listSuggestionsForRun(
  ctx: PersistenceAuthContext,
  runId: string
): Promise<readonly ScopeDiscoverySuggestionRow[]> {
  const { data, error } = await ctx.supabase
    .from("scope_discovery_suggestions")
    .select(
      "id, org_id, project_id, run_id, suggestion_identity, suggestion_kind, original_status, evidence"
    )
    .eq("run_id", runId)
    .eq("org_id", ctx.orgId);

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to list discovery suggestions."
      )
    );
  }

  return (data as ScopeDiscoverySuggestionRow[]) ?? [];
}
