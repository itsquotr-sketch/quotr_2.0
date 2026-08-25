/**
 * RETAINING-WALL-MATURITY-1D-R1 — construction method and plant.
 *
 * Starter for accessible timber walls: machine-assisted pile holes
 * (mini-excavator / auger). Labour productivity must match that method.
 * If access cannot take a machine, do not price plant; use manual productivity.
 */
import type { OrganisationRate } from "@/components/setup/types";
import { getStringFact } from "@/lib/estimate/facts";
import { timberMiniExcavatorWorkload } from "@/lib/estimate/retaining-wall-plant-workload";
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

export {
  RW_TIMBER_PLANT_SCALING_RULE,
  timberMiniExcavatorWorkload,
} from "@/lib/estimate/retaining-wall-plant-workload";

export const RW_TIMBER_EXCAVATION_SELF_PERFORM = "SELF_PERFORMED" as const;
export const RW_TIMBER_EXCAVATION_SUBCONTRACT = "SUBCONTRACTED" as const;
export type RwTimberExcavationMethod =
  | typeof RW_TIMBER_EXCAVATION_SELF_PERFORM
  | typeof RW_TIMBER_EXCAVATION_SUBCONTRACT;

export function resolveTimberExcavationMethod(
  facts: readonly EstimateFact[] | null | undefined,
  workAreaId: string
): RwTimberExcavationMethod {
  const raw = getStringFact(
    [...(facts ?? [])],
    workAreaId,
    "retaining_wall.excavation_method"
  );
  const value = (raw ?? "").toLowerCase();
  if (
    value.includes("subcontract") ||
    value.includes("subbie") ||
    value === "subcontract"
  ) {
    return RW_TIMBER_EXCAVATION_SUBCONTRACT;
  }
  return RW_TIMBER_EXCAVATION_SELF_PERFORM;
}

/**
 * Integer plant days from machine hours (1E).
 * Manual method: 0. Unknown excavation allowance is not a plant driver.
 */
export function timberMiniExcavatorDays(params: {
  method: RwTimberPilingMethod;
  pileCount: number;
  measuredExcavationM3: number | null;
  rates?: readonly OrganisationRate[];
}): {
  days: number;
  pileLoad: number;
  excavationLoad: number;
  pileMachineHours: number;
  excavationMachineHours: number;
  setupHours: number;
  totalMachineHours: number;
  productiveHoursPerDay: number;
  basis: string;
} {
  const workload = timberMiniExcavatorWorkload(params);
  return {
    days: workload.days,
    pileLoad: workload.pileMachineHours,
    excavationLoad: workload.excavationMachineHours,
    pileMachineHours: workload.pileMachineHours,
    excavationMachineHours: workload.excavationMachineHours,
    setupHours: workload.setupHours,
    totalMachineHours: workload.totalMachineHours,
    productiveHoursPerDay: workload.productiveHoursPerDay,
    basis: workload.basis,
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

export function resolveSleeperPostMethod(
  constraints: readonly EstimateConstraint[] | null | undefined,
  facts?: readonly EstimateFact[] | null,
  workAreaId?: string
): {
  method: RwTimberPilingMethod;
  machineAccess: boolean;
  disclosure: string;
} {
  const timber = resolveTimberPilingMethod(constraints, facts, workAreaId);
  if (!timber.machineAccess) {
    return {
      ...timber,
      disclosure:
        "Site access cannot take a mini-excavator/auger. Steel post holes are manual. Plant is not priced.",
    };
  }
  return {
    ...timber,
    disclosure:
      "Accessible-site starter: machine-assisted steel post holes (mini-excavator/auger). Carpenter labour is attendance, set-out, place and plumb. Concrete placement is a separate labour intent. Hole digging is not bulk excavation.",
  };
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
