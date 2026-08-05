import { deepFreeze } from "../immutability";
import type { ConfidenceBand } from "../types";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "./version";
import type {
  CatalogueCondition,
  ClarificationSpec,
  EvidenceRequirement,
  RelationshipType,
  RequirementLevel,
  ScopeRelationship,
} from "./types";
import type { ScopeDiscoverySuggestionKind } from "../types";

export function confidenceForBand(band: ConfidenceBand): number {
  if (band === "HIGH") return 0.85;
  if (band === "MEDIUM") return 0.55;
  return 0.25;
}

export function defineRelationship(input: {
  relationshipId: string;
  parentScopeType: string;
  candidateScopeType: string;
  suggestionKind: ScopeDiscoverySuggestionKind;
  relationshipType: RelationshipType;
  title: string;
  description: string;
  requirementLevel: RequirementLevel;
  triggerConditions: CatalogueCondition;
  suppressConditions?: CatalogueCondition | null;
  conflictConditions?: CatalogueCondition | null;
  clarification?: ClarificationSpec | null;
  evidenceRequirements?: Partial<EvidenceRequirement>;
  defaultConfidenceBand: ConfidenceBand;
  regions?: readonly string[];
  trades?: readonly string[];
  futureAssemblyReference?: string | null;
  rationaleCode: string;
  active?: boolean;
  clarifyWhenEvidenceMissing?: boolean;
}): ScopeRelationship {
  return deepFreeze({
    relationshipId: input.relationshipId,
    catalogueVersion: SCOPE_RELATIONSHIP_CATALOGUE_VERSION,
    parentScopeType: input.parentScopeType,
    candidateScopeType: input.candidateScopeType,
    suggestionKind: input.suggestionKind,
    relationshipType: input.relationshipType,
    title: input.title,
    description: input.description,
    requirementLevel: input.requirementLevel,
    triggerConditions: input.triggerConditions,
    suppressConditions: input.suppressConditions ?? null,
    conflictConditions: input.conflictConditions ?? null,
    clarification: input.clarification ?? null,
    evidenceRequirements: {
      kind: input.evidenceRequirements?.kind ?? "accepted_parent",
      factKeys: input.evidenceRequirements?.factKeys ?? [],
      constraintKeys: input.evidenceRequirements?.constraintKeys ?? [],
    },
    defaultConfidenceBand: input.defaultConfidenceBand,
    applicability: {
      regions: input.regions ?? ["all"],
      trades: input.trades ?? [],
    },
    futureAssemblyReference: input.futureAssemblyReference ?? null,
    rationaleCode: input.rationaleCode,
    active: input.active ?? true,
    clarifyWhenEvidenceMissing: input.clarifyWhenEvidenceMissing ?? false,
  });
}

export function parentAccepted(parent: string): CatalogueCondition {
  return { op: "accepted_wa_exists", scopeType: parent };
}

export function allOf(
  ...conditions: CatalogueCondition[]
): CatalogueCondition {
  return { op: "all", conditions };
}

export function anyOf(
  ...conditions: CatalogueCondition[]
): CatalogueCondition {
  return { op: "any", conditions };
}
