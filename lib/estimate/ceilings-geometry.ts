/**
 * CEILINGS WA-04A — Portion geometry takeoff.
 *
 * Derives area and perimeter at calculation time. Does not persist
 * derived values back onto project facts.
 *
 * Area-only never invents length, width, perimeter, or framing layout.
 */

import { round2 } from "@/lib/estimate/facts";
import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  type PhysicalRequirementResolution,
} from "@/lib/estimate/physical-requirement-resolution";
import type {
  CeilingGeometry,
  CeilingGeometryMode,
  CeilingPortion,
  CeilingStructureFamily,
} from "@/lib/estimate/ceilings-portions";

export const CEILING_FAMILIES_REQUIRING_LENGTH_WIDTH = [
  "timber_direct_fix",
  "steel_direct_fix",
  "suspended_steel",
] as const;

export type CeilingGeometryStatus = "ok" | "information_required" | "invalid";

export type CeilingGeometryTakeoff = {
  readonly mode: CeilingGeometryMode | null;
  readonly length_m: number | null;
  readonly width_m: number | null;
  readonly area_m2: number | null;
  readonly perimeter_lm: number | null;
  readonly resolution: PhysicalRequirementResolution;
  readonly status: CeilingGeometryStatus;
  readonly reason: string | null;
};

function inspectNumber(value: unknown): "missing" | "invalid" | "ok" {
  if (value == null) return "missing";
  if (typeof value !== "number") return "invalid";
  if (!Number.isFinite(value)) return "invalid";
  if (value <= 0) return "invalid";
  return "ok";
}

export function ceilingFamilyRequiresLengthWidth(
  family: CeilingStructureFamily | null | undefined
): boolean {
  return (
    family === "timber_direct_fix" ||
    family === "steel_direct_fix" ||
    family === "suspended_steel"
  );
}

export function deriveCeilingGeometry(
  portion: Pick<CeilingPortion, "geometry" | "structure">
): CeilingGeometryTakeoff {
  const geometry: CeilingGeometry = portion.geometry;
  const lengthState = inspectNumber(geometry.length_m);
  const widthState = inspectNumber(geometry.width_m);
  const areaState = inspectNumber(geometry.area_m2);

  if (
    lengthState === "invalid" ||
    widthState === "invalid" ||
    areaState === "invalid"
  ) {
    return {
      mode: geometry.mode ?? null,
      length_m: null,
      width_m: null,
      area_m2: null,
      perimeter_lm: null,
      resolution: PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
      status: "invalid",
      reason: "Ceiling geometry is not a valid positive finite measurement.",
    };
  }

  if (lengthState === "ok" && widthState === "missing") {
    return {
      mode: geometry.mode ?? null,
      length_m: geometry.length_m,
      width_m: null,
      area_m2: null,
      perimeter_lm: null,
      resolution: PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
      status: "invalid",
      reason: "Length is present without width.",
    };
  }
  if (widthState === "ok" && lengthState === "missing") {
    return {
      mode: geometry.mode ?? null,
      length_m: null,
      width_m: geometry.width_m,
      area_m2: null,
      perimeter_lm: null,
      resolution: PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
      status: "invalid",
      reason: "Width is present without length.",
    };
  }

  if (lengthState === "ok" && widthState === "ok") {
    const length_m = geometry.length_m as number;
    const width_m = geometry.width_m as number;
    return {
      mode: "length_width",
      length_m,
      width_m,
      area_m2: round2(length_m * width_m),
      perimeter_lm: round2(2 * (length_m + width_m)),
      resolution: PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED,
      status: "ok",
      reason: null,
    };
  }

  if (areaState === "ok") {
    const family = portion.structure.family;
    if (ceilingFamilyRequiresLengthWidth(family)) {
      return {
        mode: "area_only",
        length_m: null,
        width_m: null,
        area_m2: geometry.area_m2,
        perimeter_lm: null,
        resolution: PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
        status: "information_required",
        reason:
          "This ceiling structure needs length and width. Area alone is not enough.",
      };
    }
    return {
      mode: "area_only",
      length_m: null,
      width_m: null,
      area_m2: geometry.area_m2,
      perimeter_lm: null,
      resolution: PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN,
      status: "ok",
      reason: null,
    };
  }

  return {
    mode: geometry.mode ?? null,
    length_m: null,
    width_m: null,
    area_m2: null,
    perimeter_lm: null,
    resolution: PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED,
    status: "information_required",
    reason: "Ceiling geometry is not complete.",
  };
}
