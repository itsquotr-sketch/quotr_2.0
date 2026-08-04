/**
 * Structured golden comparators for Batch 2B.3B.
 * Never recalculates expected values — only compares actual vs fixture expected.
 */

import type {
  AggregateResult,
  CalculationResult,
} from "../core/types";
import type {
  FieldMismatch,
  GoldenAggregateScenario,
  GoldenCompareReport,
  GoldenLineExpectation,
  GoldenLineScenario,
  GoldenValidationScenario,
} from "./fixture-types";

function near(
  actual: number | null | undefined,
  expected: number | null | undefined,
  tolerance: number
): boolean {
  if (actual == null && expected == null) return true;
  if (actual == null || expected == null) return false;
  return Math.abs(actual - expected) <= tolerance;
}

function pushNum(
  diffs: FieldMismatch[],
  field: string,
  actual: number | null | undefined,
  expected: number | null | undefined,
  tolerance: number
): void {
  if (!near(actual, expected, tolerance)) {
    const a = actual ?? null;
    const e = expected ?? null;
    diffs.push({
      field,
      expected: e,
      actual: a,
      delta:
        typeof a === "number" && typeof e === "number"
          ? Math.round((a - e) * 100) / 100
          : null,
    });
  }
}

function pushEq(
  diffs: FieldMismatch[],
  field: string,
  actual: string | number | boolean | null | undefined,
  expected: string | number | boolean | null | undefined
): void {
  if (actual !== expected) {
    diffs.push({
      field,
      expected: expected ?? null,
      actual: actual ?? null,
      delta: null,
    });
  }
}

function codesMatch(
  actual: readonly { code: string }[],
  expected: readonly string[]
): boolean {
  const a = [...actual.map((x) => x.code)].sort();
  const e = [...expected].sort();
  if (a.length !== e.length) return false;
  return a.every((c, i) => c === e[i]);
}

function stepsMatch(
  actual: readonly { id: string }[],
  expected: readonly string[]
): boolean {
  if (expected.length === 0) return true;
  const ids = actual.map((s) => s.id);
  return expected.every((id) => ids.includes(id));
}

/** @deprecated Prefer compareLineScenario — retained for 2B.3A callers. */
export function compareLineResultToGolden(
  result: CalculationResult,
  expectation: GoldenLineExpectation
): GoldenCompareReport {
  const tolerance = expectation.tolerance ?? 0.01;
  const differences: FieldMismatch[] = [];

  if (!result.ok || !result.outputs) {
    return {
      scenario_id: expectation.scenario_id,
      pass: false,
      differences: [
        { field: "ok", expected: 1, actual: 0, delta: 1 },
      ],
    };
  }

  pushNum(
    differences,
    "total_cost",
    result.outputs.total_cost,
    expectation.expected_cost,
    tolerance
  );
  pushNum(
    differences,
    "total_sell",
    result.outputs.total_sell,
    expectation.expected_sell,
    tolerance
  );
  pushNum(
    differences,
    "gross_profit",
    result.outputs.gross_profit,
    expectation.expected_gross_profit,
    tolerance
  );
  pushNum(
    differences,
    "gross_margin_percent",
    result.outputs.gross_margin_percent,
    expectation.expected_gross_margin_percent,
    tolerance
  );
  if (expectation.expected_markup_percent != null) {
    pushNum(
      differences,
      "markup_percent",
      result.outputs.markup_percent,
      expectation.expected_markup_percent,
      tolerance
    );
  }
  pushEq(differences, "mode", result.outputs.mode, expectation.mode);

  return {
    scenario_id: expectation.scenario_id,
    pass: differences.length === 0,
    differences,
  };
}

