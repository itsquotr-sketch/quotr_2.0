import type {
  DuplicateClass,
  ScopeDiscoverySuggestion,
  ScopeDiscoverySuggestionKind,
  SuggestionIdentityParts,
} from "./types";

export function normalizeWorkAreaType(type: string | null): string | null {
  if (!type) return null;
  return type.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function buildSuggestionIdentity(
  input: SuggestionIdentityParts
): string {
  const parts = [
    input.projectId,
    input.suggestionKind,
    input.normalizedWorkAreaType ?? "-",
    input.relatedWorkAreaId ?? "-",
    input.normalizedParentScope ?? "-",
    input.catalogueEdgeId ?? "-",
  ];
  return parts.join("|");
}

export function identityPartsFromSuggestion(
  suggestion: ScopeDiscoverySuggestion
): SuggestionIdentityParts {
  return {
    projectId: suggestion.projectId,
    suggestionKind: suggestion.suggestionKind,
    normalizedWorkAreaType: normalizeWorkAreaType(
      suggestion.proposedWorkAreaType
    ),
    relatedWorkAreaId: suggestion.relatedWorkAreaId,
    normalizedParentScope: suggestion.parentSuggestionId,
    catalogueEdgeId: suggestion.catalogueEdgeId,
  };
}

export function identityKeyForSuggestion(
  suggestion: ScopeDiscoverySuggestion
): string {
  return buildSuggestionIdentity(identityPartsFromSuggestion(suggestion));
}

/**
 * Deterministic duplicate classification — no fuzzy AI similarity.
 */
export function classifyDuplicate(input: {
  readonly candidate: ScopeDiscoverySuggestion;
  readonly against: ScopeDiscoverySuggestion | null;
  readonly acceptedWorkAreaTypes: readonly string[];
  readonly priorRejectionIdentityKeys: readonly string[];
  readonly rejectionSuppressionActive: boolean;
}): DuplicateClass {
  const candidateKey = identityKeyForSuggestion(input.candidate);
  const candidateType = normalizeWorkAreaType(
    input.candidate.proposedWorkAreaType
  );

  if (
    candidateType &&
    input.acceptedWorkAreaTypes
      .map((t) => normalizeWorkAreaType(t))
      .includes(candidateType)
  ) {
    return "EXISTING_ACCEPTED_SCOPE";
  }

  if (
    input.rejectionSuppressionActive &&
    input.priorRejectionIdentityKeys.includes(candidateKey)
  ) {
    return "PREVIOUSLY_REJECTED";
  }

  if (!input.against) {
    return "DISTINCT";
  }

  const againstKey = identityKeyForSuggestion(input.against);
  if (candidateKey === againstKey) {
    return "EXACT_DUPLICATE";
  }

  const sameKind =
    input.candidate.suggestionKind === input.against.suggestionKind;
  const sameType =
    candidateType !== null &&
    candidateType ===
      normalizeWorkAreaType(input.against.proposedWorkAreaType);
  const sameEdge =
    input.candidate.catalogueEdgeId !== null &&
    input.candidate.catalogueEdgeId === input.against.catalogueEdgeId;

  if (sameKind && (sameType || sameEdge)) {
    if (
      input.candidate.conflictReferences.length > 0 ||
      input.against.conflictReferences.length > 0 ||
      input.candidate.suggestionKind === "CONFLICT_WARNING"
    ) {
      return "CONFLICTING_SUGGESTION";
    }
    return "SEMANTIC_DUPLICATE";
  }

  // Title-only differences with different identity remain DISTINCT.
  return "DISTINCT";
}

export function kindsThatRequireWorkAreaType(): readonly ScopeDiscoverySuggestionKind[] {
  return ["WORK_AREA", "SUB_SCOPE", "MISSING_SCOPE", "DEPENDENCY"] as const;
}
