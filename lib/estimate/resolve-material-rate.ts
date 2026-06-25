import { round2 } from "@/lib/estimate/facts";
import { getCatalogueEntry } from "@/lib/rates/catalogue";
import {
  deriveSellFromCost,
  getDefaultMarginPercent,
} from "@/lib/estimate/rates";
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";
import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";
import type { ResolvedRate } from "@/lib/estimate/types";

export type MaterialRateSource =
  | "company_specific"
  | "company_category"
  | "company_scope"
  | "benchmark_specific"
  | "benchmark_category"
  | "missing";

export type MaterialRateConfidence = "high" | "medium" | "low";

export type ResolvedMaterialRate = ResolvedRate & {
  materialRateSource: MaterialRateSource;
  confidence: MaterialRateConfidence;
  rateResolutionDisplay: string;
  resolvedMaterialKey: string;
};

function findActiveRate(
  rates: OrganisationRate[],
  predicate: (rate: OrganisationRate) => boolean
): OrganisationRate | undefined {
  return rates.find((rate) => rate.active && predicate(rate));
}

function unitsMatch(rateUnit: string, expectedUnit: string): boolean {
  const normalize = (unit: string) =>
    unit
      .toLowerCase()
      .replace("m²", "m2")
      .replace("each", "sheet")
      .replace("litre", "l")
      .replace("liter", "l");
  return normalize(rateUnit) === normalize(expectedUnit);
}

function mapMaterialSourceToRateSourceType(
  source: MaterialRateSource
): RateSourceType {
  switch (source) {
    case "company_specific":
    case "company_scope":
      return "user_rate";
    case "company_category":
      return "work_area_rate";
    case "benchmark_specific":
    case "benchmark_category":
      return "benchmark";
    default:
      return "missing";
  }
}

function confidenceForSource(source: MaterialRateSource): MaterialRateConfidence {
  switch (source) {
    case "company_specific":
      return "high";
    case "company_scope":
    case "company_category":
      return "medium";
    case "benchmark_specific":
      return "medium";
    case "benchmark_category":
      return "low";
    default:
      return "low";
  }
}

export function formatMaterialRateResolutionDisplay(params: {
  source: MaterialRateSource;
  label: string;
  unit: string;
  materialKey: string;
}): string {
  const unitLabel = params.unit === "m2" ? "$/m²" : params.unit === "lm" ? "$/lm" : params.unit === "m3" ? "$/m³" : params.unit === "l" ? "$/L" : params.unit === "each" ? "$/sheet" : `$/${params.unit}`;

  switch (params.source) {
    case "company_specific":
      return `Company rate: ${params.label} ${unitLabel}`;
    case "company_scope":
      return `Company scope rate: ${params.label}`;
    case "company_category":
      return `Company category rate: ${params.label}`;
    case "benchmark_specific":
      return `Benchmark fallback: ${params.label} ${unitLabel}`;
    case "benchmark_category":
      return `Benchmark category fallback: ${params.label}`;
    case "missing":
      return `Missing specific rate — using benchmark for ${params.label}`;
    default:
      return params.label;
  }
}

function buildResolvedMaterialRate(params: {
  costRate: number;
  sellRate: number;
  unit: string;
  materialRateSource: MaterialRateSource;
  itemKey: string;
  label: string;
  sellDerivedFromMargin: boolean;
  organisationSettings: OrganisationSettings | null;
}): ResolvedMaterialRate {
  const low = params.organisationSettings?.budget_rate_factor ?? 0.9;
  const high = params.organisationSettings?.premium_rate_factor ?? 1.15;
  const sourceType = mapMaterialSourceToRateSourceType(params.materialRateSource);

  return {
    costRate: params.costRate,
    sellRate: params.sellRate,
    costRateLow: round2(params.costRate * low),
    costRateHigh: round2(params.costRate * high),
    sellRateLow: round2(params.sellRate * low),
    sellRateHigh: round2(params.sellRate * high),
    unit: params.unit,
    sourceType,
    sourceLabel: formatMaterialRateResolutionDisplay({
      source: params.materialRateSource,
      label: params.label,
      unit: params.unit,
      materialKey: params.itemKey,
    }),
    itemKey: params.itemKey,
    sellDerivedFromMargin: params.sellDerivedFromMargin,
    materialRateSource: params.materialRateSource,
    confidence: confidenceForSource(params.materialRateSource),
    rateResolutionDisplay: formatMaterialRateResolutionDisplay({
      source: params.materialRateSource,
      label: params.label,
      unit: params.unit,
      materialKey: params.itemKey,
    }),
    resolvedMaterialKey: params.itemKey,
  };
}

