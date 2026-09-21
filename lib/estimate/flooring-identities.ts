/**
 * FLOORING-03 / FLOORING-04B / FLOORING-04C — canonical Flooring Area identities.
 *
 * Physical package keys, sheet reuse, labour-operation identities,
 * owner-approved finish subcontract COST, framing allowance COST, and
 * substrate/removal productivity hours. Do not alias Bathroom labour,
 * Bathroom tile packages, `scope.flooring.m2`, `flooring.material.m2`,
 * or generic removal dollars.
 */

import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
  BATHROOM_SHEET_AREA_M2,
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

/** Quotr V1 subcontract direct COST, ex GST / m². Not sell. */
export const FLOORING_CARPET_SUPPLY_INSTALL_COST_EX_GST = 75 as const;
export const FLOORING_VINYL_PLANK_SUPPLY_INSTALL_COST_EX_GST = 95 as const;
export const FLOORING_TILE_SUPPLY_INSTALL_COST_EX_GST = 150 as const;
export const FLOORING_HARDWOOD_SUPPLY_INSTALL_COST_EX_GST = 190 as const;
export const FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_COST_EX_GST = 15 as const;
export const FLOORING_FLOOR_PREPARATION_ALLOWANCE_COST_EX_GST = 35 as const;

export const FLOORING_CARPET_SUPPLY_INSTALL_LABEL =
  "Carpet supply and installation" as const;
export const FLOORING_VINYL_PLANK_SUPPLY_INSTALL_LABEL =
  "Vinyl plank / LVT supply and installation" as const;
export const FLOORING_TILE_SUPPLY_INSTALL_LABEL =
  "Floor tile supply and installation" as const;
export const FLOORING_HARDWOOD_SUPPLY_INSTALL_LABEL =
  "Hardwood / timber flooring supply and installation" as const;
export const FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_LABEL =
  "Carpet underlay supply and installation" as const;
export const FLOORING_FLOOR_PREPARATION_ALLOWANCE_LABEL =
  "Ordinary floor-preparation allowance" as const;

export const FLOORING_CARPET_SUPPLY_INSTALL_DESCRIPTION =
  "Quotr benchmark COST $75.00 ex GST / m². Includes ordinary carpet supply allowance, ordinary straight-lay installation, and standard installation accessories normally forming part of that package. Excludes underlay, preparation or levelling, existing finish removal, substrate work, framing, stairs, disposal, specialist patterns, moisture remediation, and skirting/scotia. Company exact subcontract rate wins." as const;
export const FLOORING_VINYL_PLANK_SUPPLY_INSTALL_DESCRIPTION =
  "Quotr benchmark COST $95.00 ex GST / m². Includes ordinary vinyl plank/LVT supply allowance, ordinary straight-lay installation, and standard adhesive/accessories where ordinarily required. Excludes sheet vinyl, preparation or self-levelling, removal, substrate, framing, disposal, moisture remediation, complex patterns, and trims beyond ordinary installation. Company exact subcontract rate wins." as const;
export const FLOORING_TILE_SUPPLY_INSTALL_DESCRIPTION =
  "Quotr benchmark COST $150.00 ex GST / m². Includes ordinary floor-tile supply allowance, standard straight-lay installation, and ordinary adhesive and grout. Excludes waterproofing, preparation/self-levelling, floor substrate or tile underlay, removal, disposal, premium tiles, herringbone or specialist patterns, specialist trims, movement-joint systems beyond ordinary work, and moisture or structural remediation. Tile dimensions are takeoff information only and do not change this V1 rate. Company exact subcontract rate wins." as const;
export const FLOORING_HARDWOOD_SUPPLY_INSTALL_DESCRIPTION =
  "Quotr benchmark COST $190.00 ex GST / m². Includes ordinary prefinished timber-flooring supply allowance, ordinary straight-lay installation, and standard adhesive/fixings where required. Excludes floor preparation, substrate, framing, removal, disposal, sanding or coating, moisture remediation, parquet, herringbone or specialist patterns, engineered specialist systems, and skirting/scotia. Board width and informational lineal metres do not change this V1 rate. Company exact subcontract rate wins." as const;
