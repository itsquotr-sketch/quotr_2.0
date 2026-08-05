import { deepFreeze } from "../immutability";
import type { CatalogueEvaluationResult } from "../catalogue/evaluator";
import type { ScopeDiscoveryProviderResult } from "../provider/types";
import type { ScopeDiscoverySuggestion } from "../types";
import {
  ORCHESTRATION_ERROR_CODES,
  safeOrchestrationFailureMessage,
  type OrchestrationErrorCode,
} from "./errors";
import type {
  DecisionApplicationExplanation,
  DiscoveryTrigger,
  IdempotencyAction,
  OrchestrationProviderMetadata,
  ScopeDiscoveryRunResult,
  ScopeDiscoveryRunStatus,
  ScopeDiscoverySourceSnapshot,
} from "./types";
import { SCOPE_DISCOVERY_ORCHESTRATION_VERSION } from "./version";

export function buildRunResult(params: {
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
  readonly providerMetadata?: OrchestrationProviderMetadata | null;
  readonly deterministicEvaluation?: CatalogueEvaluationResult | null;
  readonly contextualProviderResult?: ScopeDiscoveryProviderResult | null;
  readonly mergedSuggestions?: readonly ScopeDiscoverySuggestion[];
  readonly primarySuggestions?: readonly ScopeDiscoverySuggestion[];
  readonly otherPossibilities?: readonly ScopeDiscoverySuggestion[];
  readonly suppressedSuggestions?: readonly ScopeDiscoverySuggestion[];
  readonly conflicts?: readonly {
    readonly code: string;
    readonly message: string;
    readonly identityKey: string;
  }[];
  readonly warnings?: readonly string[];
  readonly errors?: readonly {
    readonly code: OrchestrationErrorCode;
    readonly message: string;
    readonly details: readonly string[];
  }[];
  readonly decisionExplanations?: readonly DecisionApplicationExplanation[];
  readonly providerCalled?: boolean;
  readonly providerAuthorised?: boolean;
  readonly providerRepairAttempted?: boolean;
  readonly explicitRerunForced?: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly latencyMs?: number | null;
  readonly tokenUsage?: {
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
  } | null;
  readonly reusedRunId?: string | null;
  readonly supersededRunId?: string | null;
  readonly failureCode?: OrchestrationErrorCode | null;
}): ScopeDiscoveryRunResult {
  const failureCode = params.failureCode ?? null;
  return deepFreeze({
    runId: params.runId,
    projectId: params.projectId,
    orgId: params.orgId,
    trigger: params.trigger,
    status: params.status,
    sourceSnapshot: params.sourceSnapshot,
    sourceFingerprint: params.sourceFingerprint,
    idempotencyKey: params.idempotencyKey,
    idempotencyAction: params.idempotencyAction,
    contractVersion: params.contractVersion,
    catalogueVersion: params.catalogueVersion,
    promptVersion: params.promptVersion,
    orchestrationVersion: SCOPE_DISCOVERY_ORCHESTRATION_VERSION,
    providerMetadata: params.providerMetadata ?? null,
    deterministicEvaluation: params.deterministicEvaluation ?? null,
    contextualProviderResult: params.contextualProviderResult ?? null,
    mergedSuggestions: params.mergedSuggestions ?? [],
    primarySuggestions: params.primarySuggestions ?? [],
    otherPossibilities: params.otherPossibilities ?? [],
    suppressedSuggestions: params.suppressedSuggestions ?? [],
    conflicts: params.conflicts ?? [],
    warnings: params.warnings ?? [],
    errors: params.errors ?? [],
    decisionExplanations: params.decisionExplanations ?? [],
    providerCalled: params.providerCalled ?? false,
    providerAuthorised: params.providerAuthorised ?? false,
    providerRepairAttempted: params.providerRepairAttempted ?? false,
    explicitRerunForced: params.explicitRerunForced ?? false,
    startedAt: params.startedAt,
    completedAt: params.completedAt,
    latencyMs: params.latencyMs ?? null,
    tokenUsage: params.tokenUsage ?? null,
    reusedRunId: params.reusedRunId ?? null,
    supersededRunId: params.supersededRunId ?? null,
    failureCode,
    failureMessage: failureCode
      ? safeOrchestrationFailureMessage(failureCode)
      : null,
  });
}

export function failureError(
  code: OrchestrationErrorCode,
  details: readonly string[] = []
): {
  readonly code: OrchestrationErrorCode;
  readonly message: string;
  readonly details: readonly string[];
} {
  return {
    code,
    message: safeOrchestrationFailureMessage(code),
    details,
  };
}

export { ORCHESTRATION_ERROR_CODES };
