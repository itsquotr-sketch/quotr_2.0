import { round2 } from "@/lib/estimate/facts";
import {
  countRateSources,
  type EstimateCalibrationSummary,
} from "@/lib/estimate/estimate-calibration";
import {
  classifyRateSource,
  isUserRateSource,
} from "@/lib/estimate/rate-source-labels";
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

function getLineItemSourceType(item: EstimateLineItemInput) {
  return item.rateSourceType ?? classifyRateSource(item.rateSource);
}

function summarizeCategoryRateSource(
  items: EstimateLineItemInput[],
  categoryFilter: (item: EstimateLineItemInput) => boolean
): string | null {
  const categoryItems = items.filter(categoryFilter);
  if (categoryItems.length === 0) return null;

  const userCount = categoryItems.filter((item) =>
    isUserRateSource(getLineItemSourceType(item))
  ).length;
  const missingCount = categoryItems.filter(
    (item) => getLineItemSourceType(item) === "missing"
  ).length;

  if (missingCount > 0) {
    return "some rates missing";
  }

  if (userCount === categoryItems.length) {
    return "your rates";
  }

  if (userCount === 0) {
    return "benchmark allowances";
  }

  return "mixed rates";
}

export function buildRateSourceSummary(
  lineItems: EstimateLineItemInput[]
): string {
  if (lineItems.length === 0) return "No line items";

  const counts = countRateSources(lineItems);
  const total = lineItems.length;

  if (counts.missing > 0) {
    return "Some rates missing — estimate confidence reduced";
  }

  const labourSummary = summarizeCategoryRateSource(
    lineItems,
    (item) => item.category === "labour"
  );
  const materialSummary = summarizeCategoryRateSource(
    lineItems,
    (item) =>
      item.category === "materials" ||
      item.category === "allowance" ||
      item.category === "subcontractor"
  );

  if (labourSummary && materialSummary) {
    if (
      labourSummary === "your rates" &&
      materialSummary === "benchmark allowances"
    ) {
      return "Using your labour rates with benchmark material allowances";
    }

    return `Labour: ${labourSummary} · Materials: ${materialSummary}`;
  }

  if (labourSummary) {
    return labourSummary === "your rates"
      ? "Using your labour rates"
      : `Labour: ${labourSummary}`;
  }

  if (materialSummary) {
    return materialSummary === "benchmark allowances"
      ? "Using benchmark allowances"
      : `Materials: ${materialSummary}`;
  }

  const userCount = counts.user_rate + counts.work_area_rate;
  const benchmarkCount =
    counts.benchmark +
    counts.productivity +
    counts.fallback +
    counts.default;

  if (userCount >= total * 0.7) {
    return "Mostly using your rates";
  }

  if (benchmarkCount >= total * 0.6) {
    return "Using benchmark allowances";
  }

  return "Using mixed rates and benchmark allowances";
}

/**
 * Deterministic confidence scoring for internal estimates.
 * Base 75, adjusted for missing facts, user-rate coverage, and benchmark reliance.
 */
export function computeConfidence(params: {
  lineItems: EstimateLineItemInput[];
  totalMissingCount: number;
}): number {
  const counts = countRateSources(params.lineItems);
  const total = Math.max(params.lineItems.length, 1);
  const userCount = counts.user_rate + counts.work_area_rate;
  const benchmarkCount =
    counts.benchmark +
    counts.productivity +
    counts.fallback +
    counts.default;

  let confidence = 75;

  if (params.totalMissingCount === 0) {
    confidence += 10;
  } else {
    confidence -= 15;
  }

  if (userCount / total >= 0.7) {
    confidence += 5;
  }

  if (benchmarkCount / total >= 0.6) {
    confidence -= 10;
  }

  if (counts.fallback + counts.default > 0) {
    confidence -= 10;
  }

  if (counts.missing > 0) {
    confidence -= 10;
  }

  return round2(Math.max(35, Math.min(95, confidence)));
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

  const missingInfo = mergeUnique(params.missingInfo);
  const assumptions = mergeUnique([
    ...GENERAL_ESTIMATE_ASSUMPTIONS,
    ...params.assumptions,
  ]);
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
      lineItems: params.lineItems,
      totalMissingCount: missingInfo.length,
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

export type { EstimateCalibrationSummary };
