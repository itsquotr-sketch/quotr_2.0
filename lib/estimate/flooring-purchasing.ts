/**
 * Stage 2E — finish purchasing quantity for existing area-sold recipes.
 *
 * Owner-stated waste changes the finish supply quantity only.
 * Installation packages, removal, preparation, underlay, substrate sheets
 * and framing stay on the net area. The combined package rate has no
 * waste percentage in its catalogue text, so waste is not assumed to be
 * inside that rate and is not priced a second time on top of it.
 *
 * Reviewed quantities, before any line is priced:
 * - vinyl 9.60 m² at 10% → supply 10.56 m², no carton
 * - vinyl 20 m² at 10% → supply 22.00 m²
 * - tile 10 m², 600 × 600, 10% → 31 whole tiles (ceil of 11 / 0.36)
 * - hardwood 12 m², 145 mm, 10% → 91.03 lineal m, no box
 * - carpet 11.52 m² at 10% → no priced supply quantity
 */

import { round2 } from "@/lib/estimate/facts";
import type { FlooringPortion } from "@/lib/estimate/flooring-portions";

export const FLOORING_FINISH_SUPPLY_COMPONENT = "flooring.finish.supply" as const;
export const FLOORING_FINISH_INSTALL_COMPONENT = "flooring.finish.install" as const;
export const FLOORING_FINISH_INSTALL_HOURS_PER_M2 =
  "flooring.finish.install.hours_per_m2" as const;
export const FLOORING_CARPET_PURCHASING_UNRESOLVED =
  "flooring.carpet.purchasing.unresolved" as const;
export const FLOORING_VINYL_SUPPLY_M2 = "flooring.vinyl_plank.supply.m2" as const;
export const FLOORING_TILE_SUPPLY_EACH = "flooring.tile.supply.each" as const;
export const FLOORING_HARDWOOD_SUPPLY_LM = "flooring.hardwood.supply.lm" as const;
export const FLOORING_FINISH_WASTE_COMPONENT = "flooring.finish.waste_increment" as const;
export const FLOORING_FINISH_ANCILLARY_COMPONENT = "flooring.finish.ancillary" as const;
export const FLOORING_WASTE_INCREMENT_CATEGORY = "FLOORING_WASTE_INCREMENT" as const;
export const FLOORING_WASTE_UNRESOLVED_CATEGORY = "FLOORING_WASTE_UNRESOLVED" as const;
export const FLOORING_VINYL_ADHESIVE_ACCESSORIES_M2 =
  "flooring.vinyl_plank.adhesive_accessories.m2" as const;
export const FLOORING_TILE_ADHESIVE_GROUT_M2 =
  "flooring.tile.adhesive_grout.m2" as const;
export const FLOORING_HARDWOOD_ADHESIVE_FIXINGS_M2 =
  "flooring.hardwood.adhesive_fixings.m2" as const;
export const FLOORING_CARPET_ACCESSORIES_M2 =
  "flooring.carpet.accessories.m2" as const;

const TILE_COUNT_EPSILON = 1e-12;

export type FlooringSupplyMeasure =
  | {
      readonly kind: "none";
      readonly netM2: number;
    }
  | {
      readonly kind: "area";
      readonly netM2: number;
      readonly wastePercent: number;
      readonly supplyM2: number;
      readonly formula: string;
    }
  | {
      readonly kind: "tiles";
      readonly netM2: number;
      readonly wastePercent: number;
      readonly netTiles: number;
      readonly supplyTiles: number;
      readonly formula: string;
    }
  | {
      readonly kind: "lineal";
      readonly netM2: number;
      readonly wastePercent: number;
      readonly netLinealM: number;
      readonly supplyLinealM: number;
      readonly formula: string;
    }
  | {
      readonly kind: "carpet_unresolved";
      readonly netM2: number;
      readonly wastePercent: number;
      readonly limitation: string;
    };

export function flooringCustomerSupplied(portion: FlooringPortion): boolean {
  return portion.finish_supplied_by === "customer";
}

function presentM2(value: number): string {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? rounded.toFixed(2) : String(rounded);
}

