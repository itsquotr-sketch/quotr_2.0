/**
 * DOORS-04B — bounded Doors productivity authority helper.
 *
 * Resolves person-hours from the canonical productivity registry.
 * Does not compose commercial line items, labour COST, or sell.
 * Unknown keys stay unresolved (null), never a legitimate zero.
 */
import type { OrganisationRate } from "@/components/setup/types";
import {
  DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY,
  DOORS_ORDINARY_PRODUCTIVITY_KEYS,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY,
  isOrdinaryDoorsMaterialKey,
} from "@/lib/estimate/doors-identities";
import {
  findCompanyProductivityRate,
  getQuotrProductivityBenchmark,
  isTrustedProductivityHours,
} from "@/lib/estimate/productivity";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";

export type DoorsProductivityResolution = {
  productivityKey: string;
  quantity: number;
  hoursPerUnit: number | null;
  hours: number | null;
  sourceType: RateSourceType | "missing";
  sourceLabel: string;
};

const PRODUCTIVITY_UNIT: Record<string, string> = {
  [DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY]: "door",
  [DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY]: "door",
  [DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY]: "set",
};

export function doorsProductivityUnit(productivityKey: string): string | undefined {
  return PRODUCTIVITY_UNIT[productivityKey];
}

export function isOrdinaryDoorsProductivityKey(
  key: string | null | undefined
): boolean {
  if (!key) return false;
  return (DOORS_ORDINARY_PRODUCTIVITY_KEYS as readonly string[]).includes(key);
}

export function resolveDoorsProductivityHours(params: {
  productivityKey: string;
  quantity: number;
  unit?: string;
  rates?: readonly OrganisationRate[];
}): DoorsProductivityResolution {
  const unit = params.unit ?? doorsProductivityUnit(params.productivityKey);
  const missing = (): DoorsProductivityResolution => ({
    productivityKey: params.productivityKey,
    quantity: params.quantity,
    hoursPerUnit: null,
    hours: null,
    sourceType: "missing",
    sourceLabel: getRateSourceLabel("missing"),
  });

  if (!Number.isFinite(params.quantity) || params.quantity < 0) {
    return missing();
  }

  const company = findCompanyProductivityRate(
    params.rates,
    params.productivityKey,
    unit
  );
  if (company?.cost_rate != null) {
    const hoursPerUnit = Number(company.cost_rate);
    if (!isTrustedProductivityHours(hoursPerUnit)) return missing();
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

/** Guard: material identities never masquerade as productivity keys. */
export function doorsMaterialIsNotProductivity(
  materialKey: string | null | undefined
): boolean {
  return isOrdinaryDoorsMaterialKey(materialKey)
    ? !isOrdinaryDoorsProductivityKey(materialKey)
    : true;
}
