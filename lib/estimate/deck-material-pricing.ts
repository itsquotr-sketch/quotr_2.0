import { round2 } from "@/lib/estimate/facts";
import { rateFieldsFromResolved } from "@/lib/estimate/line-item-helpers";
import {
  canPriceBuildUpQuantity,
  toMaterialRateResolution,
  type BuildUpMaterialPricing,
} from "@/lib/estimate/material-rate-pricing";
import {
  getDeckBoardLmMaterialKey,
  getDeckBoardM2MaterialKey,
  getDeckLmBenchmark,
  getDeckM2Benchmark,
} from "@/lib/estimate/material-rate-keys";
import {
  convertCompanyM2RateToLm,
  resolveMaterialRate,
} from "@/lib/estimate/resolve-material-rate";
import type { EstimateContext } from "@/lib/estimate/types";
import type { OrganisationSettings } from "@/components/setup/types";

/**
 * FOUNDATION-R2-R1-R1 — Deck decking commercial authority.
 *
 * Board width known:
 * 1. company exact matching $/lm
 * 2. company exact matching $/m², converted with known board coverage
 * 3. Quotr exact $/lm benchmark
 * 4. matching $/m² as an area package (not converted)
 * 5. missing / pricing required
 *
 * Board width unknown: never invent lm. Company then Quotr matching m² package.
 *
 * Quotr m² is not converted to lm. Repository benchmarks are independently
 * calibrated ($/lm ≠ $/m² × width). Converting Quotr m² would fight the more
 * specific Quotr $/lm series. Company m² is converted because it is the same
 * boards (framing/fixings are separate keys) and the contractor's number must
 * outrank a Quotr lm benchmark.
 *
 * Waste-once (conversion path):
 *   coverage_width_m = board_width_mm / 1000
 *   equivalent_cost_per_lm = cost_per_m² × coverage_width_m
 *   purchase_lm already includes waste %
 *   total = purchase_lm × equivalent_cost_per_lm
 *         = (base_lm × (1 + waste)) × (cost_m² × width)
 *         ≈ area × (1 + waste) × cost_m²
 * Do not also inflate area. Do not convert a package fallback that already
 * embeds an unknown waste allowance — that path prices net deck area × $/m².
 */

export function coverageWidthM(boardWidthMm: number): number {
  return boardWidthMm / 1000;
}

export function convertM2CostToLmCost(
  costPerM2: number,
  boardWidthMm: number
): number {
  return round2(costPerM2 * coverageWidthM(boardWidthMm));
}

export function formatM2ToLmConversionNote(
  costPerM2: number,
  boardWidthMm: number
): string {
  const amount = Number.isInteger(costPerM2)
    ? costPerM2.toFixed(0)
    : costPerM2.toFixed(2);
  return `$${amount}/m² converted using ${boardWidthMm}mm board coverage`;
}

function withoutBenchmarks(
  settings: OrganisationSettings | null
): OrganisationSettings {
  return {
    ...(settings ?? {}),
    allow_benchmark_rates: false,
  } as OrganisationSettings;
}

function pricedLm(
  resolved: Parameters<typeof toMaterialRateResolution>[0],
  purchaseLm: number,
  conversionNote?: string,
  conversion?: BuildUpMaterialPricing["conversion"]
): BuildUpMaterialPricing {
  return {
    quantity: purchaseLm,
    unit: "lm",
    costRate: resolved.costRate,
    sellRate: resolved.sellRate,
    resolution: toMaterialRateResolution(resolved, conversionNote),
    rateFields: rateFieldsFromResolved(resolved, resolved.itemKey),
    usedBuildUpQuantity: true,
    conversion,
  };
}

function areaPackage(
  resolved: Parameters<typeof toMaterialRateResolution>[0],
  areaM2: number
): BuildUpMaterialPricing {
  return {
    quantity: areaM2,
    unit: "m2",
    costRate: resolved.costRate,
    sellRate: resolved.sellRate,
    resolution: toMaterialRateResolution(resolved),
    rateFields: rateFieldsFromResolved(resolved, resolved.itemKey),
    usedBuildUpQuantity: false,
  };
}

export function resolveDeckingBoardPricing(params: {
  context: EstimateContext;
  material: string | null;
  label: string;
  purchaseLm: number | null;
  boardWidthMm: number | null;
  areaM2: number;
}): BuildUpMaterialPricing {
  const lmKey = getDeckBoardLmMaterialKey(params.material);
  const m2Key = getDeckBoardM2MaterialKey(params.material);
  const lmBench = getDeckLmBenchmark(params.material);
  const m2Bench = getDeckM2Benchmark(params.material);
  const canUseLm =
    params.purchaseLm != null &&
    params.boardWidthMm != null &&
    params.boardWidthMm > 0;

  const resolveLm = (settings: OrganisationSettings | null) =>
    resolveMaterialRate({
      orgRates: params.context.rates,
      materialKey: lmKey,
      unit: "lm",
      label: params.label,
      benchmarkCostRate: lmBench.cost,
      benchmarkSellRate: lmBench.sell,
      organisationSettings: settings,
    });

  const resolveM2 = (settings: OrganisationSettings | null) =>
    resolveMaterialRate({
      orgRates: params.context.rates,
      materialKey: m2Key,
      unit: "m2",
      label: params.label,
      benchmarkCostRate: m2Bench.cost,
      benchmarkSellRate: m2Bench.sell,
      organisationSettings: settings,
    });

  if (canUseLm && params.purchaseLm != null && params.boardWidthMm != null) {
    const companyLm = resolveLm(withoutBenchmarks(params.context.organisationSettings));
    if (
      companyLm.materialRateSource === "company_specific" &&
      canPriceBuildUpQuantity(companyLm, "lm")
    ) {
      return pricedLm(companyLm, params.purchaseLm);
    }

    const companyM2 = resolveM2(withoutBenchmarks(params.context.organisationSettings));
    if (companyM2.materialRateSource === "company_specific") {
      const converted = convertCompanyM2RateToLm({
        resolved: companyM2,
        boardWidthMm: params.boardWidthMm,
        organisationSettings: params.context.organisationSettings,
        label: params.label,
      });
      return pricedLm(
        converted,
        params.purchaseLm,
        formatM2ToLmConversionNote(companyM2.costRate, params.boardWidthMm),
        {
          from: "m2",
          to: "lm",
          factor: coverageWidthM(params.boardWidthMm),
          sourceUnitCost: companyM2.costRate,
          basis: `${params.boardWidthMm}mm board coverage`,
        }
      );
    }

    const quotrLm = resolveLm(params.context.organisationSettings);
    if (canPriceBuildUpQuantity(quotrLm, "lm")) {
      return pricedLm(quotrLm, params.purchaseLm);
    }
  }

  return areaPackage(
    resolveM2(params.context.organisationSettings),
    params.areaM2
  );
}
