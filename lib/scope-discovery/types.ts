import type { ScopeDiscoveryErrorCode } from "./codes";
import type { SCOPE_DISCOVERY_CONTRACT_VERSION } from "./version";

export const SUGGESTION_KINDS = [
  "WORK_AREA",
  "SUB_SCOPE",
  "MISSING_SCOPE",
  "DEPENDENCY",
  "POSSIBLE_EXCLUSION",
  "CLARIFICATION_REQUIRED",
  "DUPLICATE_WARNING",
  "CONFLICT_WARNING",
] as const;

export type ScopeDiscoverySuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const SUGGESTION_STATUSES = [
  "PROPOSED",
  "ACCEPTED",
  "REJECTED",
  "MODIFIED",
  "SUPERSEDED",
  "STALE",
  "FAILED",
] as const;

export type ScopeDiscoverySuggestionStatus =
  (typeof SUGGESTION_STATUSES)[number];

export const CONFIDENCE_BANDS = ["HIGH", "MEDIUM", "LOW"] as const;

export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export const EVIDENCE_SOURCE_TYPES = [
  "PROJECT_BRIEF_TEXT",
  "SITE_NOTE",
  "USER_FACT",
  "CONSTRAINT",
  "EXISTING_WORK_AREA",
  "DETERMINISTIC_RULE",
  "USER_CORRECTION",
  "DOCUMENT_REFERENCE",
  "PHOTO_REFERENCE",
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export type EvidenceRelevance = "primary" | "supporting" | "contrary";

export type EvidenceProvenance =
  | "ai"
  | "deterministic_rule"
  | "user"
  | "system";

export type ScopeDiscoveryDecisionType = "accept" | "reject" | "modify";

export const TRANSITION_COMMANDS = [
  "ACCEPT",
  "REJECT",
  "MODIFY",
  "MARK_STALE",
  "SUPERSEDE",
  "MARK_FAILED",
] as const;

export type TransitionCommandType = (typeof TRANSITION_COMMANDS)[number];

export type DuplicateClass =
  | "EXACT_DUPLICATE"
  | "SEMANTIC_DUPLICATE"
  | "EXISTING_ACCEPTED_SCOPE"
  | "PREVIOUSLY_REJECTED"
  | "CONFLICTING_SUGGESTION"
  | "DISTINCT";

export type MaterialSourceKey =
  | "briefRevision"
  | "noteRevisionSet"
  | "factRevisions"
  | "constraintRevisions"
  | "workAreaRevisions"
  | "catalogueVersion"
  | "contractVersion";

export type StalenessReason =
  | "brief_changed"
  | "notes_changed"
  | "facts_changed"
  | "constraints_changed"
  | "work_areas_changed"
  | "catalogue_version_changed"
  | "contract_version_changed"
  | "material_source_changed";

export interface ValidationIssue {
  readonly code: ScopeDiscoveryErrorCode;
  readonly message: string;
  readonly path: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly suggestion: ScopeDiscoverySuggestion | null;
}

export interface EvidenceItem {
  readonly sourceType: EvidenceSourceType;
  readonly sourceId: string;
  readonly excerptOrValue: string;
  readonly relevance: EvidenceRelevance;
  readonly timestamp: string;
  readonly provenance: EvidenceProvenance;
  readonly userAuthored: boolean;
  readonly authoritative: boolean;
}

export interface ClarificationNeed {
  readonly key: string;
  readonly promptKey: string;
  readonly relatedFactKeys: readonly string[];
}

/**
 * Caller-normalized material source revisions/hashes.
 * Provider/model ids are intentionally excluded from material project sources.
 */
export interface SourceSnapshot {
  readonly briefRevision: string;
  readonly noteRevisionSet: string;
  readonly factRevisions: string;
  readonly constraintRevisions: string;
  readonly workAreaRevisions: string;
  readonly catalogueVersion: string;
  readonly contractVersion: string;
  /** Non-material metadata — changes here must not reset rejection alone. */
  readonly providerModelId: string | null;
  readonly formattingRevision: string | null;
}

export interface ProviderMetadata {
  readonly provider: string;
  readonly model: string;
  readonly requestId: string | null;
  readonly promptContractVersion: string | null;
}

export interface ScopeDiscoveryDecision {
  readonly decisionType: ScopeDiscoveryDecisionType;
  readonly decidedByUserId: string;
  readonly decidedAt: string;
  readonly originalSuggestionId: string;
  readonly modifiedTitle: string | null;
  readonly modifiedDescription: string | null;
  readonly modifiedWorkAreaType: string | null;
  readonly reasonCode: string | null;
  readonly userNote: string | null;
  readonly sourceRevision: string;
  readonly resultingWorkAreaId: string | null;
}

export interface ScopeDiscoverySuggestion {
  readonly suggestionId: string;
  readonly projectId: string;
  readonly orgId: string;
  readonly analysisRunId: string;
  readonly suggestionKind: ScopeDiscoverySuggestionKind;
  readonly proposedWorkAreaType: string | null;
  readonly proposedTitle: string;
  readonly proposedDescription: string | null;
  readonly relatedWorkAreaId: string | null;
  readonly parentSuggestionId: string | null;
  readonly confidence: number;
  readonly confidenceBand: ConfidenceBand;
  readonly evidence: readonly EvidenceItem[];
  readonly rationaleKey: string;
  readonly sourceSnapshot: SourceSnapshot;
  readonly dependencyReferences: readonly string[];
  readonly conflictReferences: readonly string[];
  readonly missingInformation: readonly ClarificationNeed[];
  readonly status: ScopeDiscoverySuggestionStatus;
  readonly decision: ScopeDiscoveryDecision | null;
  readonly contractVersion: typeof SCOPE_DISCOVERY_CONTRACT_VERSION | string;
  readonly providerMetadata: ProviderMetadata | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly staleReason: StalenessReason | null;
  readonly supersededBySuggestionId: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  /** Deterministic catalogue edge id when present. */
  readonly catalogueEdgeId: string | null;
  /** Origin stream for merge. */
  readonly origin: "deterministic" | "ai" | "merged";
}

export interface TransitionAuditMetadata {
  readonly actorUserId: string;
  readonly occurredAt: string;
  readonly sourceRevision: string;
  readonly note: string | null;
}

export type TransitionCommand =
  | {
      readonly type: "ACCEPT";
      readonly audit: TransitionAuditMetadata;
      readonly resultingWorkAreaId: string | null;
      readonly reasonCode: string | null;
    }
  | {
      readonly type: "REJECT";
      readonly audit: TransitionAuditMetadata;
      readonly reasonCode: string | null;
      readonly userNote: string | null;
    }
  | {
      readonly type: "MODIFY";
      readonly audit: TransitionAuditMetadata;
      readonly modifiedTitle: string;
      readonly modifiedDescription: string | null;
      readonly modifiedWorkAreaType: string | null;
      readonly resultingWorkAreaId: string | null;
      readonly reasonCode: string | null;
      readonly userNote: string | null;
    }
  | {
      readonly type: "MARK_STALE";
      readonly audit: TransitionAuditMetadata;
      readonly staleReason: StalenessReason;
    }
  | {
      readonly type: "SUPERSEDE";
      readonly audit: TransitionAuditMetadata;
      readonly supersededBySuggestionId: string;
    }
  | {
      readonly type: "MARK_FAILED";
      readonly audit: TransitionAuditMetadata;
      readonly failureCode: string;
      readonly failureMessage: string;
    };

export interface TransitionResult {
  readonly ok: boolean;
  readonly suggestion: ScopeDiscoverySuggestion | null;
  readonly issues: readonly ValidationIssue[];
  readonly fromStatus: ScopeDiscoverySuggestionStatus;
  readonly toStatus: ScopeDiscoverySuggestionStatus | null;
  readonly commandType: TransitionCommandType;
  readonly audit: TransitionAuditMetadata;
}

export interface SuggestionIdentityParts {
  readonly projectId: string;
  readonly suggestionKind: ScopeDiscoverySuggestionKind;
  readonly normalizedWorkAreaType: string | null;
  readonly relatedWorkAreaId: string | null;
  readonly normalizedParentScope: string | null;
  readonly catalogueEdgeId: string | null;
}

export interface StalenessEvaluation {
  readonly isStale: boolean;
  readonly reasons: readonly StalenessReason[];
  readonly changedSources: readonly MaterialSourceKey[];
  readonly suppressionResetEligible: boolean;
}

export interface PriorProposalRecord {
  readonly identityKey: string;
  readonly status: ScopeDiscoverySuggestionStatus;
  readonly sourceSnapshot: SourceSnapshot;
  readonly suggestionId: string;
}

export interface RejectionRecord {
  readonly identityKey: string;
  readonly sourceSnapshot: SourceSnapshot;
  readonly suggestionId: string;
}

export interface MergeConflict {
  readonly code: string;
  readonly message: string;
  readonly deterministicSuggestionId: string | null;
  readonly aiSuggestionId: string | null;
  readonly identityKey: string;
}

export interface MergeWarning {
  readonly code: string;
  readonly message: string;
  readonly suggestionId: string | null;
}

export interface MergeInput {
  readonly deterministicSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly aiSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly acceptedWorkAreaTypes: readonly string[];
  readonly priorProposals: readonly PriorProposalRecord[];
  readonly rejections: readonly RejectionRecord[];
}

export interface MergeResult {
  readonly primarySuggestions: readonly ScopeDiscoverySuggestion[];
  readonly otherPossibilities: readonly ScopeDiscoverySuggestion[];
  readonly suppressedSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly conflicts: readonly MergeConflict[];
  readonly duplicateClassifications: readonly {
    readonly suggestionId: string;
    readonly class: DuplicateClass;
    readonly againstId: string | null;
  }[];
  readonly mergeWarnings: readonly MergeWarning[];
}
