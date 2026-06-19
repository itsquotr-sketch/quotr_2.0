import { calculateBathroom } from "@/lib/estimate/calculators/bathroom";
import { calculateDeck } from "@/lib/estimate/calculators/deck";
import { calculateDemolition } from "@/lib/estimate/calculators/demolition";
import { calculateExternalStairs } from "@/lib/estimate/calculators/external-stairs";
import { calculateFence } from "@/lib/estimate/calculators/fence";
import { calculateKitchen } from "@/lib/estimate/calculators/kitchen";
import { calculatePergola } from "@/lib/estimate/calculators/pergola";
import { calculateRetainingWall } from "@/lib/estimate/calculators/retaining-wall";
import { finalizeEstimateResult, mergeUnique } from "@/lib/estimate/summary";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateLineItemInput,
  EstimateResult,
  WorkAreaCalculator,
} from "@/lib/estimate/types";

const CALCULATORS: Record<string, WorkAreaCalculator> = {
  deck: calculateDeck,
  pergola: calculatePergola,
  retaining_wall: calculateRetainingWall,
  external_stairs: calculateExternalStairs,
  bathroom: calculateBathroom,
  kitchen: calculateKitchen,
  fence: calculateFence,
  demolition: calculateDemolition,
};

export class EstimateEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EstimateEngineError";
  }
}

export function calculateEstimate(context: EstimateContext): EstimateResult {
  const confirmed = context.confirmedWorkAreas;

  if (confirmed.length === 0) {
    throw new EstimateEngineError("No confirmed work areas to estimate.");
  }

  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  const exclusions: string[] = [];
  const calculatorResults: CalculatorResult[] = [];
  let sortOrder = 1;

  for (const workArea of confirmed) {
    const calculator = CALCULATORS[workArea.type];

    if (!calculator) {
      missingInfo.push(`No calculator available for ${workArea.name}.`);
      calculatorResults.push({
        lineItems: [],
        assumptions: [],
        missingInfo: [`No calculator available for ${workArea.name}.`],
        exclusions: [],
        confidence: 40,
      });
      continue;
    }

    const result = calculator(context, workArea);
    calculatorResults.push(result);

    for (const item of result.lineItems) {
      lineItems.push({
        ...item,
        sortOrder: sortOrder++,
      });
    }

    assumptions.push(...result.assumptions);
    missingInfo.push(...result.missingInfo);
    exclusions.push(...result.exclusions);
  }

  if (lineItems.length === 0) {
    missingInfo.push(
      "No priced line items could be generated from confirmed work areas."
    );
  }

  return finalizeEstimateResult({
    lineItems,
    assumptions: mergeUnique(assumptions),
    missingInfo: mergeUnique(missingInfo),
    exclusions: mergeUnique(exclusions),
    calculatorResults,
  });
}
