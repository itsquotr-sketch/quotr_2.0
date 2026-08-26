/**
 * RETAINING-WALL-FAMILY-COVERAGE-01 — shared Timber / Sleeper / Masonry coverage.
 *
 * Labour productivity semantics: TOTAL PERSON-HOURS PER UNIT (not elapsed crew time).
 * Digger access is distinct from general site_access.
 */

import { round2 } from "@/lib/estimate/facts";
import { getStringFact } from "@/lib/estimate/facts";
import {
  RW_TIMBER_PILING_METHOD_MANUAL,
  RW_TIMBER_PILING_METHOD_MACHINE,
  type RwTimberPilingMethod,
} from "@/lib/estimate/retaining-wall-construction-method";
import type { EstimateConstraint, EstimateFact } from "@/lib/estimate/types";
import { resolveProjectCondition } from "@/lib/project-conditions/legacy-adapter";

export const RW_DIGGER_ACCESS_FACT = "retaining_wall.digger_access" as const;
export const RW_DRAINAGE_SOCK_FACT = "retaining_wall.drainage_sock_required" as const;
export const RW_PILE_MATERIAL_FACT = "retaining_wall.pile_material" as const;

export const RW_PILE_MATERIAL_H5_SED = "H5 SED retaining pole" as const;
export const RW_PILE_MATERIAL_HOUSE_PILE_125 =
  "125×125 H5 house pile" as const;

export const RW_DRAINAGE_SOCK_KEY = "retaining_wall.drainage.sock.lm" as const;
export const RW_DRAINAGE_SOCK_COMPONENT =
  "retaining_wall.drainage.sock" as const;

export const RW_TIMBER_CONCRETE_COMPONENT =
  "retaining_wall.timber.hole_concrete" as const;
export const RW_TIMBER_CONCRETE_LABOUR_COMPONENT =
  "retaining_wall.timber.concrete.place" as const;

export const RW_PRODUCTIVITY_PERSON_HOUR_NOTE =
  "Total worker-hours per unit — not elapsed crew time. Example: 2 workers × 1 hour ÷ 4 units = 0.5 labour-h/unit.";

export const RW_EXCAVATION_MACHINE_HOURS_KEY =
  "retaining_wall.excavation.machine.hours_per_m3" as const;
export const RW_EXCAVATION_MANUAL_HOURS_KEY =
  "retaining_wall.excavation.manual.hours_per_m3" as const;

export const RW_EXCAVATION_MACHINE_HOURS_STARTER = 0.45;
export const RW_EXCAVATION_MANUAL_HOURS_STARTER = 1.6;

export const RW_TIMBER_CONCRETE_HOURS_KEY =
  "retaining_wall.timber.concrete.place.hours_per_hole" as const;
export const RW_TIMBER_CONCRETE_HOURS_STARTER = 0.12;

export const RW_DRAINAGE_SOCK_STARTER_COST_PER_LM = 4.5;

export function parseDiggerAccess(
  raw: string | null | undefined
): "yes" | "no" | "not_sure" | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "yes" || value === "true") return "yes";
  if (value === "no" || value === "false") return "no";
  if (value.includes("not sure") || value === "unsure" || value === "unknown") {
    return "not_sure";
  }
  return null;
}

function siteAccessSuggestsMachine(access: string | null | undefined): boolean {
  const value = access?.toLowerCase() ?? "";
  return !(
    value === "difficult" ||
    value === "very poor" ||
    value === "verypoor" ||
    value === "restricted"
  );
}

/**
 * Explicit digger_access overrides site_access inference.
 * Not sure → conservative manual when site is difficult; else machine when site allows.
 */
