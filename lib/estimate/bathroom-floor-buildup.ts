/**
 * WA-BATHROOM-POLISH-01 — tiled bathroom floor build-up layers.
 *
 * LAYER 1 structural XOR: plywood OR 19 mm FC flooring OR Secura OR none/other/legacy 18 mm FC.
 * LAYER 2 tile underlay: derived when 19 mm plywood + tile finish.
 * LAYER 3 floor finish: owned by bathroom-finishes (WA-BATHROOM-04).
 */

import {
  BATHROOM_FC_19MM_TILE_READY_STATEMENT,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
  BATHROOM_LEGACY_18MM_FC_STATEMENT,
  BATHROOM_SECURA_TILE_READY_STATEMENT,
  BATHROOM_TILE_UNDERLAY_6MM_KEY,
  BATHROOM_TILE_UNDERLAY_6MM_LABEL,
  BATHROOM_TILE_UNDERLAY_DERIVED_STATEMENT,
  BATHROOM_TILE_UNDERLAY_SHEET_AREA_M2,
  BATHROOM_TILE_UNDERLAY_SHEET_LENGTH_M,
  BATHROOM_TILE_UNDERLAY_SHEET_WIDTH_M,
} from "@/lib/estimate/bathroom-identities";
import { bathroomSheetTakeoff } from "@/lib/estimate/bathroom-linings";
import {
  parseBathroomFcFlooringSheetSize,
  parseBathroomFloorFinish,
  parseBathroomFloorSubstrate,
  type BathroomFcFlooringSheetSize,
  type BathroomFloorFinishSystem,
} from "@/lib/estimate/bathroom-scope";

export const BATHROOM_FC_19MM_SHEET_AREA_M2 = 1.62;
export const BATHROOM_SECURA_SHEET_AREA_M2 = 1.44;
export const BATHROOM_TILE_UNDERLAY_SHEET = {
  lengthM: BATHROOM_TILE_UNDERLAY_SHEET_LENGTH_M,
  widthM: BATHROOM_TILE_UNDERLAY_SHEET_WIDTH_M,
} as const;

export type BathroomStructuralFloorKind =
  | "treated_plywood"
  | "fibre_cement"
  | "fibre_cement_flooring_19mm"
  | "secura_flooring"
  | "none"
  | "other";

export type BathroomFloorBuildUp = {
  structural: BathroomStructuralFloorKind | null;
  structuralAssumedPlywood: boolean;
  fcSheetSize: BathroomFcFlooringSheetSize | null;
  tileUnderlayRequired: boolean;
  floorFinish: BathroomFloorFinishSystem | null;
  assumptions: string[];
};

export function bathroomPlywoodRequiresTileUnderlay(params: {
  structural: BathroomStructuralFloorKind | null;
  floorFinish: BathroomFloorFinishSystem | null;
}): boolean {
  return params.structural === "treated_plywood" && params.floorFinish === "tile";
}

export function resolveBathroomFloorBuildUp(params: {
  substrateRaw: unknown;
  sheetSizeRaw?: unknown;
  floorFinishRaw: unknown;
  stripOutOnly?: boolean;
}): BathroomFloorBuildUp {
  const assumptions: string[] = [];
  const floorFinish = parseBathroomFloorFinish(params.floorFinishRaw);
  const assumedPlywood =
    !params.stripOutOnly &&
    typeof params.substrateRaw === "string" &&
    /not sure|unknown|unsure/i.test(params.substrateRaw.trim());
  const structural = assumedPlywood
    ? "treated_plywood"
    : parseBathroomFloorSubstrate(params.substrateRaw);
  const fcSheetSize = parseBathroomFcFlooringSheetSize(params.sheetSizeRaw);

  if (structural === "fibre_cement") {
    assumptions.push(BATHROOM_LEGACY_18MM_FC_STATEMENT);
  }
  if (structural === "fibre_cement_flooring_19mm" && floorFinish === "tile") {
    assumptions.push(BATHROOM_FC_19MM_TILE_READY_STATEMENT);
  }
  if (structural === "secura_flooring" && floorFinish === "tile") {
    assumptions.push(BATHROOM_SECURA_TILE_READY_STATEMENT);
  }

  const tileUnderlayRequired = bathroomPlywoodRequiresTileUnderlay({
    structural,
    floorFinish,
  });
  if (tileUnderlayRequired) {
    assumptions.push(BATHROOM_TILE_UNDERLAY_DERIVED_STATEMENT);
  }

  return {
    structural,
    structuralAssumedPlywood: assumedPlywood,
    fcSheetSize,
    tileUnderlayRequired,
    floorFinish,
    assumptions,
  };
}

export function bathroomStructuralMaterialIdentity(params: {
  structural: BathroomStructuralFloorKind;
  fcSheetSize: BathroomFcFlooringSheetSize | null;
}): { itemKey: string; label: string; sheet: { lengthM: number; widthM: number } | null } | null {
  if (params.structural === "treated_plywood") {
    return {
      itemKey: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
      label: "19 mm H3.2 treated plywood",
      sheet: { lengthM: 2.4, widthM: 1.2 },
    };
  }
  if (params.structural === "fibre_cement") {
    return {
      itemKey: BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
      label: "18 mm fibre cement sheet",
      sheet: { lengthM: 2.4, widthM: 1.2 },
    };
  }
  if (params.structural === "fibre_cement_flooring_19mm") {
    if (params.fcSheetSize === "1800x900") {
      return {
        itemKey: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
        label: "19 mm fibre-cement flooring 1800 × 900",
        sheet: { lengthM: 1.8, widthM: 0.9 },
      };
    }
    if (params.fcSheetSize === "2700x600") {
      return {
        itemKey: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
        label: "19 mm fibre-cement flooring 2700 × 600",
        sheet: { lengthM: 2.7, widthM: 0.6 },
      };
    }
    return {
      itemKey: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
      label: "19 mm fibre-cement flooring",
      sheet: { lengthM: 2.7, widthM: 0.6 },
    };
  }
  if (params.structural === "secura_flooring") {
    return {
      itemKey: BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
      label: "Secura flooring 2400 × 600",
      sheet: { lengthM: 2.4, widthM: 0.6 },
    };
  }
  return null;
}

export function bathroomStructuralSheetTakeoff(
  floorAreaM2: number,
  sheet: { lengthM: number; widthM: number }
) {
  return bathroomSheetTakeoff(floorAreaM2, sheet);
}

export function bathroomTileUnderlayIdentity() {
  return {
    itemKey: BATHROOM_TILE_UNDERLAY_6MM_KEY,
    label: BATHROOM_TILE_UNDERLAY_6MM_LABEL,
    sheet: {
      lengthM: BATHROOM_TILE_UNDERLAY_SHEET.lengthM,
      widthM: BATHROOM_TILE_UNDERLAY_SHEET.widthM,
    },
    sheetAreaM2: BATHROOM_TILE_UNDERLAY_SHEET_AREA_M2,
  };
}
