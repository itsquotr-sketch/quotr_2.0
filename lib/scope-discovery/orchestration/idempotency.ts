import { deepFreeze } from "../immutability";
import { fingerprintDigest } from "./source-snapshot";
import type {
  DiscoveryTrigger,
  ExplicitUserTrigger,
  IdempotencyDecision,
  PriorRunSummary,
  ScopeDiscoveryRequest,
  ScopeDiscoverySourceSnapshot,
} from "./types";
import { EXPLICIT_USER_TRIGGERS } from "./types";

export function triggerFamily(trigger: DiscoveryTrigger): string {
  switch (trigger) {
    case "INITIAL_ANALYSE_JOB":
    case "USER_REQUESTED_RERUN":
      return "explicit_user";
    case "PROJECT_BRIEF_CHANGED":
      return "brief_change";
    case "SITE_NOTES_CHANGED":
      return "notes_change";
    case "FACTS_CHANGED":
      return "facts_change";
    case "CONSTRAINTS_CHANGED":
      return "constraints_change";
    case "WORK_AREAS_CHANGED":
      return "work_areas_change";
    default:
      return "unknown";
  }
}

export function isExplicitUserTrigger(
  trigger: DiscoveryTrigger
): trigger is ExplicitUserTrigger {
  return (EXPLICIT_USER_TRIGGERS as readonly string[]).includes(trigger);
}

/**
 * Provider may run only when enabled, explicitly user-initiated, and
 * trigger is an explicit-user family (OCD-ISD-06/07/08).
 * Source-change triggers never authorise a paid call by themselves.
 */
export function isProviderAuthorised(request: ScopeDiscoveryRequest): boolean {
  return (
    request.providerEnabled &&
    request.explicitUserInitiation &&
    isExplicitUserTrigger(request.trigger)
  );
}

/**
 * Idempotency identity — excludes provider wording, timestamps, titles, tokens.
 */
export function buildIdempotencyKey(params: {
  readonly projectId: string;
  readonly triggerFamily: string;
  readonly sourceFingerprint: string;
  readonly contractVersion: string;
  readonly catalogueVersion: string;
  readonly promptVersion: string;
  readonly analysisObjective: string;
}): string {
  return fingerprintDigest([
    params.projectId,
    params.triggerFamily,
    params.sourceFingerprint,
    params.contractVersion,
    params.catalogueVersion,
    params.promptVersion,
    params.analysisObjective.trim(),
  ]);
}

export function decideIdempotencyAction(params: {
  readonly request: ScopeDiscoveryRequest;
  readonly snapshot: ScopeDiscoverySourceSnapshot;
  readonly sourceFingerprint: string;
  readonly idempotencyKey: string;
  readonly priorRuns: readonly PriorRunSummary[];
}): IdempotencyDecision {
  const family = triggerFamily(params.request.trigger);
  const matching = params.priorRuns.filter(
    (r) =>
      r.projectId === params.request.projectId &&
      r.idempotencyKey === params.idempotencyKey
  );

  const inFlight = matching.find((r) => r.inFlight);
  if (inFlight) {
    return deepFreeze({
      action: "REJECT_DUPLICATE_IN_FLIGHT",
      idempotencyKey: params.idempotencyKey,
      sourceFingerprint: params.sourceFingerprint,
      triggerFamily: family,
      reusableRunId: null,
      supersededRunId: null,
      reason: "Identical discovery request is already in flight.",
    });
  }

  const completed = matching.find(
    (r) => r.completedSuccessfully && !r.failed && r.result
  );

  // Explicit force rerun: new run even when identical completed exists.
  if (
    params.request.forceNewRun &&
    params.request.trigger === "USER_REQUESTED_RERUN" &&
    completed
  ) {
    return deepFreeze({
      action: "EXECUTE_NEW_RUN",
      idempotencyKey: params.idempotencyKey,
      sourceFingerprint: params.sourceFingerprint,
      triggerFamily: family,
      reusableRunId: null,
      supersededRunId: completed.runId,
      reason:
        "Explicit user rerun forced a new run; prior identical completed run superseded for identity only (not rewritten).",
    });
  }

  if (completed) {
    return deepFreeze({
      action: "REUSE_IDENTICAL_COMPLETED_RUN",
      idempotencyKey: params.idempotencyKey,
      sourceFingerprint: params.sourceFingerprint,
      triggerFamily: family,
      reusableRunId: completed.runId,
      supersededRunId: null,
      reason: "Identical successful completed run may be reused.",
    });
  }

  const failed = matching.find((r) => r.failed);
  if (failed) {
    return deepFreeze({
      action: "RETRY_FAILED_RUN",
      idempotencyKey: params.idempotencyKey,
      sourceFingerprint: params.sourceFingerprint,
      triggerFamily: family,
      reusableRunId: null,
      supersededRunId: failed.runId,
      reason: "Prior identical run failed; explicit retry permitted.",
    });
  }

  // Material change: different fingerprint on same project with a prior run.
  const priorDifferent = params.priorRuns.find(
    (r) =>
      r.projectId === params.request.projectId &&
      r.sourceFingerprint !== params.sourceFingerprint &&
      (r.completedSuccessfully || r.failed)
  );
  if (priorDifferent) {
    return deepFreeze({
      action: "SUPERSEDE_STALE_RUN",
      idempotencyKey: params.idempotencyKey,
      sourceFingerprint: params.sourceFingerprint,
      triggerFamily: family,
      reusableRunId: null,
      supersededRunId: priorDifferent.runId,
      reason:
        "Material source change creates a new run; prior run is superseded (not rewritten).",
    });
  }

  return deepFreeze({
    action: "EXECUTE_NEW_RUN",
    idempotencyKey: params.idempotencyKey,
    sourceFingerprint: params.sourceFingerprint,
    triggerFamily: family,
    reusableRunId: null,
    supersededRunId: null,
    reason: "No reusable prior run; execute new discovery run.",
  });
}