export function resolveRetainingWallDiggerAccess(params: {
  facts?: readonly EstimateFact[] | null;
  workAreaId?: string;
  constraints?: readonly EstimateConstraint[] | null;
}): {
  machineFeasible: boolean;
  method: RwTimberPilingMethod;
  source: "digger_access" | "site_access" | "default";
  disclosure: string;
} {
  const diggerRaw =
    params.workAreaId != null
      ? getStringFact(
          [...(params.facts ?? [])],
          params.workAreaId,
          RW_DIGGER_ACCESS_FACT
        )
      : null;
  const parsed = parseDiggerAccess(diggerRaw);
  if (parsed === "yes") {
    return {
      machineFeasible: true,
      method: RW_TIMBER_PILING_METHOD_MACHINE,
      source: "digger_access",
      disclosure:
        "Mini excavator / digger can access the work area. Machine-assisted excavation and plant may apply.",
    };
  }
  if (parsed === "no") {
    return {
      machineFeasible: false,
      method: RW_TIMBER_PILING_METHOD_MANUAL,
      source: "digger_access",
      disclosure:
        "No mini excavator / digger access. Manual excavation productivity applies and excavation plant is not priced.",
    };
  }

  const resolved = resolveProjectCondition({
    constraints: [...(params.constraints ?? [])],
    facts: params.facts ? [...params.facts] : undefined,
    workAreaId: params.workAreaId,
    constraintKey: "site_access",
    legacyFactKey: "retaining_wall.access",
  });
  const siteAllows = siteAccessSuggestsMachine(resolved.value);
  if (parsed === "not_sure") {
    return {
      machineFeasible: siteAllows,
      method: siteAllows
        ? RW_TIMBER_PILING_METHOD_MACHINE
        : RW_TIMBER_PILING_METHOD_MANUAL,
      source: "default",
      disclosure: siteAllows
        ? "Digger access not confirmed — using accessible-site default (machine-assisted where applicable). Confirm machine access."
        : "Digger access not confirmed — difficult site access implies manual excavation. Confirm machine access.",
    };
  }

  return {
    machineFeasible: siteAllows,
    method: siteAllows
      ? RW_TIMBER_PILING_METHOD_MACHINE
      : RW_TIMBER_PILING_METHOD_MANUAL,
    source: "site_access",
    disclosure: siteAllows
      ? "Accessible site — machine-assisted excavation/plant may apply when digger access is not explicitly set."
      : "Site access cannot take a mini-excavator. Manual excavation and no excavation plant.",
  };
}

export function retainingWallExcavationProductivityKey(
  method: RwTimberPilingMethod
): string {
  return method === RW_TIMBER_PILING_METHOD_MANUAL
    ? RW_EXCAVATION_MANUAL_HOURS_KEY
    : RW_EXCAVATION_MACHINE_HOURS_KEY;
}

export function retainingWallExcavationHoursStarter(
  method: RwTimberPilingMethod
): number {
  return method === RW_TIMBER_PILING_METHOD_MANUAL
    ? RW_EXCAVATION_MANUAL_HOURS_STARTER
    : RW_EXCAVATION_MACHINE_HOURS_STARTER;
}

export function parseDrainageSockRequired(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean | null {
  const raw = getStringFact([...facts], workAreaId, RW_DRAINAGE_SOCK_FACT);
  if (raw == null) return null;
  const value = raw.toLowerCase();
  if (value === "yes" || value === "true") return true;
  if (value === "no" || value === "false") return false;
  if (value.includes("not sure") || value === "unsure") return null;
  return null;
}

export function parseTimberPileMaterial(
  facts: readonly EstimateFact[],
  workAreaId: string
): typeof RW_PILE_MATERIAL_H5_SED | typeof RW_PILE_MATERIAL_HOUSE_PILE_125 {
  const raw = getStringFact([...facts], workAreaId, RW_PILE_MATERIAL_FACT);
  const value = (raw ?? "").toLowerCase();
  if (
    value.includes("house pile") ||
    value.includes("125") ||
    value.includes("square pile")
  ) {
    return RW_PILE_MATERIAL_HOUSE_PILE_125;
  }
  return RW_PILE_MATERIAL_H5_SED;
}

/** Derive person-hours per unit from crew calibration inputs. */
export function personHoursPerUnit(params: {
  crewSize: number;
  elapsedHours: number;
  quantityCompleted: number;
}): number | null {
  if (
    !(params.crewSize > 0) ||
    !(params.elapsedHours >= 0) ||
    !(params.quantityCompleted > 0)
  ) {
    return null;
  }
  return round2(
    (params.crewSize * params.elapsedHours) / params.quantityCompleted
  );
}

export function isHousePileMaterial(
  material: typeof RW_PILE_MATERIAL_H5_SED | typeof RW_PILE_MATERIAL_HOUSE_PILE_125
): boolean {
  return material === RW_PILE_MATERIAL_HOUSE_PILE_125;
}
