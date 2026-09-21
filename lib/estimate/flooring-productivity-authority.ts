/**
 * FLOORING-04C — substrate-install and removal productivity authority.
 *
 * Resolver only. Does not emit estimate line items or labour COST.
 * Nested Flooring stays unpriced until FLOORING-05.
 *
 * Order: company exact productivity hours > 0 → Quotr benchmark → Pricing Required.
 * Invalid, zero, missing, or wrong-rate-type company rows do not become authority.
 * Do not call resolveProductivity with a silent fallback.
 */

import type { OrganisationRate } from "@/components/setup/types";
import {
  FLOORING_CARPET_REMOVE_HOURS_PER_M2,
  FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2,
  FLOORING_PRODUCTIVITY_KEYS,
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
  FLOORING_TILE_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
} from "@/lib/estimate/flooring-identities";
import {
  findCompanyProductivityRate,
  getQuotrProductivityBenchmark,
  isTrustedProductivityHours,
} from "@/lib/estimate/productivity";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";

export type FlooringProductivityResolution = {
  readonly productivityKey: string;
  readonly quantity: number;
  readonly hoursPerUnit: number | null;
  readonly hours: number | null;
  readonly sourceType: RateSourceType | "missing";
  readonly sourceLabel: string;
};

const PRODUCTIVITY_UNIT: Record<
  (typeof FLOORING_PRODUCTIVITY_KEYS)[number],
  string
> = {
  [FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET]: "sheet",
  [FLOORING_CARPET_REMOVE_HOURS_PER_M2]: "m2",
  [FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2]: "m2",
  [FLOORING_TILE_REMOVE_HOURS_PER_M2]: "m2",
  [FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2]: "m2",
  [FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2]: "m2",
};

export function isFlooringProductivityKey(
  key: string | null | undefined
): key is (typeof FLOORING_PRODUCTIVITY_KEYS)[number] {
  if (!key) return false;
  return (FLOORING_PRODUCTIVITY_KEYS as readonly string[]).includes(key);
}

export function flooringProductivityUnit(
  productivityKey: string
): string | undefined {
  if (!isFlooringProductivityKey(productivityKey)) return undefined;
  return PRODUCTIVITY_UNIT[productivityKey];
}

export function resolveFlooringProductivityHours(params: {
  productivityKey: string;
  quantity: number;
  unit?: string;
  rates?: readonly OrganisationRate[];
}): FlooringProductivityResolution {
  const missing = (): FlooringProductivityResolution => ({
    productivityKey: params.productivityKey,
    quantity: params.quantity,
    hoursPerUnit: null,
    hours: null,
    sourceType: "missing",
    sourceLabel: getRateSourceLabel("missing"),
  });

  if (!isFlooringProductivityKey(params.productivityKey)) return missing();
  if (!Number.isFinite(params.quantity) || params.quantity < 0) return missing();

  const unit =
    params.unit ?? flooringProductivityUnit(params.productivityKey) ?? "unit";
  const company = findCompanyProductivityRate(
    params.rates,
    params.productivityKey,
    unit
  );
  if (company?.cost_rate != null) {
    const hoursPerUnit = Number(company.cost_rate);
    if (isTrustedProductivityHours(hoursPerUnit)) {
      const calibrated = company.source === "calibrated_productivity";
      return {
        productivityKey: params.productivityKey,
        quantity: params.quantity,
        hoursPerUnit,
        hours: hoursPerUnit * params.quantity,
        sourceType: calibrated ? "calibrated_productivity" : "user_rate",
        sourceLabel: calibrated
          ? getRateSourceLabel("calibrated_productivity")
          : getRateSourceLabel("user_rate"),
      };
    }
  }

  const benchmark = getQuotrProductivityBenchmark(params.productivityKey);
  if (benchmark && isTrustedProductivityHours(benchmark.hoursPerUnit)) {
    return {
      productivityKey: params.productivityKey,
      quantity: params.quantity,
      hoursPerUnit: benchmark.hoursPerUnit,
      hours: benchmark.hoursPerUnit * params.quantity,
      sourceType: "benchmark",
      sourceLabel: benchmark.sourceLabel,
    };
  }

  return missing();
}