export function compareLineScenario(
  result: CalculationResult,
  fixture: GoldenLineScenario
): GoldenCompareReport {
  const tol = fixture.precisionTolerance;
  const differences: FieldMismatch[] = [];

  pushEq(differences, "ok", result.ok, fixture.expectOk);

  if (fixture.expectedEngineVersion) {
    pushEq(
      differences,
      "engine_version",
      result.engine_version,
      fixture.expectedEngineVersion
    );
  }
  if (fixture.expectedFormulaVersion) {
    pushEq(
      differences,
      "formula_version",
      result.formula_version,
      fixture.expectedFormulaVersion
    );
  }

  if (!fixture.expectOk) {
    if (
      !codesMatch(result.validation_errors, fixture.expectedErrors)
    ) {
      differences.push({
        field: "validation_error_codes",
        expected: fixture.expectedErrors.join(","),
        actual: result.validation_errors.map((e) => e.code).join(","),
        delta: null,
      });
    }
    pushEq(differences, "outputs_null", result.outputs == null, true);
    return {
      scenario_id: fixture.scenarioId,
      pass: differences.length === 0,
      differences,
    };
  }

  if (!result.ok || !result.outputs) {
    differences.push({
      field: "ok",
      expected: true,
      actual: false,
      delta: null,
    });
    return {
      scenario_id: fixture.scenarioId,
      pass: false,
      differences,
    };
  }

  const o = result.outputs;
  pushEq(differences, "mode", o.mode, fixture.mode);
  pushNum(differences, "total_cost", o.total_cost, fixture.expected.total_cost, tol);
  pushNum(differences, "total_sell", o.total_sell, fixture.expected.total_sell, tol);
  pushNum(
    differences,
    "gross_profit",
    o.gross_profit,
    fixture.expected.gross_profit,
    tol
  );
  pushNum(
    differences,
    "gross_margin_percent",
    o.gross_margin_percent,
    fixture.expected.gross_margin_percent,
    tol
  );
  if (fixture.expected.markup_percent !== undefined) {
    pushNum(
      differences,
      "markup_percent",
      o.markup_percent,
      fixture.expected.markup_percent,
      tol
    );
  }
  pushEq(differences, "cost_known", o.cost_known, fixture.expected.cost_known);

  if (fixture.expected.quantity !== undefined) {
    pushNum(differences, "quantity", o.quantity, fixture.expected.quantity, tol);
  }
  if (fixture.expected.calculated_quantity !== undefined) {
    pushNum(
      differences,
      "calculated_quantity",
      o.calculated_quantity,
      fixture.expected.calculated_quantity,
      tol
    );
  }
  if (fixture.expected.unit_cost !== undefined) {
    pushNum(differences, "unit_cost", o.unit_cost, fixture.expected.unit_cost, tol);
  }
  if (fixture.expected.unit_sell !== undefined) {
    pushNum(differences, "unit_sell", o.unit_sell, fixture.expected.unit_sell, tol);
  }

  if (!codesMatch(result.warnings, fixture.expectedWarnings)) {
    differences.push({
      field: "warning_codes",
      expected: fixture.expectedWarnings.join(","),
      actual: result.warnings.map((w) => w.code).join(","),
      delta: null,
    });
  }

  if (!stepsMatch(result.steps, fixture.expectedSteps)) {
    differences.push({
      field: "calculation_step_ids",
      expected: fixture.expectedSteps.join(","),
      actual: result.steps.map((s) => s.id).join(","),
      delta: null,
    });
  }

  const overridePresent = result.manual_override != null;
  const expectedOverride = fixture.expectedManualOverrideState != null;
  pushEq(differences, "manual_override_present", overridePresent, expectedOverride);
  if (expectedOverride && result.manual_override) {
    pushEq(
      differences,
      "manual_override_fields",
      result.manual_override.overridden_fields.join(","),
      fixture.expectedManualOverrideState!.overridden_fields.join(",")
    );
  }

  for (const signal of fixture.learningHookExpectations) {
    if (!result.future_learning.signals.includes(signal)) {
      differences.push({
        field: `learning_signal:${signal}`,
        expected: signal,
        actual: result.future_learning.signals.join(","),
        delta: null,
      });
    }
  }
  pushEq(
    differences,
    "auto_update_company_rules",
    result.future_learning.auto_update_company_rules,
    false
  );

  return {
    scenario_id: fixture.scenarioId,
    pass: differences.length === 0,
    differences,
  };
}

