import { PERGOLA_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import { resolveRate } from "@/lib/estimate/rates";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import type { ResolvedRate } from "@/lib/estimate/types";

export const PERGOLA_FRAME_RATE_KEYS = {
  timber: "pergola.frame.timber.m2",
  aluminium: "pergola.frame.aluminium.m2",
  steel: "pergola.frame.steel.m2",
  generic: "pergola.material.m2",
} as const;

export const PERGOLA_ROOF_RATE_KEYS = {
  colorsteel: "pergola.roof.colorsteel.m2",
  polycarbonate: "pergola.roof.polycarbonate.m2",
  timberBatten: "pergola.roof.timber_batten.m2",
  generic: "pergola.roofing.m2",
} as const;

export const PERGOLA_ALLOWANCE_RATE_KEYS = {
  footingsEach: "pergola.footings.each",
  guttersLm: "pergola.gutters.lm",
} as const;

function getPergolaFrameBenchmark(material: string | null) {
  const normalized = material?.toLowerCase() ?? "";
  if (normalized.includes("steel")) {
    return PERGOLA_BENCHMARKS.steelFrame;
  }
  if (normalized.includes("aluminium") || normalized.includes("aluminum")) {
    return PERGOLA_BENCHMARKS.aluminiumFrame;
  }
  if (normalized.includes("timber")) {
    return PERGOLA_BENCHMARKS.timberFrame;
  }
  return PERGOLA_BENCHMARKS.frameMaterials;
}

function getPergolaFrameRateKey(material: string | null): string {
  const normalized = material?.toLowerCase() ?? "";
  if (normalized.includes("steel")) {
    return PERGOLA_FRAME_RATE_KEYS.steel;
  }
  if (normalized.includes("aluminium") || normalized.includes("aluminum")) {
    return PERGOLA_FRAME_RATE_KEYS.aluminium;
  }
  if (normalized.includes("timber")) {
    return PERGOLA_FRAME_RATE_KEYS.timber;
  }
  return PERGOLA_FRAME_RATE_KEYS.generic;
}

function getPergolaRoofingBenchmark(roofingType: string | null) {
  const normalized = roofingType?.toLowerCase() ?? "";
  if (normalized.includes("colorsteel") || normalized.includes("steel")) {
    return PERGOLA_BENCHMARKS.colorsteelRoofing;
  }
  if (normalized.includes("polycarb")) {
    return PERGOLA_BENCHMARKS.polycarbonateRoofing;
  }
  if (normalized.includes("timber") || normalized.includes("slat")) {
    return PERGOLA_BENCHMARKS.roofing;
  }
  return PERGOLA_BENCHMARKS.roofing;
}

function getPergolaRoofRateKey(roofingType: string | null): string {
  const normalized = roofingType?.toLowerCase() ?? "";
  if (normalized.includes("colorsteel") || normalized.includes("steel")) {
    return PERGOLA_ROOF_RATE_KEYS.colorsteel;
  }
  if (normalized.includes("polycarb")) {
    return PERGOLA_ROOF_RATE_KEYS.polycarbonate;
  }
  if (normalized.includes("timber") || normalized.includes("slat")) {
    return PERGOLA_ROOF_RATE_KEYS.timberBatten;
  }
  return PERGOLA_ROOF_RATE_KEYS.generic;
}

function hasUserRate(
  rates: OrganisationRate[],
  itemKey: string,
  rateType: string
): boolean {
  return rates.some(
    (rate) =>
      rate.active &&
      rate.rate_type === rateType &&
      rate.item_key === itemKey &&
      rate.cost_rate != null
  );
}

export function resolvePergolaFrameRate(params: {
  material: string | null;
  rates: OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
}): ResolvedRate {
  const specificKey = getPergolaFrameRateKey(params.material);
  const benchmark = getPergolaFrameBenchmark(params.material);

  if (
    !hasUserRate(params.rates, specificKey, "material") &&
    hasUserRate(params.rates, PERGOLA_FRAME_RATE_KEYS.generic, "material")
  ) {
    return resolveRate({
      rates: params.rates,
      rateType: "material",
      itemKey: PERGOLA_FRAME_RATE_KEYS.generic,
      workAreaType: "pergola",
      unit: "m2",
      fallbackCostRate: PERGOLA_BENCHMARKS.frameMaterials.cost,
      fallbackSellRate: PERGOLA_BENCHMARKS.frameMaterials.sell,
      organisationSettings: params.organisationSettings,
    });
  }

  return resolveRate({
    rates: params.rates,
    rateType: "material",
    itemKey: specificKey,
    workAreaType: "pergola",
    unit: "m2",
    fallbackCostRate: benchmark.cost,
    fallbackSellRate: benchmark.sell,
    organisationSettings: params.organisationSettings,
  });
}

export function resolvePergolaRoofRate(params: {
  roofingType: string | null;
  rates: OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
}): ResolvedRate {
  const specificKey = getPergolaRoofRateKey(params.roofingType);
  const benchmark = getPergolaRoofingBenchmark(params.roofingType);

  if (
    !hasUserRate(params.rates, specificKey, "material") &&
    hasUserRate(params.rates, PERGOLA_ROOF_RATE_KEYS.generic, "material")
  ) {
    return resolveRate({
      rates: params.rates,
      rateType: "material",
      itemKey: PERGOLA_ROOF_RATE_KEYS.generic,
      workAreaType: "pergola",
      unit: "m2",
      fallbackCostRate: PERGOLA_BENCHMARKS.roofing.cost,
      fallbackSellRate: PERGOLA_BENCHMARKS.roofing.sell,
      organisationSettings: params.organisationSettings,
    });
  }

  return resolveRate({
    rates: params.rates,
    rateType: "material",
    itemKey: specificKey,
    workAreaType: "pergola",
    unit: "m2",
    fallbackCostRate: benchmark.cost,
    fallbackSellRate: benchmark.sell,
    organisationSettings: params.organisationSettings,
  });
}
