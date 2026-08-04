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

function applyWasteToQuantity(
  quantity: number,
  wastePercent: number | null | undefined,
  alreadyAdjusted: boolean | undefined
): { quantity: number; steps: CalculationStep[]; warnings: ValidationIssue[] } {
  const steps: CalculationStep[] = [];
  const warnings: ValidationIssue[] = [];

  if (
    alreadyAdjusted ||
    wastePercent == null ||
    !isFiniteNumber(wastePercent) ||
    wastePercent === 0
  ) {
    return { quantity, steps, warnings };
  }

  const adjusted = roundMoney(quantity * (1 + wastePercent / 100));
  steps.push({
    id: "apply_waste",
    formula_id: "F-WASTE",
    description: "Apply waste percent to quantity before money",
    inputs: { quantity, waste_percent: wastePercent },
    output: adjusted,
  });
  warnings.push({
    code: "wastage_applied",
    message: `Wastage ${wastePercent}% applied to quantity.`,
    field: "waste_percent",
  });
  return { quantity: adjusted, steps, warnings };
}

function resolveUnitSell(
  unitCost: number | null,
  unitSell: number | null | undefined,
  marginPercent: number | null | undefined,
  steps: CalculationStep[]
): { unitSell: number | null; marginApplied: number | null } {
  if (unitSell != null && isFiniteNumber(unitSell)) {
    return { unitSell: roundMoney(unitSell), marginApplied: null };
  }
  if (unitCost != null && isFiniteNumber(unitCost)) {
    const m =
      marginPercent != null && isFiniteNumber(marginPercent)
        ? marginPercent
        : DEFAULT_GROSS_MARGIN_PERCENT;
    const derived = deriveSellFromCost(unitCost, m);
    steps.push({
      id: "derive_unit_sell",
      formula_id: "F-SFM",
      description: "Derive unit sell from unit cost using gross margin",
      inputs: { unit_cost: unitCost, gross_margin_percent: m },
      output: derived,
    });
    return { unitSell: derived, marginApplied: m };
  }
  return { unitSell: null, marginApplied: null };
}

export function calculateQuantityRate(
  input: CalculationLineInput
): ModeCalculationSuccess {
  const steps: CalculationStep[] = [];
  const warnings: ValidationIssue[] = [];
  const formulaIds = ["F-QTY", "F-GP", "F-M", "F-MU"];

  let quantity = roundMoney(input.quantity as number);
  const wasteResult = applyWasteToQuantity(
    quantity,
    input.waste_percent,
    input.quantity_waste_adjusted
  );
  quantity = wasteResult.quantity;
  steps.push(...wasteResult.steps);
  warnings.push(...wasteResult.warnings);
  if (wasteResult.steps.length > 0) formulaIds.unshift("F-WASTE");

  const unitCost =
    input.unit_cost != null ? roundMoney(input.unit_cost) : null;
  const sellResolved = resolveUnitSell(
    unitCost,
    input.unit_sell,
    input.target_gross_margin_percent,
    steps
  );
  if (sellResolved.marginApplied != null) formulaIds.push("F-SFM");

  const unitSell = sellResolved.unitSell;
  const totalCost =
    unitCost != null ? roundMoney(quantity * unitCost) : roundMoney(0);
  const totalSell =
    unitSell != null ? roundMoney(quantity * unitSell) : roundMoney(0);

  steps.push({
    id: "quantity_rate_totals",
    formula_id: "F-QTY",
    description: "quantity × unit rates",
    inputs: {
      quantity,
      unit_cost: unitCost,
      unit_sell: unitSell,
    },
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
    mode: "quantity_rate",
    quantity,
    unit: input.unit ?? null,
    unit_cost: unitCost,
    unit_sell: unitSell,
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
    marginApplied: sellResolved.marginApplied,
    learningSignals: ["qty_rate"],
  };
}
