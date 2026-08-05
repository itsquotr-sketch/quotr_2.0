import { deepFreeze } from "../immutability";
import {
  identityKeyForSuggestion,
  normalizeWorkAreaType,
} from "../identity";
import { evaluateStaleness } from "../staleness";
import { validateScopeDiscoverySuggestion } from "../validation";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../version";
import type {
  RejectionRecord,
  ScopeDiscoverySuggestion,
  SourceSnapshot,
} from "../types";
import {
  buildConstraintMap,
  buildFactMap,
  isConflict,
  isSuppressed,
  isTriggered,
  type ConditionContext,
} from "./condition-eval";
import { buildRelationshipEvidence } from "./evidence-builder";
import { resolveCanonicalScopeId } from "./normalisation";
import { confidenceForBand } from "./relationship-helpers";
import type {
  AcceptedWorkAreaRef,
  EvaluationConstraint,
  EvaluationFact,
  MissingScopeClassification,
  RelationshipMatchResult,
  ScopeRelationship,
} from "./types";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "./version";

export interface CatalogueEvaluationInput {
  readonly projectId: string;
  readonly orgId: string;
  readonly analysisRunId: string;
  readonly acceptedWorkAreas: readonly AcceptedWorkAreaRef[];
  readonly facts: readonly EvaluationFact[];
  readonly constraints: readonly EvaluationConstraint[];
  readonly sourceSnapshot: SourceSnapshot;
  readonly rejections?: readonly RejectionRecord[];
  readonly relationships: readonly ScopeRelationship[];
  readonly createdAt?: string;
}

export interface CatalogueEvaluationResult {
  readonly suggestions: readonly ScopeDiscoverySuggestion[];
  readonly suppressed: readonly RelationshipMatchResult[];
  readonly conflicts: readonly RelationshipMatchResult[];
  readonly clarifications: readonly RelationshipMatchResult[];
  readonly matches: readonly RelationshipMatchResult[];
  readonly warnings: readonly string[];
  readonly validationIssues: readonly { readonly path: string; readonly message: string }[];
}

function deterministicUuid(seed: string): string {
  // FNV-1a inspired digest → UUID-shaped string (version 4 variant bits).
  let h1 = 2166136261;
  let h2 = 2166136261 ^ 0xabcdef;
  for (let i = 0; i < seed.length; i += 1) {
    const c = seed.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 ^= c + i;
    h2 = Math.imul(h2, 16777619);
  }
  const hex = (n: number, len: number) =>
    (n >>> 0).toString(16).padStart(len, "0").slice(-len);
  const a = hex(h1, 8);
  const b = hex(h1 ^ h2, 4);
  const c = `4${hex(h2, 3)}`;
  const d = `8${hex(h1 ^ 0x1234, 3)}`;
  const e = `${hex(h2 ^ 0x5678, 4)}${hex(h1 ^ h2 ^ 0x9abc, 8)}`.slice(0, 12);
  return `${a}-${b}-${c}-${d}-${e}`;
}

function classificationFor(
  relationship: ScopeRelationship,
  kind: "emit" | "conflict" | "clarify"
): MissingScopeClassification {
  if (kind === "conflict") return "CONFLICT_DETECTED";
  if (kind === "clarify") return "CLARIFICATION_NEEDED";
  if (relationship.requirementLevel === "MUST_CONSIDER") {
    return "REQUIRED_CONSIDERATION_MISSING";
  }
  if (relationship.relationshipType === "CONDITIONAL") {
    return "CONDITIONAL_SCOPE_POSSIBLE";
  }
  return "LIKELY_SCOPE_MISSING";
}

function findParentWorkAreaId(
  accepted: readonly AcceptedWorkAreaRef[],
  parentScopeType: string
): string | null {
  const target = resolveCanonicalScopeId(parentScopeType) ?? parentScopeType;
  const match = accepted.find((wa) => {
    const resolved = resolveCanonicalScopeId(wa.type) ?? wa.type;
    return resolved === target || wa.type === parentScopeType;
  });
  return match?.workAreaId ?? null;
}

function evidenceKeysMissing(
  relationship: ScopeRelationship,
  ctx: ConditionContext
): boolean {
  if (!relationship.clarifyWhenEvidenceMissing) return false;
  if (relationship.evidenceRequirements.kind !== "user_fact") return false;
  return relationship.evidenceRequirements.factKeys.some(
    (key) => !ctx.facts.has(key) || ctx.facts.get(key) == null
  );
}

