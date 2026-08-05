/**
 * Stage 3.1B.5C — Run scope discovery application service.
 *
 * Feature-gated. Persists RUNNING before provider. Never touches Analyse Job.
 * Injectable auth + provider for verification.
 */

import { randomUUID } from "node:crypto";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../version";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../catalogue/version";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "../provider/version";
import { getScopeDiscoveryAvailability } from "../configuration";
import {
  buildIdempotencyKey,
  decideIdempotencyAction,
  triggerFamily,
} from "../orchestration/idempotency";
import { executeScopeDiscovery } from "../orchestration/execute";
import {
  buildSourceSnapshot,
  computeSourceFingerprint,
} from "../orchestration/source-snapshot";
import type {
  InjectedProviderRunner,
  ScopeDiscoveryRequest,
  ScopeDiscoveryRunResult,
  ScopeDiscoveryRunStatus,
} from "../orchestration/types";
import type { PersistenceAuthContext } from "../persistence/context";
import {
  completeDiscoveryRun,
  insertDiscoveryRun,
  insertDiscoverySuggestions,
  listSuggestionDetailsForRun,
  ScopeDiscoveryPersistenceError,
  PERSISTENCE_ERROR_CODES,
} from "../persistence";
import { validateScopeDiscoverySuggestion } from "../validation";
import {
  APPLICATION_ERROR_CODES,
  applicationFailure,
  ScopeDiscoveryApplicationError,
} from "./errors";
import { logDiscoveryEvent } from "./logging";
import {
  mapOrchestrationToSafeRunResult,
  suggestionToPersistInput,
} from "./result-mappers";
import { collectProjectSources } from "./source-collector";
import {
  DEFAULT_ANALYSIS_OBJECTIVE,
  type RunDiscoveryInput,
  type RunDiscoveryOutcome,
} from "./types";

export interface RunScopeDiscoveryDeps {
  readonly ctx: PersistenceAuthContext;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injected for tests; when omitted and provider may run, uses Anthropic. */
  readonly providerRunner?: InjectedProviderRunner | null;
  /** When true, skip dynamic Anthropic import (tests). */
  readonly disableLiveProvider?: boolean;
  readonly now?: () => Date;
  readonly revalidate?: (projectId: string) => void | Promise<void>;
}

function snapshotToRecord(
  snapshot: ReturnType<typeof buildSourceSnapshot>
): Record<string, unknown> {
  return { ...snapshot } as unknown as Record<string, unknown>;
}

function sanitiseWarnings(warnings: readonly unknown[]): unknown[] {
  return warnings
    .map((w) => String(w).slice(0, 240))
    .filter(Boolean)
    .slice(0, 40);
}

function sanitiseErrors(
  errors: ScopeDiscoveryRunResult["errors"]
): unknown[] {
  return errors
    .map((e) => ({
      code: e.code,
      message: String(e.message).slice(0, 240),
    }))
    .slice(0, 20);
}

async function resolveProviderRunner(
  deps: RunScopeDiscoveryDeps,
  providerMayRun: boolean
): Promise<InjectedProviderRunner | null> {
  if (deps.providerRunner !== undefined) {
    return deps.providerRunner;
  }
  if (!providerMayRun || deps.disableLiveProvider) {
    return null;
  }
  try {
    const { createAnthropicScopeDiscoveryTransport } = await import(
      "../provider/anthropic-provider"
    );
    const { runScopeDiscoveryProvider } = await import("../provider/run");
    const transport = createAnthropicScopeDiscoveryTransport();
    return async ({ input, signal }) => {
      void signal;
      return runScopeDiscoveryProvider({ input, transport });
    };
  } catch {
    return null;
  }
}

function buildRequest(params: {
  readonly sources: Awaited<ReturnType<typeof collectProjectSources>>;
  readonly userId: string;
  readonly runId: string;
  readonly providerEnabled: boolean;
  readonly forceNewRun: boolean;
  readonly analysisObjective: string;
  readonly requestedAt: string;
}): ScopeDiscoveryRequest {
  const { sources } = params;
  return {
    projectId: sources.projectId,
    orgId: sources.orgId,
    requestedRunId: params.runId,
    trigger: "USER_REQUESTED_RERUN",
    projectBrief: sources.briefText,
    projectBriefRevision: sources.briefRevision,
    selectedSiteNotes: sources.siteNotes,
    acceptedWorkAreas: sources.acceptedWorkAreas,
    authoritativeFacts: sources.facts,
    authoritativeConstraints: sources.constraints,
    priorSuggestions: sources.priorSuggestions,
    priorDecisions: sources.priorDecisions,
    priorProposals: sources.priorProposals,
    priorRejections: sources.priorRejections,
    currentContractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    currentCatalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    currentPromptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
    region: sources.region,
    analysisObjective: params.analysisObjective,
    providerEnabled: params.providerEnabled,
    explicitUserInitiation: true,
    forceNewRun: params.forceNewRun,
    requestedByUserId: params.userId,
    requestedAt: params.requestedAt,
    priorRunSummaries: sources.priorRunSummaries,
  };
}

