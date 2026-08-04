/**
 * Map legacy kernel steps → structured contract steps.
 */

import type { CalculationStep } from "../core/types";
import {
  EXPLANATION_KEYS,
  LEGACY_STEP_ID_TO_CODE,
  STEP_CODES,
  type PrecisionTreatment,
  type StepCode,
  type StepOperationType,
} from "./step-codes";
import type { StructuredCalculationStep } from "./types";

function operationFor(code: StepCode): StepOperationType {
  switch (code) {
    case STEP_CODES.BASE_QUANTITY:
      return "quantity";
    case STEP_CODES.WASTE_QUANTITY:
      return "quantity_adjust";
    case STEP_CODES.LABOUR_HOURS:
      return "hours";
    case STEP_CODES.BASE_COST:
    case STEP_CODES.BASE_SELL:
    case STEP_CODES.LUMP_SUM_TOTALS:
      return "rate_apply";
    case STEP_CODES.SELL_FROM_MARGIN:
      return "derive_sell";
    case STEP_CODES.MANUAL_SELL_OVERRIDE:
      return "override";
    case STEP_CODES.GROSS_PROFIT:
    case STEP_CODES.GROSS_MARGIN:
    case STEP_CODES.MARKUP:
    case STEP_CODES.PROFIT_UNKNOWN:
      return "profit";
    case STEP_CODES.DOCUMENT_SUBTOTAL:
      return "aggregate";
    case STEP_CODES.GST:
    case STEP_CODES.TOTAL_INCLUDING_GST:
      return "tax";
    default:
      return "informational";
  }
}

function precisionFor(code: StepCode): PrecisionTreatment {
  if (code === STEP_CODES.GROSS_MARGIN || code === STEP_CODES.MARKUP) {
    return "round_percent_2dp";
  }
  if (code === STEP_CODES.PROFIT_UNKNOWN) return "none";
  return "round_money_2dp";
}

function explanationKeyFor(code: StepCode): string {
  switch (code) {
    case STEP_CODES.WASTE_QUANTITY:
      return EXPLANATION_KEYS.WASTE_QUANTITY;
    case STEP_CODES.LABOUR_HOURS:
      return EXPLANATION_KEYS.LABOUR_HOURS;
    case STEP_CODES.SELL_FROM_MARGIN:
      return EXPLANATION_KEYS.SELL_FROM_MARGIN;
    case STEP_CODES.BASE_COST:
    case STEP_CODES.BASE_SELL:
      return EXPLANATION_KEYS.BASE_COST;
    case STEP_CODES.LUMP_SUM_TOTALS:
      return EXPLANATION_KEYS.LUMP_SUM;
    case STEP_CODES.GROSS_PROFIT:
      return EXPLANATION_KEYS.GROSS_PROFIT;
    case STEP_CODES.GROSS_MARGIN:
      return EXPLANATION_KEYS.GROSS_MARGIN;
    case STEP_CODES.PROFIT_UNKNOWN:
      return EXPLANATION_KEYS.PROFIT_UNKNOWN;
    case STEP_CODES.DOCUMENT_SUBTOTAL:
      return EXPLANATION_KEYS.DOCUMENT_SUBTOTAL;
    case STEP_CODES.GST:
      return EXPLANATION_KEYS.GST;
    case STEP_CODES.TOTAL_INCLUDING_GST:
      return EXPLANATION_KEYS.TOTAL_INCLUDING_GST;
    case STEP_CODES.MANUAL_SELL_OVERRIDE:
      return EXPLANATION_KEYS.MANUAL_OVERRIDE;
    default:
      return `step.${code.toLowerCase()}`;
  }
}

function scrubInputs(
  inputs: CalculationStep["inputs"]
): Record<string, number | string | boolean | null> {
  const out: Record<string, number | string | boolean | null> = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Convert legacy kernel steps into structured contract steps.
 * When cost is unknown, profit_metrics maps to PROFIT_UNKNOWN (no fabricated margin step).
 */
export function mapLegacyStepsToStructured(
  steps: readonly CalculationStep[],
  options?: { costKnown?: boolean; includeGstTotal?: boolean; gstInclusive?: number | null }
): StructuredCalculationStep[] {
  const mapped: StructuredCalculationStep[] = [];

  for (const step of steps) {
    let code = LEGACY_STEP_ID_TO_CODE[step.id];
    if (!code) continue;

    if (
      step.id === "profit_metrics" &&
      options?.costKnown === false
    ) {
      code = STEP_CODES.PROFIT_UNKNOWN;
    }

    const refs = scrubInputs(step.inputs);
    mapped.push({
      code,
      operationType: operationFor(code),
      inputReferences: refs,
      values: refs,
      result: step.output === undefined ? null : step.output,
      precisionTreatment: precisionFor(code),
      explanationKey: explanationKeyFor(code),
      formulaId: step.formula_id ?? null,
      legacyStepId: step.id,
    });

    if (
      code === STEP_CODES.GROSS_PROFIT &&
      options?.costKnown !== false &&
      typeof step.output === "number"
    ) {
      // Companion margin step when cost known — values from inputs if present
      mapped.push({
        code: STEP_CODES.GROSS_MARGIN,
        operationType: "profit",
        inputReferences: refs,
        values: refs,
        result: null,
        precisionTreatment: "round_percent_2dp",
        explanationKey: EXPLANATION_KEYS.GROSS_MARGIN,
        formulaId: "F-M",
        legacyStepId: step.id,
      });
    }
  }

  if (
    options?.includeGstTotal &&
    options.gstInclusive != null &&
    mapped.some((s) => s.code === STEP_CODES.GST)
  ) {
    mapped.push({
      code: STEP_CODES.TOTAL_INCLUDING_GST,
      operationType: "tax",
      inputReferences: {},
      values: { total_incl_gst: options.gstInclusive },
      result: options.gstInclusive,
      precisionTreatment: "round_money_2dp",
      explanationKey: EXPLANATION_KEYS.TOTAL_INCLUDING_GST,
      formulaId: "F-GST",
      legacyStepId: null,
    });
  }

  return mapped;
}
