/**
 * WA-BATHROOM-03 — floor substrate, wall lining, ceiling lining physical model.
 *
 * Waste is applied once (owner-approved 10% sheet waste).
 * Sheet count = ceil(purchase area / 2.88).
 * Do not round before calculation.
 */

import {
  BATHROOM_AQUALINE_LABEL,
  BATHROOM_FC_FLOORING_19MM_LABEL,
  BATHROOM_FIBRE_CEMENT_LABEL,
  BATHROOM_PLYWOOD_LABEL,
  BATHROOM_SECURA_LABEL,
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

export function bathroomSheetTakeoff(
  physicalAreaM2: number,
  sheet?: { lengthM: number; widthM: number }
): BathroomSheetTakeoff {
  const sheetLengthM = sheet?.lengthM ?? BATHROOM_SHEET_LENGTH_M;
  const sheetWidthM = sheet?.widthM ?? BATHROOM_SHEET_WIDTH_M;
  const sheetAreaM2 = sheetLengthM * sheetWidthM;
  const purchaseAreaM2 = physicalAreaM2 * (1 + BATHROOM_SHEET_WASTE_FACTOR);
  const sheetCount = Math.ceil(purchaseAreaM2 / sheetAreaM2 - 1e-12);
  return {
    physicalAreaM2,
    wasteFactor: BATHROOM_SHEET_WASTE_FACTOR,
    purchaseAreaM2,
    sheetAreaM2,
    sheetCount,
    sheetLengthM,
    sheetWidthM,
  };
}

export function bathroomLiningHours(
  physicalAreaM2: number,
  hoursPerM2: number
): number {
  return physicalAreaM2 * hoursPerM2;
}

export function bathroomSheetMaterialLabel(
  kind: "plywood" | "fibre_cement" | "aqualine" | "fibre_cement_flooring_19mm" | "secura_flooring"
): string {
  if (kind === "plywood") return BATHROOM_PLYWOOD_LABEL;
  if (kind === "fibre_cement") return BATHROOM_FIBRE_CEMENT_LABEL;
  if (kind === "fibre_cement_flooring_19mm") return BATHROOM_FC_FLOORING_19MM_LABEL;
  if (kind === "secura_flooring") return BATHROOM_SECURA_LABEL;
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
