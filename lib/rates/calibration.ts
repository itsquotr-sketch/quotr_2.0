import { RECOMMENDED_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import type {
  CalibrationSummary,
  RatesPageState,
} from "@/lib/rates/types";

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
    defaultMarginPercent: state.settings?.default_margin_percent ?? 25,
    activeRateCount,
    recommendedMissingCount: recommendedMissing.length,
    benchmarkFallbackEnabled: state.settings?.allow_benchmark_rates ?? true,
    status,
    statusLabel,
    lastUpdatedAt,
  };
}

export function getRateSourceLabel(
  rate: RatesPageState["rates"][number] | undefined
): string {
  if (!rate) return "Not set";
  if (!rate.active) return "Inactive";
  if (rate.cost_rate != null) return "Your rate";
  return "Not set";
}
