/**
 * Stable structured calculation step codes — Batch 2B.3C.
 * Only emit steps that genuinely occurred.
 */

export const STEP_CODES = Object.freeze({
  BASE_QUANTITY: "BASE_QUANTITY",
  WASTE_QUANTITY: "WASTE_QUANTITY",
  LABOUR_HOURS: "LABOUR_HOURS",
  BASE_COST: "BASE_COST",
  BASE_SELL: "BASE_SELL",
  SELL_FROM_MARGIN: "SELL_FROM_MARGIN",
  MANUAL_SELL_OVERRIDE: "MANUAL_SELL_OVERRIDE",
  LUMP_SUM_TOTALS: "LUMP_SUM_TOTALS",
  GROSS_PROFIT: "GROSS_PROFIT",
  GROSS_MARGIN: "GROSS_MARGIN",
  MARKUP: "MARKUP",
  DOCUMENT_SUBTOTAL: "DOCUMENT_SUBTOTAL",
  GST: "GST",
  TOTAL_INCLUDING_GST: "TOTAL_INCLUDING_GST",
  PROFIT_UNKNOWN: "PROFIT_UNKNOWN",
} as const);

export type StepCode = (typeof STEP_CODES)[keyof typeof STEP_CODES];

export type StepOperationType =
  | "quantity"
  | "quantity_adjust"
  | "hours"
  | "rate_apply"
  | "derive_sell"
  | "override"
  | "profit"
  | "aggregate"
  | "tax"
  | "informational";

export type PrecisionTreatment =
  | "round_money_2dp"
  | "round_percent_2dp"
  | "identity"
  | "none";

/** Maps legacy kernel step ids to stable contract step codes. */
export const LEGACY_STEP_ID_TO_CODE: Readonly<Record<string, StepCode>> =
  Object.freeze({
    apply_waste: STEP_CODES.WASTE_QUANTITY,
    derive_unit_sell: STEP_CODES.SELL_FROM_MARGIN,
    derive_hourly_sell: STEP_CODES.SELL_FROM_MARGIN,
    quantity_rate_totals: STEP_CODES.BASE_COST,
    derive_hours: STEP_CODES.LABOUR_HOURS,
    use_provided_hours: STEP_CODES.LABOUR_HOURS,
    productivity_totals: STEP_CODES.BASE_COST,
    lump_sum_totals: STEP_CODES.LUMP_SUM_TOTALS,
    profit_metrics: STEP_CODES.GROSS_PROFIT,
    sum_lines: STEP_CODES.DOCUMENT_SUBTOTAL,
    apply_gst: STEP_CODES.GST,
  });

export const EXPLANATION_KEYS = Object.freeze({
  WASTE_QUANTITY: "step.waste_quantity",
  LABOUR_HOURS: "step.labour_hours",
  SELL_FROM_MARGIN: "step.sell_from_margin",
  BASE_COST: "step.base_cost",
  LUMP_SUM: "step.lump_sum",
  GROSS_PROFIT: "step.gross_profit",
  GROSS_MARGIN: "step.gross_margin",
  PROFIT_UNKNOWN: "step.profit_unknown",
  DOCUMENT_SUBTOTAL: "step.document_subtotal",
  GST: "step.gst",
  TOTAL_INCLUDING_GST: "step.total_including_gst",
  MANUAL_OVERRIDE: "step.manual_override",
  COST_UNKNOWN: "warning.cost_unknown",
} as const);
