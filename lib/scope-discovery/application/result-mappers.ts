/**
 * Map orchestration / DB rows to safe application DTOs.
 */

import type { ScopeDiscoverySuggestion } from "../types";
import { identityKeyForSuggestion } from "../identity";
import type { ScopeDiscoveryRunResult } from "../orchestration/types";
import type { DiscoverySuggestionDetailRow } from "../persistence/suggestion-repository";
import type { DiscoveryDecisionDetailRow } from "../persistence/decision-repository";
import {
  formatEvidenceSummaries,
  formatMissingInformationSummaries,
  whySuggestedText,
} from "../ui";
import { evaluateDecidability } from "../classification";
import type {
  ComposedDecisionState,
  SafeEvidenceSummary,
  SafeRunResult,
  SafeSuggestionView,
} from "./types";

export function summariseEvidence(evidence: unknown): SafeEvidenceSummary {
  if (!Array.isArray(evidence)) {
    return { count: 0, primarySourceTypes: [], summaries: [] };
  }
  const types = new Set<string>();
  for (const item of evidence) {
    if (
      item &&
      typeof item === "object" &&
      "sourceType" in item &&
      typeof (item as { sourceType: unknown }).sourceType === "string"
    ) {
      types.add((item as { sourceType: string }).sourceType);
    }
  }
  return {
    count: evidence.length,
    primarySourceTypes: [...types].slice(0, 8),
    summaries: formatEvidenceSummaries(evidence),
  };
}

export function composeDecisionState(params: {
  readonly staleReason: string | null;
  readonly supersededBySuggestionId: string | null;
  readonly latestDecisionType: string | null;
}): ComposedDecisionState {
  if (params.supersededBySuggestionId) return "SUPERSEDED";
  if (params.staleReason) return "STALE";
  const t = (params.latestDecisionType ?? "").toUpperCase();
  if (t === "ACCEPT") return "ACCEPTED";
  if (t === "REJECT") return "REJECTED";
  if (t === "MODIFY") return "MODIFIED";
  return "PROPOSED";
}

export function originHintFromMetadata(
  providerMetadata: Record<string, unknown> | null
): "deterministic" | "ai" | "unknown" {
  if (!providerMetadata) return "deterministic";
  if (providerMetadata.origin === "deterministic") return "deterministic";
  if (providerMetadata.origin === "ai" || providerMetadata.provider) return "ai";
  return "unknown";
}

export function mapDbSuggestionToSafeView(
  row: DiscoverySuggestionDetailRow,
  decision: DiscoveryDecisionDetailRow | null
): SafeSuggestionView {
  const originHint = originHintFromMetadata(row.provider_metadata);
  const decisionState = composeDecisionState({
    staleReason: row.stale_reason,
    supersededBySuggestionId: row.superseded_by_suggestion_id,
    latestDecisionType: decision?.decision_type ?? null,
  });
  const decidability = evaluateDecidability({
    suggestionKind: row.suggestion_kind,
    proposedWorkAreaType: row.proposed_work_area_type,
    relatedWorkAreaId: row.related_work_area_id,
    decisionState,
    proposedTitle: row.proposed_title,
  });
  return {
    suggestionId: row.id,
    runId: row.run_id,
    suggestionIdentity: row.suggestion_identity,
    suggestionKind: row.suggestion_kind,
    proposedWorkAreaType: row.proposed_work_area_type,
    proposedTitle: row.proposed_title,
    proposedDescription: row.proposed_description,
    confidence: row.confidence,
    confidenceBand: row.confidence_band,
    rationaleCode: row.rationale_code,
    whySuggested: whySuggestedText({
      rationaleCode: row.rationale_code,
      suggestionKind: row.suggestion_kind,
      originHint,
    }),
    decisionState,
    decisionId: decision?.id ?? null,
    createdWorkAreaId: decision?.created_work_area_id ?? null,
    evidence: summariseEvidence(row.evidence),
    missingInformationSummaries: formatMissingInformationSummaries(
      row.missing_information ?? []
    ),
    staleReason: row.stale_reason,
    supersededBySuggestionId: row.superseded_by_suggestion_id,
    originHint,
    relatedWorkAreaId: row.related_work_area_id,
    proposalClass: decidability.proposalClass,
    actionFamily: decidability.actionFamily,
    canDecide: decidability.canDecide,
    canCreateWorkArea: decidability.canCreateWorkArea,
    canIncludeInScope: decidability.canIncludeInScope,
    decidabilityReason: decidability.reason,
  };
}

