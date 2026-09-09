/**
 * WA-INTERNAL-WALLS-03 — timber partition physical takeoff.
 *
 * Owner formulas (V1):
 *   stud_count = ceil(L / S) + 1
 *   stud_lm = stud_count × height
 *   plate_lm = 2 × length
 *   nogging_rows = 2 / 3 / 4 by height
 *   nogging_lm = rows × length
 *   raw_timber_lm = studs + plates + nogs
 *   purchase_timber_lm = raw × (1 + waste)   // waste once
 *   wall_area_m2 = length × height            // not lining faces
 *
 * Not Bathroom intensity. Not 0.8 h/lm. No opening trimmers.
 */

import { round2 } from "@/lib/estimate/facts";
import {
  INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS,
  INTERNAL_WALLS_STEEL_STUD_KEY,
  INTERNAL_WALLS_STEEL_TRACK_KEY,
  INTERNAL_WALLS_STEEL_WASTE_FACTOR,
  INTERNAL_WALLS_TIMBER_140_KEY,
  INTERNAL_WALLS_TIMBER_90_KEY,
} from "@/lib/estimate/internal-walls-identities";
import {
  recommendedNoggingRows,
  recommendedStudCentresMm,
  type InternalWallsTimberSize,
  type InternalWallsWallType,
} from "@/lib/estimate/internal-walls-wall-types";

export type InternalWallsStudCentresResolution =
  | { ok: true; mm: number; spacingM: number }
  | { ok: false; reason: "missing" | "invalid" };

export type InternalWallsTimberTakeoff = {
  wallTypeId: string;
  frameSize: InternalWallsTimberSize;
  lengthLm: number;
  heightM: number;
  centresMm: number;
  spacingM: number;
  studCount: number;
  studLm: number;
  plateLm: number;
  noggingRows: 2 | 3 | 4;
  noggingLm: number;
  rawTimberLm: number;
  wasteFactor: number;
  purchaseTimberLm: number;
  wallAreaM2: number;
  labourHours: number;
  hoursPerM2: number;
  materialKey: string | null;
};

export function resolveInternalWallsStudCentres(
  type: Pick<
    InternalWallsWallType,
    "stud_centres_mm" | "stud_centres_source" | "height_m"
  >
): InternalWallsStudCentresResolution {
  if (type.stud_centres_source === "custom") {
    const mm = type.stud_centres_mm;
    if (mm == null || !Number.isFinite(mm) || mm <= 0) {
      return { ok: false, reason: "missing" };
    }
    return { ok: true, mm, spacingM: mm / 1000 };
  }
  if (
    type.stud_centres_mm != null &&
    Number.isFinite(type.stud_centres_mm) &&
    type.stud_centres_mm > 0
  ) {
    return {
      ok: true,
      mm: type.stud_centres_mm,
      spacingM: type.stud_centres_mm / 1000,
    };
  }
  if (type.height_m != null && Number.isFinite(type.height_m) && type.height_m > 0) {
    const mm = recommendedStudCentresMm(type.height_m);
    return { ok: true, mm, spacingM: mm / 1000 };
  }
  return { ok: false, reason: "missing" };
}

/**
 * Includes one stud at each end. Epsilon keeps exact multiples from
 * floating-point ceil errors (e.g. 12 / 0.6).
 */
export function internalWallsStudCount(lengthLm: number, spacingM: number): number {
  if (!(spacingM > 0) || !(lengthLm > 0)) {
    return 0;
  }
  return Math.ceil(lengthLm / spacingM - 1e-12) + 1;
}

export function internalWallsHoursPerM2(
  frameSize: InternalWallsTimberSize
): number | null {
  if (frameSize === "90x45") return INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS.timber90M2;
  if (frameSize === "140x45") return INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS.timber140M2;
  return null;
}

export function internalWallsSharedTimberKey(
  frameSize: InternalWallsTimberSize
): string | null {
  if (frameSize === "90x45") return INTERNAL_WALLS_TIMBER_90_KEY;
  if (frameSize === "140x45") return INTERNAL_WALLS_TIMBER_140_KEY;
  return null;
}

export function internalWallsTimberTakeoff(params: {
  type: InternalWallsWallType;
  centresMm: number;
  spacingM: number;
  wasteFactor: number;
  hoursPerM2?: number | null;
}): InternalWallsTimberTakeoff | null {
  const { type } = params;
  const lengthLm = type.length_lm;
  const heightM = type.height_m;
  const frameSize = type.frame_size;
  if (
    lengthLm == null ||
    heightM == null ||
    frameSize == null ||
    !(lengthLm > 0) ||
    !(heightM > 0) ||
    !(params.spacingM > 0) ||
    !(params.centresMm > 0)
  ) {
    return null;
  }

  const studCount = internalWallsStudCount(lengthLm, params.spacingM);
  const studLm = round2(studCount * heightM);
  const plateLm = round2(2 * lengthLm);
  const noggingRows = recommendedNoggingRows(heightM);
  const noggingLm = round2(noggingRows * lengthLm);
  const rawTimberLm = round2(studLm + plateLm + noggingLm);
  const wasteFactor =
    Number.isFinite(params.wasteFactor) && params.wasteFactor >= 0
      ? params.wasteFactor
      : 0;
  const purchaseTimberLm = round2(rawTimberLm * (1 + wasteFactor));
  const wallAreaM2 = round2(lengthLm * heightM);
  const hoursPerM2 =
    params.hoursPerM2 ?? internalWallsHoursPerM2(frameSize) ?? 0;
  const labourHours = round2(wallAreaM2 * hoursPerM2);

  return {
    wallTypeId: type.id,
    frameSize,
    lengthLm,
    heightM,
    centresMm: params.centresMm,
    spacingM: params.spacingM,
    studCount,
    studLm,
    plateLm,
    noggingRows,
    noggingLm,
    rawTimberLm,
    wasteFactor,
    purchaseTimberLm,
    wallAreaM2,
    labourHours,
    hoursPerM2,
    materialKey: internalWallsSharedTimberKey(frameSize),
  };
}

