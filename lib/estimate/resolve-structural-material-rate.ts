/**
 * DECK-1C-B2 — exact structural MaterialRequirement rate resolution.
 *
 * Hierarchy (narrow; no fuzzy identity):
 * 1. project override (in-memory rate_type=project_material until project UI)
 * 2. company exact (rate_type=material, identity+unit)
 * 6. Quotr exact benchmark (sourced identity+lm only)
 * 8. pricing required
 *
 * Does not price by component name or section-only match.
 * Does not use DECK_BENCHMARKS.framing package rates.
 */
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { round2 } from "@/lib/estimate/facts";
import { materialRateUnitsMatch } from "@/lib/estimate/resolve-material-rate";
import type { MaterialRequirement, RequirementRateSource } from "@/lib/estimate/requirements";
import {
  cloneStructuralBenchmarkEvidence,
  findExactStructuralTimberBenchmark,
  type StructuralTimberBenchmarkEvidence,
} from "@/lib/estimate/structural-timber-benchmarks";
import {
  buildMaterialRateItemKey,
  type MaterialIdentity,
} from "@/lib/materials/identity";

export type StructuralMaterialRateResolution = Pick<
  MaterialRequirement,
  "priced" | "rateSource" | "unitCost" | "totalCost" | "rateEvidence"
>;

function findExactOrgMaterialRate(
  rates: readonly OrganisationRate[],
  itemKey: string,
  unit: string,
  rateType: "material" | "project_material"
): OrganisationRate | undefined {
  return rates.find(
    (rate) =>
      rate.active &&
      rate.rate_type === rateType &&
      rate.item_key === itemKey &&
      rate.cost_rate != null &&
      materialRateUnitsMatch(rate.unit, unit)
  );
}

function pricedFromUnitCost(params: {
  purchaseQuantity: number;
  unitCost: number;
  rateSource: RequirementRateSource;
  rateEvidence?: MaterialRequirement["rateEvidence"];
}): StructuralMaterialRateResolution {
  return {
    priced: true,
    rateSource: params.rateSource,
    unitCost: params.unitCost,
    totalCost: round2(params.purchaseQuantity * params.unitCost),
    rateEvidence: params.rateEvidence,
  };
}

function unpriced(): StructuralMaterialRateResolution {
  return {
    priced: false,
    rateSource: "missing",
    unitCost: null,
    totalCost: null,
  };
}

function evidenceForSnapshot(
  row: StructuralTimberBenchmarkEvidence
): NonNullable<MaterialRequirement["rateEvidence"]> {
  const cloned = cloneStructuralBenchmarkEvidence(row);
  return {
    sourceName: cloned.sourceName,
    sourceType: cloned.sourceType,
    sourceURL: cloned.sourceURL,
    sourceProductCode: cloned.sourceProductCode,
    sourceProductDescription: cloned.sourceProductDescription,
    sourceRegion: cloned.sourceRegion,
    sourceBranch: cloned.sourceBranch,
    sourcePrice: cloned.sourcePriceInclGst,
    sourceUnit: cloned.sourceUnit,
    gstBasis: cloned.gstBasis,
    channel: cloned.channel,
    stockLengthM: cloned.stockLengthM,
    conversionFormula: cloned.conversionFormula,
    normalizedRateUnit: cloned.rateUnit,
    normalizedRateExGst: cloned.normalizedRateExGst,
    researchedAt: cloned.researchedAt,
    verifiedAt: cloned.verifiedAt,
    quality: cloned.quality,
    evidenceId: cloned.evidenceId,
    notes: cloned.notes,
  };
}

export function resolveStructuralMaterialRequirementRate(params: {
  identity: MaterialIdentity;
  unit: "lm" | "ea" | "m3";
  purchaseQuantity: number;
  rates: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): StructuralMaterialRateResolution {
  const itemKey = buildMaterialRateItemKey(params.identity, params.unit);

  const projectRate = findExactOrgMaterialRate(
    params.rates,
    itemKey,
    params.unit,
    "project_material"
  );
  if (projectRate?.cost_rate != null) {
    return pricedFromUnitCost({
      purchaseQuantity: params.purchaseQuantity,
      unitCost: Number(projectRate.cost_rate),
      rateSource: "project_override",
    });
  }

  const companyRate = findExactOrgMaterialRate(
    params.rates,
    itemKey,
    params.unit,
    "material"
  );
  if (companyRate?.cost_rate != null) {
    return pricedFromUnitCost({
      purchaseQuantity: params.purchaseQuantity,
      unitCost: Number(companyRate.cost_rate),
      rateSource: "company",
    });
  }

  const benchmarkAllowed =
    params.organisationSettings?.allow_benchmark_rates !== false;
  if (benchmarkAllowed) {
    const benchmark = findExactStructuralTimberBenchmark(
      params.identity,
      params.unit
    );
    if (benchmark) {
      return pricedFromUnitCost({
        purchaseQuantity: params.purchaseQuantity,
        unitCost: benchmark.normalizedRateExGst,
        rateSource: "benchmark",
        rateEvidence: evidenceForSnapshot(benchmark),
      });
    }
  }

  return unpriced();
}
