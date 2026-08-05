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

export interface DiscoveryRunDetailRow extends ScopeDiscoveryRunRow {
  readonly trigger: string;
  readonly analysis_objective: string;
  readonly source_snapshot: Record<string, unknown>;
  readonly warnings: unknown;
  readonly errors: unknown;
  readonly latency_ms: number | null;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly provider_called: boolean;
  readonly repair_attempted: boolean;
  readonly reused_run_id: string | null;
  readonly superseded_run_id: string | null;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly archived_at: string | null;
  readonly provider: string | null;
  readonly model: string | null;
}

const RUN_DETAIL_SELECT =
  "id, org_id, project_id, status, idempotency_key, source_fingerprint, contract_version, catalogue_version, prompt_version, trigger, analysis_objective, source_snapshot, warnings, errors, latency_ms, input_tokens, output_tokens, provider_called, repair_attempted, reused_run_id, superseded_run_id, started_at, completed_at, archived_at, provider, model";

export async function getDiscoveryRunDetail(
  ctx: PersistenceAuthContext,
  runId: string
): Promise<DiscoveryRunDetailRow | null> {
  const { data, error } = await ctx.supabase
    .from("scope_discovery_runs")
    .select(RUN_DETAIL_SELECT)
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

  return (data as DiscoveryRunDetailRow | null) ?? null;
}

export async function listRecentDiscoveryRuns(
  ctx: PersistenceAuthContext,
  projectId: string,
  limit = 20
): Promise<readonly DiscoveryRunDetailRow[]> {
  await assertProjectOwnedByOrg(ctx, projectId);

  const { data, error } = await ctx.supabase
    .from("scope_discovery_runs")
    .select(RUN_DETAIL_SELECT)
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to list discovery runs."
      )
    );
  }

  return (data as DiscoveryRunDetailRow[]) ?? [];
}

export async function getLatestTerminalDiscoveryRun(
  ctx: PersistenceAuthContext,
  projectId: string
): Promise<DiscoveryRunDetailRow | null> {
  await assertProjectOwnedByOrg(ctx, projectId);

  const { data, error } = await ctx.supabase
    .from("scope_discovery_runs")
    .select(RUN_DETAIL_SELECT)
    .eq("project_id", projectId)
    .eq("org_id", ctx.orgId)
    .is("archived_at", null)
    .in("status", [
      "COMPLETED",
      "COMPLETED_WITH_WARNINGS",
      "REUSED",
      "FAILED_VALIDATION",
      "FAILED_DETERMINISTIC",
      "FAILED_PROVIDER",
      "FAILED_MERGE",
    ])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw mapDbError(
      error,
      new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.PERSISTENCE_FAILED,
        "Failed to load latest discovery run."
      )
    );
  }

  return (data as DiscoveryRunDetailRow | null) ?? null;
}
