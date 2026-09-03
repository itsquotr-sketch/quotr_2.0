import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { companyRateAuthorityLabel } from "@/lib/rates/authority";
import {
  RECOMMENDED_RATE_CATALOGUE,
  SCOPE_RATE_CATALOGUE,
  getCatalogueEntry,
} from "@/lib/rates/catalogue";
import type {
  CalibrationSummary,
  RatesPageState,
} from "@/lib/rates/types";

function isLegacyScopePackageKey(itemKey: string): boolean {
  return (
    itemKey.startsWith("scope.") ||
    SCOPE_RATE_CATALOGUE.some((entry) => entry.item_key === itemKey)
  );
}

function isRateConfigured(
  rates: RatesPageState["rates"],
  itemKey: string
): boolean {
  const rate = rates.find((row) => row.item_key === itemKey);
  return Boolean(rate?.active && rate.cost_rate != null);
}

function resolveStatus(
  activeRateCount: number,
  recommendedMissingCount: number,
  recommendedTotal: number
): Pick<CalibrationSummary, "status" | "statusLabel"> {
  if (activeRateCount === 0) {
    return {
      status: "needs_rates",
      statusLabel: "Needs rates",
    };
  }

  if (
    recommendedTotal > 0 &&
    recommendedMissingCount >= Math.ceil(recommendedTotal * 0.6)
  ) {
    return {
      status: "using_mostly_benchmarks",
      statusLabel: "Using mostly benchmarks",
    };
  }

  if (recommendedMissingCount > 0) {
    return {
      status: "needs_rates",
      statusLabel: "Needs rates",
    };
  }

  return {
    status: "good_setup",
    statusLabel: "Good setup",
  };
}

export function buildCalibrationSummary(
  state: RatesPageState
): CalibrationSummary {
  const activeRateCount = state.rates.filter(
    (rate) => rate.active && rate.cost_rate != null
  ).length;

  const recommendedMissing = RECOMMENDED_RATE_CATALOGUE.filter(
    (entry) => !isRateConfigured(state.rates, entry.item_key)
  );

  const lastUpdatedAt = state.rates.reduce<string | null>((latest, rate) => {
    if (!rate.updated_at) return latest;
    if (!latest || rate.updated_at > latest) return rate.updated_at;
    return latest;
  }, null);

  const { status, statusLabel } = resolveStatus(
    activeRateCount,
    recommendedMissing.length,
    RECOMMENDED_RATE_CATALOGUE.length
  );

  return {
    defaultMarginPercent: state.settings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT,
    activeRateCount,
    recommendedMissingCount: recommendedMissing.length,
    benchmarkFallbackEnabled: state.settings?.allow_benchmark_rates ?? true,
    status,
    statusLabel,
    lastUpdatedAt,
  };
}

export function getRateSourceLabel(
  rate: RatesPageState["rates"][number] | undefined,
  itemKey?: string
): string {
  const key = itemKey ?? rate?.item_key;
  const catalogue = key ? getCatalogueEntry(key) : undefined;
  const hasActiveCost = Boolean(rate?.active && rate.cost_rate != null);

  if (hasActiveCost && rate?.source === "calibrated_productivity") {
    return "Your calibrated productivity";
  }

  return companyRateAuthorityLabel({
    hasActiveCostRate: hasActiveCost,
    isLegacyScopePackage: key ? isLegacyScopePackageKey(key) : false,
    hasCatalogueBenchmark: catalogue?.defaultCostRate != null,
  });
}