function buildSuggestion(input: {
  relationship: ScopeRelationship;
  evaluation: CatalogueEvaluationInput;
  ctx: ConditionContext;
  suggestionKind: ScopeDiscoverySuggestion["suggestionKind"];
  relatedWorkAreaId: string | null;
}): ScopeDiscoverySuggestion {
  const { relationship, evaluation, ctx, suggestionKind, relatedWorkAreaId } =
    input;
  const band = relationship.defaultConfidenceBand;
  const createdAt = evaluation.createdAt ?? "2026-08-05T00:00:00.000Z";
  const suggestionId = deterministicUuid(
    `${evaluation.projectId}|${relationship.relationshipId}|${suggestionKind}`
  );

  const missingInformation = relationship.clarification
    ? [
        {
          key: relationship.clarification.key,
          promptKey: relationship.clarification.promptKey,
          relatedFactKeys: relationship.clarification.relatedFactKeys,
        },
      ]
    : [];

  return deepFreeze({
    suggestionId,
    projectId: evaluation.projectId,
    orgId: evaluation.orgId,
    analysisRunId: evaluation.analysisRunId,
    suggestionKind,
    proposedWorkAreaType: relationship.candidateScopeType,
    proposedTitle: relationship.title,
    proposedDescription: relationship.description,
    relatedWorkAreaId,
    parentSuggestionId: null,
    confidence: confidenceForBand(band),
    confidenceBand: band,
    evidence: buildRelationshipEvidence(relationship, ctx, relatedWorkAreaId),
    rationaleKey: relationship.rationaleCode,
    sourceSnapshot: {
      ...evaluation.sourceSnapshot,
      catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    },
    dependencyReferences: [relationship.relationshipId],
    conflictReferences: [],
    missingInformation,
    status: "PROPOSED",
    decision: null,
    contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
    providerMetadata: null,
    createdAt,
    updatedAt: createdAt,
    staleReason: null,
    supersededBySuggestionId: null,
    failureCode: null,
    failureMessage: null,
    catalogueEdgeId: relationship.relationshipId,
    origin: "deterministic",
  });
}

function isRejectionActive(
  identityKey: string,
  snapshot: SourceSnapshot,
  rejections: readonly RejectionRecord[]
): boolean {
  const rejection = rejections.find((r) => r.identityKey === identityKey);
  if (!rejection) return false;
  const evaluation = evaluateStaleness({
    suggestion: {
      suggestionId: rejection.suggestionId,
      projectId: "00000000-0000-4000-8000-000000000001",
      orgId: "00000000-0000-4000-8000-000000000002",
      analysisRunId: "00000000-0000-4000-8000-000000000003",
      suggestionKind: "MISSING_SCOPE",
      proposedWorkAreaType: "deck",
      proposedTitle: "x",
      proposedDescription: null,
      relatedWorkAreaId: null,
      parentSuggestionId: null,
      confidence: 0.5,
      confidenceBand: "MEDIUM",
      evidence: [],
      rationaleKey: "x",
      sourceSnapshot: rejection.sourceSnapshot,
      dependencyReferences: [],
      conflictReferences: [],
      missingInformation: [],
      status: "REJECTED",
      decision: {
        decisionType: "reject",
        decidedByUserId: "00000000-0000-4000-8000-000000000004",
        decidedAt: "2026-08-05T00:00:00.000Z",
        originalSuggestionId: rejection.suggestionId,
        modifiedTitle: null,
        modifiedDescription: null,
        modifiedWorkAreaType: null,
        reasonCode: null,
        userNote: null,
        sourceRevision: rejection.sourceSnapshot.briefRevision,
        resultingWorkAreaId: null,
      },
      contractVersion: SCOPE_DISCOVERY_CONTRACT_VERSION,
      providerMetadata: null,
      createdAt: "2026-08-05T00:00:00.000Z",
      updatedAt: "2026-08-05T00:00:00.000Z",
      staleReason: null,
      supersededBySuggestionId: null,
      failureCode: null,
      failureMessage: null,
      catalogueEdgeId: null,
      origin: "deterministic",
    },
    currentSnapshot: snapshot,
  });
  return !evaluation.suppressionResetEligible;
}

function candidateAlreadyAccepted(
  accepted: readonly AcceptedWorkAreaRef[],
  candidateScopeType: string
): boolean {
  const target = resolveCanonicalScopeId(candidateScopeType) ?? candidateScopeType;
  return accepted.some((wa) => {
    const resolved = resolveCanonicalScopeId(wa.type) ?? normalizeWorkAreaType(wa.type);
    return resolved === target;
  });
}

/**
 * Pure deterministic catalogue evaluator.
 * Emits Stage 3.1B.1 suggestions — never auto-accepts or mutates Facts/WAs.
 */
