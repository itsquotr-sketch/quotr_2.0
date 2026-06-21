import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { round2 } from "@/lib/estimate/facts";
import {
  getRateSourceLabel,
  type RateSourceType,
} from "@/lib/estimate/rate-source-labels";
import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";
import type { ResolvedLabourRate, ResolvedRate } from "@/lib/estimate/types";

const DEFAULT_LABOUR_COST_RATE = 60;
const DEFAULT_LABOUR_SELL_RATE = 90;

/** Legacy onboarding keys mapped to current catalogue keys */
const ITEM_KEY_ALIASES: Record<string, string[]> = {
  "scope.retaining_wall.face_m2": ["scope.retaining_wall.m2"],
  "scope.demolition.m2": ["scope.demolition.hour"],
};

function getDefaultMarginPercent(settings: OrganisationSettings | null): number {
  return settings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT;
}

function getLowFactor(settings: OrganisationSettings | null): number {
  return settings?.budget_rate_factor ?? 0.9;
}

function getHighFactor(settings: OrganisationSettings | null): number {
  return settings?.premium_rate_factor ?? 1.15;
}

function deriveSellFromCost(
  costRate: number,
  marginPercent: number
): number {
  if (marginPercent >= 100) return costRate * 1.5;
  return round2(costRate / (1 - marginPercent / 100));
}

function applyRangeFactors(
  costRate: number,
  sellRate: number,
  settings: OrganisationSettings | null
): Pick<
  ResolvedRate,
  "costRateLow" | "costRateHigh" | "sellRateLow" | "sellRateHigh"
> {
  const low = getLowFactor(settings);
  const high = getHighFactor(settings);
  return {
    costRateLow: round2(costRate * low),
    costRateHigh: round2(costRate * high),
    sellRateLow: round2(sellRate * low),
    sellRateHigh: round2(sellRate * high),
  };
}

function findActiveRate(
  rates: OrganisationRate[],
  predicate: (rate: OrganisationRate) => boolean
): OrganisationRate | undefined {
  return rates.find((rate) => rate.active && predicate(rate));
}

function allowBenchmarkFallback(
  settings: OrganisationSettings | null
): boolean {
  return settings?.allow_benchmark_rates !== false;
}

function buildResolvedRate(params: {
  costRate: number;
  sellRate: number;
  unit: string;
  sourceType: RateSourceType;
  itemKey: string;
  sellDerivedFromMargin: boolean;
  organisationSettings: OrganisationSettings | null;
}): ResolvedRate {
  const range = applyRangeFactors(
    params.costRate,
    params.sellRate,
    params.organisationSettings
  );

  return {
    costRate: params.costRate,
    sellRate: params.sellRate,
    unit: params.unit,
    sourceType: params.sourceType,
    itemKey: params.itemKey,
    sellDerivedFromMargin: params.sellDerivedFromMargin,
    sourceLabel: getRateSourceLabel(params.sourceType),
    ...range,
  };
}

export function resolveRate(params: {
  rates: OrganisationRate[];
  rateType: string;
  itemKey: string;
  workAreaType?: string;
  unit?: string;
  fallbackCostRate: number;
  fallbackSellRate?: number;
  organisationSettings: OrganisationSettings | null;
}): ResolvedRate {
  const marginPercent = getDefaultMarginPercent(params.organisationSettings);
  const benchmarkAllowed = allowBenchmarkFallback(params.organisationSettings);
  let costRate = params.fallbackCostRate;
  let sellRate =
    params.fallbackSellRate ?? deriveSellFromCost(costRate, marginPercent);
  let unit = params.unit ?? "unit";
  let sourceType: RateSourceType = benchmarkAllowed ? "benchmark" : "missing";
  let sellDerivedFromMargin = params.fallbackSellRate == null;

  const exactRate = findActiveRate(params.rates, (rate) => {
    if (
      rate.item_key === params.itemKey &&
      rate.rate_type === params.rateType
    ) {
      return true;
    }
    const aliases = ITEM_KEY_ALIASES[params.itemKey] ?? [];
    return (
      aliases.includes(rate.item_key) && rate.rate_type === params.rateType
    );
  });

  if (exactRate?.cost_rate != null) {
    costRate = exactRate.cost_rate;
    sellDerivedFromMargin = exactRate.sell_rate == null;
    sellRate =
      exactRate.sell_rate ?? deriveSellFromCost(costRate, marginPercent);
    unit = exactRate.unit || unit;
    sourceType = "user_rate";
  } else if (params.workAreaType) {
    const workAreaRate = findActiveRate(
      params.rates,
      (rate) =>
        rate.rate_type === params.rateType &&
        rate.work_area_type === params.workAreaType &&
        rate.cost_rate != null
    );

    if (workAreaRate?.cost_rate != null) {
      costRate = workAreaRate.cost_rate;
      sellDerivedFromMargin = workAreaRate.sell_rate == null;
      sellRate =
        workAreaRate.sell_rate ??
        deriveSellFromCost(costRate, marginPercent);
      unit = workAreaRate.unit || unit;
      sourceType = "work_area_rate";
    }
  } else if (!benchmarkAllowed) {
    sourceType = "missing";
  }

  return buildResolvedRate({
    costRate,
    sellRate,
    unit,
    sourceType,
    itemKey: params.itemKey,
    sellDerivedFromMargin,
    organisationSettings: params.organisationSettings,
  });
}

export function resolveLabourRate(params: {
  rates: OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  trade?: string;
}): ResolvedLabourRate {
  const marginPercent = getDefaultMarginPercent(params.organisationSettings);

  const labourKeys =
    params.trade === "labourer"
      ? ["labour.labourer.hour", "labour.general.hour", "labour.carpenter.hour"]
      : params.trade === "apprentice"
        ? ["labour.apprentice.hour", "labour.general.hour", "labour.carpenter.hour"]
        : ["labour.carpenter.hour", "labour.general.hour"];

  for (const key of labourKeys) {
    const userRate = findActiveRate(
      params.rates,
      (rate) => rate.item_key === key && rate.rate_type === "labour"
    );

    if (userRate?.cost_rate != null) {
      const sellDerivedFromMargin = userRate.sell_rate == null;
      return {
        costRate: userRate.cost_rate,
        sellRate:
          userRate.sell_rate ??
          deriveSellFromCost(userRate.cost_rate, marginPercent),
        sourceLabel: getRateSourceLabel("user_rate"),
        sourceType: "user_rate",
        itemKey: key,
        sellDerivedFromMargin,
      };
    }
  }

  const benchmarkAllowed = allowBenchmarkFallback(params.organisationSettings);
  const sourceType: RateSourceType = benchmarkAllowed ? "default" : "missing";

  return {
    costRate: DEFAULT_LABOUR_COST_RATE,
    sellRate: DEFAULT_LABOUR_SELL_RATE,
    sourceLabel: getRateSourceLabel(sourceType),
    sourceType,
    sellDerivedFromMargin: false,
  };
}

export function getRangeFactors(settings: OrganisationSettings | null): {
  low: number;
  high: number;
} {
  return {
    low: getLowFactor(settings),
    high: getHighFactor(settings),
  };
}

export { deriveSellFromCost, getDefaultMarginPercent, DEFAULT_MARGIN_PERCENT };
