/**
 * RETAINING-WALL-MATURITY-1D-R1 — construction method and plant.
 *
 * Starter for accessible timber walls: machine-assisted pile holes
 * (mini-excavator / auger). Labour productivity must match that method.
 * If access cannot take a machine, do not price plant; use manual productivity.
 */
import type { EstimateConstraint, EstimateFact } from "@/lib/estimate/types";
import { resolveProjectCondition } from "@/lib/project-conditions/legacy-adapter";

export const RW_TIMBER_PILING_METHOD_MACHINE = "MACHINE_ASSISTED" as const;
export const RW_TIMBER_PILING_METHOD_MANUAL = "MANUAL" as const;
export type RwTimberPilingMethod =
  | typeof RW_TIMBER_PILING_METHOD_MACHINE
  | typeof RW_TIMBER_PILING_METHOD_MANUAL;

export const RW_TIMBER_COMPACTION_METHOD =
  "MANUAL_BASIC_CONSOLIDATION_NO_COMPACTOR" as const;

export const RW_MINI_EXCAVATOR_DAY_KEY = "plant.mini_excavator.day";
export const RW_MINI_EXCAVATOR_DAY_COST_EX_GST = 420;
export const RW_MINI_EXCAVATOR_DAY_BASIS =
  "QUOTR_STARTER_DRY_HIRE_DAY_EX_GST" as const;

/** One suburban machine day of pile-hole / attendance work. Not a production study. */
export const RW_PILES_PER_MACHINE_DAY = 16;
/** Measured bulk cut only. Unknown face-m² excavation allowance does not add plant days. */
export const RW_MEASURED_EXCAVATION_M3_PER_MACHINE_DAY = 20;

export const RW_TIMBER_PLANT_SCALING_RULE =
  "MIN_1_DAY_THEN_CEIL_PILE_LOAD_PLUS_MEASURED_EXCAVATION_LOAD" as const;

/**
 * Integer plant days for machine-assisted timber walls.
 * Workload = pileCount/16 + measuredBulkM3/20. Minimum 1 when machine scope exists.
 * Manual method: 0. Unknown excavation allowance is not a plant driver.
 */
export function timberMiniExcavatorDays(params: {
  method: RwTimberPilingMethod;
  pileCount: number;
  measuredExcavationM3: number | null;
}): { days: number; pileLoad: number; excavationLoad: number; basis: string } {
  if (params.method !== RW_TIMBER_PILING_METHOD_MACHINE) {
    return {
      days: 0,
      pileLoad: 0,
      excavationLoad: 0,
      basis: "Manual piling — no mini-excavator day.",
    };
  }
  const pileCount = params.pileCount > 0 ? params.pileCount : 0;
  const measured =
    params.measuredExcavationM3 != null && params.measuredExcavationM3 > 0
      ? params.measuredExcavationM3
      : 0;
  const pileLoad = pileCount / RW_PILES_PER_MACHINE_DAY;
  const excavationLoad = measured / RW_MEASURED_EXCAVATION_M3_PER_MACHINE_DAY;
  const workload = pileLoad + excavationLoad;
  const machineScope = pileCount > 0 || measured > 0;
  const days = machineScope ? Math.max(1, Math.ceil(workload - 1e-12)) : 0;
  return {
    days,
    pileLoad,
    excavationLoad,
    basis: machineScope
      ? `${RW_TIMBER_PLANT_SCALING_RULE}. ${pileCount} piles / ${RW_PILES_PER_MACHINE_DAY} per day + ${measured} m³ measured bulk / ${RW_MEASURED_EXCAVATION_M3_PER_MACHINE_DAY} m³ per day → ${days} day(s). Unknown excavation allowance does not add plant days.`
      : "No machine scope.",
  };
}

function accessIsMachineBlocked(access: string | null | undefined): boolean {
  const value = access?.toLowerCase() ?? "";
  return (
    value === "difficult" ||
    value === "very poor" ||
    value === "verypoor" ||
    value === "restricted"
  );
}

export function timberMachineAccessFeasible(
  constraints: readonly EstimateConstraint[] | null | undefined,
  facts?: readonly EstimateFact[] | null,
  workAreaId?: string
): boolean {
  const resolved = resolveProjectCondition({
    constraints: [...(constraints ?? [])],
    facts: facts ? [...facts] : undefined,
    workAreaId,
    constraintKey: "site_access",
    legacyFactKey: "retaining_wall.access",
  });
  return !accessIsMachineBlocked(resolved.value);
}

export function resolveTimberPilingMethod(
  constraints: readonly EstimateConstraint[] | null | undefined,
  facts?: readonly EstimateFact[] | null,
  workAreaId?: string
): {
  method: RwTimberPilingMethod;
  machineAccess: boolean;
  disclosure: string;
} {
  const machineAccess = timberMachineAccessFeasible(
    constraints,
    facts,
    workAreaId
  );
  if (!machineAccess) {
    return {
      method: RW_TIMBER_PILING_METHOD_MANUAL,
      machineAccess: false,
      disclosure:
        "Site access cannot take a mini-excavator/auger. Pile holes are manual. Plant is not priced.",
    };
  }
  return {
    method: RW_TIMBER_PILING_METHOD_MACHINE,
    machineAccess: true,
    disclosure:
      "Accessible-site starter: machine-assisted pile holes (mini-excavator/auger). Carpenter labour is attendance, set-out, place and plumb — not a hand-dug 0.85 h/ea with no machine.",
  };
}