async function persistTerminalResult(params: {
  readonly ctx: PersistenceAuthContext;
  readonly runId: string;
  readonly projectId: string;
  readonly result: ScopeDiscoveryRunResult;
}): Promise<void> {
  const { result } = params;
  const status = result.status as Exclude<
    ScopeDiscoveryRunStatus,
    "RUNNING" | "VALIDATED"
  >;

  const suggestions = result.mergedSuggestions.filter((s) => {
    const v = validateScopeDiscoverySuggestion(s);
    return v.ok;
  });

  // Orchestration may reuse stable suggestionIds across runs; DB PK is global.
  const idMap = new Map<string, string>();
  for (const s of suggestions) {
    idMap.set(s.suggestionId, randomUUID());
  }

  if (suggestions.length > 0) {
    await insertDiscoverySuggestions(
      params.ctx,
      suggestions.map((s) => {
        const input = suggestionToPersistInput(
          s,
          params.runId,
          result.catalogueVersion
        );
        const parentMapped =
          s.parentSuggestionId && idMap.has(s.parentSuggestionId)
            ? idMap.get(s.parentSuggestionId)!
            : null;
        return {
          ...input,
          id: idMap.get(s.suggestionId)!,
          parentSuggestionId: parentMapped,
        };
      })
    );
  }

  await completeDiscoveryRun(params.ctx, {
    runId: params.runId,
    projectId: params.projectId,
    status,
    warnings: sanitiseWarnings(result.warnings),
    errors: sanitiseErrors(result.errors),
    latencyMs: result.latencyMs,
    inputTokens: result.tokenUsage?.inputTokens ?? null,
    outputTokens: result.tokenUsage?.outputTokens ?? null,
    repairAttempted: result.providerRepairAttempted,
    providerCalled: result.providerCalled,
    provider: result.providerMetadata?.provider ?? null,
    model: result.providerMetadata?.model ?? null,
    providerMetadata: result.providerMetadata
      ? {
          provider: result.providerMetadata.provider,
          model: result.providerMetadata.model,
          requestId: result.providerMetadata.requestId,
          promptVersion: result.providerMetadata.promptVersion,
        }
      : null,
    completedAt: result.completedAt,
  });
}

/**
 * Explicit user-triggered scope discovery run.
 * Returns FEATURE_DISABLED without provider or persistence when flag off.
 */
