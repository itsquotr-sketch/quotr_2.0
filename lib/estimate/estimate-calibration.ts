import { getCatalogueEntry } from "@/lib/rates/catalogue";
import type { EstimateLineItemInput } from "@/lib/estimate/types";

export type LineItemForCalibration = Pick<
  EstimateLineItemInput,
  "rateSource" | "rateSourceType" | "itemKey" | "category"
>;
import {
  classifyRateSource,
  getRateSourceLabel,
  isBenchmarkLikeSource,
  isUserRateSource,
  type RateSourceType,
} from "@/lib/estimate/rate-source-labels";

export type RateSourceCounts = Record<RateSourceType, number>;

export type EstimateCalibrationSummary = {
  userRateCount: number;
  benchmarkCount: number;
  fallbackCount: number;
  missingCount: number;
  productivityCount: number;
  recommendedRatesMissing: number;
};

export type CalibrationHint = {
  itemKey: string;
  label: string;
  message: string;
};

function getLineItemSourceType(item: LineItemForCalibration): RateSourceType {
  return item.rateSourceType ?? classifyRateSource(item.rateSource);
}

export function countRateSources(
  lineItems: LineItemForCalibration[]
): RateSourceCounts {
  const counts: RateSourceCounts = {
    user_rate: 0,
    work_area_rate: 0,
    derived_from_margin: 0,
    benchmark: 0,
    productivity: 0,
    fallback: 0,
    missing: 0,
    default: 0,
  };

  for (const item of lineItems) {
    counts[getLineItemSourceType(item)] += 1;
  }

  return counts;
}

export function buildEstimateCalibrationSummary(
  lineItems: LineItemForCalibration[]
): EstimateCalibrationSummary {
  const counts = countRateSources(lineItems);

  const benchmarkKeys = new Set<string>();
  for (const item of lineItems) {
    const type = getLineItemSourceType(item);
    if (
      isBenchmarkLikeSource(type) ||
      type === "missing" ||
      type === "productivity"
    ) {
      if (item.itemKey) {
        benchmarkKeys.add(item.itemKey);
      }
    }
  }

  return {
    userRateCount: counts.user_rate + counts.work_area_rate,
    benchmarkCount:
      counts.benchmark + counts.productivity + counts.default + counts.fallback,
    fallbackCount: counts.fallback + counts.default,
    missingCount: counts.missing,
    productivityCount: counts.productivity,
    recommendedRatesMissing: benchmarkKeys.size,
  };
}

export function buildCalibrationHints(
  lineItems: LineItemForCalibration[],
  maxHints = 5
): CalibrationHint[] {
  const hints: CalibrationHint[] = [];
  const seen = new Set<string>();

  for (const item of lineItems) {
    const type = getLineItemSourceType(item);
    if (isUserRateSource(type)) continue;
    if (!item.itemKey || seen.has(item.itemKey)) continue;

    const catalogue = getCatalogueEntry(item.itemKey);
    if (!catalogue) continue;

    seen.add(item.itemKey);
    hints.push({
      itemKey: item.itemKey,
      label: catalogue.label,
      message: `Set ${catalogue.label.toLowerCase()} in Rates to improve this estimate.`,
    });

    if (hints.length >= maxHints) break;
  }

  if (hints.length === 0) {
    const hasBenchmark = lineItems.some((item) =>
      isBenchmarkLikeSource(getLineItemSourceType(item))
    );
    if (hasBenchmark) {
      hints.push({
        itemKey: "labour.carpenter.hour",
        label: "Carpenter / builder",
        message: "Add your labour and material rates in Rates to improve accuracy.",
      });
    }
  }

  return hints.slice(0, maxHints);
}

export function formatRateSourceForDisplay(item: LineItemForCalibration): string {
  return getRateSourceLabel(getLineItemSourceType(item));
}
