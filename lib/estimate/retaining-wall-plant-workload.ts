/**
 * RETAINING-WALL-MATURITY-1E — timber plant machine-hour model.
 *
 * Hire days are ceil(total machine hours / productive hours per day),
 * minimum 1 day when machine-assisted plant is required.
 * Carpenter attendance hours are a separate labour intent.
 * Not a sell-value or face-m² package driver.
 */
import { findCompanyProductivityRate } from "@/lib/estimate/productivity";
import { round2 } from "@/lib/estimate/facts";
import type { OrganisationRate } from "@/components/setup/types";

type MachineMethod = "MACHINE_ASSISTED" | "MANUAL";

/** Auger / mini-excavator occupancy per pile hole. Not carpenter 0.85 h/ea. */
export const RW_PLANT_MACHINE_HOURS_PER_PILE = 0.2;
/** Mini-excavator occupancy per measured bulk m³. Not crew attendance 0.45 h/m³. */
export const RW_PLANT_MACHINE_HOURS_PER_M3 = 0.25;
/** Fixed unload / set-up / pack-up occupancy on a suburban hire visit. */
export const RW_PLANT_SETUP_HOURS = 1;
/**
 * Productive machine hours in one dry-hire day after mobilisation and breaks.
 * NZ suburban construction convention — not an 8-hour billed clock.
 */
export const RW_PLANT_PRODUCTIVE_HOURS_PER_DAY = 7;

export const RW_PLANT_HOURS_PER_PILE_KEY =
  "plant.mini_excavator.hours_per_pile" as const;
export const RW_PLANT_HOURS_PER_M3_KEY =
  "plant.mini_excavator.hours_per_m3" as const;
export const RW_PLANT_SETUP_HOURS_KEY =
  "plant.mini_excavator.setup_hours" as const;
export const RW_PLANT_PRODUCTIVE_HOURS_PER_DAY_KEY =
  "plant.mini_excavator.productive_hours_per_day" as const;

export const RW_TIMBER_PLANT_SCALING_RULE =
  "CEIL_MACHINE_HOURS_OVER_PRODUCTIVE_DAY_MIN_1_WHEN_REQUIRED" as const;

export type TimberPlantWorkload = {
  days: number;
  pileMachineHours: number;
  excavationMachineHours: number;
  setupHours: number;
  totalMachineHours: number;
  productiveHoursPerDay: number;
  hoursPerPile: number;
  hoursPerM3: number;
  basis: string;
};

function resolveHours(
  rates: readonly OrganisationRate[] | undefined,
  key: string,
  unit: string,
  fallback: number
): number {
  const named = findCompanyProductivityRate(rates, key, unit);
  const value = named?.cost_rate != null ? Number(named.cost_rate) : fallback;
  return value > 0 ? value : fallback;
}

export function timberMiniExcavatorWorkload(params: {
  method: MachineMethod;
  pileCount: number;
  measuredExcavationM3: number | null;
  rates?: readonly OrganisationRate[];
}): TimberPlantWorkload {
  const hoursPerPile = resolveHours(
    params.rates,
    RW_PLANT_HOURS_PER_PILE_KEY,
    "ea",
    RW_PLANT_MACHINE_HOURS_PER_PILE
  );
  const hoursPerM3 = resolveHours(
    params.rates,
    RW_PLANT_HOURS_PER_M3_KEY,
    "m3",
    RW_PLANT_MACHINE_HOURS_PER_M3
  );
  const setupHours = round2(
    resolveHours(
      params.rates,
      RW_PLANT_SETUP_HOURS_KEY,
      "job",
      RW_PLANT_SETUP_HOURS
    )
  );
  const productiveHoursPerDay = resolveHours(
    params.rates,
    RW_PLANT_PRODUCTIVE_HOURS_PER_DAY_KEY,
    "day",
    RW_PLANT_PRODUCTIVE_HOURS_PER_DAY
  );

  if (params.method !== "MACHINE_ASSISTED") {
    return {
      days: 0,
      pileMachineHours: 0,
      excavationMachineHours: 0,
      setupHours: 0,
      totalMachineHours: 0,
      productiveHoursPerDay,
      hoursPerPile,
      hoursPerM3,
      basis: "Manual piling — no mini-excavator day.",
    };
  }

  const pileCount = params.pileCount > 0 ? params.pileCount : 0;
  const measured =
    params.measuredExcavationM3 != null && params.measuredExcavationM3 > 0
      ? params.measuredExcavationM3
      : 0;
  const pileMachineHours = round2(pileCount * hoursPerPile);
  const excavationMachineHours = round2(measured * hoursPerM3);
  const machineScope = pileCount > 0 || measured > 0;
  const totalMachineHours = machineScope
    ? round2(pileMachineHours + excavationMachineHours + setupHours)
    : 0;
  const days = machineScope
    ? Math.max(1, Math.ceil(totalMachineHours / productiveHoursPerDay - 1e-12))
    : 0;

  return {
    days,
    pileMachineHours,
    excavationMachineHours,
    setupHours: machineScope ? setupHours : 0,
    totalMachineHours,
    productiveHoursPerDay,
    hoursPerPile,
    hoursPerM3,
    basis: machineScope
      ? `${RW_TIMBER_PLANT_SCALING_RULE}. ${pileCount} piles × ${hoursPerPile} machine h/ea = ${pileMachineHours}h · ${measured} m³ measured bulk × ${hoursPerM3} machine h/m³ = ${excavationMachineHours}h · setup ${setupHours}h · total ${totalMachineHours}h / ${productiveHoursPerDay} productive h/day → ${days} day(s). Unknown excavation allowance does not add plant hours.`
      : "No machine scope.",
  };
}