export async function runScopeDiscovery(
  input: RunDiscoveryInput,
  deps: RunScopeDiscoveryDeps
): Promise<RunDiscoveryOutcome> {
  const started = Date.now();
  const env = deps.env ?? process.env;
  const availability = getScopeDiscoveryAvailability(env);

  logDiscoveryEvent({
    event: "run_requested",
    projectId: input.projectId,
    featureEnabled: availability.featureEnabled,
  });

  if (!availability.featureEnabled) {
    logDiscoveryEvent({
      event: "feature_disabled",
      projectId: input.projectId,
      code: APPLICATION_ERROR_CODES.FEATURE_DISABLED,
    });
    return applicationFailure(APPLICATION_ERROR_CODES.FEATURE_DISABLED);
  }

  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  if (!input.projectId || typeof input.projectId !== "string") {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  const analysisObjective = (
    input.analysisObjective?.trim() || DEFAULT_ANALYSIS_OBJECTIVE
  ).slice(0, 500);
  const forceNewRun = Boolean(input.forceNewRun);
  const nowIso = (deps.now?.() ?? new Date()).toISOString();
  const runId = randomUUID();

  let sources;
  try {
    sources = await collectProjectSources(deps.ctx, input.projectId);
  } catch (error) {
    if (
      error instanceof ScopeDiscoveryPersistenceError &&
      error.code === PERSISTENCE_ERROR_CODES.PROJECT_NOT_OWNED
    ) {
      return applicationFailure(APPLICATION_ERROR_CODES.PROJECT_NOT_FOUND);
    }
    return applicationFailure(APPLICATION_ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Injected runner (tests) may run even without a live Anthropic key.
  // Explicit null forces deterministic-only. Undefined → env availability.
  const providerEnabled =
    deps.providerRunner != null
      ? true
      : deps.providerRunner === null
        ? false
        : availability.providerMayRun;
  const request = buildRequest({
    sources,
    userId: deps.ctx.userId,
    runId,
    providerEnabled,
    forceNewRun,
    analysisObjective,
    requestedAt: nowIso,
  });

  const snapshot = buildSourceSnapshot(request);
  const sourceFingerprint = computeSourceFingerprint(snapshot);
  const idempotencyKey = buildIdempotencyKey({
    projectId: request.projectId,
    triggerFamily: triggerFamily(request.trigger),
    sourceFingerprint,
    contractVersion: request.currentContractVersion,
    catalogueVersion: request.currentCatalogueVersion,
    promptVersion: request.currentPromptVersion,
    analysisObjective: request.analysisObjective,
  });

  const idempotency = decideIdempotencyAction({
    request,
    snapshot,
    sourceFingerprint,
    idempotencyKey,
    // Application reuse does not require hydrated result on summaries.
    priorRuns: sources.priorRunSummaries.map((r) =>
      r.completedSuccessfully
        ? {
            ...r,
            result: r.result ?? ({
              runId: r.runId,
              projectId: r.projectId,
              orgId: sources.orgId,
              status: r.status,
              mergedSuggestions: [],
              primarySuggestions: [],
              otherPossibilities: [],
              suppressedSuggestions: [],
              conflicts: [],
              warnings: [],
              errors: [],
            } as unknown as ScopeDiscoveryRunResult),
          }
        : r
    ),
  });

  if (idempotency.action === "REJECT_DUPLICATE_IN_FLIGHT") {
    return applicationFailure(APPLICATION_ERROR_CODES.DUPLICATE_IN_FLIGHT);
  }

  if (
    idempotency.action === "REUSE_IDENTICAL_COMPLETED_RUN" &&
    idempotency.reusableRunId
  ) {
    const suggestions = await listSuggestionDetailsForRun(
      deps.ctx,
      idempotency.reusableRunId
    );
    logDiscoveryEvent({
      event: "run_reused",
      projectId: input.projectId,
      runId: idempotency.reusableRunId,
      reused: true,
      elapsedMs: Date.now() - started,
    });

    const deterministicCount = suggestions.filter(
      (s) =>
        !s.provider_metadata ||
        (s.provider_metadata as { origin?: string }).origin === "deterministic"
    ).length;
    const contextualCount = suggestions.length - deterministicCount;

    if (deps.revalidate) {
      await deps.revalidate(input.projectId);
    }

    return {
      ok: true,
      success: true,
      runId: idempotency.reusableRunId,
      projectId: input.projectId,
      status: "REUSED",
      reused: true,
      reusedRunId: idempotency.reusableRunId,
      deterministicSuggestionCount: deterministicCount,
      contextualSuggestionCount: Math.max(0, contextualCount),
      primaryCount: suggestions.length,
      otherPossibilityCount: 0,
      conflictCount: 0,
      suppressedCount: 0,
      warnings: ["Identical completed discovery run reused."],
      stale: false,
      message: "Previous scope discovery results were reused.",
      latencyMs: Date.now() - started,
      featureEnabled: true,
    };
  }

  // Insert RUNNING before provider.
  try {
    await insertDiscoveryRun(deps.ctx, {
      id: runId,
      projectId: input.projectId,
      trigger: "USER_REQUESTED_RERUN",
      status: "RUNNING",
      sourceFingerprint,
      idempotencyKey,
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
      provider: null,
      model: null,
      analysisObjective,
      sourceSnapshot: snapshotToRecord(snapshot),
      providerMetadata: null,
      warnings: [],
      errors: [],
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      repairAttempted: false,
      providerCalled: false,
      reusedRunId: null,
      supersededRunId: idempotency.supersededRunId,
      startedAt: nowIso,
      completedAt: null,
    });
  } catch (error) {
    if (
      error instanceof ScopeDiscoveryPersistenceError &&
      error.code === PERSISTENCE_ERROR_CODES.DUPLICATE_ACTIVE_RUN
    ) {
      return applicationFailure(APPLICATION_ERROR_CODES.DUPLICATE_IN_FLIGHT);
    }
    logDiscoveryEvent({
      event: "persistence_failed",
      projectId: input.projectId,
      code: APPLICATION_ERROR_CODES.PERSISTENCE_FAILED,
    });
    return applicationFailure(APPLICATION_ERROR_CODES.PERSISTENCE_FAILED);
  }

  logDiscoveryEvent({
    event: "run_started",
    projectId: input.projectId,
    runId,
  });

  const providerRunner = await resolveProviderRunner(
    deps,
    providerEnabled
  );

  // Exclude our own RUNNING row from prior summaries so orchestrator does not
  // treat this insert as a duplicate in-flight rejection.
  const requestForExecute: ScopeDiscoveryRequest = {
    ...request,
    priorRunSummaries: sources.priorRunSummaries.filter(
      (r) => r.runId !== runId && !r.inFlight
    ),
  };

  let result: ScopeDiscoveryRunResult;
  try {
    result = await executeScopeDiscovery({
      request: requestForExecute,
      providerRunner,
      context: { now: deps.now },
    });
  } catch {
    try {
      await completeDiscoveryRun(deps.ctx, {
        runId,
        projectId: input.projectId,
        status: "FAILED_PROVIDER",
        errors: [{ code: "RUN_FAILED", message: "Scope discovery failed." }],
        completedAt: (deps.now?.() ?? new Date()).toISOString(),
        providerCalled: Boolean(providerRunner),
      });
    } catch {
      // best-effort terminalise
    }
    return applicationFailure(APPLICATION_ERROR_CODES.RUN_FAILED);
  }

  logDiscoveryEvent({
    event: result.providerCalled
      ? result.contextualProviderResult?.success === false
        ? "provider_failed"
        : "provider_completed"
      : "deterministic_completed",
    projectId: input.projectId,
    runId,
    status: result.status,
    providerCalled: result.providerCalled,
    inputTokens: result.tokenUsage?.inputTokens ?? null,
    outputTokens: result.tokenUsage?.outputTokens ?? null,
    elapsedMs: result.latencyMs ?? Date.now() - started,
  });

  // If orchestrator returned REUSED (should be rare after app-level reuse),
  // terminalise our RUNNING row without rewriting prior suggestions.
  if (result.status === "REUSED") {
    try {
      await completeDiscoveryRun(deps.ctx, {
        runId,
        projectId: input.projectId,
        status: "REUSED",
        warnings: sanitiseWarnings(result.warnings),
        completedAt: result.completedAt,
        providerCalled: false,
      });
    } catch {
      // prior data remains authoritative
    }

    if (deps.revalidate) {
      await deps.revalidate(input.projectId);
    }

    return mapOrchestrationToSafeRunResult({
      result,
      reused: true,
      stale: false,
      message: "Previous scope discovery results were reused.",
    });
  }

  try {
    await persistTerminalResult({
      ctx: deps.ctx,
      runId,
      projectId: input.projectId,
      result: { ...result, runId },
    });

    logDiscoveryEvent({
      event: "persistence_completed",
      projectId: input.projectId,
      runId,
      status: result.status,
      elapsedMs: Date.now() - started,
    });
  } catch (error) {
    const persistCode =
      error instanceof ScopeDiscoveryPersistenceError
        ? error.code
        : error instanceof ScopeDiscoveryApplicationError
          ? error.code
          : APPLICATION_ERROR_CODES.PERSISTENCE_FAILED;
    logDiscoveryEvent({
      event: "persistence_failed",
      projectId: input.projectId,
      runId,
      code: persistCode,
    });
    try {
      await completeDiscoveryRun(deps.ctx, {
        runId,
        projectId: input.projectId,
        status: "FAILED_MERGE",
        errors: [
          {
            code: "PERSISTENCE_FAILED",
            message: "Failed to save discovery results.",
          },
        ],
        completedAt: (deps.now?.() ?? new Date()).toISOString(),
        providerCalled: result.providerCalled,
      });
    } catch {
      // leave RUNNING only if complete also fails — rare
    }
    return applicationFailure(APPLICATION_ERROR_CODES.PERSISTENCE_FAILED);
  }

  if (deps.revalidate) {
    await deps.revalidate(input.projectId);
  }

  const message =
    result.status === "COMPLETED_WITH_WARNINGS"
      ? "Scope discovery completed with warnings. Deterministic suggestions were preserved."
      : result.status.startsWith("FAILED")
        ? "Scope discovery could not be completed."
        : "Scope discovery completed.";

  if (result.status.startsWith("FAILED") && result.mergedSuggestions.length === 0) {
    return applicationFailure(APPLICATION_ERROR_CODES.RUN_FAILED);
  }

  return mapOrchestrationToSafeRunResult({
    result: { ...result, runId },
    reused: false,
    stale: false,
    message,
  });
}
