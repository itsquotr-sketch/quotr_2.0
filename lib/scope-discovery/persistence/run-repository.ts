import { mapCompleteRunPatch, mapRunInsert } from "./mappers";
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
  CompleteRunInput,
  PersistRunInput,
  ScopeDiscoveryRunRow,
} from "./types";

export async function insertDiscoveryRun(
  ctx: PersistenceAuthContext,
  input: PersistRunInput
): Promise<ScopeDiscoveryRunRow> {
  await assertProjectOwnedByOrg(ctx, input.projectId);

  const row = mapRunInsert(input, ctx.orgId, ctx.userId);
  const { data, error } = await ctx.supabase
    .from("scope_discovery_runs")
    .insert(row)
    .select(
      "id, org_id, project_id, status, idempotency_key, source_fingerprint, contract_version, catalogue_version, prompt_version"
    )
    .single();

  if (error || !data) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to persist discovery run."
      )
    );
  }

  return data as ScopeDiscoveryRunRow;
}

export async function completeDiscoveryRun(
  ctx: PersistenceAuthContext,
  input: CompleteRunInput
): Promise<ScopeDiscoveryRunRow> {
  await assertProjectOwnedByOrg(ctx, input.projectId);

  const patch = mapCompleteRunPatch(input);
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  );

  const { data, error } = await ctx.supabase
    .from("scope_discovery_runs")
    .update(cleanPatch)
    .eq("id", input.runId)
    .eq("org_id", ctx.orgId)
    .eq("project_id", input.projectId)
    .select(
      "id, org_id, project_id, status, idempotency_key, source_fingerprint, contract_version, catalogue_version, prompt_version"
    )
    .maybeSingle();

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to complete discovery run."
      )
    );
  }
  if (!data) {
    throw new ScopeDiscoveryPersistenceError(
      PERSISTENCE_ERROR_CODES.NOT_FOUND,
      "Discovery run was not found."
    );
  }

  return data as ScopeDiscoveryRunRow;
}

export async function archiveDiscoveryRun(
  ctx: PersistenceAuthContext,
  params: { readonly runId: string; readonly projectId: string }
): Promise<void> {
  await assertProjectOwnedByOrg(ctx, params.projectId);

  const { error } = await ctx.supabase
    .from("scope_discovery_runs")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", params.runId)
    .eq("org_id", ctx.orgId)
    .eq("project_id", params.projectId);

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to archive discovery run."
      )
    );
  }
}

export async function getDiscoveryRunById(
  ctx: PersistenceAuthContext,
  runId: string
): Promise<ScopeDiscoveryRunRow | null> {
  const { data, error } = await ctx.supabase
    .from("scope_discovery_runs")
    .select(
      "id, org_id, project_id, status, idempotency_key, source_fingerprint, contract_version, catalogue_version, prompt_version"
    )
    .eq("id", runId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to load discovery run."
      )
    );
  }

  return (data as ScopeDiscoveryRunRow | null) ?? null;
}