export function partitionSafeSuggestions(
  views: readonly SafeSuggestionView[]
): {
  readonly primary: SafeSuggestionView[];
  readonly other: SafeSuggestionView[];
  readonly conflicts: SafeSuggestionView[];
} {
  const primary: SafeSuggestionView[] = [];
  const other: SafeSuggestionView[] = [];
  const conflicts: SafeSuggestionView[] = [];

  for (const v of views) {
    if (
      v.suggestionKind === "CONFLICT_WARNING" ||
      v.suggestionKind === "DUPLICATE_WARNING"
    ) {
      conflicts.push(v);
      continue;
    }
    if (
      v.confidenceBand === "LOW" ||
      v.suggestionKind === "POSSIBLE_EXCLUSION" ||
      v.suggestionKind === "CLARIFICATION_REQUIRED"
    ) {
      other.push(v);
      continue;
    }
    primary.push(v);
  }

  return { primary, other, conflicts };
}

export function countOrigins(suggestions: readonly ScopeDiscoverySuggestion[]): {
  deterministic: number;
  contextual: number;
} {
  let deterministic = 0;
  let contextual = 0;
  for (const s of suggestions) {
    if (s.origin === "ai") contextual += 1;
    else deterministic += 1;
  }
  return { deterministic, contextual };
}

export function mapOrchestrationToSafeRunResult(params: {
  readonly result: ScopeDiscoveryRunResult;
  readonly reused: boolean;
  readonly stale: boolean;
  readonly message: string;
}): SafeRunResult {
  const { result } = params;
  const origins = countOrigins(result.mergedSuggestions);
  return {
    ok: true,
    success: true,
    runId: params.reused
      ? (result.reusedRunId ?? result.runId)
      : result.runId,
    projectId: result.projectId,
    status: result.status,
    reused: params.reused,
    reusedRunId: result.reusedRunId,
    deterministicSuggestionCount: origins.deterministic,
    contextualSuggestionCount: origins.contextual,
    primaryCount: result.primarySuggestions.length,
    otherPossibilityCount: result.otherPossibilities.length,
    conflictCount: result.conflicts.length,
    suppressedCount: result.suppressedSuggestions.length,
    warnings: result.warnings.slice(0, 20).map((w) => String(w).slice(0, 240)),
    stale: params.stale,
    message: params.message,
    latencyMs: result.latencyMs,
    featureEnabled: true,
  };
}

export function suggestionToPersistInput(
  suggestion: ScopeDiscoverySuggestion,
  runId: string,
  catalogueVersion: string
) {
  return {
    id: suggestion.suggestionId,
    runId,
    projectId: suggestion.projectId,
    suggestionIdentity: identityKeyForSuggestion(suggestion),
    suggestionKind: suggestion.suggestionKind,
    proposedWorkAreaType: suggestion.proposedWorkAreaType,
    proposedTitle: suggestion.proposedTitle,
    proposedDescription: suggestion.proposedDescription,
    relatedWorkAreaId: suggestion.relatedWorkAreaId,
    parentSuggestionId: suggestion.parentSuggestionId,
    confidence: suggestion.confidence,
    confidenceBand: suggestion.confidenceBand,
    evidence: suggestion.evidence,
    sourceSnapshot: suggestion.sourceSnapshot as unknown as Record<
      string,
      unknown
    >,
    dependencyReferences: suggestion.dependencyReferences,
    conflictReferences: suggestion.conflictReferences,
    missingInformation: suggestion.missingInformation,
    rationaleCode: suggestion.rationaleKey,
    contractVersion: suggestion.contractVersion,
    catalogueVersion,
    promptVersion: suggestion.providerMetadata?.promptContractVersion ?? null,
    providerMetadata: suggestion.providerMetadata
      ? {
          provider: suggestion.providerMetadata.provider,
          model: suggestion.providerMetadata.model,
          requestId: suggestion.providerMetadata.requestId,
          origin: suggestion.origin,
        }
      : { origin: suggestion.origin },
  };
}
