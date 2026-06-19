import { round2 } from "@/lib/estimate/facts";
import type {
  CalculatorResult,
  EstimateLineItemInput,
  EstimateResult,
} from "@/lib/estimate/types";

export const GENERAL_ESTIMATE_ASSUMPTIONS = [
  "This is an internal working estimate, not a client quote.",
  "Pricing includes overhead and margin allowance.",
  "Final selections may affect price.",
];

export const GENERAL_ESTIMATE_EXCLUSIONS = [
  "Building consent / engineering",
  "Major excavation unless confirmed",
  "Final finish selections beyond allowance",
];

export function sumLineItems(lineItems: EstimateLineItemInput[]) {
  return lineItems.reduce(
    (totals, item) => ({
      costLow: totals.costLow + item.costLow,
      costHigh: totals.costHigh + item.costHigh,
      sellLow: totals.sellLow + item.sellLow,
      sellHigh: totals.sellHigh + item.sellHigh,
      recommendedCost: totals.recommendedCost + item.recommendedCost,
      recommendedSell: totals.recommendedSell + item.recommendedSell,
    }),
    {
      costLow: 0,
      costHigh: 0,
      sellLow: 0,
      sellHigh: 0,
      recommendedCost: 0,
      recommendedSell: 0,
    }
  );
}

export function buildRateSourceSummary(
  lineItems: EstimateLineItemInput[]
): string {
  let userCount = 0;
  let benchmarkCount = 0;

  for (const item of lineItems) {
    const source = item.rateSource.toLowerCase();
    if (source.includes("user rate") || source.includes("work area rate")) {
      userCount += 1;
    } else {
      benchmarkCount += 1;
    }
  }

  const total = lineItems.length;
  if (userCount >= total * 0.6) return "Using your rates";
  if (benchmarkCount >= total * 0.6) return "Using benchmark allowances";
  return "Using mixed rates and benchmark allowances";
}

export function computeConfidence(params: {
  calculatorResults: CalculatorResult[];
  totalMissingCount: number;
  benchmarkHeavy: boolean;
}): number {
  if (params.calculatorResults.length === 0) return 0;

  const average =
    params.calculatorResults.reduce(
      (sum, result) => sum + result.confidence,
      0
    ) / params.calculatorResults.length;

  let confidence = average - params.totalMissingCount * 3;
  if (params.benchmarkHeavy) {
    confidence = Math.min(confidence, 85);
  }
  confidence = Math.max(35, Math.min(95, confidence));
  return round2(confidence);
}

export function mergeUnique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export function finalizeEstimateResult(params: {
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  exclusions: string[];
  calculatorResults: CalculatorResult[];
}): EstimateResult {
  const totals = sumLineItems(params.lineItems);
  const grossProfit = round2(
    totals.recommendedSell - totals.recommendedCost
  );
  const marginPercent =
    totals.recommendedSell > 0
      ? round2((grossProfit / totals.recommendedSell) * 100)
      : 0;
  const markupPercent =
    totals.recommendedCost > 0
      ? round2((grossProfit / totals.recommendedCost) * 100)
      : 0;

  const benchmarkHeavy =
    params.lineItems.filter((item) =>
      item.rateSource.toLowerCase().includes("benchmark")
    ).length >=
    params.lineItems.length * 0.6;

  const assumptions = mergeUnique([
    ...GENERAL_ESTIMATE_ASSUMPTIONS,
    ...params.assumptions,
  ]);
  const missingInfo = mergeUnique(params.missingInfo);
  const exclusions = mergeUnique([
    ...GENERAL_ESTIMATE_EXCLUSIONS,
    ...params.exclusions,
  ]);

  return {
    costLow: round2(totals.costLow),
    costHigh: round2(totals.costHigh),
    sellLow: round2(totals.sellLow),
    sellHigh: round2(totals.sellHigh),
    recommendedCost: round2(totals.recommendedCost),
    recommendedSell: round2(totals.recommendedSell),
    grossProfit,
    marginPercent,
    markupPercent,
    confidence: computeConfidence({
      calculatorResults: params.calculatorResults,
      totalMissingCount: missingInfo.length,
      benchmarkHeavy,
    }),
    rateSourceSummary: buildRateSourceSummary(params.lineItems),
    assumptions,
    missingInfo,
    exclusions,
    lineItems: params.lineItems,
  };
}

export function baseConfidence(missingCount: number): number {
  return Math.max(45, 82 - missingCount * 5);
}
