/**
 * Application-layer types for gated scope discovery (3.1B.5C).
 * Safe DTOs for server actions — no raw provider bodies or secrets.
 */

import type { ConfidenceBand, ScopeDiscoverySuggestionKind } from "../types";
import type { ScopeDiscoveryRunStatus } from "../orchestration/types";
import type { ApplicationErrorCode } from "./errors";

export const DEFAULT_ANALYSIS_OBJECTIVE =
  "Discover likely missing and related work areas for this project." as const;

export const SOURCE_BOUNDS = Object.freeze({
  maxSiteNotes: 40,
  maxWorkAreas: 40,
  maxFacts: 200,
  maxConstraints: 80,
  maxPriorRuns: 20,
  maxPriorSuggestions: 100,
  maxPriorDecisions: 200,
  maxBriefChars: 5000,
  maxNoteChars: 4000,
});

export type ComposedDecisionState =
  | "PROPOSED"
  | "ACCEPTED"
  | "REJECTED"
  | "MODIFIED"
  | "STALE"
  | "SUPERSEDED";

export interface SafeEvidenceSummary {
  readonly count: number;
  readonly primarySourceTypes: readonly string[];
}

export interface SafeSuggestionView {
  readonly suggestionId: string;
  readonly runId: string;
  readonly suggestionIdentity: string;
  readonly suggestionKind: ScopeDiscoverySuggestionKind | string;
  readonly proposedWorkAreaType: string | null;
  readonly proposedTitle: string;
  readonly proposedDescription: string | null;
  readonly confidence: number | null;
  readonly confidenceBand: ConfidenceBand | string;
  readonly rationaleCode: string;
  readonly decisionState: ComposedDecisionState;
  readonly decisionId: string | null;
  readonly createdWorkAreaId: string | null;
  readonly evidence: SafeEvidenceSummary;
  readonly staleReason: string | null;
  readonly supersededBySuggestionId: string | null;
  readonly originHint: "deterministic" | "ai" | "unknown";
}

export interface SafeRunResult {
  readonly ok: true;
  readonly success: true;
  readonly runId: string;
  readonly projectId: string;
  readonly status: ScopeDiscoveryRunStatus | string;
  readonly reused: boolean;
  readonly reusedRunId: string | null;
  readonly deterministicSuggestionCount: number;
  readonly contextualSuggestionCount: number;
  readonly primaryCount: number;
  readonly otherPossibilityCount: number;
  readonly conflictCount: number;
  readonly suppressedCount: number;
  readonly warnings: readonly string[];
  readonly stale: boolean;
  readonly message: string;
  readonly latencyMs: number | null;
  readonly featureEnabled: true;
}

export interface SafeDecisionResult {
  readonly ok: true;
  readonly success: true;
  readonly decisionId: string;
  readonly suggestionId: string;
  readonly projectId: string;
  readonly decisionType: "ACCEPT" | "REJECT" | "MODIFY";
  readonly createdWorkAreaId: string | null;
  readonly idempotentReuse: boolean;
  readonly message: string;
}

export interface ApplicationFailure {
  readonly ok: false;
  readonly success: false;
  readonly code: ApplicationErrorCode;
  readonly message: string;
}

export type RunDiscoveryOutcome = SafeRunResult | ApplicationFailure;
export type DecisionOutcome = SafeDecisionResult | ApplicationFailure;

export interface SafeResultsRead {
  readonly ok: true;
  readonly featureEnabled: boolean;
  readonly projectId: string;
  readonly runId: string | null;
  readonly status: string | null;
  readonly stale: boolean;
  readonly staleReasons: readonly string[];
  readonly primarySuggestions: readonly SafeSuggestionView[];
  readonly otherPossibilities: readonly SafeSuggestionView[];
  readonly conflicts: readonly SafeSuggestionView[];
  readonly suppressedCount: number;
  readonly warnings: readonly string[];
  readonly message: string;
}

export type ResultsReadOutcome = SafeResultsRead | ApplicationFailure;

export interface StaleEvaluationOutcome {
  readonly ok: true;
  readonly projectId: string;
  readonly runId: string | null;
  readonly stale: boolean;
  readonly comparison: string;
  readonly reasons: readonly string[];
  readonly changedSources: readonly string[];
  readonly message: string;
}

export type StaleOutcome = StaleEvaluationOutcome | ApplicationFailure;

export interface RunDiscoveryInput {
  readonly projectId: string;
  readonly forceNewRun?: boolean;
  readonly analysisObjective?: string;
}

export interface GetResultsInput {
  readonly projectId: string;
  readonly runId?: string;
}

export interface AcceptDecisionAppInput {
  readonly suggestionId: string;
  readonly projectId: string;
  readonly sourceRevision: string;
  readonly reasonCode?: string | null;
  readonly userNote?: string | null;
}

export interface RejectDecisionAppInput {
  readonly suggestionId: string;
  readonly projectId: string;
  readonly sourceRevision: string;
  readonly reasonCode?: string | null;
  readonly userNote?: string | null;
}

export interface ModifyDecisionAppInput {
  readonly suggestionId: string;
  readonly projectId: string;
  readonly sourceRevision: string;
  readonly modifiedTitle: string;
  readonly modifiedDescription?: string | null;
  readonly modifiedWorkAreaType: string;
  readonly reasonCode?: string | null;
  readonly userNote?: string | null;
}