export function resolveMaterialRate(params: {
  orgRates: OrganisationRate[];
  materialKey: string;
  categoryKey?: string;
  scopeKey?: string;
  workAreaType?: string;
  unit: string;
  label?: string;
  benchmarkCostRate: number;
  benchmarkSellRate?: number;
  categoryBenchmarkCostRate?: number;
  categoryBenchmarkSellRate?: number;
  organisationSettings: OrganisationSettings | null;
}): ResolvedMaterialRate {
  const marginPercent = getDefaultMarginPercent(params.organisationSettings);
  const benchmarkAllowed =
    params.organisationSettings?.allow_benchmark_rates !== false;
  const catalogueEntry = getCatalogueEntry(params.materialKey);
  const label =
    params.label ?? catalogueEntry?.label ?? params.materialKey.split(".").pop() ?? "Material";

  const exactRate = findActiveRate(
    params.orgRates,
    (rate) =>
      rate.item_key === params.materialKey &&
      rate.rate_type === "material" &&
      rate.cost_rate != null &&
      unitsMatch(rate.unit, params.unit)
  );

  if (exactRate?.cost_rate != null) {
    const sellDerived = exactRate.sell_rate == null;
    return buildResolvedMaterialRate({
      costRate: exactRate.cost_rate,
      sellRate:
        exactRate.sell_rate ??
        deriveSellFromCost(exactRate.cost_rate, marginPercent),
      unit: exactRate.unit || params.unit,
      materialRateSource: "company_specific",
      itemKey: params.materialKey,
      label,
      sellDerivedFromMargin: sellDerived,
      organisationSettings: params.organisationSettings,
    });
  }

  if (params.categoryKey) {
    const categoryRate = findActiveRate(
      params.orgRates,
      (rate) =>
        rate.item_key === params.categoryKey &&
        rate.rate_type === "material" &&
        rate.cost_rate != null
    );
    if (categoryRate?.cost_rate != null) {
      const sellDerived = categoryRate.sell_rate == null;
      return buildResolvedMaterialRate({
        costRate: categoryRate.cost_rate,
        sellRate:
          categoryRate.sell_rate ??
          deriveSellFromCost(categoryRate.cost_rate, marginPercent),
        unit: categoryRate.unit || params.unit,
        materialRateSource: "company_category",
        itemKey: params.categoryKey,
        label,
        sellDerivedFromMargin: sellDerived,
        organisationSettings: params.organisationSettings,
      });
    }
  }

  if (params.workAreaType) {
    const workAreaRate = findActiveRate(
      params.orgRates,
      (rate) =>
        rate.rate_type === "material" &&
        rate.work_area_type === params.workAreaType &&
        rate.cost_rate != null
    );
    if (workAreaRate?.cost_rate != null) {
      const sellDerived = workAreaRate.sell_rate == null;
      return buildResolvedMaterialRate({
        costRate: workAreaRate.cost_rate,
        sellRate:
          workAreaRate.sell_rate ??
          deriveSellFromCost(workAreaRate.cost_rate, marginPercent),
        unit: workAreaRate.unit || params.unit,
        materialRateSource: "company_category",
        itemKey: workAreaRate.item_key,
        label,
        sellDerivedFromMargin: sellDerived,
        organisationSettings: params.organisationSettings,
      });
    }
  }

  if (params.scopeKey) {
    const scopeRate = findActiveRate(
      params.orgRates,
      (rate) =>
        rate.item_key === params.scopeKey &&
        rate.rate_type === "scope" &&
        rate.cost_rate != null
    );
    if (scopeRate?.cost_rate != null) {
      const sellDerived = scopeRate.sell_rate == null;
      return buildResolvedMaterialRate({
        costRate: scopeRate.cost_rate,
        sellRate:
          scopeRate.sell_rate ??
          deriveSellFromCost(scopeRate.cost_rate, marginPercent),
        unit: scopeRate.unit || params.unit,
        materialRateSource: "company_scope",
        itemKey: params.scopeKey,
        label,
        sellDerivedFromMargin: sellDerived,
        organisationSettings: params.organisationSettings,
      });
    }
  }

  if (benchmarkAllowed) {
    const sellDerived = params.benchmarkSellRate == null;
    return buildResolvedMaterialRate({
      costRate: params.benchmarkCostRate,
      sellRate:
        params.benchmarkSellRate ??
        deriveSellFromCost(params.benchmarkCostRate, marginPercent),
      unit: params.unit,
      materialRateSource: "benchmark_specific",
      itemKey: params.materialKey,
      label,
      sellDerivedFromMargin: sellDerived,
      organisationSettings: params.organisationSettings,
    });
  }

  if (
    benchmarkAllowed &&
    params.categoryBenchmarkCostRate != null
  ) {
    const sellDerived = params.categoryBenchmarkSellRate == null;
    return buildResolvedMaterialRate({
      costRate: params.categoryBenchmarkCostRate,
      sellRate:
        params.categoryBenchmarkSellRate ??
        deriveSellFromCost(params.categoryBenchmarkCostRate, marginPercent),
      unit: params.unit,
      materialRateSource: "benchmark_category",
      itemKey: params.categoryKey ?? params.materialKey,
      label,
      sellDerivedFromMargin: sellDerived,
      organisationSettings: params.organisationSettings,
    });
  }

  const fallbackCost = benchmarkAllowed ? params.benchmarkCostRate : 0;
  const fallbackSell = benchmarkAllowed
    ? (params.benchmarkSellRate ??
      deriveSellFromCost(params.benchmarkCostRate, marginPercent))
    : 0;

  return buildResolvedMaterialRate({
    costRate: fallbackCost,
    sellRate: fallbackSell,
    unit: params.unit,
    materialRateSource: benchmarkAllowed ? "benchmark_specific" : "missing",
    itemKey: params.materialKey,
    label,
    sellDerivedFromMargin: params.benchmarkSellRate == null,
    organisationSettings: params.organisationSettings,
  });
}
