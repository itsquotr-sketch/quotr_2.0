/**
 * FLOORING-03 — canonical Flooring Area component identities.
 *
 * Physical package keys, sheet reuse, and labour-operation identities only.
 * No COST rates, productivity hour values, or legacy lump aliases.
 *
 * Reuse Bathroom `sheet.*` keys only where the physical product and unit
 * match exactly. Do not alias Bathroom labour, Bathroom tile packages,
 * `scope.flooring.m2`, `flooring.material.m2`, or generic removal dollars.
 */

import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
} from "@/lib/estimate/bathroom-identities";

/** Carpet supply-and-install subcontract package. */
export const FLOORING_CARPET_SUPPLY_INSTALL_M2 =
  "flooring.carpet.supply_install.m2" as const;
/** Vinyl plank / LVT supply-and-install subcontract package. */
export const FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2 =
  "flooring.vinyl_plank.supply_install.m2" as const;
/** Tile supply-and-install subcontract package. */
export const FLOORING_TILE_SUPPLY_INSTALL_M2 =
  "flooring.tile.supply_install.m2" as const;
/** Hardwood / timber flooring supply-and-install subcontract package. */
export const FLOORING_HARDWOOD_SUPPLY_INSTALL_M2 =
  "flooring.hardwood.supply_install.m2" as const;

/** Optional carpet underlay supply-and-install add-on. */
export const FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2 =
  "flooring.carpet.underlay.supply_install.m2" as const;
/** Optional floor-preparation allowance add-on. */
export const FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2 =
  "flooring.floor_preparation.allowance.m2" as const;

/** Substrate installation operation. Identity only — no hour value. */
export const FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET =
  "flooring.substrate.install.hours_per_sheet" as const;

export const FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2 =
  "flooring.subfloor_framing.minor.allowance.m2" as const;
export const FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2 =
  "flooring.subfloor_framing.standard.allowance.m2" as const;
export const FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2 =
  "flooring.subfloor_framing.major.allowance.m2" as const;

export const FLOORING_CARPET_REMOVE_HOURS_PER_M2 =
  "flooring.carpet.remove.hours_per_m2" as const;
export const FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2 =
  "flooring.vinyl_plank.remove.hours_per_m2" as const;
export const FLOORING_TILE_REMOVE_HOURS_PER_M2 =
  "flooring.tile.remove.hours_per_m2" as const;
export const FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2 =
  "flooring.hardwood.remove.hours_per_m2" as const;
export const FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2 =
  "flooring.substrate.remove.hours_per_m2" as const;

export const FLOORING_SUBSTRATE_MATERIAL_COMPONENT =
  "flooring.substrate.material" as const;
export const FLOORING_SUBSTRATE_INSTALL_LABOUR =
  "flooring.substrate.install" as const;
export const FLOORING_CARPET_REMOVE_LABOUR = "flooring.carpet.remove" as const;
export const FLOORING_VINYL_PLANK_REMOVE_LABOUR =
  "flooring.vinyl_plank.remove" as const;
export const FLOORING_TILE_REMOVE_LABOUR = "flooring.tile.remove" as const;
export const FLOORING_HARDWOOD_REMOVE_LABOUR =
  "flooring.hardwood.remove" as const;
export const FLOORING_SUBSTRATE_REMOVE_LABOUR =
  "flooring.substrate.remove" as const;
export const FLOORING_CUSTOM_REMOVAL_COMPONENT =
  "flooring.finish.remove.custom" as const;

export const FLOORING_CUSTOM_FINISH_COMPONENT =
  "flooring.finish.custom.unresolved" as const;
export const FLOORING_SPECIALIST_COMPONENT =
  "flooring.specialist.unsupported" as const;

/**
 * Existing carpenter/labourer COST paths. Nested Flooring does not resolve
 * hourly COST in FLOORING-03. FLOORING-04 decides removal trade if needed.
 */
export const FLOORING_CARPENTER_LABOUR_RATE_KEY =
  "labour.carpenter.hour" as const;
export const FLOORING_LABOURER_LABOUR_RATE_KEY =
  "labour.labourer.hour" as const;

export const FLOORING_ORDINARY_FINISH_PACKAGE_KEYS = [
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
] as const;

export const FLOORING_ORDINARY_ADDON_KEYS = [
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
] as const;

export const FLOORING_ORDINARY_FRAMING_KEYS = [
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
] as const;

export const FLOORING_ORDINARY_REMOVAL_HOURS_KEYS = [
  FLOORING_CARPET_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  FLOORING_TILE_REMOVE_HOURS_PER_M2,
  FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
] as const;

export const FLOORING_SUBSTRATE_SHEET_KEYS = [
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
] as const;

/** Face coverage m² / sheet. No waste. Generic 19 mm FC matches both listed formats. */
export const FLOORING_SUBSTRATE_SHEET_COVERAGE_M2 = {
  [BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY]: 2.4 * 1.2,
  [BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY]: 2.4 * 1.2,
  [BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY]: 2.7 * 0.6,
  [BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY]: 1.8 * 0.9,
  [BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY]: 1.62,
  [BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY]: 2.4 * 0.6,
} as const;

export function flooringSubstrateSheetCoverageM2(
  itemKey: string | null | undefined
): number | null {
  if (!itemKey) return null;
  const coverage =
    FLOORING_SUBSTRATE_SHEET_COVERAGE_M2[
      itemKey as keyof typeof FLOORING_SUBSTRATE_SHEET_COVERAGE_M2
    ];
  return coverage != null && Number.isFinite(coverage) && coverage > 0
    ? coverage
    : null;
}

export function isFlooringSubstrateSheetKey(
  key: string | null | undefined
): boolean {
  if (!key) return false;
  return (FLOORING_SUBSTRATE_SHEET_KEYS as readonly string[]).includes(key);
}

export function isOrdinaryFlooringFinishPackageKey(
  key: string | null | undefined
): boolean {
  if (!key) return false;
  return (FLOORING_ORDINARY_FINISH_PACKAGE_KEYS as readonly string[]).includes(
    key
  );
}

export function flooringFinishPackageKey(
  finish: "carpet" | "vinyl_plank" | "tile" | "hardwood"
): string {
  if (finish === "carpet") return FLOORING_CARPET_SUPPLY_INSTALL_M2;
  if (finish === "vinyl_plank") return FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2;
  if (finish === "tile") return FLOORING_TILE_SUPPLY_INSTALL_M2;
  return FLOORING_HARDWOOD_SUPPLY_INSTALL_M2;
}

export function flooringFramingAllowanceKey(
  level: "minor" | "standard" | "major"
): string {
  if (level === "minor") return FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2;
  if (level === "standard") return FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2;
  return FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2;
}

export function flooringFinishRemovalHoursKey(
  existing: "carpet" | "vinyl" | "tile" | "hardwood"
): string {
  if (existing === "carpet") return FLOORING_CARPET_REMOVE_HOURS_PER_M2;
  if (existing === "vinyl") return FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2;
  if (existing === "tile") return FLOORING_TILE_REMOVE_HOURS_PER_M2;
  return FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2;
}

export function flooringFinishRemovalLabourComponent(
  existing: "carpet" | "vinyl" | "tile" | "hardwood"
): string {
  if (existing === "carpet") return FLOORING_CARPET_REMOVE_LABOUR;
  if (existing === "vinyl") return FLOORING_VINYL_PLANK_REMOVE_LABOUR;
  if (existing === "tile") return FLOORING_TILE_REMOVE_LABOUR;
  return FLOORING_HARDWOOD_REMOVE_LABOUR;
}
