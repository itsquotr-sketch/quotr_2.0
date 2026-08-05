import type {
  PriorProposalRecord,
  RejectionRecord,
  ScopeDiscoverySuggestion,
  ScopeDiscoverySuggestionStatus,
} from "../types";
import type { CatalogueEvaluationResult } from "../catalogue/evaluator";
import type { ScopeDiscoveryProviderResult } from "../provider/types";
import type { OrchestrationErrorCode } from "./errors";
import type { SCOPE_DISCOVERY_ORCHESTRATION_VERSION } from "./version";

export const DISCOVERY_TRIGGERS = [
  "INITIAL_ANALYSE_JOB",
  "USER_REQUESTED_RERUN",
  "PROJECT_BRIEF_CHANGED",
  "SITE_NOTES_CHANGED",
  "FACTS_CHANGED",
  "CONSTRAINTS_CHANGED",
  "WORK_AREAS_CHANGED",
] as const;

export type DiscoveryTrigger = (typeof DISCOVERY_TRIGGERS)[number];

/** Triggers that may authorise a paid provider call when explicitly user-initiated. */
export const EXPLICIT_USER_TRIGGERS = [
  "INITIAL_ANALYSE_JOB",
  "USER_REQUESTED_RERUN",
] as const;

export type ExplicitUserTrigger = (typeof EXPLICIT_USER_TRIGGERS)[number];

export const IDEMPOTENCY_ACTIONS = [
  "EXECUTE_NEW_RUN",
  "REUSE_IDENTICAL_COMPLETED_RUN",
  "RETRY_FAILED_RUN",
  "SUPERSEDE_STALE_RUN",
  "REJECT_DUPLICATE_IN_FLIGHT",
] as const;

export type IdempotencyAction = (typeof IDEMPOTENCY_ACTIONS)[number];

export const RUN_STATUSES = [
  "VALIDATED",
  "RUNNING",
  "COMPLETED",
  "COMPLETED_WITH_WARNINGS",
  "FAILED_VALIDATION",
  "FAILED_DETERMINISTIC",
  "FAILED_PROVIDER",
  "FAILED_MERGE",
  "REUSED",
  "CANCELLED",
] as const;

export type ScopeDiscoveryRunStatus = (typeof RUN_STATUSES)[number];

export const STALE_RUN_COMPARISONS = [
  "CURRENT",
  "STALE_MATERIAL_CHANGE",
  "CURRENT_PROVIDER_CHANGED_ONLY",
  "CURRENT_FORMATTING_CHANGE_ONLY",
  "UNKNOWN_VERSION",
  "CANNOT_COMPARE",
] as const;

export type StaleRunComparison = (typeof STALE_RUN_COMPARISONS)[number];

export interface OrchestrationSiteNote {
  readonly noteId: string;
  /** Caller-supplied stable revision/hash for the note body. */
  readonly revision: string;
  readonly content: string;
}

export interface OrchestrationWorkArea {
  readonly workAreaId: string;
  readonly type: string;
  readonly title: string | null;
  readonly revision: string;
}

export interface OrchestrationFact {
  readonly key: string;
  readonly value: string | number | boolean | null;
  readonly revision: string;
}

export interface OrchestrationConstraint {
  readonly key: string;
  readonly value: string | number | boolean | null;
  readonly revision: string;
}

export interface PriorDecisionRecord {
  readonly suggestionId: string;
  readonly identityKey: string;
  readonly status: ScopeDiscoverySuggestionStatus;
  readonly decisionType: "accept" | "reject" | "modify" | null;
  readonly sourceSnapshotBriefRevision: string;
  readonly sourceSnapshot: import("../types").SourceSnapshot;
  readonly modifiedTitle: string | null;
  readonly modifiedDescription: string | null;
  readonly resultingWorkAreaId: string | null;
}

/**
 * MVP policy ORCH-POL-01 (aligned with OCD-ISD-05 / OCD-ISD-15):
 * If deterministic evaluation succeeds but the provider fails, return
 * deterministic results with COMPLETED_WITH_WARNINGS.
 */
export const ORCH_POL_01_PROVIDER_FAIL_RETURNS_DETERMINISTIC =
  "ORCH-POL-01" as const;

export interface ScopeDiscoveryRequest {
  readonly projectId: string;
  readonly orgId: string;
  readonly requestedRunId: string;
  readonly trigger: DiscoveryTrigger;
  readonly projectBrief: string;
  /** Stable brief revision/hash supplied by caller (pre-normalised preferred). */
  readonly projectBriefRevision: string;
  readonly selectedSiteNotes: readonly OrchestrationSiteNote[];
  readonly acceptedWorkAreas: readonly OrchestrationWorkArea[];
  readonly authoritativeFacts: readonly OrchestrationFact[];
  readonly authoritativeConstraints: readonly OrchestrationConstraint[];
  readonly priorSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly priorDecisions: readonly PriorDecisionRecord[];
  readonly priorProposals: readonly PriorProposalRecord[];
  readonly priorRejections: readonly RejectionRecord[];
  readonly currentContractVersion: string;
  readonly currentCatalogueVersion: string;
  readonly currentPromptVersion: string;
  readonly region: string | null;
  readonly analysisObjective: string;
  /** Whether contextual provider may run — still requires explicit user initiation. */
  readonly providerEnabled: boolean;
  /**
   * Caller affirms the user explicitly initiated this analysis.
   * Source-change triggers alone must not set this to invent paid calls.
   */
  readonly explicitUserInitiation: boolean;
  /**
   * When true with USER_REQUESTED_RERUN, execute a new run even if an
   * identical completed run exists. Documented on the result.
   */
  readonly forceNewRun: boolean;
  readonly requestedByUserId: string;
  readonly requestedAt: string;
  /** Caller-supplied prior run summaries for pure idempotency decisions. */
  readonly priorRunSummaries: readonly PriorRunSummary[];
}

