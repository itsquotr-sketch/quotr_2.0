import type {
  DiscoveryTrigger,
  ScopeDiscoveryRunStatus,
} from "../orchestration/types";
import type {
  ConfidenceBand,
  ScopeDiscoverySuggestionKind,
} from "../types";

export type DbDecisionType = "ACCEPT" | "REJECT" | "MODIFY";

export interface PersistRunInput {
  readonly id: string;
  readonly projectId: string;
  readonly trigger: DiscoveryTrigger;
  readonly status: ScopeDiscoveryRunStatus;
  readonly sourceFingerprint: string;
  readonly idempotencyKey: string;
  readonly contractVersion: string;
  readonly catalogueVersion: string;
  readonly promptVersion: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly analysisObjective: string;
  readonly sourceSnapshot: Record<string, unknown>;
  readonly providerMetadata: Record<string, unknown> | null;
  readonly warnings: readonly unknown[];
  readonly errors: readonly unknown[];
  readonly latencyMs: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly repairAttempted: boolean;
  readonly providerCalled: boolean;
  readonly reusedRunId: string | null;
  readonly supersededRunId: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export interface CompleteRunInput {
  readonly runId: string;
  readonly projectId: string;
  readonly status: Exclude<ScopeDiscoveryRunStatus, "RUNNING" | "VALIDATED">;
  readonly warnings?: readonly unknown[];
  readonly errors?: readonly unknown[];
  readonly latencyMs?: number | null;
  readonly inputTokens?: number | null;
  readonly outputTokens?: number | null;
  readonly repairAttempted?: boolean;
  readonly providerCalled?: boolean;
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly providerMetadata?: Record<string, unknown> | null;
  readonly completedAt: string;
}

export interface PersistSuggestionInput {
  readonly id: string;
  readonly runId: string;
  readonly projectId: string;
  readonly suggestionIdentity: string;
  readonly suggestionKind: ScopeDiscoverySuggestionKind;
  readonly proposedWorkAreaType: string | null;
  readonly proposedTitle: string;
  readonly proposedDescription: string | null;
  readonly relatedWorkAreaId: string | null;
  readonly parentSuggestionId: string | null;
  readonly confidence: number | null;
  readonly confidenceBand: ConfidenceBand;
  readonly evidence: readonly unknown[];
  readonly sourceSnapshot: Record<string, unknown>;
  readonly dependencyReferences: readonly unknown[];
  readonly conflictReferences: readonly unknown[];
  readonly missingInformation: readonly unknown[];
  readonly rationaleCode: string;
  readonly contractVersion: string;
  readonly catalogueVersion: string;
  readonly promptVersion: string | null;
  readonly providerMetadata: Record<string, unknown> | null;
}

export interface MarkSuggestionStaleInput {
  readonly suggestionId: string;
  readonly projectId: string;
  readonly staleReason: string | null;
  readonly supersededBySuggestionId: string | null;
}

export interface PersistDecisionInput {
  readonly id: string;
  readonly projectId: string;
  readonly runId: string;
  readonly suggestionId: string;
  readonly decisionType: DbDecisionType;
  readonly decidedAt: string;
  readonly reasonCode: string | null;
  readonly userNote: string | null;
  readonly modifiedTitle: string | null;
  readonly modifiedDescription: string | null;
  readonly modifiedWorkAreaType: string | null;
  readonly sourceRevision: string;
  /** Must remain null in this batch — no WA creation from persistence helpers. */
  readonly createdWorkAreaId: null;
}

export interface ScopeDiscoveryRunRow {
  readonly id: string;
  readonly org_id: string;
  readonly project_id: string;
  readonly status: string;
  readonly idempotency_key: string;
  readonly source_fingerprint: string;
  readonly contract_version: string;
  readonly catalogue_version: string;
  readonly prompt_version: string;
}

export interface ScopeDiscoverySuggestionRow {
  readonly id: string;
  readonly org_id: string;
  readonly project_id: string;
  readonly run_id: string;
  readonly suggestion_identity: string;
  readonly suggestion_kind: string;
  readonly original_status: string;
  readonly evidence: unknown;
}

export interface ScopeDiscoveryDecisionRow {
  readonly id: string;
  readonly org_id: string;
  readonly project_id: string;
  readonly suggestion_id: string;
  readonly decision_type: string;
  readonly decided_by: string;
  readonly decided_at: string;
}
