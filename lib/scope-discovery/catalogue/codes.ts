export const CATALOGUE_ERROR_CODES = Object.freeze({
  DUPLICATE_RELATIONSHIP_ID: "duplicate_relationship_id",
  UNKNOWN_SCOPE_ID: "unknown_scope_id",
  UNKNOWN_OPERATOR: "unknown_operator",
  INVALID_CONDITION: "invalid_condition",
  INVALID_BAND: "invalid_band",
  INVALID_RELATIONSHIP_TYPE: "invalid_relationship_type",
  INVALID_REQUIREMENT_LEVEL: "invalid_requirement_level",
  INVALID_SUGGESTION_KIND: "invalid_suggestion_kind",
  DUPLICATE_SEMANTIC_EDGE: "duplicate_semantic_edge",
  IMPOSSIBLE_TRIGGER_SUPPRESS: "impossible_trigger_suppress",
  COMMERCIAL_FIELD_FORBIDDEN: "commercial_field_forbidden",
  MISSING_RATIONALE: "missing_rationale",
  MISSING_EVIDENCE_REQUIREMENTS: "missing_evidence_requirements",
  INACTIVE_WITHOUT_ID: "inactive_without_id",
  EXECUTABLE_PREDICATE_FORBIDDEN: "executable_predicate_forbidden",
} as const);

export type CatalogueErrorCode =
  (typeof CATALOGUE_ERROR_CODES)[keyof typeof CATALOGUE_ERROR_CODES];
