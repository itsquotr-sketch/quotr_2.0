import { ENGINE_VERSION, FORMULA_VERSION } from "../versioning";
import type { CalculationLineInput, CalculationResult } from "../core/types";
import { validateLineInput } from "../validation/validate-line-input";
import {
  buildLearningMetadata,
  buildLineExplanation,
} from "../explanation/build-explanation";
import { calculateQuantityRate } from "./quantity-rate";
import { calculateProductivityLabour } from "./productivity-labour";
import { calculateLumpSum } from "./lump-sum";

function freezeResult(result: CalculationResult): CalculationResult {
  return Object.freeze({
    ...result,
    steps: Object.freeze([...result.steps]),
    warnings: Object.freeze([...result.warnings]),
    validation_errors: Object.freeze([...result.validation_errors]),
    explanation: Object.freeze({
      ...result.explanation,
      formula_ids: Object.freeze([...result.explanation.formula_ids]),
      modifiers: Object.freeze([...result.explanation.modifiers]),
      source_references: Object.freeze([
        ...result.explanation.source_references,
      ]),
    }),
    future_learning: Object.freeze({
      ...result.future_learning,
      signals: Object.freeze([...result.future_learning.signals]),
      evidence_hooks: Object.freeze([
        ...result.future_learning.evidence_hooks,
      ]),
      auto_update_company_rules: false as const,
    }),
  });
}

/**
 * Authoritative line-item calculation entry point.
 * Pure / deterministic / side-effect free. Not wired to the app in 2B.3A.
 */
export function calculateLineItem(
  input: CalculationLineInput
): CalculationResult {
  const validation_errors = validateLineInput(input);

  if (validation_errors.length > 0) {
    return freezeResult({
      ok: false,
      engine_version: ENGINE_VERSION,
      formula_version: FORMULA_VERSION,
      calculation_id: input.calculation_id ?? null,
      inputs: input,
      outputs: null,
      steps: Object.freeze([]),
      warnings: Object.freeze([]),
      validation_errors: Object.freeze([...validation_errors]),
      manual_override: input.manual_override ?? null,
      explanation: buildLineExplanation({
        mode: input.mode,
        formulaIds: [],
        input,
        marginApplied: null,
        ratesUsed: {},
        inputsUsed: { mode: input.mode },
      }),
      future_learning: buildLearningMetadata(["validation_failed"]),
    });
  }

  const computed =
    input.mode === "quantity_rate"
      ? calculateQuantityRate(input)
      : input.mode === "productivity_labour"
        ? calculateProductivityLabour(input)
        : calculateLumpSum(input);

  const learningSignals = [...computed.learningSignals];
  if (input.manual_override) {
    learningSignals.push("manual_override");
  }

  return freezeResult({
    ok: true,
    engine_version: ENGINE_VERSION,
    formula_version: FORMULA_VERSION,
    calculation_id: input.calculation_id ?? null,
    inputs: input,
    outputs: Object.freeze({ ...computed.outputs }),
    steps: Object.freeze([...computed.steps]),
    warnings: Object.freeze([...computed.warnings]),
    validation_errors: Object.freeze([]),
    manual_override: input.manual_override ?? null,
    explanation: buildLineExplanation({
      mode: input.mode,
      formulaIds: computed.formulaIds,
      input,
      marginApplied: computed.marginApplied,
      ratesUsed: {
        unit_cost: computed.outputs.unit_cost,
        unit_sell: computed.outputs.unit_sell,
        productivity_rate: computed.outputs.productivity_rate,
      },
      inputsUsed: {
        mode: input.mode,
        quantity: computed.outputs.quantity,
        calculated_quantity: computed.outputs.calculated_quantity,
      },
      modifiers:
        input.waste_percent != null
          ? [{ waste_percent: input.waste_percent }]
          : [],
    }),
    future_learning: buildLearningMetadata(learningSignals),
  });
}
