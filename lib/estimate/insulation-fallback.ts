/**
 * EST-BENCHMARK-01A — ordinary thermal insulation identities.
 *
 * Reuses the existing FITOUT insulation COST ($12/m²). That rate is a
 * generic thermal/standard batt allowance, not a proprietary branded
 * product. Acoustic / fire / specified products stay Pricing Required.
 */

import { FITOUT_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import { CEILINGS_QUOTR_PRODUCTIVITY_HOURS, CEILINGS_PRODUCTIVITY_KEYS } from "@/lib/estimate/ceilings-identities";
import type { CeilingInsulationType } from "@/lib/estimate/ceilings-portions";
import type { InternalWallsInsulationType } from "@/lib/estimate/internal-walls-finish";

export const CEILING_INSULATION_THERMAL_KEY =
  "insulation.ceiling.thermal.m2" as const;
export const WALL_INSULATION_THERMAL_KEY = "insulation.wall.thermal.m2" as const;

/** Existing canonical COST reused for ordinary thermal insulation. */
export const ORDINARY_THERMAL_INSULATION_COST =
  FITOUT_BENCHMARKS.insulationPerM2.cost;

export const ORDINARY_THERMAL_INSULATION_COST_DERIVATION =
  "A: reuse FITOUT_BENCHMARKS.insulationPerM2.cost as ordinary thermal / standard insulation COST. Not a proprietary branded batt." as const;

/** B: wall thermal install hours reuse ceiling insulation hours (conservative). */
export const WALL_INSULATION_HOURS_PER_M2 =
  CEILINGS_QUOTR_PRODUCTIVITY_HOURS[CEILINGS_PRODUCTIVITY_KEYS.insulationM2];

export const WALL_INSULATION_HOURS_DERIVATION =
  "B: reuse ceilings.insulation.install.hours_per_m2 for ordinary wall thermal insulation. Same family install; ceiling hours are conservative for walls." as const;

export function ceilingInsulationResolvesWithQuotr(
  type: string | null | undefined
): boolean {
  return type === "thermal";
}

export function ceilingInsulationMaterialKey(
  type: string | null | undefined
): string | null {
  if (type === "thermal") return CEILING_INSULATION_THERMAL_KEY;
  return null;
}

export function ceilingInsulationSpecification(
  type: CeilingInsulationType | string | null | undefined
): string {
  if (type === "thermal") return "Thermal / standard ceiling insulation";
  if (type === "acoustic") return "Acoustic ceiling insulation";
  if (type === "thermal_acoustic") return "Thermal-acoustic ceiling insulation";
  if (type === "existing_specified") return "Specified ceiling insulation";
  if (type && type.trim()) return type.trim();
  return "Ceiling insulation";
}

export function wallInsulationResolvesWithQuotr(
  type: InternalWallsInsulationType | string | null | undefined
): boolean {
  return type === "thermal";
}

export function wallInsulationMaterialKeyForFallback(
  type: InternalWallsInsulationType
): string | null {
  if (type === "thermal") return WALL_INSULATION_THERMAL_KEY;
  return null;
}