export function resolveFlooringSupply(params: {
  portion: FlooringPortion;
  netM2: number;
  tile: { tileAreaM2: number; wholeTileCount: number } | null;
  hardwood: { linealM: number; boardWidthMm: number } | null;
}): FlooringSupplyMeasure {
  const waste = params.portion.waste_percent;
  const hasWaste = waste != null && Number.isFinite(waste) && waste > 0;
  const customer = flooringCustomerSupplied(params.portion);
  const netM2 = params.netM2;

  if (params.portion.finish_type === "carpet") {
    if (!hasWaste || customer) return { kind: "none", netM2 };
    return {
      kind: "carpet_unresolved",
      netM2,
      wastePercent: waste,
      limitation: `Carpet roll purchasing cannot be calculated from ${waste}% waste. Installed area stays ${presentM2(netM2)} m². No roll width or seam layout is known, so no supply quantity is priced.`,
    };
  }

  if (!hasWaste) return { kind: "none", netM2 };

  if (params.portion.finish_type === "tile" && params.tile) {
    const supplyArea = netM2 * (1 + waste / 100);
    const supplyTiles = Math.ceil(
      supplyArea / params.tile.tileAreaM2 - TILE_COUNT_EPSILON
    );
    return {
      kind: "tiles",
      netM2,
      wastePercent: waste,
      netTiles: params.tile.wholeTileCount,
      supplyTiles,
      formula: `Net ${presentM2(netM2)} m² × (1 + ${waste}% waste) = ${presentM2(supplyArea)} m². Whole tiles ceil to ${supplyTiles}. No second area waste is added. Installation stays ${presentM2(netM2)} m².`,
    };
  }

  if (params.portion.finish_type === "hardwood" && params.hardwood) {
    const netLinealM = round2(params.hardwood.linealM);
    const supplyLinealM = round2(params.hardwood.linealM * (1 + waste / 100));
    return {
      kind: "lineal",
      netM2,
      wastePercent: waste,
      netLinealM,
      supplyLinealM,
      formula: `Net ${presentM2(netM2)} m² at ${params.hardwood.boardWidthMm} mm is ${netLinealM} lineal m. Supply ${supplyLinealM} lineal m includes ${waste}% waste. Box coverage is unknown, so no pack count is invented. Installation stays ${presentM2(netM2)} m².`,
    };
  }

  if (params.portion.finish_type === "vinyl_plank") {
    const supplyM2 = round2(netM2 * (1 + waste / 100));
    return {
      kind: "area",
      netM2,
      wastePercent: waste,
      supplyM2,
      formula: `Net ${presentM2(netM2)} m² × (1 + ${waste}% waste) = supply ${presentM2(supplyM2)} m². No carton coverage is known, so this is an area allowance. Installation, removal and preparation stay the net area.`,
    };
  }

  return { kind: "none", netM2 };
}

/** Extra purchase only. The net quantity stays with the package or installation. */
export function flooringWasteExtra(
  purchasing: FlooringSupplyMeasure
): { quantity: number; unit: string } | null {
  if (purchasing.kind === "area") {
    const quantity = round2(purchasing.supplyM2 - purchasing.netM2);
    return quantity > 0 ? { quantity, unit: "m2" } : null;
  }
  if (purchasing.kind === "tiles") {
    const quantity = purchasing.supplyTiles - purchasing.netTiles;
    return quantity > 0 ? { quantity, unit: "each" } : null;
  }
  if (purchasing.kind === "lineal") {
    const quantity = round2(purchasing.supplyLinealM - purchasing.netLinealM);
    return quantity > 0 ? { quantity, unit: "lm" } : null;
  }
  return null;
}

/** Separate pricing still needs a supply quantity when no waste was stated. */
export function flooringSeparateSupplyMeasure(params: {
  purchasing: FlooringSupplyMeasure;
  netM2: number;
  tile: { tileAreaM2: number; wholeTileCount: number } | null;
  hardwood: { linealM: number; boardWidthMm: number } | null;
}): FlooringSupplyMeasure {
  if (params.purchasing.kind !== "none") return params.purchasing;
  if (params.tile) {
    return {
      kind: "tiles",
      netM2: params.netM2,
      wastePercent: 0,
      netTiles: params.tile.wholeTileCount,
      supplyTiles: params.tile.wholeTileCount,
      formula: `No waste is stated. Supply is ${params.tile.wholeTileCount} whole tiles. Installation stays ${presentM2(params.netM2)} m².`,
    };
  }
  if (params.hardwood) {
    const lineal = round2(params.hardwood.linealM);
    return {
      kind: "lineal",
      netM2: params.netM2,
      wastePercent: 0,
      netLinealM: lineal,
      supplyLinealM: lineal,
      formula: `No waste is stated. Supply is ${lineal} lineal m. Installation stays ${presentM2(params.netM2)} m².`,
    };
  }
  const net = round2(params.netM2);
  return {
    kind: "area",
    netM2: params.netM2,
    wastePercent: 0,
    supplyM2: net,
    formula: `No waste is stated. Supply quantity is the net ${presentM2(params.netM2)} m².`,
  };
}