export function compareAggregateScenario(
  result: AggregateResult,
  fixture: GoldenAggregateScenario
): GoldenCompareReport {
  const tol = fixture.precisionTolerance;
  const differences: FieldMismatch[] = [];

  pushEq(differences, "ok", result.ok, fixture.expectOk);

  if (!fixture.expectOk) {
    if (!codesMatch(result.validation_errors, fixture.expectedErrors)) {
      differences.push({
        field: "validation_error_codes",
        expected: fixture.expectedErrors.join(","),
        actual: result.validation_errors.map((e) => e.code).join(","),
        delta: null,
      });
    }
    return {
      scenario_id: fixture.scenarioId,
      pass: differences.length === 0,
      differences,
    };
  }

  if (!result.ok) {
    differences.push({
      field: "ok",
      expected: true,
      actual: false,
      delta: null,
    });
    return {
      scenario_id: fixture.scenarioId,
      pass: false,
      differences,
    };
  }

  pushNum(
    differences,
    "subtotal_cost",
    result.subtotal_cost,
    fixture.expectedSubtotalCost,
    tol
  );
  pushNum(
    differences,
    "subtotal_sell",
    result.subtotal_sell,
    fixture.expectedSubtotalSell,
    tol
  );
  pushNum(
    differences,
    "gross_profit",
    result.gross_profit,
    fixture.expectedGrossProfit,
    tol
  );
  pushNum(
    differences,
    "gross_margin_percent",
    result.gross_margin_percent,
    fixture.expectedGrossMargin,
    tol
  );
  pushNum(differences, "gst_amount", result.gst_amount, fixture.expectedGST, tol);
  pushNum(
    differences,
    "total_incl_gst",
    result.total_incl_gst,
    fixture.expectedTotalIncludingGST,
    tol
  );

  if (fixture.expectedCostKnown !== undefined) {
    pushEq(differences, "cost_known", result.cost_known, fixture.expectedCostKnown);
  }

  if (fixture.gstRate !== undefined && fixture.gstRate !== null) {
    pushEq(differences, "gst_rate_percent", result.gst_rate_percent, fixture.gstRate);
  }

  if (!codesMatch(result.warnings, fixture.expectedWarnings)) {
    differences.push({
      field: "warning_codes",
      expected: fixture.expectedWarnings.join(","),
      actual: result.warnings.map((w) => w.code).join(","),
      delta: null,
    });
  }

  if (!stepsMatch(result.steps, fixture.expectedSteps)) {
    differences.push({
      field: "calculation_step_ids",
      expected: fixture.expectedSteps.join(","),
      actual: result.steps.map((s) => s.id).join(","),
      delta: null,
    });
  }

  return {
    scenario_id: fixture.scenarioId,
    pass: differences.length === 0,
    differences,
  };
}

export function compareValidationScenario(
  result: CalculationResult | AggregateResult,
  fixture: GoldenValidationScenario
): GoldenCompareReport {
  const differences: FieldMismatch[] = [];
  pushEq(differences, "ok", result.ok, false);
  pushEq(differences, "expected_no_result", true, fixture.expectedNoResult);

  if (!codesMatch(result.validation_errors, fixture.expectedErrorCodes)) {
    differences.push({
      field: "validation_error_codes",
      expected: fixture.expectedErrorCodes.join(","),
      actual: result.validation_errors.map((e) => e.code).join(","),
      delta: null,
    });
  }

  if ("outputs" in result) {
    pushEq(differences, "outputs_null", result.outputs == null, true);
  }

  return {
    scenario_id: fixture.scenarioId,
    pass: differences.length === 0,
    differences,
  };
}
