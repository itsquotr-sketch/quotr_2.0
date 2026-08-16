import { round2 } from "@/lib/estimate/facts";
import { getCatalogueEntry } from "@/lib/rates/catalogue";
import { getDefaultMarginPercent } from "@/lib/estimate/rates";
import { classifyResolvedSell } from "@/lib/commercial-engine/core/cost-first-authority";
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

export function materialRateUnitsMatch(
  rateUnit: string,
  expectedUnit: string
): boolean {
  const normalize = (unit: string) =>
    unit
      .toLowerCase()
      .replace("m²", "m2")
      .replace("face m2", "m2")
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
  switch (params.source) {
    case "company_specific":
      return "Your company rate";
    case "company_scope":
      return "Your company package rate";
    case "company_category":
      return "Your company category rate";
    case "benchmark_specific":
    case "benchmark_category":
      return "Quotr benchmark";
    case "missing":
      return "Pricing required";
    default:
      return params.label;
  }
}

function buildResolvedMaterialRate(params: {
  costRate: number;
  sellRate: number | null | undefined;
  unit: string;
  materialRateSource: MaterialRateSource;
  itemKey: string;
  label: string;
  organisationSettings: OrganisationSettings | null;
  explicitSellOverride?: boolean;
}): ResolvedMaterialRate {
  const low = params.organisationSettings?.budget_rate_factor ?? 0.9;
  const high = params.organisationSettings?.premium_rate_factor ?? 1.15;
  const sourceType = mapMaterialSourceToRateSourceType(params.materialRateSource);
  const marginPercent = getDefaultMarginPercent(params.organisationSettings);
  const classified = classifyResolvedSell({
    costRate: params.costRate,
    sellRate: params.sellRate,
    applicableGrossMarginPercent: marginPercent,
    explicitSellOverride: params.explicitSellOverride,
  });

  return {
    costRate: params.costRate,
    sellRate: classified.sellRate,
    costRateLow: round2(params.costRate * low),
    costRateHigh: round2(params.costRate * high),
    sellRateLow: round2(classified.sellRate * low),
    sellRateHigh: round2(classified.sellRate * high),
    unit: params.unit,
    sourceType,
    sourceLabel: formatMaterialRateResolutionDisplay({
      source: params.materialRateSource,
      label: params.label,
      unit: params.unit,
      materialKey: params.itemKey,
    }),
    itemKey: params.itemKey,
    sellDerivedFromMargin: classified.sellDerivedFromMargin,
    sellAuthority: classified.sellAuthority,
    grossMarginPercent: classified.grossMarginPercent,
    isLegacyPairedRate: classified.isLegacyPairedRate,
    isExplicitSellOverride: classified.isExplicitSellOverride,
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

/**
 * Convert a company matching-material $/m² rate into an equivalent $/lm rate
 * using known board coverage width.
 *
 * equivalent_cost_per_lm = cost_per_m² × (board_width_mm / 1000)
 *
 * A $23/m² rate is not a $23/lm rate. Sell is converted only when the source
 * row was a legacy pair or explicit override; cost-only rows re-derive sell
 * from company gross margin after conversion (COMMERCIAL-P0).
 */
export function convertCompanyM2RateToLm(params: {
  resolved: ResolvedMaterialRate;
  boardWidthMm: number;
  organisationSettings: OrganisationSettings | null;
  label: string;
}): ResolvedMaterialRate {
  const widthM = params.boardWidthMm / 1000;
  const costRate = round2(params.resolved.costRate * widthM);
  const convertPairedSell =
    params.resolved.isLegacyPairedRate || params.resolved.isExplicitSellOverride;
  const sellRate = convertPairedSell
    ? round2(params.resolved.sellRate * widthM)
    : null;

  return buildResolvedMaterialRate({
    costRate,
    sellRate,
    unit: "lm",
    materialRateSource: params.resolved.materialRateSource,
    itemKey: params.resolved.resolvedMaterialKey,
    label: params.label,
    organisationSettings: params.organisationSettings,
    explicitSellOverride: params.resolved.isExplicitSellOverride,
  });
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
      materialRateUnitsMatch(rate.unit, params.unit)
  );

  if (exactRate?.cost_rate != null) {
    return buildResolvedMaterialRate({
      costRate: exactRate.cost_rate,
      sellRate: exactRate.sell_rate,
      unit: exactRate.unit || params.unit,
      materialRateSource: "company_specific",
      itemKey: params.materialKey,
      label,
      organisationSettings: params.organisationSettings,
    });
  }

  if (params.categoryKey) {
    const categoryRate = findActiveRate(
      params.orgRates,
      (rate) =>
        rate.item_key === params.categoryKey &&
        rate.rate_type === "material" &&
        rate.cost_rate != null &&
        materialRateUnitsMatch(rate.unit || params.unit, params.unit)
    );
    if (categoryRate?.cost_rate != null) {
      return buildResolvedMaterialRate({
        costRate: categoryRate.cost_rate,
        sellRate: categoryRate.sell_rate,
        unit: categoryRate.unit || params.unit,
        materialRateSource: "company_category",
        itemKey: params.categoryKey,
        label,
        organisationSettings: params.organisationSettings,
      });
    }
  }

  // workAreaType is accepted for call-site compatibility but must not first-match
  // an arbitrary work-area material rate (unit/material identity errors).
  void params.workAreaType;

  if (params.scopeKey) {
    const scopeRate = findActiveRate(
      params.orgRates,
      (rate) =>
        rate.item_key === params.scopeKey &&
        rate.rate_type === "scope" &&
        rate.cost_rate != null &&
        materialRateUnitsMatch(rate.unit || params.unit, params.unit)
    );
    if (scopeRate?.cost_rate != null) {
      return buildResolvedMaterialRate({
        costRate: scopeRate.cost_rate,
        sellRate: scopeRate.sell_rate,
        unit: scopeRate.unit || params.unit,
        materialRateSource: "company_scope",
        itemKey: params.scopeKey,
        label,
        organisationSettings: params.organisationSettings,
      });
    }
  }

  if (benchmarkAllowed) {
    return buildResolvedMaterialRate({
      costRate: params.benchmarkCostRate,
      sellRate: params.benchmarkSellRate,
      unit: params.unit,
      materialRateSource: "benchmark_specific",
      itemKey: params.materialKey,
      label,
      organisationSettings: params.organisationSettings,
    });
  }

  if (
    benchmarkAllowed &&
    params.categoryBenchmarkCostRate != null
  ) {
    return buildResolvedMaterialRate({
      costRate: params.categoryBenchmarkCostRate,
      sellRate: params.categoryBenchmarkSellRate,
      unit: params.unit,
      materialRateSource: "benchmark_category",
      itemKey: params.categoryKey ?? params.materialKey,
      label,
      organisationSettings: params.organisationSettings,
    });
  }

  const fallbackCost = benchmarkAllowed ? params.benchmarkCostRate : 0;
  const fallbackSell = benchmarkAllowed ? params.benchmarkSellRate : null;

  return buildResolvedMaterialRate({
    costRate: fallbackCost,
    sellRate: fallbackSell,
    unit: params.unit,
    materialRateSource: benchmarkAllowed ? "benchmark_specific" : "missing",
    itemKey: params.materialKey,
    label,
    organisationSettings: params.organisationSettings,
  });
}
