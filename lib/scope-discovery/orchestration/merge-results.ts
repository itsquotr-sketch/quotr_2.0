import { mergeScopeSuggestions } from "../merge";
import { deepFreeze } from "../immutability";
import { identityKeyForSuggestion } from "../identity";
import { evaluateStaleness } from "../staleness";
import { validateScopeDiscoverySuggestion } from "../validation";
import type {
  MergeResult,
  PriorProposalRecord,
  RejectionRecord,
  ScopeDiscoverySuggestion,
  SourceSnapshot,
} from "../types";
import type { CatalogueEvaluationResult } from "../catalogue/evaluator";
import {
  ORCHESTRATION_ERROR_CODES,
  ScopeDiscoveryOrchestrationError,
} from "./errors";
import type {
  DecisionApplicationExplanation,
  PriorDecisionRecord,
  ScopeDiscoveryRequest,
} from "./types";

/**
 * Build rejection + prior proposal records from caller-supplied history.
 * Does not mutate prior records.
 */
export function buildPriorDecisionInputs(params: {
  readonly request: ScopeDiscoveryRequest;
  readonly currentSnapshot: SourceSnapshot;
}): {
  readonly rejections: readonly RejectionRecord[];
  readonly priorProposals: readonly PriorProposalRecord[];
  readonly explanations: readonly DecisionApplicationExplanation[];
  readonly modifiedRetained: readonly PriorDecisionRecord[];
} {
  const explanations: DecisionApplicationExplanation[] = [];
  const rejections: RejectionRecord[] = [...params.request.priorRejections];
  const priorProposals: PriorProposalRecord[] = [
    ...params.request.priorProposals,
  ];

  for (const decision of params.request.priorDecisions) {
    if (decision.status === "REJECTED" || decision.decisionType === "reject") {
      const synthetic: ScopeDiscoverySuggestion = {
        suggestionId: decision.suggestionId,
        projectId: params.request.projectId,
        orgId: params.request.orgId,
        analysisRunId: params.request.requestedRunId,
        suggestionKind: "WORK_AREA",
        proposedWorkAreaType: "deck",
        proposedTitle: "prior",
        proposedDescription: null,
        relatedWorkAreaId: null,
        parentSuggestionId: null,
        confidence: 0.5,
        confidenceBand: "MEDIUM",
        evidence: [],
        rationaleKey: "prior.reject",
        sourceSnapshot: decision.sourceSnapshot,
        dependencyReferences: [],
        conflictReferences: [],
        missingInformation: [],
        status: "REJECTED",
        decision: null,
        contractVersion: params.request.currentContractVersion,
        providerMetadata: null,
        createdAt: params.request.requestedAt,
        updatedAt: params.request.requestedAt,
        staleReason: null,
        supersededBySuggestionId: null,
        failureCode: null,
        failureMessage: null,
        catalogueEdgeId: null,
        origin: "deterministic",
      };
      const stale = evaluateStaleness({
        suggestion: synthetic,
        currentSnapshot: params.currentSnapshot,
      });
      if (!stale.suppressionResetEligible) {
        rejections.push({
          identityKey: decision.identityKey,
          sourceSnapshot: decision.sourceSnapshot,
          suggestionId: decision.suggestionId,
        });
        explanations.push({
          code: "rejection_suppressed",
          message:
            "Prior rejection remains active; unchanged identity stays suppressed.",
          identityKey: decision.identityKey,
          suggestionId: decision.suggestionId,
        });
      } else {
        explanations.push({
          code: "rejection_reconsideration_eligible",
          message:
            "Material source change makes prior rejection eligible for reconsideration.",
          identityKey: decision.identityKey,
          suggestionId: decision.suggestionId,
        });
      }
    }

    if (decision.status === "ACCEPTED" || decision.decisionType === "accept") {
      explanations.push({
        code: "accepted_preserved",
        message:
          "Accepted scope remains accepted; new analysis does not auto-stale it.",
        identityKey: decision.identityKey,
        suggestionId: decision.suggestionId,
      });
      priorProposals.push({
        identityKey: decision.identityKey,
        status: "ACCEPTED",
        sourceSnapshot: decision.sourceSnapshot,
        suggestionId: decision.suggestionId,
      });
    }

    if (decision.status === "MODIFIED" || decision.decisionType === "modify") {
      explanations.push({
        code: "modified_retained",
        message:
          "Modified suggestion retained as prior user correction (not DNA write).",
        identityKey: decision.identityKey,
        suggestionId: decision.suggestionId,
      });
      priorProposals.push({
        identityKey: decision.identityKey,
        status: "MODIFIED",
        sourceSnapshot: decision.sourceSnapshot,
        suggestionId: decision.suggestionId,
      });
    }

    if (decision.status === "STALE" || decision.status === "SUPERSEDED") {
      explanations.push({
        code: "historical_not_revived",
        message: "Stale or superseded proposal remains historical and is not revived.",
        identityKey: decision.identityKey,
        suggestionId: decision.suggestionId,
      });
    }
  }

  // Provider-only change check for rejections already handled by evaluateStaleness
  // (providerModelId is non-material).

  const modifiedRetained = params.request.priorDecisions.filter(
    (d) => d.status === "MODIFIED" || d.decisionType === "modify"
  );

  return deepFreeze({
    rejections,
    priorProposals,
    explanations,
    modifiedRetained,
  });
}

/**
 * Merge via Stage 3.1B.1 authority only — no competing algorithm.
 */
export function mergeDiscoveryStreams(params: {
  readonly deterministic: CatalogueEvaluationResult;
  readonly contextualSuggestions: readonly ScopeDiscoverySuggestion[];
  readonly acceptedWorkAreaTypes: readonly string[];
  readonly priorProposals: readonly PriorProposalRecord[];
  readonly rejections: readonly RejectionRecord[];
}): MergeResult {
  try {
    return mergeScopeSuggestions({
      deterministicSuggestions: params.deterministic.suggestions,
      aiSuggestions: params.contextualSuggestions,
      acceptedWorkAreaTypes: params.acceptedWorkAreaTypes,
      priorProposals: params.priorProposals,
      rejections: params.rejections,
    });
  } catch (error) {
    throw new ScopeDiscoveryOrchestrationError(
      ORCHESTRATION_ERROR_CODES.MERGE_FAILED,
      "Merge of deterministic and contextual suggestions failed.",
      [error instanceof Error ? error.message : "unknown"]
    );
  }
}

export function validateFinalSuggestions(
  suggestions: readonly ScopeDiscoverySuggestion[]
): {
  readonly ok: boolean;
  readonly valid: readonly ScopeDiscoverySuggestion[];
  readonly issues: readonly string[];
} {
  const valid: ScopeDiscoverySuggestion[] = [];
  const issues: string[] = [];
  for (const suggestion of suggestions) {
    const check = validateScopeDiscoverySuggestion(suggestion);
    if (!check.ok || !check.suggestion) {
      issues.push(
        ...check.issues.map(
          (i) =>
            `${identityKeyForSuggestion(suggestion)}: ${i.path} ${i.message}`
        )
      );
      continue;
    }
    if (check.suggestion.status !== "PROPOSED") {
      issues.push(
        `${identityKeyForSuggestion(suggestion)}: final suggestion must remain PROPOSED.`
      );
      continue;
    }
    valid.push(check.suggestion);
  }
  return deepFreeze({ ok: issues.length === 0, valid, issues });
}
