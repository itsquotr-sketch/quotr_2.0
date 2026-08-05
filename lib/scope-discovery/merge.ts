import { compareSuggestions, dedupeByIdentity } from "./deduplication";
import { deepFreeze } from "./immutability";
import {
  identityKeyForSuggestion,
  normalizeWorkAreaType,
} from "./identity";
import { evaluateStaleness } from "./staleness";
import type {
  DuplicateClass,
  MergeConflict,
  MergeInput,
  MergeResult,
  MergeWarning,
  RejectionRecord,
  ScopeDiscoverySuggestion,
  SourceSnapshot,
} from "./types";

/**
 * Deterministic-first merge of catalogue/rules suggestions with AI suggestions.
 * OCD-ISD-05: deterministic required/suppress/conflict wins.
 * OCD-ISD-02: LOW band → otherPossibilities.
 * OCD-ISD-03: rejections suppress until material source change.
 */
export function mergeScopeSuggestions(input: MergeInput): MergeResult {
  const conflicts: MergeConflict[] = [];
  const warnings: MergeWarning[] = [];
  const classifications: {
    suggestionId: string;
    class: DuplicateClass;
    againstId: string | null;
  }[] = [];
  const suppressed: ScopeDiscoverySuggestion[] = [];
  const working = new Map<string, ScopeDiscoverySuggestion>();
  const acceptedTypes = input.acceptedWorkAreaTypes;

  for (const suggestion of [...input.deterministicSuggestions].sort(
    compareSuggestions
  )) {
    ingest(suggestion, {
      working,
      acceptedTypes,
      rejections: input.rejections,
      suppressed,
      classifications,
      conflicts,
      warnings,
      isAi: false,
    });
  }

  for (const suggestion of [...input.aiSuggestions].sort(compareSuggestions)) {
    ingest(suggestion, {
      working,
      acceptedTypes,
      rejections: input.rejections,
      suppressed,
      classifications,
      conflicts,
      warnings,
      isAi: true,
    });
  }

  const { unique } = dedupeByIdentity([...working.values()]);
  const primary: ScopeDiscoverySuggestion[] = [];
  const other: ScopeDiscoverySuggestion[] = [];
  for (const suggestion of unique) {
    if (suggestion.confidenceBand === "LOW") {
      other.push(suggestion);
    } else {
      primary.push(suggestion);
    }
  }

  primary.sort(compareSuggestions);
  other.sort(compareSuggestions);

  return deepFreeze({
    primarySuggestions: primary,
    otherPossibilities: other,
    suppressedSuggestions: suppressed,
    conflicts,
    duplicateClassifications: classifications,
    mergeWarnings: warnings,
  });
}

