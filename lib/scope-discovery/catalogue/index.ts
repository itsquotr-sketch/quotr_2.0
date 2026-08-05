/**
 * Stage 3.1B.2 — Scope relationship catalogue foundation.
 * Provider-free, AI-free, persistence-free, production-disconnected.
 */

export { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "./version";

export {
  CATALOGUE_ERROR_CODES,
  type CatalogueErrorCode,
} from "./codes";

export type {
  AcceptedWorkAreaRef,
  CatalogueCondition,
  CatalogueValidationIssue,
  CatalogueValidationResult,
  ClarificationSpec,
  ConditionOperator,
  EvidenceRequirement,
  EvaluationConstraint,
  EvaluationFact,
  MissingScopeClassification,
  RelationshipMatchResult,
  RelationshipType,
  RequirementLevel,
  ScopeRelationship,
} from "./types";

export {
  CONDITION_OPERATORS,
  MISSING_SCOPE_CLASSIFICATIONS,
  RELATIONSHIP_TYPES,
  REQUIREMENT_LEVELS,
} from "./types";

export {
  CANONICAL_SCOPE_IDS,
  DOCUMENTED_ALIASES,
  SCOPE_ALIASES,
  isCanonicalScopeId,
  normalizeScopeKey,
  resolveCanonicalScopeId,
  type CanonicalScopeId,
} from "./normalisation";

export {
  SCOPE_RELATIONSHIP_CATALOGUE,
  assertCatalogueValid,
  getActiveRelationships,
  getCatalogueValidation,
  getRelationshipsByParent,
} from "./catalogue";

export { validateCatalogueRelationships } from "./validation";

export {
  evaluateScopeRelationships,
  type CatalogueEvaluationInput,
  type CatalogueEvaluationResult,
} from "./evaluator";

export {
  evaluateCondition,
  isTriggered,
  isSuppressed,
  buildFactMap,
  buildConstraintMap,
} from "./condition-eval";

export { buildRelationshipEvidence } from "./evidence-builder";

export { confidenceForBand, defineRelationship } from "./relationship-helpers";

export { DECK_RELATIONSHIPS } from "./relationships/deck";
export { BATHROOM_RELATIONSHIPS } from "./relationships/bathroom";
export { COMMERCIAL_FITOUT_RELATIONSHIPS } from "./relationships/commercial-fitout";
