/**
 * WA-BATHROOM-03 — local bathroom nogging / fixture-support framing.
 *
 * Not a complete partition calculator. Full new walls belong to internal_walls.
 * Lineal quantity is exact derived lm — no 10% sheet waste.
 */

import {
  BATHROOM_FRAMING_INTENSITY_LM_PER_M2,
  BATHROOM_PRODUCTIVITY_BENCHMARKS,
} from "@/lib/estimate/bathroom-identities";
import type { BathroomFramingLevel } from "@/lib/estimate/bathroom-scope";

export type BathroomFramingTakeoff = {
  level: Exclude<BathroomFramingLevel, "none">;
  intensityLmPerM2: number;
  grossWallAreaM2: number;
  framingLm: number;
  labourHours: number;
};

export function bathroomFramingIntensityLmPerM2(
  level: BathroomFramingLevel
): number {
  return BATHROOM_FRAMING_INTENSITY_LM_PER_M2[level];
}

export function bathroomFramingTakeoff(params: {
  level: BathroomFramingLevel;
  grossWallAreaM2: number;
  hoursPerLm?: number;
}): BathroomFramingTakeoff | null {
  if (params.level === "none") return null;
  const intensityLmPerM2 = bathroomFramingIntensityLmPerM2(params.level);
  if (intensityLmPerM2 <= 0) return null;
  const framingLm = params.grossWallAreaM2 * intensityLmPerM2;
  const hoursPerLm =
    params.hoursPerLm ?? BATHROOM_PRODUCTIVITY_BENCHMARKS.framingLm;
  return {
    level: params.level,
    intensityLmPerM2,
    grossWallAreaM2: params.grossWallAreaM2,
    framingLm,
    labourHours: framingLm * hoursPerLm,
  };
}

export function presentBathroomLm(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded.toFixed(1)} lm` : `${rounded} lm`;
}
