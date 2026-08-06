/**
 * Read latest scope discovery results with composed decision state.
 * Does not mutate records. Hides results when feature disabled (initial rollout).
 */

import { getScopeDiscoveryAvailability } from "../configuration";
import {
  buildSourceSnapshot,
  computeSourceFingerprint,
} from "../orchestration/source-snapshot";
import { evaluateStaleRun } from "../orchestration/stale-analysis";
import type { ScopeDiscoverySourceSnapshot } from "../orchestration/types";
import type { PersistenceAuthContext } from "../persistence/context";
import {
  getDiscoveryRunDetail,
  getLatestTerminalDiscoveryRun,
  listDecisionsForRun,
  listSuggestionDetailsForRun,
  PERSISTENCE_ERROR_CODES,
  ScopeDiscoveryPersistenceError,
} from "../persistence";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../version";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../catalogue/version";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "../provider/version";
import { detectProviderPartialFailure } from "../ui/warnings";
import { APPLICATION_ERROR_CODES, applicationFailure } from "./errors";
import { logDiscoveryEvent } from "./logging";
import {
  mapDbSuggestionToSafeView,
  partitionSafeSuggestions,
} from "./result-mappers";
import { collectProjectSources } from "./source-collector";
import {
  DEFAULT_ANALYSIS_OBJECTIVE,
  type GetResultsInput,
  type ResultsReadOutcome,
} from "./types";

export interface GetResultsDeps {
  readonly ctx: PersistenceAuthContext;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** When true, allow historical reads even if feature disabled. Default false for rollout. */
  readonly allowReadWhenDisabled?: boolean;
}

function parseSnapshot(
  raw: Record<string, unknown> | null | undefined
): ScopeDiscoverySourceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.briefRevision !== "string") return null;
  return raw as unknown as ScopeDiscoverySourceSnapshot;
}

function emptyResults(
  projectId: string,
  featureEnabled: boolean,
  message: string
): ResultsReadOutcome {
  return {
    ok: true,
    featureEnabled,
    projectId,
    runId: null,
    status: null,
    stale: false,
    staleReasons: [],
    sourceRevision: null,
    primarySuggestions: [],
    otherPossibilities: [],
    conflicts: [],
    allSuggestions: [],
    dismissedCount: 0,
    suppressedCount: 0,
    warnings: [],
    providerPartialFailure: false,
    message,
  };
}

export async function getScopeDiscoveryResults(
  input: GetResultsInput,
  deps: GetResultsDeps
): Promise<ResultsReadOutcome> {
  const availability = getScopeDiscoveryAvailability(deps.env ?? process.env);

  if (!availability.featureEnabled && !deps.allowReadWhenDisabled) {
    return emptyResults(
      input.projectId,
      false,
      "Scope discovery is not enabled."
    );
  }

  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  let run;
  try {
    if (input.runId) {
      run = await getDiscoveryRunDetail(deps.ctx, input.runId);
      if (!run || run.project_id !== input.projectId) {
        return applicationFailure(APPLICATION_ERROR_CODES.NOT_FOUND);
      }
    } else {
      run = await getLatestTerminalDiscoveryRun(deps.ctx, input.projectId);
    }
  } catch (error) {
    if (
      error instanceof ScopeDiscoveryPersistenceError &&
      error.code === PERSISTENCE_ERROR_CODES.PROJECT_NOT_OWNED
    ) {
      return applicationFailure(APPLICATION_ERROR_CODES.PROJECT_NOT_FOUND);
    }
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_FOUND);
  }

  if (!run) {
    return emptyResults(
      input.projectId,
      availability.featureEnabled,
      "No scope discovery results yet."
    );
  }

  const [suggestions, decisions, sources] = await Promise.all([
    listSuggestionDetailsForRun(deps.ctx, run.id),
    listDecisionsForRun(deps.ctx, run.id),
    collectProjectSources(deps.ctx, input.projectId).catch(() => null),
  ]);

  const latestBySuggestion = new Map<string, (typeof decisions)[number]>();
  for (const d of decisions) {
    latestBySuggestion.set(d.suggestion_id, d);
  }

  const views = suggestions.map((s) =>
    mapDbSuggestionToSafeView(s, latestBySuggestion.get(s.id) ?? null)
  );
  const partitioned = partitionSafeSuggestions(views);
  const dismissedCount = views.filter(
    (v) => v.decisionState === "REJECTED"
  ).length;

  let stale = false;
  let staleReasons: string[] = [];
  if (sources) {
    const priorSnap = parseSnapshot(run.source_snapshot);
    const currentRequest = {
      projectId: sources.projectId,
      orgId: sources.orgId,
      requestedRunId: run.id,
      trigger: "USER_REQUESTED_RERUN" as const,
      projectBrief: sources.briefText,
      projectBriefRevision: sources.briefRevision,
      selectedSiteNotes: sources.siteNotes,
      acceptedWorkAreas: sources.acceptedWorkAreas,
      authoritativeFacts: sources.facts,
      authoritativeConstraints: sources.constraints,
      priorSuggestions: [],
      priorDecisions: sources.priorDecisions,
      priorProposals: sources.priorProposals,
      priorRejections: sources.priorRejections,
      currentContractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      currentCatalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      currentPromptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
      region: sources.region,
      analysisObjective: DEFAULT_ANALYSIS_OBJECTIVE,
      providerEnabled: false,
      explicitUserInitiation: true,
      forceNewRun: false,
      requestedByUserId: deps.ctx.userId,
      requestedAt: new Date().toISOString(),
      priorRunSummaries: [],
    };
    const currentSnap = buildSourceSnapshot(currentRequest);
    void computeSourceFingerprint(currentSnap);
    const evaluation = evaluateStaleRun({
      priorSnapshot: priorSnap,
      currentSnapshot: currentSnap,
      priorRunId: run.id,
      priorOrchestrationVersion:
        typeof run.source_snapshot?.orchestrationVersion === "string"
          ? String(run.source_snapshot.orchestrationVersion)
          : null,
    });
    stale = evaluation.comparison === "STALE_MATERIAL_CHANGE";
    staleReasons = [...evaluation.reasons];
  }

  const warnings = Array.isArray(run.warnings)
    ? run.warnings.map((w) => String(w).slice(0, 240)).slice(0, 20)
    : [];

  const snap = parseSnapshot(run.source_snapshot);
  const sourceRevision =
    snap?.briefRevision ??
    (typeof run.source_fingerprint === "string"
      ? run.source_fingerprint
      : null);

  logDiscoveryEvent({
    event: "results_read",
    projectId: input.projectId,
    runId: run.id,
    featureEnabled: availability.featureEnabled,
  });

  return {
    ok: true,
    featureEnabled: availability.featureEnabled,
    projectId: input.projectId,
    runId: run.id,
    status: run.status,
    stale,
    staleReasons,
    sourceRevision,
    primarySuggestions: partitioned.primary,
    otherPossibilities: partitioned.other,
    conflicts: partitioned.conflicts,
    allSuggestions: views,
    dismissedCount,
    suppressedCount: 0,
    warnings,
    providerPartialFailure: detectProviderPartialFailure(warnings, run.status),
    message: stale
      ? "Scope discovery results may be out of date. Analyse again when ready."
      : "Scope discovery results loaded.",
  };
}
