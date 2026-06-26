import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { round2 } from "@/lib/estimate/facts";
import {
  assertMarginPercentForEstimating,
  InvalidMarginPercentError,
} from "@/lib/security/margin-validation";
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
  "pergola.frame.timber.m2": ["pergola_timber_frame_m2"],
  "pergola.frame.aluminium.m2": ["pergola_aluminium_frame_m2"],
  "pergola.frame.steel.m2": ["pergola_steel_frame_m2"],
  "pergola.roof.polycarbonate.m2": ["pergola_roof_polycarbonate_m2"],
  "pergola.roof.colorsteel.m2": ["pergola_roof_colorsteel_m2"],
  "pergola.roof.timber_batten.m2": ["pergola_roof_timber_batten_m2"],
  "pergola.footings.each": ["pergola_footings_each"],
  "pergola.gutters.lm": ["pergola_gutters_lm"],
  "bathroom.waterproofing.m2": ["bathroom_waterproofing_m2"],
  "bathroom.waterproofing.allowance": ["bathroom_waterproofing_m2"],
  "bathroom.tiling.m2": ["bathroom_tiling_m2"],
  "bathroom.plumbing.allowance": ["bathroom_plumbing_allowance"],
  "bathroom.electrical.allowance": ["bathroom_electrical_allowance"],
  "kitchen.cabinetry.install": ["kitchen_install_lm", "kitchen_install_each"],
  "internal_walls.framing.lm": ["internal_wall_framing_lm"],
  "sheet.plasterboard.standard.each": [
    "plasterboard_standard_sheet",
    "sheet.plasterboard.standard.each",
  ],
  "sheet.plasterboard.aqualine.each": ["plasterboard_aqualine_sheet"],
  "sheet.plasterboard.fyreline.each": ["plasterboard_fyreline_sheet"],
  "ceilings.plasterboard.m2": ["ceiling_plasterboard_m2"],
  "doors.install.each": ["door_install_each"],
  "doors.solid_core.each": ["door_supply_solid_core_each"],
  "flooring.material.m2": ["flooring_vinyl_m2"],
  "flooring.vinyl.m2": ["flooring_vinyl_m2"],
  "flooring.prep.m2": ["flooring_prep_m2"],
  "painting.material.m2": ["painting_internal_m2"],
  "painting.door.each": ["painting_door_each"],
  "painting.trim.lm": ["painting_trim_lm"],
  "plastering.level4.m2": ["plastering_level4_m2"],
  "plastering.level5.m2": ["plastering_level5_m2"],
  "demolition.general.m2": ["demolition_general_m2"],
  "demolition.wall.lm": ["demolition_wall_lm"],
  "demolition.flooring.m2": ["demolition_flooring_m2"],
  "demolition.ceiling.m2": ["demolition_ceiling_m2"],
  "demolition.kitchen.each": ["demolition_kitchen_each"],
  "demolition.bathroom.each": ["demolition_bathroom_each"],
  "demolition.disposal.allowance": ["demolition_disposal_allowance"],
  "demolition.skip_bin.each": ["demolition_skip_bin_each"],
  "demolition.carting.allowance": ["demolition_carting_allowance"],
  "demolition.fixture.removal": ["demolition_fixture_removal_allowance"],
  "external_stairs.material.riser": [
    "external_stairs_riser_each",
    "external_stairs_material_riser_each",
  ],
  "external_stairs.landing.m2": ["external_stairs_landing_m2"],
  "external_stairs.handrail.lm": ["external_stairs_handrail_lm"],
  "external_stairs.balustrade.lm": ["external_stairs_balustrade_lm"],
  "external_stairs.removal.each": ["external_stairs_removal_each"],
  "external_stairs.finish.allowance": ["external_stairs_finish_allowance"],
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

function deriveSellFromCost(costRate: number, marginPercent: number): number {
  assertMarginPercentForEstimating(marginPercent);
  const divisor = 1 - marginPercent / 100;
  if (divisor <= 0) {
    throw new InvalidMarginPercentError(marginPercent);
  }
  return round2(costRate / divisor);
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

export {
  deriveSellFromCost,
  getDefaultMarginPercent,
  DEFAULT_MARGIN_PERCENT,
  InvalidMarginPercentError,
};