export function evaluateScopeRelationships(
  input: CatalogueEvaluationInput
): CatalogueEvaluationResult {
  const ctx: ConditionContext = {
    acceptedWorkAreas: input.acceptedWorkAreas,
    facts: buildFactMap(input.facts),
    constraints: buildConstraintMap(input.constraints),
  };

  const suggestions: ScopeDiscoverySuggestion[] = [];
  const suppressed: RelationshipMatchResult[] = [];
  const conflicts: RelationshipMatchResult[] = [];
  const clarifications: RelationshipMatchResult[] = [];
  const matches: RelationshipMatchResult[] = [];
  const warnings: string[] = [];
  const validationIssues: { path: string; message: string }[] = [];

  const active = [...input.relationships]
    .filter((r) => r.active)
    .sort((a, b) => a.relationshipId.localeCompare(b.relationshipId));

  for (const relationship of active) {
    if (!isTriggered(relationship.triggerConditions, ctx)) {
      matches.push({
        relationshipId: relationship.relationshipId,
        classification: "NOT_APPLICABLE",
        suppressed: true,
        reason: "trigger_not_satisfied",
      });
      continue;
    }

    if (isSuppressed(relationship.suppressConditions, ctx)) {
      suppressed.push({
        relationshipId: relationship.relationshipId,
        classification: "EXPLICITLY_SUPPRESSED",
        suppressed: true,
        reason: "suppress_conditions_met",
      });
      continue;
    }

    if (
      relationship.suggestionKind !== "CLARIFICATION_REQUIRED" &&
      candidateAlreadyAccepted(
        input.acceptedWorkAreas,
        relationship.candidateScopeType
      )
    ) {
      suppressed.push({
        relationshipId: relationship.relationshipId,
        classification: "ALREADY_COVERED",
        suppressed: true,
        reason: "accepted_equivalent_scope",
      });
      continue;
    }

    if (isConflict(relationship.conflictConditions, ctx)) {
      const relatedWorkAreaId = findParentWorkAreaId(
        input.acceptedWorkAreas,
        relationship.parentScopeType
      );
      const suggestion = buildSuggestion({
        relationship,
        evaluation: input,
        ctx,
        suggestionKind: "CONFLICT_WARNING",
        relatedWorkAreaId,
      });
      const validated = validateScopeDiscoverySuggestion(suggestion);
      if (!validated.ok || !validated.suggestion) {
        validationIssues.push(
          ...validated.issues.map((i) => ({
            path: i.path,
            message: i.message,
          }))
        );
        warnings.push(
          `Invalid conflict suggestion for ${relationship.relationshipId}`
        );
        continue;
      }
      suggestions.push(validated.suggestion);
      conflicts.push({
        relationshipId: relationship.relationshipId,
        classification: "CONFLICT_DETECTED",
        suppressed: false,
        reason: "conflict_conditions_met",
      });
      continue;
    }

    const needsClarify =
      relationship.suggestionKind === "CLARIFICATION_REQUIRED" ||
      evidenceKeysMissing(relationship, ctx);

    const suggestionKind = needsClarify
      ? "CLARIFICATION_REQUIRED"
      : relationship.suggestionKind;

    const relatedWorkAreaId = findParentWorkAreaId(
      input.acceptedWorkAreas,
      relationship.parentScopeType
    );

    const draft = buildSuggestion({
      relationship,
      evaluation: input,
      ctx,
      suggestionKind,
      relatedWorkAreaId,
    });

    const identityKey = identityKeyForSuggestion(draft);
    if (
      isRejectionActive(
        identityKey,
        draft.sourceSnapshot,
        input.rejections ?? []
      )
    ) {
      suppressed.push({
        relationshipId: relationship.relationshipId,
        classification: "PREVIOUSLY_REJECTED",
        suppressed: true,
        reason: "prior_rejection_active",
      });
      continue;
    }

    const validated = validateScopeDiscoverySuggestion(draft);
    if (!validated.ok || !validated.suggestion) {
      validationIssues.push(
        ...validated.issues.map((i) => ({
          path: i.path,
          message: i.message,
        }))
      );
      warnings.push(`Invalid suggestion for ${relationship.relationshipId}`);
      continue;
    }

    suggestions.push(validated.suggestion);
    const match: RelationshipMatchResult = {
      relationshipId: relationship.relationshipId,
      classification: classificationFor(
        relationship,
        needsClarify ? "clarify" : "emit"
      ),
      suppressed: false,
      reason: needsClarify ? "clarification_emitted" : "suggestion_emitted",
    };
    matches.push(match);
    if (needsClarify) clarifications.push(match);
  }

  suggestions.sort((a, b) =>
    (a.catalogueEdgeId ?? a.suggestionId).localeCompare(
      b.catalogueEdgeId ?? b.suggestionId
    )
  );

  return deepFreeze({
    suggestions,
    suppressed,
    conflicts,
    clarifications,
    matches,
    warnings,
    validationIssues,
  });
}
