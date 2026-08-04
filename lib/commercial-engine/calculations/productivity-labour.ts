import { deriveProfitMetrics } from "../core/profit";
import { deriveSellFromCost } from "../core/sell-from-margin";
import { isFiniteNumber, roundMoney } from "../core/money";
import type {
  CalculationLineInput,
  CalculationOutputs,
  CalculationStep,
  ValidationIssue,
} from "../core/types";
import { DEFAULT_GROSS_MARGIN_PERCENT } from "../versioning";

export type ModeCalculationSuccess = {
  readonly outputs: CalculationOutputs;
  readonly steps: CalculationStep[];
  readonly warnings: ValidationIssue[];
  readonly formulaIds: string[];
  readonly marginApplied: number | null;
  readonly learningSignals: string[];
};

export function calculateProductivityLabour(
  input: CalculationLineInput
): ModeCalculationSuccess {
  const steps: CalculationStep[] = [];
  const warnings: ValidationIssue[] = [];
  const formulaIds = ["F-PROD", "F-GP", "F-M", "F-MU"];

  let hours: number;
  let productivityRate =
    input.productivity_rate != null ? roundMoney(input.productivity_rate) : null;
  const quantity =
    input.quantity != null && isFiniteNumber(input.quantity)
      ? roundMoney(input.quantity)
      : null;

  if (
    input.calculated_quantity != null &&
    isFiniteNumber(input.calculated_quantity) &&
    input.calculated_quantity > 0
  ) {
    hours = roundMoney(input.calculated_quantity);
    steps.push({
      id: "use_provided_hours",
      formula_id: "F-PROD",
      description: "Use provided labour hours (calculated_quantity)",
      inputs: { calculated_quantity: hours },
      output: hours,
    });
    if (
      productivityRate == null &&
      quantity != null &&
      quantity > 0
    ) {
      productivityRate = roundMoney(hours / quantity);
    }
  } else {
    hours = roundMoney(
      (quantity as number) * (productivityRate as number)
    );
    steps.push({
      id: "derive_hours",
      formula_id: "F-PROD",
      description: "hours = quantity × productivity_rate",
      inputs: {
        quantity,
        productivity_rate: productivityRate,
      },
      output: hours,
    });
  }

  const unitCost =
    input.unit_cost != null ? roundMoney(input.unit_cost) : null;
  let unitSell =
    input.unit_sell != null ? roundMoney(input.unit_sell) : null;
  let marginApplied: number | null = null;

  if (unitSell == null && unitCost != null) {
    const m =
      input.target_gross_margin_percent != null &&
      isFiniteNumber(input.target_gross_margin_percent)
        ? input.target_gross_margin_percent
        : DEFAULT_GROSS_MARGIN_PERCENT;
    unitSell = deriveSellFromCost(unitCost, m);
    marginApplied = m;
    formulaIds.push("F-SFM");
    steps.push({
      id: "derive_hourly_sell",
      formula_id: "F-SFM",
      description: "Derive hourly sell from hourly cost using gross margin",
      inputs: { unit_cost: unitCost, gross_margin_percent: m },
      output: unitSell,
    });
  }

  const totalCost =
    unitCost != null ? roundMoney(hours * unitCost) : roundMoney(0);
  const totalSell =
    unitSell != null ? roundMoney(hours * unitSell) : roundMoney(0);

  steps.push({
    id: "productivity_totals",
    formula_id: "F-PROD",
    description: "hours × hourly rates",
    inputs: { hours, unit_cost: unitCost, unit_sell: unitSell },
    output: totalSell,
  });

  const profit = deriveProfitMetrics(totalCost, totalSell);
  steps.push({
    id: "profit_metrics",
    formula_id: "F-GP",
    description: "Derive gross profit, margin %, markup %",
    inputs: { total_cost: totalCost, total_sell: totalSell },
    output: profit.gross_profit,
  });

  const outputs: CalculationOutputs = {
    mode: "productivity_labour",
    quantity,
    unit: input.unit ?? null,
    unit_cost: unitCost,
    unit_sell: unitSell,
    productivity_rate: productivityRate,
    productivity_unit: input.productivity_unit ?? input.unit ?? null,
    calculated_quantity: hours,
    total_cost: totalCost,
    total_sell: totalSell,
    ...profit,
  };

  return {
    outputs,
    steps,
    warnings,
    formulaIds,
    marginApplied,
    learningSignals: ["productivity_labour"],
  };
}
