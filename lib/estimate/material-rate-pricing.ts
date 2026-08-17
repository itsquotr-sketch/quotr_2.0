import { rateFieldsFromResolved } from "@/lib/estimate/line-item-helpers";
import {
  resolveMaterialRate,
  type ResolvedMaterialRate,
} from "@/lib/estimate/resolve-material-rate";
import type { EstimateContext } from "@/lib/estimate/types";

export type MaterialRateResolution = {
  source: ResolvedMaterialRate["materialRateSource"];
  sourceLabel: string;
  display: string;
  confidence: ResolvedMaterialRate["confidence"];
  materialKey: string;
  /** Contractor-facing conversion explanation; omit internal rate keys. */
  conversionNote?: string;
};

export type BuildUpMaterialPricing = {
  quantity: number;
  unit: string;
  costRate: number;
  sellRate: number;
  resolution: MaterialRateResolution;
  rateFields: ReturnType<typeof rateFieldsFromResolved>;
  usedBuildUpQuantity: boolean;
  /** Optional conversion provenance when a company m² rate was converted to $/lm. */
  conversion?: {
    from: string;
    to: string;
    factor: number;
    sourceUnitCost?: number;
    basis?: string;
  };
};

export function toMaterialRateResolution(
  resolved: ResolvedMaterialRate,
  conversionNote?: string
): MaterialRateResolution {
  return {
    source: resolved.materialRateSource,
    sourceLabel: resolved.sourceLabel,
    display: resolved.rateResolutionDisplay,
    confidence: resolved.confidence,
    materialKey: resolved.resolvedMaterialKey,
    conversionNote,
  };
}

function isSpecificUnitRate(
  resolved: ResolvedMaterialRate,
  expectedUnit: string
): boolean {
  if (resolved.materialRateSource === "missing") {
    return false;
  }
  const normalized = resolved.unit.toLowerCase().replace("m²", "m2");
  const expected = expectedUnit.toLowerCase().replace("m²", "m2");
  return normalized === expected;
}

/**
 * Use the physical takeoff quantity when the resolved rate's unit matches and
 * the source is a specific material cost (company or Quotr benchmark).
 * Scope/package sources must not price lm takeoff as if they were $/lm.
 */
export function canPriceBuildUpQuantity(
  resolved: ResolvedMaterialRate,
  expectedUnit: string
): boolean {
  if (!isSpecificUnitRate(resolved, expectedUnit)) {
    return false;
  }
  return (
    resolved.materialRateSource === "company_specific" ||
    resolved.materialRateSource === "company_category" ||
    resolved.materialRateSource === "benchmark_specific" ||
    resolved.materialRateSource === "benchmark_category"
  );
}

export function resolveBuildUpMaterialPricing(params: {
  context: EstimateContext;
  materialKey: string;
  label: string;
  buildUpQuantity: number;
  buildUpUnit: string;
  benchmarkCostRate: number;
  benchmarkSellRate: number;
  categoryKey?: string;
  scopeKey?: string;
  workAreaType?: string;
  categoryBenchmarkCostRate?: number;
  categoryBenchmarkSellRate?: number;
  fallback?: {
    materialKey: string;
    quantity: number;
    unit: string;
    benchmarkCostRate: number;
    benchmarkSellRate: number;
    label?: string;
  };
}): BuildUpMaterialPricing {
  const primary = resolveMaterialRate({
    orgRates: params.context.rates,
    materialKey: params.materialKey,
    categoryKey: params.categoryKey,
    scopeKey: params.scopeKey,
    workAreaType: params.workAreaType,
    unit: params.buildUpUnit,
    label: params.label,
    benchmarkCostRate: params.benchmarkCostRate,
    benchmarkSellRate: params.benchmarkSellRate,
    categoryBenchmarkCostRate: params.categoryBenchmarkCostRate,
    categoryBenchmarkSellRate: params.categoryBenchmarkSellRate,
    organisationSettings: params.context.organisationSettings,
  });

  if (canPriceBuildUpQuantity(primary, params.buildUpUnit)) {
    return {
      quantity: params.buildUpQuantity,
      unit: params.buildUpUnit,
      costRate: primary.costRate,
      sellRate: primary.sellRate,
      resolution: toMaterialRateResolution(primary),
      rateFields: rateFieldsFromResolved(primary, primary.itemKey),
      usedBuildUpQuantity: true,
    };
  }

  if (params.fallback) {
    const fallbackResolved = resolveMaterialRate({
      orgRates: params.context.rates,
      materialKey: params.fallback.materialKey,
      workAreaType: params.workAreaType,
      unit: params.fallback.unit,
      label: params.fallback.label ?? params.label,
      benchmarkCostRate: params.fallback.benchmarkCostRate,
      benchmarkSellRate: params.fallback.benchmarkSellRate,
      organisationSettings: params.context.organisationSettings,
    });

    return {
      quantity: params.fallback.quantity,
      unit: params.fallback.unit,
      costRate: fallbackResolved.costRate,
      sellRate: fallbackResolved.sellRate,
      resolution: toMaterialRateResolution(fallbackResolved),
      rateFields: rateFieldsFromResolved(fallbackResolved, fallbackResolved.itemKey),
      usedBuildUpQuantity: false,
    };
  }

  return {
    quantity: params.buildUpQuantity,
    unit: params.buildUpUnit,
    costRate: primary.costRate,
    sellRate: primary.sellRate,
    resolution: toMaterialRateResolution(primary),
    rateFields: rateFieldsFromResolved(primary, primary.itemKey),
    usedBuildUpQuantity: isSpecificUnitRate(primary, params.buildUpUnit),
  };
}

export function withMaterialRateResolution<T extends { materialRateResolution?: MaterialRateResolution }>(
  item: T,
  resolution: MaterialRateResolution | null | undefined
): T {
  if (!resolution) {
    return item;
  }
  return { ...item, materialRateResolution: resolution };
}