export const FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_DESCRIPTION =
  "Quotr benchmark COST $15.00 ex GST / m². Includes ordinary standard underlay supply and ordinary installation. Excludes premium acoustic or specialist systems, floor preparation, remediation, removal and disposal. The base carpet package excludes underlay. Company exact subcontract rate wins." as const;
export const FLOORING_FLOOR_PREPARATION_ALLOWANCE_DESCRIPTION =
  "Quotr benchmark COST $35.00 ex GST / m². Bounded allowance for ordinary minor floor preparation or self-levelling associated with vinyl-plank or tile installation. Does not cover all preparation risk. Excludes unlimited levelling, structural remediation, rotten substrate, moisture remediation, asbestos/hazardous material, extensive grinding, engineered screeds, major height correction, and substrate replacement. Company exact subcontract rate wins." as const;

/** Substrate installation operation. Physical identity — do not rename. */
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

/** Quotr V1 productivity, person-hours. Not dollars. */
export const FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET_VALUE = 0.5 as const;
export const FLOORING_CARPET_REMOVE_HOURS_PER_M2_VALUE = 0.12 as const;
export const FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2_VALUE = 0.2 as const;
export const FLOORING_TILE_REMOVE_HOURS_PER_M2_VALUE = 0.55 as const;
export const FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2_VALUE = 0.35 as const;
export const FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2_VALUE = 0.3 as const;

export const FLOORING_SUBSTRATE_INSTALL_HOURS_LABEL =
  "Flooring substrate sheet installation" as const;
export const FLOORING_CARPET_REMOVE_HOURS_LABEL =
  "Carpet finish removal" as const;
export const FLOORING_VINYL_PLANK_REMOVE_HOURS_LABEL =
  "Vinyl / LVT finish removal" as const;
export const FLOORING_TILE_REMOVE_HOURS_LABEL =
  "Floor tile finish removal" as const;
export const FLOORING_HARDWOOD_REMOVE_HOURS_LABEL =
  "Hardwood / timber finish removal" as const;
export const FLOORING_SUBSTRATE_REMOVE_HOURS_LABEL =
  "Flooring substrate removal" as const;

export const FLOORING_SUBSTRATE_INSTALL_HOURS_DESCRIPTION =
  "Quotr V1 0.50 person-hours per purchased whole substrate sheet. Applies to the FLOORING-03 whole-sheet count, not net m². Includes ordinary setting out, cutting, fitting and fixing of a selected supported flooring substrate sheet. Excludes substrate material COST, framing alteration, structural design, extensive levelling, finish flooring, removal, disposal, and specialist membranes or systems. Future labour COST uses labour.carpenter.hour. Company exact productivity wins." as const;
export const FLOORING_CARPET_REMOVE_HOURS_DESCRIPTION =
  "Quotr V1 0.12 person-hours / m² on the entered physical floor area. Ordinary carpet finish removal only. Excludes disposal/cartage, hazardous materials, structural repairs, substrate removal, grinding/remediation beyond ordinary uplift, and specialist systems. Future V1 labour COST uses labour.carpenter.hour. Company exact productivity wins." as const;
export const FLOORING_VINYL_PLANK_REMOVE_HOURS_DESCRIPTION =
  "Quotr V1 0.20 person-hours / m² on the entered physical floor area. Ordinary vinyl plank/LVT finish removal only. Excludes disposal/cartage, hazardous materials, structural repairs, substrate removal, grinding/remediation beyond ordinary uplift, and specialist systems. Future V1 labour COST uses labour.carpenter.hour. Company exact productivity wins." as const;
export const FLOORING_TILE_REMOVE_HOURS_DESCRIPTION =
  "Quotr V1 0.55 person-hours / m² on the entered physical floor area. Ordinary floor-tile finish removal only. Excludes disposal/cartage, hazardous materials, structural repairs, substrate removal, grinding/remediation beyond ordinary uplift, and specialist systems. Future V1 labour COST uses labour.carpenter.hour. Company exact productivity wins." as const;
export const FLOORING_HARDWOOD_REMOVE_HOURS_DESCRIPTION =
  "Quotr V1 0.35 person-hours / m² on the entered physical floor area. Ordinary hardwood/timber finish removal only. Excludes disposal/cartage, hazardous materials, structural repairs, substrate removal, grinding/remediation beyond ordinary uplift, and specialist systems. Future V1 labour COST uses labour.carpenter.hour. Company exact productivity wins." as const;