function ingest(
  suggestion: ScopeDiscoverySuggestion,
  ctx: {
    working: Map<string, ScopeDiscoverySuggestion>;
    acceptedTypes: readonly string[];
    rejections: readonly RejectionRecord[];
    suppressed: ScopeDiscoverySuggestion[];
    classifications: {
      suggestionId: string;
      class: DuplicateClass;
      againstId: string | null;
    }[];
    conflicts: MergeConflict[];
    warnings: MergeWarning[];
    isAi: boolean;
  }
): void {
  const key = identityKeyForSuggestion(suggestion);
  const type = normalizeWorkAreaType(suggestion.proposedWorkAreaType);

  if (
    type &&
    ctx.acceptedTypes.some((t) => normalizeWorkAreaType(t) === type)
  ) {
    ctx.classifications.push({
      suggestionId: suggestion.suggestionId,
      class: "EXISTING_ACCEPTED_SCOPE",
      againstId: null,
    });
    ctx.suppressed.push(suggestion);
    return;
  }

  const rejection = findActiveRejection(
    key,
    suggestion.sourceSnapshot,
    ctx.rejections
  );
  if (rejection) {
    ctx.classifications.push({
      suggestionId: suggestion.suggestionId,
      class: "PREVIOUSLY_REJECTED",
      againstId: rejection.suggestionId,
    });
    ctx.suppressed.push(suggestion);
    return;
  }

  const existing = ctx.working.get(key);
  if (ctx.isAi) {
    const suppressor = [...ctx.working.values()].find((d) => {
      if (d.origin === "ai") return false;
      const sameType =
        type !== null &&
        normalizeWorkAreaType(d.proposedWorkAreaType) === type;
      const sameEdge =
        suggestion.catalogueEdgeId !== null &&
        suggestion.catalogueEdgeId === d.catalogueEdgeId;
      const isSuppressKind =
        d.suggestionKind === "CONFLICT_WARNING" ||
        d.suggestionKind === "POSSIBLE_EXCLUSION" ||
        d.conflictReferences.length > 0;
      return isSuppressKind && (sameType || sameEdge);
    });

    if (suppressor) {
      ctx.conflicts.push({
        code: "deterministic_conflict_precedence",
        message:
          "Deterministic conflict/suppress rule takes precedence; AI cannot bypass.",
        deterministicSuggestionId: suppressor.suggestionId,
        aiSuggestionId: suggestion.suggestionId,
        identityKey: key,
      });
      ctx.classifications.push({
        suggestionId: suggestion.suggestionId,
        class: "CONFLICTING_SUGGESTION",
        againstId: suppressor.suggestionId,
      });
      ctx.suppressed.push(suggestion);
      return;
    }
  }

  if (existing && ctx.isAi) {
    const merged = deepFreeze({
      ...existing,
      evidence: dedupeEvidence([...existing.evidence, ...suggestion.evidence]),
      origin: "merged" as const,
      proposedTitle: existing.proposedTitle,
      proposedDescription: existing.proposedDescription,
      proposedWorkAreaType: existing.proposedWorkAreaType,
      suggestionKind: existing.suggestionKind,
      confidence: existing.confidence,
      confidenceBand: existing.confidenceBand,
      rationaleKey: existing.rationaleKey,
      catalogueEdgeId: existing.catalogueEdgeId,
    });
    ctx.working.set(key, merged);
    ctx.classifications.push({
      suggestionId: suggestion.suggestionId,
      class: "EXACT_DUPLICATE",
      againstId: existing.suggestionId,
    });
    ctx.suppressed.push(suggestion);
    ctx.warnings.push({
      code: "ai_evidence_merged",
      message:
        "AI evidence merged into deterministic suggestion; AI identity discarded.",
      suggestionId: existing.suggestionId,
    });
    return;
  }

  if (existing && !ctx.isAi) {
    // Prefer first deterministic after sort; collapse exact duplicates.
    ctx.classifications.push({
      suggestionId: suggestion.suggestionId,
      class: "EXACT_DUPLICATE",
      againstId: existing.suggestionId,
    });
    ctx.suppressed.push(suggestion);
    return;
  }

  ctx.working.set(key, suggestion);
}

function findActiveRejection(
  key: string,
  candidateSnapshot: SourceSnapshot,
  rejections: readonly RejectionRecord[]
): RejectionRecord | null {
  const rejection = rejections.find((r) => r.identityKey === key);
  if (!rejection) return null;
  const evaluation = evaluateStaleness({
    suggestion: syntheticRejected(rejection.suggestionId, rejection.sourceSnapshot),
    currentSnapshot: candidateSnapshot,
  });
  return evaluation.suppressionResetEligible ? null : rejection;
}

function dedupeEvidence(
  items: ScopeDiscoverySuggestion["evidence"][number][]
): ScopeDiscoverySuggestion["evidence"] {
  const seen = new Set<string>();
  const out: ScopeDiscoverySuggestion["evidence"][number][] = [];
  for (const item of items) {
    const key = `${item.sourceType}|${item.sourceId}|${item.relevance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return deepFreeze(out);
}

function syntheticRejected(
  suggestionId: string,
  sourceSnapshot: SourceSnapshot
): ScopeDiscoverySuggestion {
  return {
    suggestionId,
    projectId: "00000000-0000-4000-8000-000000000001",
    orgId: "00000000-0000-4000-8000-000000000002",
    analysisRunId: "00000000-0000-4000-8000-000000000003",
    suggestionKind: "WORK_AREA",
    proposedWorkAreaType: "deck",
    proposedTitle: "synthetic",
    proposedDescription: null,
    relatedWorkAreaId: null,
    parentSuggestionId: null,
    confidence: 0.5,
    confidenceBand: "MEDIUM",
    evidence: [],
    rationaleKey: "synthetic",
    sourceSnapshot,
    dependencyReferences: [],
    conflictReferences: [],
    missingInformation: [],
    status: "REJECTED",
    decision: {
      decisionType: "reject",
      decidedByUserId: "00000000-0000-4000-8000-000000000004",
      decidedAt: "2026-08-05T00:00:00.000Z",
      originalSuggestionId: suggestionId,
      modifiedTitle: null,
      modifiedDescription: null,
      modifiedWorkAreaType: null,
      reasonCode: null,
      userNote: null,
      sourceRevision: sourceSnapshot.briefRevision,
      resultingWorkAreaId: null,
    },
    contractVersion: "scope-discovery-suggestion/v1",
    providerMetadata: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    staleReason: null,
    supersededBySuggestionId: null,
    failureCode: null,
    failureMessage: null,
    catalogueEdgeId: null,
    origin: "deterministic",
  };
}
