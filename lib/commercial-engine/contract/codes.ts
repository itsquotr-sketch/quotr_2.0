/**
 * Stable warning and error taxonomy — Batch 2B.3C.
 * Machine-readable codes only; messages are secondary.
 */

/** Blocking validation — no successful financial result. */
export const BLOCKING_ERROR_CODES = Object.freeze({
  INVALID_MODE: "invalid_mode",
  NON_FINITE: "non_finite",
  NEGATIVE_NOT_ALLOWED: "negative_not_allowed",
  MARGIN_OUT_OF_BOUNDS: "margin_out_of_bounds",
  INVALID_GST_RATE: "invalid_gst_rate",
  QUANTITY_REQUIRED: "quantity_required",
  RATES_REQUIRED: "rates_required",
  SELL_OR_MARGIN_REQUIRED: "sell_or_margin_required",
  HOURS_REQUIRED: "hours_required",
  HOURLY_RATES_REQUIRED: "hourly_rates_required",
  LUMP_SELL_REQUIRED: "lump_sell_required",
  LUMP_COST_INVALID: "lump_cost_invalid",
  WASTE_OUT_OF_BOUNDS: "waste_out_of_bounds",
  INVALID_INCLUSION_RULE: "invalid_inclusion_rule",
  INVALID_OVERRIDE: "invalid_override",
  INVALID_REQUEST: "invalid_request",
} as const);

/** Non-blocking warnings — calculation may still succeed. */
export const WARNING_CODES = Object.freeze({
  COST_UNKNOWN: "cost_unknown",
  PROFITABILITY_UNKNOWN: "profitability_unknown",
  SELL_ONLY_LUMP: "sell_only_lump",
  ZERO_VALUE_INFORMATIONAL: "zero_value_informational",
  MANUAL_OVERRIDE_APPLIED: "manual_override_applied",
  PRELIMINARY_ALLOWANCE: "preliminary_allowance",
  WASTAGE_APPLIED: "wastage_applied",
  VISIBILITY_FILTER_APPLIED: "visibility_filter_applied",
  VERSION_MISMATCH_REPLAY: "version_mismatch_replay",
  FORMULA_VERSION_UNSUPPORTED: "formula_version_unsupported",
  ENGINE_VERSION_UNSUPPORTED: "engine_version_unsupported",
} as const);

export type BlockingErrorCode =
  (typeof BLOCKING_ERROR_CODES)[keyof typeof BLOCKING_ERROR_CODES];
export type WarningCode = (typeof WARNING_CODES)[keyof typeof WARNING_CODES];

export type IssueSeverity = "blocking_error" | "warning";

export type ContractIssue = {
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly field?: string;
  readonly category:
    | "validation"
    | "commercial"
    | "override"
    | "version"
    | "replay";
};
