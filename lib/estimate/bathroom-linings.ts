/**
 * WA-BATHROOM-03 — floor substrate, wall lining, ceiling lining physical model.
 *
 * Waste is applied once (owner-approved 10% sheet waste).
 * Sheet count = ceil(purchase area / 2.88).
 * Do not round before calculation.
 */

import {
  BATHROOM_AQUALINE_LABEL,
  BATHROOM_FIBRE_CEMENT_LABEL,
  BATHROOM_PLYWOOD_LABEL,
  BATHROOM_SHEET_AREA_M2,
  BATHROOM_SHEET_LENGTH_M,
  BATHROOM_SHEET_WASTE_FACTOR,
  BATHROOM_SHEET_WIDTH_M,
} from "@/lib/estimate/bathroom-identities";

export type BathroomSheetTakeoff = {
  physicalAreaM2: number;
  wasteFactor: number;
  purchaseAreaM2: number;
  sheetAreaM2: number;
  sheetCount: number;
  sheetLengthM: number;
  sheetWidthM: number;
};

export function bathroomSheetTakeoff(physicalAreaM2: number): BathroomSheetTakeoff {
  const purchaseAreaM2 = physicalAreaM2 * (1 + BATHROOM_SHEET_WASTE_FACTOR);
  const sheetCount = Math.ceil(purchaseAreaM2 / BATHROOM_SHEET_AREA_M2 - 1e-12);
  return {
    physicalAreaM2,
    wasteFactor: BATHROOM_SHEET_WASTE_FACTOR,
    purchaseAreaM2,
    sheetAreaM2: BATHROOM_SHEET_AREA_M2,
    sheetCount,
    sheetLengthM: BATHROOM_SHEET_LENGTH_M,
    sheetWidthM: BATHROOM_SHEET_WIDTH_M,
  };
}

export function bathroomLiningHours(
  physicalAreaM2: number,
  hoursPerM2: number
): number {
  return physicalAreaM2 * hoursPerM2;
}

export function bathroomSheetMaterialLabel(
  kind: "plywood" | "fibre_cement" | "aqualine"
): string {
  if (kind === "plywood") return BATHROOM_PLYWOOD_LABEL;
  if (kind === "fibre_cement") return BATHROOM_FIBRE_CEMENT_LABEL;
  return BATHROOM_AQUALINE_LABEL;
}

export function presentBathroomAreaM2(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded.toFixed(1)} m²` : `${rounded} m²`;
}

export function presentBathroomHours(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} person-hours`;
}
