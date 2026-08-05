export const SCOPE_DISCOVERY_ERROR_CODES = Object.freeze({
  INVALID_KIND: "invalid_kind",
  INVALID_STATUS: "invalid_status",
  INVALID_CONFIDENCE: "invalid_confidence",
  CONFIDENCE_BAND_MISMATCH: "confidence_band_mismatch",
  INVALID_BAND: "invalid_band",
  EMPTY_TITLE: "empty_title",
  INVALID_EVIDENCE: "invalid_evidence",
  DUPLICATE_EVIDENCE: "duplicate_evidence",
  INVALID_ID: "invalid_id",
  WORK_AREA_TYPE_REQUIRED: "work_area_type_required",
  DECISION_REQUIRED: "decision_required",
  DECISION_MISMATCH: "decision_mismatch",
  STALE_REASON_REQUIRED: "stale_reason_required",
  SUPERSEDED_LINK_REQUIRED: "superseded_link_required",
  FAILED_ERROR_REQUIRED: "failed_error_required",
  INVALID_TRANSITION: "invalid_transition",
  COMMERCIAL_FIELD_FORBIDDEN: "commercial_field_forbidden",
  INVALID_CONTRACT_VERSION: "invalid_contract_version",
  INVALID_SOURCE_SNAPSHOT: "invalid_source_snapshot",
  INVALID_COMMAND: "invalid_command",
  ORIGINAL_IMMUTABLE: "original_immutable",
} as const);

export type ScopeDiscoveryErrorCode =
  (typeof SCOPE_DISCOVERY_ERROR_CODES)[keyof typeof SCOPE_DISCOVERY_ERROR_CODES];
