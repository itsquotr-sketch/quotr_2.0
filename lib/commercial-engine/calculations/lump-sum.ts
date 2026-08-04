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

  const costProvided =
    input.total_cost != null && isFiniteNumber(input.total_cost);
  const totalCost = costProvided ? roundMoney(input.total_cost as number) : 0;
  const totalSell = roundMoney(input.total_sell as number);

  // Sell-only: cost omitted → unknown (do not fabricate margin).
  // Explicit 0 + sell > 0 → also treat as unknown cost (OCD-30).
  // Both 0 → intentional no-charge / informational (cost known as zero).
  const costKnown =
    (costProvided && !(totalCost === 0 && totalSell > 0)) ||
    (totalCost === 0 && totalSell === 0);

  steps.push({
    id: "lump_sum_totals",
    formula_id: "F-LUMP",
    description: "Accept lump-sum totals as authoritative (no qty×rate equality)",
    inputs: {
      total_cost: costKnown ? totalCost : null,
      total_sell: totalSell,
      cost_known: costKnown ? 1 : 0,
    },
    output: totalSell,
  });

  if (!costKnown && totalSell > 0) {
    warnings.push({
      code: "cost_unknown",
      message:
        "Lump-sum cost is unknown while sell is positive. Do not fabricate margin or cost.",
      field: "total_cost",
    });
  }

  const quantity =
    input.quantity != null && isFiniteNumber(input.quantity)
      ? roundMoney(input.quantity)
      : null;

  const profit = deriveProfitMetrics(totalCost, totalSell, { costKnown });
  steps.push({
    id: "profit_metrics",
    formula_id: "F-GP",
    description: costKnown
      ? "Derive gross profit, margin %, markup %"
      : "Cost unknown — profit metrics null (not fabricated)",
    inputs: {
      total_cost: costKnown ? totalCost : null,
      total_sell: totalSell,
    },
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
    gross_profit: profit.gross_profit,
    gross_margin_percent: profit.gross_margin_percent,
    markup_percent: profit.markup_percent,
    cost_known: profit.cost_known,
  };

  return {
    outputs,
    steps,
    warnings,
    formulaIds,
    marginApplied: null,
    learningSignals: costKnown ? ["lump_sum"] : ["lump_sum", "cost_unknown"],
  };
}
