import type { CalculationResult } from "../core/types";
import type { GoldenCompareReport, GoldenLineExpectation } from "./types";

function near(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

/**
 * Compare an engine line result to a golden expectation.
 * Does not load scenario files — callers supply expectations (migration later).
 */
export function compareLineResultToGolden(
  result: CalculationResult,
  expectation: GoldenLineExpectation
): GoldenCompareReport {
  const tolerance = expectation.tolerance ?? 0.01;
  const differences: GoldenCompareReport["differences"][number][] = [];

  if (!result.ok || !result.outputs) {
    return {
      scenario_id: expectation.scenario_id,
      pass: false,
      differences: [
        {
          field: "ok",
          expected: 1,
          actual: 0,
          delta: 1,
        },
      ],
    };
  }

  const checks: Array<[string, number, number]> = [
    ["total_cost", result.outputs.total_cost, expectation.expected_cost],
    ["total_sell", result.outputs.total_sell, expectation.expected_sell],
    [
      "gross_profit",
      result.outputs.gross_profit,
      expectation.expected_gross_profit,
    ],
    [
      "gross_margin_percent",
      result.outputs.gross_margin_percent,
      expectation.expected_gross_margin_percent,
    ],
  ];

  if (expectation.expected_markup_percent != null) {
    checks.push([
      "markup_percent",
      result.outputs.markup_percent,
      expectation.expected_markup_percent,
    ]);
  }

  for (const [field, actual, expected] of checks) {
    if (!near(actual, expected, tolerance)) {
      differences.push({
        field,
        expected,
        actual,
        delta: Math.round((actual - expected) * 100) / 100,
      });
    }
  }

  if (result.outputs.mode !== expectation.mode) {
    differences.push({
      field: "mode_mismatch",
      expected: NaN,
      actual: NaN,
      delta: NaN,
    });
  }

  return {
    scenario_id: expectation.scenario_id,
    pass: differences.length === 0,
    differences,
  };
}