export function presentInternalWallsHours(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} person-hours`;
}

export function presentInternalWallsLm(value: number): string {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? `${rounded.toFixed(1)} lm` : `${rounded} lm`;
}

export function formatInternalWallsFramingTakeoff(takeoff: InternalWallsTimberTakeoff): string {
  const size = takeoff.frameSize === "140x45" ? "140×45" : takeoff.frameSize === "90x45" ? "90×45" : "timber";
  return [
    `${size} H1.2 timber`,
    `${takeoff.lengthLm} m × ${takeoff.heightM} m`,
    `${takeoff.centresMm} mm centres`,
    `${takeoff.studCount} studs`,
    `${presentInternalWallsLm(takeoff.studLm)} studs`,
    `${presentInternalWallsLm(takeoff.plateLm)} plates`,
    `${presentInternalWallsLm(takeoff.noggingLm)} nogging`,
    `${presentInternalWallsLm(takeoff.rawTimberLm)} net timber`,
    `${presentInternalWallsLm(takeoff.purchaseTimberLm)} incl. waste`,
  ].join(" · ");
}

export type InternalWallsSteelTakeoff = {
  wallTypeId: string;
  lengthLm: number;
  heightM: number;
  centresMm: number;
  spacingM: number;
  studWidthMm: number | null;
  studCount: number;
  studLm: number;
  bottomTrackLm: number;
  topTrackLm: number;
  totalTrackLm: number;
  wallAreaM2: number;
  labourHours: number;
  hoursPerM2: number;
  wasteFactor: number;
  trackMaterialKey: typeof INTERNAL_WALLS_STEEL_TRACK_KEY;
  studMaterialKey: typeof INTERNAL_WALLS_STEEL_STUD_KEY;
};

export function internalWallsSteelTakeoff(params: {
  type: InternalWallsWallType;
  centresMm: number;
  spacingM: number;
  hoursPerM2?: number | null;
}): InternalWallsSteelTakeoff | null {
  const { type } = params;
  const lengthLm = type.length_lm;
  const heightM = type.height_m;
  if (
    lengthLm == null ||
    heightM == null ||
    !(lengthLm > 0) ||
    !(heightM > 0) ||
    !(params.spacingM > 0) ||
    !(params.centresMm > 0)
  ) {
    return null;
  }

  const studCount = internalWallsStudCount(lengthLm, params.spacingM);
  const studLm = round2(studCount * heightM);
  const bottomTrackLm = round2(lengthLm);
  const topTrackLm = round2(lengthLm);
  const totalTrackLm = round2(bottomTrackLm + topTrackLm);
  const wallAreaM2 = round2(lengthLm * heightM);
  const hoursPerM2 =
    params.hoursPerM2 ?? INTERNAL_WALLS_PRODUCTIVITY_BENCHMARKS.steelTrackAndStudM2;
  const labourHours = round2(wallAreaM2 * hoursPerM2);

  return {
    wallTypeId: type.id,
    lengthLm,
    heightM,
    centresMm: params.centresMm,
    spacingM: params.spacingM,
    studWidthMm: type.steel?.stud_width_mm ?? null,
    studCount,
    studLm,
    bottomTrackLm,
    topTrackLm,
    totalTrackLm,
    wallAreaM2,
    labourHours,
    hoursPerM2,
    wasteFactor: INTERNAL_WALLS_STEEL_WASTE_FACTOR,
    trackMaterialKey: INTERNAL_WALLS_STEEL_TRACK_KEY,
    studMaterialKey: INTERNAL_WALLS_STEEL_STUD_KEY,
  };
}

export function formatInternalWallsSteelTakeoff(takeoff: InternalWallsSteelTakeoff): string {
  return [
    "Steel framing",
    `${takeoff.lengthLm} m × ${takeoff.heightM} m`,
    `${takeoff.centresMm} mm centres`,
    `Track ${presentInternalWallsLm(takeoff.totalTrackLm)} (${presentInternalWallsLm(takeoff.topTrackLm)} top + ${presentInternalWallsLm(takeoff.bottomTrackLm)} bottom)`,
    `${takeoff.studCount} studs`,
    `${takeoff.studCount} × ${takeoff.heightM} m`,
    `${presentInternalWallsLm(takeoff.studLm)} studs`,
  ].join(" · ");
}

