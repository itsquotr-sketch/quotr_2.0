import type {
  ConfidenceBand,
  ScopeDiscoverySuggestion,
  ScopeDiscoverySuggestionKind,
  SourceSnapshot,
} from "../types";
import type { ProviderErrorCode } from "./errors";
import type { SCOPE_DISCOVERY_PROMPT_VERSION } from "./version";

export const PROVIDER_INPUT_LIMITS = Object.freeze({
  maxBriefChars: 5000,
  maxNotes: 20,
  maxNoteChars: 2000,
  maxWorkAreas: 40,
  maxFacts: 80,
  maxConstraints: 40,
  maxDeterministicSuggestions: 60,
  maxDeterministicSuppressions: 60,
  maxDeterministicConflicts: 40,
  maxOutputCandidates: 30,
});

export interface ProviderSiteNote {
  readonly noteId: string;
  readonly content: string;
}

export interface ProviderWorkAreaRef {
  readonly workAreaId: string;
  readonly type: string;
  readonly title: string | null;
}

export interface ProviderFactRef {
  readonly key: string;
  readonly value: string | number | boolean | null;
}

export interface ProviderConstraintRef {
  readonly key: string;
  readonly value: string | number | boolean | null;
}

export interface DeterministicSuppressionRef {
  readonly relationshipId: string;
  readonly candidateScopeType: string;
  readonly reason: string;
}

export interface DeterministicConflictRef {
  readonly relationshipId: string;
  readonly candidateScopeType: string;
  readonly reason: string;
}

export interface ScopeDiscoveryProviderInput {
  readonly projectId: string;
  readonly orgId: string;
  readonly analysisRunId: string;
  readonly projectBrief: string;
  readonly selectedSiteNotes: readonly ProviderSiteNote[];
  readonly acceptedWorkAreas: readonly ProviderWorkAreaRef[];
  readonly relevantFacts: readonly ProviderFactRef[];
  readonly relevantConstraints: readonly ProviderConstraintRef[];
  readonly deterministicSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly deterministicSuppressions: readonly DeterministicSuppressionRef[];
  readonly deterministicConflicts: readonly DeterministicConflictRef[];
  readonly sourceSnapshot: SourceSnapshot;
  readonly catalogueVersion: string;
  readonly contractVersion: string;
  readonly region: string | null;
  readonly analysisObjective: string;
}

export interface ProviderRawCandidate {
  readonly suggestionKind: ScopeDiscoverySuggestionKind;
  readonly proposedWorkAreaType: string;
  readonly proposedTitle: string;
  readonly proposedDescription: string | null;
  readonly relatedWorkAreaReference: string | null;
  readonly parentSuggestionReference: string | null;
  readonly confidenceBand: ConfidenceBand;
  readonly evidenceReferences: readonly string[];
  readonly rationaleCode: string;
  readonly missingInformation: readonly {
    readonly key: string;
    readonly promptKey: string;
    readonly relatedFactKeys: readonly string[];
  }[];
  readonly dependencyReferences: readonly string[];
  readonly conflictReferences: readonly string[];
}

export interface ProviderRawOutput {
  readonly candidates: readonly ProviderRawCandidate[];
  readonly warnings: readonly string[];
}

export interface TokenUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface ScopeDiscoveryTransportRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly isRepair: boolean;
}

export interface ScopeDiscoveryTransportResponse {
  readonly text: string;
  readonly model: string;
  readonly requestId: string | null;
  readonly tokenUsage: TokenUsage;
  readonly latencyMs: number;
}

export type ScopeDiscoveryTransport = (
  request: ScopeDiscoveryTransportRequest
) => Promise<ScopeDiscoveryTransportResponse>;

export interface ScopeDiscoveryProviderResult {
  readonly success: boolean;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: typeof SCOPE_DISCOVERY_PROMPT_VERSION | string;
  readonly contractVersion: string;
  readonly catalogueVersion: string;
  readonly analysisRunId: string;
  readonly contextualSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly warnings: readonly string[];
  readonly validationErrors: readonly string[];
  readonly repairAttempted: boolean;
  readonly latencyMs: number;
  readonly tokenUsage: TokenUsage | null;
  readonly failureCode: ProviderErrorCode | null;
  readonly failureMessage: string | null;
}

export interface AllowedEvidenceCatalog {
  readonly refs: ReadonlySet<string>;
}