export interface PriorRunSummary {
  readonly runId: string;
  readonly projectId: string;
  readonly status: ScopeDiscoveryRunStatus;
  readonly idempotencyKey: string;
  readonly sourceFingerprint: string;
  readonly triggerFamily: string;
  readonly inFlight: boolean;
  readonly completedSuccessfully: boolean;
  readonly failed: boolean;
  readonly result?: ScopeDiscoveryRunResult;
}

/**
 * Material source snapshot for one run.
 * Provider/model is metadata only — not part of the project-source fingerprint.
 */
export interface ScopeDiscoverySourceSnapshot {
  readonly briefRevision: string;
  readonly noteIdsAndRevisions: readonly {
    readonly noteId: string;
    readonly revision: string;
  }[];
  readonly noteRevisionSet: string;
  readonly factKeysAndRevisions: readonly {
    readonly key: string;
    readonly revision: string;
  }[];
  readonly factRevisions: string;
  readonly constraintKeysAndRevisions: readonly {
    readonly key: string;
    readonly revision: string;
  }[];
  readonly constraintRevisions: string;
  readonly workAreaIdsAndRevisions: readonly {
    readonly workAreaId: string;
    readonly type: string;
    readonly revision: string;
  }[];
  readonly workAreaRevisions: string;
  readonly contractVersion: string;
  readonly catalogueVersion: string;
  readonly promptVersion: string;
  readonly region: string | null;
  readonly analysisObjective: string;
  /** Non-material — never part of project-source fingerprint. */
  readonly providerModelId: string | null;
  readonly formattingRevision: string | null;
  readonly orchestrationVersion: typeof SCOPE_DISCOVERY_ORCHESTRATION_VERSION | string;
}

export interface IdempotencyDecision {
  readonly action: IdempotencyAction;
  readonly idempotencyKey: string;
  readonly sourceFingerprint: string;
  readonly triggerFamily: string;
  readonly reusableRunId: string | null;
  readonly supersededRunId: string | null;
  readonly reason: string;
}

export interface DecisionApplicationExplanation {
  readonly code: string;
  readonly message: string;
  readonly identityKey: string | null;
  readonly suggestionId: string | null;
}

export interface StaleRunEvaluation {
  readonly comparison: StaleRunComparison;
  readonly reasons: readonly string[];
  readonly changedSources: readonly string[];
  readonly priorRunId: string | null;
}

export interface OrchestrationProviderMetadata {
  readonly provider: string | null;
  readonly model: string | null;
  readonly requestId: string | null;
  readonly promptVersion: string | null;
  readonly repairAttempted: boolean;
}

export interface ScopeDiscoveryRunResult {
  readonly runId: string;
  readonly projectId: string;
  readonly orgId: string;
  readonly trigger: DiscoveryTrigger;
  readonly status: ScopeDiscoveryRunStatus;
  readonly sourceSnapshot: ScopeDiscoverySourceSnapshot;
  readonly sourceFingerprint: string;
  readonly idempotencyKey: string;
  readonly idempotencyAction: IdempotencyAction;
  readonly contractVersion: string;
  readonly catalogueVersion: string;
  readonly promptVersion: string;
  readonly orchestrationVersion: string;
  readonly providerMetadata: OrchestrationProviderMetadata | null;
  readonly deterministicEvaluation: CatalogueEvaluationResult | null;
  readonly contextualProviderResult: ScopeDiscoveryProviderResult | null;
  readonly mergedSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly primarySuggestions: readonly ScopeDiscoverySuggestion[];
  readonly otherPossibilities: readonly ScopeDiscoverySuggestion[];
  readonly suppressedSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly conflicts: readonly {
    readonly code: string;
    readonly message: string;
    readonly identityKey: string;
  }[];
  readonly warnings: readonly string[];
  readonly errors: readonly {
    readonly code: OrchestrationErrorCode;
    readonly message: string;
    readonly details: readonly string[];
  }[];
  readonly decisionExplanations: readonly DecisionApplicationExplanation[];
  readonly providerCalled: boolean;
  readonly providerAuthorised: boolean;
  readonly providerRepairAttempted: boolean;
  readonly explicitRerunForced: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly latencyMs: number | null;
  readonly tokenUsage: {
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
  } | null;
  readonly reusedRunId: string | null;
  readonly supersededRunId: string | null;
  readonly failureCode: OrchestrationErrorCode | null;
  readonly failureMessage: string | null;
}

export interface ExecutionContext {
  readonly abortSignal?: AbortSignal;
  readonly providerTimeoutMs?: number;
  readonly callerRequestId?: string | null;
  /** Injected clock for tests. */
  readonly now?: () => Date;
}

/**
 * Injected contextual provider runner — orchestrator never imports Anthropic SDK.
 */
export type InjectedProviderRunner = (params: {
  readonly input: import("../provider/types").ScopeDiscoveryProviderInput;
  readonly signal?: AbortSignal;
}) => Promise<ScopeDiscoveryProviderResult>;
