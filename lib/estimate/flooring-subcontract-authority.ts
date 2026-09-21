/**
 * FLOORING-04B — finish subcontract and add-on COST authority.
 *
 * Resolver only. Does not emit estimate line items. Nested Flooring stays
 * unpriced until FLOORING-05.
 *
 * Order: company exact subcontract COST > 0 → Quotr benchmark > Pricing Required.
 * No family, work-area, material-key, Bathroom, Kitchen, or legacy fallback.
 */

import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";
import {
  FLOORING_CARPET_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_COST_EX_GST,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_SUBCONTRACT_RATE_KEYS,
  FLOORING_TILE_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_COST_EX_GST,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  isOrdinaryFlooringFinishPackageKey,
} from "@/lib/estimate/flooring-identities";
import { getCatalogueEntry } from "@/lib/rates/catalogue";

export const FLOORING_SUBCONTRACT_RATE_TYPE = "subcontractor" as const;

export const FLOORING_SUBCONTRACT_QUOTR_COST: Record<
  (typeof FLOORING_SUBCONTRACT_RATE_KEYS)[number],
  number
> = {
  [FLOORING_CARPET_SUPPLY_INSTALL_M2]: FLOORING_CARPET_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2]:
    FLOORING_VINYL_PLANK_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_TILE_SUPPLY_INSTALL_M2]: FLOORING_TILE_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_HARDWOOD_SUPPLY_INSTALL_M2]:
    FLOORING_HARDWOOD_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2]:
    FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_COST_EX_GST,
  [FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2]:
    FLOORING_FLOOR_PREPARATION_ALLOWANCE_COST_EX_GST,
};

export type FlooringSubcontractRateSource = "company" | "quotr" | "missing";

export type FlooringSubcontractRateResolution = {
  readonly itemKey: string;
  readonly costRate: number | null;
  readonly source: FlooringSubcontractRateSource;
  readonly sourceLabel: "Company" | "Quotr benchmark" | "Pricing Required";
};

function isPositiveCost(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isFlooringSubcontractRateKey(
  key: string | null | undefined
): key is (typeof FLOORING_SUBCONTRACT_RATE_KEYS)[number] {
  if (!key) return false;
  return (FLOORING_SUBCONTRACT_RATE_KEYS as readonly string[]).includes(key);
}

export function resolveFlooringSubcontractRate(params: {
  itemKey: string;
  rates?: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): FlooringSubcontractRateResolution {
  const { itemKey } = params;
  if (!isFlooringSubcontractRateKey(itemKey)) {
    return {
      itemKey,
      costRate: null,
      source: "missing",
      sourceLabel: "Pricing Required",
    };
  }

  const exactCompany = (params.rates ?? []).find(
    (rate) =>
      rate.active &&
      rate.item_key === itemKey &&
      rate.rate_type === FLOORING_SUBCONTRACT_RATE_TYPE &&
      isPositiveCost(rate.cost_rate)
  );
  if (exactCompany && isPositiveCost(exactCompany.cost_rate)) {
    return {
      itemKey,
      costRate: exactCompany.cost_rate,
      source: "company",
      sourceLabel: "Company",
    };
  }

  const allowBenchmark =
    params.organisationSettings?.allow_benchmark_rates !== false;
  const catalogue = getCatalogueEntry(itemKey);
  const quotrCost = isPositiveCost(catalogue?.defaultCostRate)
    ? catalogue.defaultCostRate
    : FLOORING_SUBCONTRACT_QUOTR_COST[itemKey];
  if (allowBenchmark && isPositiveCost(quotrCost)) {
    return {
      itemKey,
      costRate: quotrCost,
      source: "quotr",
      sourceLabel: "Quotr benchmark",
    };
  }

  return {
    itemKey,
    costRate: null,
    source: "missing",
    sourceLabel: "Pricing Required",
  };
}

export function flooringSubcontractAuthorityCost(
  itemKey: string,
  areaM2: number,
  rates: readonly OrganisationRate[] = []
): number | null {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return null;
  const resolved = resolveFlooringSubcontractRate({ itemKey, rates });
  if (resolved.costRate == null) return null;
  return resolved.costRate * areaM2;
}

export function ordinaryFlooringFinishResolvesPackage(
  finish: string | null | undefined
): boolean {
  return (
    finish === "carpet" ||
    finish === "vinyl_plank" ||
    finish === "tile" ||
    finish === "hardwood"
  );
}

export function customOrSpecialistResolvesOrdinaryPackage(params: {
  finish_type: string | null;
  specialist_kind: string | null;
}): boolean {
  if (params.specialist_kind != null) return false;
  if (params.finish_type === "other") return false;
  return isOrdinaryFlooringFinishPackageKey(
    params.finish_type === "carpet"
      ? FLOORING_CARPET_SUPPLY_INSTALL_M2
      : params.finish_type === "vinyl_plank"
        ? FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2
        : params.finish_type === "tile"
          ? FLOORING_TILE_SUPPLY_INSTALL_M2
          : params.finish_type === "hardwood"
            ? FLOORING_HARDWOOD_SUPPLY_INSTALL_M2
            : null
  );
}
