import { deriveProfitMetrics } from "../core/profit";
import { isFiniteNumber, roundMoney } from "../core/money";
import type {
  CalculationLineInput,
  CalculationOutputs,
  CalculationStep,
  ValidationIssue,
} from "../core/types";

export type ModeCalculationSuccess = {
  readonly outputs: CalculationOutputs;
  readonly steps: CalculationStep[];
  readonly warnings: ValidationIssue[];
  readonly formulaIds: string[];
  readonly marginApplied: number | null;
  readonly learningSignals: string[];
};

export function calculateLumpSum(
  input: CalculationLineInput
): ModeCalculationSuccess {
  const steps: CalculationStep[] = [];
  const warnings: ValidationIssue[] = [];
  const formulaIds = ["F-LUMP", "F-GP", "F-M", "F-MU"];

  const totalCost =
    input.total_cost != null && isFiniteNumber(input.total_cost)
      ? roundMoney(input.total_cost)
      : 0;
  const totalSell = roundMoney(input.total_sell as number);

  steps.push({
    id: "lump_sum_totals",
    formula_id: "F-LUMP",
    description: "Accept lump-sum totals as authoritative (no qty×rate equality)",
    inputs: { total_cost: totalCost, total_sell: totalSell },
    output: totalSell,
  });

  if (totalCost === 0 && totalSell > 0) {
    warnings.push({
      code: "cost_unknown",
      message:
        "Lump-sum cost is zero or not entered while sell is positive. Treat cost as unknown, not a true zero-cost job.",
      field: "total_cost",
    });
  }

  const quantity =
    input.quantity != null && isFiniteNumber(input.quantity)
      ? roundMoney(input.quantity)
      : null;

  const profit = deriveProfitMetrics(totalCost, totalSell);
  steps.push({
    id: "profit_metrics",
    formula_id: "F-GP",
    description: "Derive gross profit, margin %, markup %",
    inputs: { total_cost: totalCost, total_sell: totalSell },
    output: profit.gross_profit,
  });

  const outputs: CalculationOutputs = {
    mode: "lump_sum",
    quantity,
    unit: input.unit ?? null,
    unit_cost:
      input.unit_cost != null ? roundMoney(input.unit_cost) : null,
    unit_sell:
      input.unit_sell != null ? roundMoney(input.unit_sell) : null,
    productivity_rate: null,
    productivity_unit: null,
    calculated_quantity: null,
    total_cost: totalCost,
    total_sell: totalSell,
    ...profit,
  };

  return {
    outputs,
    steps,
    warnings,
    formulaIds,
    marginApplied: null,
    learningSignals: ["lump_sum"],
  };
}
