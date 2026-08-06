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

export interface DiscoverySuggestionDetailRow extends ScopeDiscoverySuggestionRow {
  readonly proposed_work_area_type: string | null;
  readonly proposed_title: string;
  readonly proposed_description: string | null;
  readonly confidence: number | null;
  readonly confidence_band: string;
  readonly rationale_code: string;
  readonly stale_reason: string | null;
  readonly superseded_by_suggestion_id: string | null;
  readonly provider_metadata: Record<string, unknown> | null;
  readonly catalogue_version: string;
  readonly prompt_version: string | null;
  readonly source_snapshot: Record<string, unknown>;
  readonly missing_information: unknown[] | null;
}

const SUGGESTION_DETAIL_SELECT =
  "id, org_id, project_id, run_id, suggestion_identity, suggestion_kind, original_status, evidence, proposed_work_area_type, proposed_title, proposed_description, confidence, confidence_band, rationale_code, stale_reason, superseded_by_suggestion_id, provider_metadata, catalogue_version, prompt_version, source_snapshot, missing_information";

export async function listSuggestionDetailsForRun(
  ctx: PersistenceAuthContext,
  runId: string
): Promise<readonly DiscoverySuggestionDetailRow[]> {
  const { data, error } = await ctx.supabase
    .from("scope_discovery_suggestions")
    .select(SUGGESTION_DETAIL_SELECT)
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

  return (data as DiscoverySuggestionDetailRow[]) ?? [];
}
