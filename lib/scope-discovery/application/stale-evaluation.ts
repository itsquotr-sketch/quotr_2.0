/**
 * Stale evaluation for scope discovery — compare sources, do not call provider.
 * Does not mutate completed runs by default.
 */

import { getScopeDiscoveryAvailability } from "../configuration";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../version";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../catalogue/version";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "../provider/version";
import { buildSourceSnapshot } from "../orchestration/source-snapshot";
import { evaluateStaleRun } from "../orchestration/stale-analysis";
import type { ScopeDiscoverySourceSnapshot } from "../orchestration/types";
import type { PersistenceAuthContext } from "../persistence/context";
import {
  getLatestTerminalDiscoveryRun,
  PERSISTENCE_ERROR_CODES,
  ScopeDiscoveryPersistenceError,
} from "../persistence";
import { APPLICATION_ERROR_CODES, applicationFailure } from "./errors";
import { collectProjectSources } from "./source-collector";
import {
  DEFAULT_ANALYSIS_OBJECTIVE,
  type StaleOutcome,
} from "./types";

export interface EvaluateStaleDeps {
  readonly ctx: PersistenceAuthContext;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function parseSnapshot(
  raw: Record<string, unknown> | null | undefined
): ScopeDiscoverySourceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.briefRevision !== "string") return null;
  return raw as unknown as ScopeDiscoverySourceSnapshot;
}

/**
 * Report whether the latest discovery run is stale vs current sources.
 * Formatting-only and provider-model-only changes are not material stale.
 */
export async function evaluateScopeDiscoveryStale(
  projectId: string,
  deps: EvaluateStaleDeps
): Promise<StaleOutcome> {
  const availability = getScopeDiscoveryAvailability(deps.env ?? process.env);
  if (!availability.featureEnabled) {
    return applicationFailure(APPLICATION_ERROR_CODES.FEATURE_DISABLED);
  }

  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  let run;
  let sources;
  try {
    run = await getLatestTerminalDiscoveryRun(deps.ctx, projectId);
    sources = await collectProjectSources(deps.ctx, projectId);
  } catch (error) {
    if (
      error instanceof ScopeDiscoveryPersistenceError &&
      error.code === PERSISTENCE_ERROR_CODES.PROJECT_NOT_OWNED
    ) {
      return applicationFailure(APPLICATION_ERROR_CODES.PROJECT_NOT_FOUND);
    }
    return applicationFailure(APPLICATION_ERROR_CODES.PROJECT_NOT_FOUND);
  }

  if (!run) {
    return {
      ok: true,
      projectId,
      runId: null,
      stale: false,
      comparison: "CANNOT_COMPARE",
      reasons: ["No prior discovery run."],
      changedSources: [],
      message: "No prior scope discovery run to compare.",
    };
  }

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
  const evaluation = evaluateStaleRun({
    priorSnapshot: priorSnap,
    currentSnapshot: currentSnap,
    priorRunId: run.id,
    priorOrchestrationVersion:
      typeof run.source_snapshot?.orchestrationVersion === "string"
        ? String(run.source_snapshot.orchestrationVersion)
        : null,
  });

  const stale = evaluation.comparison === "STALE_MATERIAL_CHANGE";

  return {
    ok: true,
    projectId,
    runId: run.id,
    stale,
    comparison: evaluation.comparison,
    reasons: [...evaluation.reasons],
    changedSources: [...evaluation.changedSources],
    message: stale
      ? "Sources changed since the last analysis. Analyse again when ready."
      : "Latest scope discovery results are still current.",
  };
}
