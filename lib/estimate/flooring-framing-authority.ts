/**
 * FLOORING-04C — below-substrate framing combined-allowance COST authority.
 *
 * Resolver only. Does not emit estimate line items. Nested Flooring stays
 * unpriced until FLOORING-05.
 *
 * These are combined allowance COSTs / m², not timber materials and not
 * productivity hours. Rate type is allowance; they appear once under
 * Rates → Subcontract with Flooring finish packages because no dedicated
 * Allowances tab exists.
 *
 * Order: company exact allowance COST > 0 → Quotr benchmark → Pricing Required.
 */

import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";
import {
  FLOORING_ORDINARY_FRAMING_KEYS,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_COST_EX_GST,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_COST_EX_GST,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_COST_EX_GST,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
} from "@/lib/estimate/flooring-identities";
import { getCatalogueEntry } from "@/lib/rates/catalogue";

export const FLOORING_FRAMING_RATE_TYPE = "allowance" as const;

export const FLOORING_FRAMING_QUOTR_COST: Record<
  (typeof FLOORING_ORDINARY_FRAMING_KEYS)[number],
  number
> = {
  [FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_COST_EX_GST,
  [FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_COST_EX_GST,
  [FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_COST_EX_GST,
};

export type FlooringFramingRateSource = "company" | "quotr" | "missing";

export type FlooringFramingRateResolution = {
  readonly itemKey: string;
  readonly costRate: number | null;
  readonly source: FlooringFramingRateSource;
  readonly sourceLabel: "Company" | "Quotr benchmark" | "Pricing Required";
};

function isPositiveCost(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isFlooringFramingAllowanceKey(
  key: string | null | undefined
): key is (typeof FLOORING_ORDINARY_FRAMING_KEYS)[number] {
  if (!key) return false;
  return (FLOORING_ORDINARY_FRAMING_KEYS as readonly string[]).includes(key);
}

export function resolveFlooringFramingAllowance(params: {
  itemKey: string;
  rates?: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): FlooringFramingRateResolution {
  const { itemKey } = params;
  if (!isFlooringFramingAllowanceKey(itemKey)) {
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
      rate.rate_type === FLOORING_FRAMING_RATE_TYPE &&
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
    : FLOORING_FRAMING_QUOTR_COST[itemKey];
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

export function flooringFramingAuthorityCost(
  itemKey: string,
  areaM2: number,
  rates: readonly OrganisationRate[] = []
): number | null {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return null;
  const resolved = resolveFlooringFramingAllowance({ itemKey, rates });
  if (resolved.costRate == null) return null;
  return resolved.costRate * areaM2;
}
