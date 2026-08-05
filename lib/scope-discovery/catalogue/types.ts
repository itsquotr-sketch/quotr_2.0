import type { CatalogueErrorCode } from "./codes";
import type { ConfidenceBand, ScopeDiscoverySuggestionKind } from "../types";
import type { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "./version";

export const RELATIONSHIP_TYPES = [
  "REQUIRED",
  "LIKELY",
  "CONDITIONAL",
  "CONFLICTING",
  "EXCLUSION_CANDIDATE",
  "CLARIFICATION",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const REQUIREMENT_LEVELS = [
  "MUST_CONSIDER",
  "SHOULD_CONSIDER",
  "MAY_CONSIDER",
] as const;

export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];

export const MISSING_SCOPE_CLASSIFICATIONS = [
  "REQUIRED_CONSIDERATION_MISSING",
  "LIKELY_SCOPE_MISSING",
  "CONDITIONAL_SCOPE_POSSIBLE",
  "CLARIFICATION_NEEDED",
  "EXPLICITLY_SUPPRESSED",
  "CONFLICT_DETECTED",
  "ALREADY_COVERED",
  "PREVIOUSLY_REJECTED",
  "NOT_APPLICABLE",
] as const;

export type MissingScopeClassification =
  (typeof MISSING_SCOPE_CLASSIFICATIONS)[number];

export const CONDITION_OPERATORS = [
  "fact_equals",
  "fact_not_equals",
  "fact_exists",
  "fact_missing",
  "fact_is_none",
  "fact_is_unknown",
  "fact_is_explicit_no",
  "fact_is_explicit_yes",
  "constraint_equals",
  "constraint_exists",
  "accepted_wa_exists",
  "accepted_wa_missing",
  "numeric_gte",
  "numeric_gt",
  "numeric_lte",
  "numeric_lt",
  "all",
  "any",
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export type EvidenceRequirementKind =
  | "none"
  | "accepted_parent"
  | "user_fact"
  | "constraint"
  | "brief_or_notes";

/** Serializable atomic or group condition — no executable functions. */
export type CatalogueCondition =
  | {
      readonly op: "fact_equals";
      readonly factKey: string;
      readonly value: string | number | boolean;
    }
  | {
      readonly op: "fact_not_equals";
      readonly factKey: string;
      readonly value: string | number | boolean;
    }
  | { readonly op: "fact_exists"; readonly factKey: string }
  | { readonly op: "fact_missing"; readonly factKey: string }
  | { readonly op: "fact_is_none"; readonly factKey: string }
  | { readonly op: "fact_is_unknown"; readonly factKey: string }
  | { readonly op: "fact_is_explicit_no"; readonly factKey: string }
  | { readonly op: "fact_is_explicit_yes"; readonly factKey: string }
  | {
      readonly op: "constraint_equals";
      readonly constraintKey: string;
      readonly value: string | number | boolean;
    }
  | { readonly op: "constraint_exists"; readonly constraintKey: string }
  | { readonly op: "accepted_wa_exists"; readonly scopeType: string }
  | { readonly op: "accepted_wa_missing"; readonly scopeType: string }
  | {
      readonly op: "numeric_gte" | "numeric_gt" | "numeric_lte" | "numeric_lt";
      readonly factKey: string;
      readonly value: number;
    }
  | { readonly op: "all"; readonly conditions: readonly CatalogueCondition[] }
  | { readonly op: "any"; readonly conditions: readonly CatalogueCondition[] };

export interface ClarificationSpec {
  readonly key: string;
  readonly promptKey: string;
  readonly relatedFactKeys: readonly string[];
}

export interface EvidenceRequirement {
  readonly kind: EvidenceRequirementKind;
  readonly factKeys: readonly string[];
  readonly constraintKeys: readonly string[];
}

export interface ScopeRelationship {
  readonly relationshipId: string;
  readonly catalogueVersion: typeof SCOPE_RELATIONSHIP_CATALOGUE_VERSION | string;
  readonly parentScopeType: string;
  readonly candidateScopeType: string;
  readonly suggestionKind: ScopeDiscoverySuggestionKind;
  readonly relationshipType: RelationshipType;
  readonly title: string;
  readonly description: string;
  readonly requirementLevel: RequirementLevel;
  readonly triggerConditions: CatalogueCondition;
  readonly suppressConditions: CatalogueCondition | null;
  readonly conflictConditions: CatalogueCondition | null;
  readonly clarification: ClarificationSpec | null;
  readonly evidenceRequirements: EvidenceRequirement;
  readonly defaultConfidenceBand: ConfidenceBand;
  readonly applicability: {
    readonly regions: readonly string[];
    readonly trades: readonly string[];
  };
  readonly futureAssemblyReference: string | null;
  readonly rationaleCode: string;
  readonly active: boolean;
  /**
   * When true and evidenceRequirements.user_fact keys are missing,
   * emit CLARIFICATION_REQUIRED instead of (or in addition to) missing scope.
   */
  readonly clarifyWhenEvidenceMissing: boolean;
}

export interface CatalogueValidationIssue {
  readonly code: CatalogueErrorCode;
  readonly message: string;
  readonly path: string;
}

export interface CatalogueValidationResult {
  readonly ok: boolean;
  readonly issues: readonly CatalogueValidationIssue[];
}

export interface AcceptedWorkAreaRef {
  readonly workAreaId: string;
  readonly type: string;
}

export interface EvaluationFact {
  readonly key: string;
  readonly value: unknown;
}

export interface EvaluationConstraint {
  readonly key: string;
  readonly value: unknown;
}

export interface RelationshipMatchResult {
  readonly relationshipId: string;
  readonly classification: MissingScopeClassification;
  readonly suppressed: boolean;
  readonly reason: string;
}
