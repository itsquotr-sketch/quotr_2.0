import { round2 } from "@/lib/estimate/facts";
import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";
import type { ResolvedLabourRate, ResolvedRate } from "@/lib/estimate/types";

const DEFAULT_LABOUR_COST_RATE = 60;
const DEFAULT_LABOUR_SELL_RATE = 90;
const DEFAULT_MARGIN_PERCENT = 33.33;

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
  let costRate = params.fallbackCostRate;
  let sellRate =
    params.fallbackSellRate ?? deriveSellFromCost(costRate, marginPercent);
  let unit = params.unit ?? "unit";
  let sourceLabel = "Benchmark allowance";

  const exactRate = findActiveRate(
    params.rates,
    (rate) =>
      rate.item_key === params.itemKey &&
      rate.rate_type === params.rateType
  );

  if (exactRate?.cost_rate != null) {
    costRate = exactRate.cost_rate;
    sellRate =
      exactRate.sell_rate ??
      deriveSellFromCost(costRate, marginPercent);
    unit = exactRate.unit || unit;
    sourceLabel = "User rate";
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
      sellRate =
        workAreaRate.sell_rate ??
        deriveSellFromCost(costRate, marginPercent);
      unit = workAreaRate.unit || unit;
      sourceLabel = "Work area rate";
    }
  }

  const range = applyRangeFactors(
    costRate,
    sellRate,
    params.organisationSettings
  );

  return {
    costRate,
    sellRate,
    unit,
    sourceLabel,
    ...range,
  };
}

export function resolveLabourRate(params: {
  rates: OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  trade?: string;
}): ResolvedLabourRate {
  const marginPercent = getDefaultMarginPercent(params.organisationSettings);
  const itemKey =
    params.trade === "labourer"
      ? "labour.labourer.hour"
      : "labour.carpenter.hour";

  const userRate = findActiveRate(
    params.rates,
    (rate) => rate.item_key === itemKey && rate.rate_type === "labour"
  );

  if (userRate?.cost_rate != null) {
    return {
      costRate: userRate.cost_rate,
      sellRate:
        userRate.sell_rate ??
        deriveSellFromCost(userRate.cost_rate, marginPercent),
      sourceLabel: "User rate",
    };
  }

  return {
    costRate: DEFAULT_LABOUR_COST_RATE,
    sellRate: DEFAULT_LABOUR_SELL_RATE,
    sourceLabel: "Benchmark allowance",
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

export { deriveSellFromCost, getDefaultMarginPercent };
