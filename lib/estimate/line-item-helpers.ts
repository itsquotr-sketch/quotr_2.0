import type {
  ResolvedLabourRate,
  ResolvedRate,
} from "@/lib/estimate/types";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";

export function rateFieldsFromResolved(
  resolved: ResolvedRate | ResolvedLabourRate,
  itemKey?: string
) {
  return {
    rateSource: resolved.sourceLabel,
    rateSourceType: resolved.sourceType,
    itemKey: itemKey ?? ("itemKey" in resolved ? resolved.itemKey : undefined),
    costRate: resolved.costRate,
    sellRate: resolved.sellRate,
    sellDerivedFromMargin: resolved.sellDerivedFromMargin,
  };
}

export function benchmarkRateFields(itemKey?: string) {
  return {
    rateSource: getRateSourceLabel("benchmark"),
    rateSourceType: "benchmark" as RateSourceType,
    itemKey,
  };
}

export function productivityRateFields() {
  return {
    rateSource: getRateSourceLabel("productivity"),
    rateSourceType: "productivity" as RateSourceType,
  };
}