export const FLOORING_SUBSTRATE_REMOVE_HOURS_DESCRIPTION =
  "Quotr V1 0.30 person-hours / m² on the entered physical floor area. Separate from finish removal. Only when substrate removal is explicitly selected after finish removal. Excludes disposal, framing removal, structural work, hazardous materials, and reconstruction. Future V1 labour COST uses labour.carpenter.hour. Company exact productivity wins." as const;

/** Combined non-structural below-substrate framing allowance COST, ex GST / m². */
export const FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_COST_EX_GST = 45 as const;
export const FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_COST_EX_GST = 90 as const;
export const FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_COST_EX_GST = 160 as const;

export const FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_LABEL =
  "Minor below-substrate framing allowance" as const;
export const FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_LABEL =
  "Standard below-substrate framing allowance" as const;
export const FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_LABEL =
  "Major below-substrate framing allowance" as const;

export const FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_DESCRIPTION =
  "Quotr combined allowance COST $45.00 ex GST / m² on net Flooring Area. Bounded generic allowance for local packing, blocking, limited levelling and small isolated non-structural framing adjustments below the substrate. Not material-only and not a productivity hour rate. Excludes engineered or structural design, consent work, structural beam/joist replacement, foundations, major decay remediation, hazardous-material work, demolition/disposal unless separately listed, and work that cannot reasonably be covered by a generic area allowance. Structural or engineered scope stays Pricing Required. Company exact allowance wins." as const;
export const FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_DESCRIPTION =
  "Quotr combined allowance COST $90.00 ex GST / m² on net Flooring Area. Bounded generic allowance for ordinary distributed blocking, packing, levelling and modest non-structural framing remediation across the selected area. Not material-only and not a productivity hour rate. Excludes engineered or structural design, consent work, structural beam/joist replacement, foundations, major decay remediation, hazardous-material work, demolition/disposal unless separately listed, and work that cannot reasonably be covered by a generic area allowance. Structural or engineered scope stays Pricing Required. Company exact allowance wins." as const;
export const FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_DESCRIPTION =
  "Quotr combined allowance COST $160.00 ex GST / m² on net Flooring Area. Bounded generic allowance for substantial non-engineered framing remediation across the selected area. Not material-only and not a productivity hour rate. Excludes engineered or structural design, consent work, structural beam/joist replacement, foundations, major decay remediation, hazardous-material work, demolition/disposal unless separately listed, and work that cannot reasonably be covered by a generic area allowance. Structural or engineered scope stays Pricing Required. Company exact allowance wins." as const;

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
 * Existing carpenter hourly COST path. FLOORING-04C does not hardcode $60.
 * Nested Flooring does not emit labour COST until FLOORING-05.
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

export const FLOORING_SUBCONTRACT_RATE_KEYS = [
  ...FLOORING_ORDINARY_FINISH_PACKAGE_KEYS,
  ...FLOORING_ORDINARY_ADDON_KEYS,
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

export const FLOORING_PRODUCTIVITY_KEYS = [
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
  ...FLOORING_ORDINARY_REMOVAL_HOURS_KEYS,
] as const;

export const FLOORING_SUBSTRATE_SHEET_KEYS = [
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
] as const;

/**
 * Face coverage from the item-key millimetre tokens (`2400x1200`).
 * That encoding is the catalogue identity, not a UI label.
 * Keys without encoded size stay unresolved — never invent dimensions.
 */
const ITEM_KEY_SHEET_MM = /(\d{3,4})x(\d{3,4})/;

export function flooringSubstrateSheetCoverageM2(
  itemKey: string | null | undefined
): number | null {
  if (!itemKey) return null;
  if (itemKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) {
    return BATHROOM_SHEET_AREA_M2;
  }
  const match = ITEM_KEY_SHEET_MM.exec(itemKey);
  if (!match) return null;
  const lengthM = Number(match[1]) / 1000;
  const widthM = Number(match[2]) / 1000;
  const coverage = lengthM * widthM;
  return Number.isFinite(coverage) && coverage > 0 ? coverage : null;
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
