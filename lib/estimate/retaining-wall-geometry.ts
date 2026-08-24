/**
 * RETAINING-WALL-MATURITY-1A — shared sloping-wall geometry.
 *
 * Face area uses the trapezoid, not max-height rectangles.
 * Position-dependent lengths use H(x). Estimating geometry only —
 * not structural design.
 */

import { round2 } from "@/lib/estimate/facts";

export type RetainingWallGeometryReadiness =
  | "DETAILED_GEOMETRY_AVAILABLE"
  | "LEVEL_HEIGHT_AVAILABLE"
  | "SLOPING_HEIGHT_AVAILABLE"
  | "INSUFFICIENT_GEOMETRY";

export type RetainingWallGeometry = {
  readonly lengthM: number;
  readonly h1M: number;
  readonly h2M: number;
  readonly faceAreaM2: number;
  readonly averageHeightM: number;
  readonly maxHeightM: number;
  readonly minHeightM: number;
  readonly sloping: boolean;
  readonly readiness: Exclude<
    RetainingWallGeometryReadiness,
    "INSUFFICIENT_GEOMETRY"
  >;
};

export const RETAINING_WALL_BACKFILL_DEPTH_M = 0.3;
export const RETAINING_WALL_BACKFILL_TOP_OFFSET_M = 0.15;
/** In-place / geometric installed volume. Not a purchase quantity. */
export const RETAINING_WALL_BACKFILL_VOLUME_KIND = "IN_PLACE_GEOMETRIC";
/** Target / maximum estimating pile spacing. Generated actual spacing may be smaller. */
export const RETAINING_WALL_DEFAULT_PILE_SPACING_M = 1.2;
export const RETAINING_WALL_PILE_SPACING_KIND = "ESTIMATING_LAYOUT_ASSUMPTION";
/** Estimating heuristic only. Design or builder embedment overrides. */
export const RETAINING_WALL_TIMBER_EMBEDMENT_RATIO = 0.5;
export const RETAINING_WALL_SLEEPER_EMBEDMENT_RATIO = 0.7;
export const RETAINING_WALL_DEFAULT_HOLE_DIAMETER_M = 0.3;
export const RETAINING_WALL_MASONRY_FOOTING_WIDTH_M = 0.4;
export const RETAINING_WALL_MASONRY_FOOTING_DEPTH_M = 0.25;
export const RETAINING_WALL_MASONRY_SUBBASE_THICKNESS_M = 0.1;
export const RETAINING_WALL_CONSENT_HEIGHT_M = 1.5;

export function heightAtX(
  lengthM: number,
  h1M: number,
  h2M: number,
  xM: number
): number {
  if (!(lengthM > 0)) return h1M;
  const x = Math.min(Math.max(xM, 0), lengthM);
  return h1M + ((h2M - h1M) * x) / lengthM;
}

export function faceAreaM2(lengthM: number, h1M: number, h2M: number): number {
  return round2(lengthM * ((h1M + h2M) / 2));
}

export function averageHeightM(h1M: number, h2M: number): number {
  return round2((h1M + h2M) / 2);
}

export function classifyRetainingWallGeometryReadiness(params: {
  lengthM: number | null;
  heightM: number | null;
  heightHighM: number | null;
  heightLowM: number | null;
}): RetainingWallGeometryReadiness {
  if (params.lengthM == null || !(params.lengthM > 0)) {
    return "INSUFFICIENT_GEOMETRY";
  }
  if (params.heightHighM != null && params.heightLowM != null) {
    return params.heightHighM === params.heightLowM
      ? "LEVEL_HEIGHT_AVAILABLE"
      : "SLOPING_HEIGHT_AVAILABLE";
  }
  if (params.heightM != null && params.heightM > 0) {
    return "LEVEL_HEIGHT_AVAILABLE";
  }
  return "INSUFFICIENT_GEOMETRY";
}

export function resolveRetainingWallGeometry(params: {
  lengthM: number | null;
  heightM: number | null;
  heightHighM: number | null;
  heightLowM: number | null;
}): RetainingWallGeometry | null {
  const readiness = classifyRetainingWallGeometryReadiness(params);
  if (readiness === "INSUFFICIENT_GEOMETRY" || params.lengthM == null) {
    return null;
  }

  let h1M: number;
  let h2M: number;
  if (params.heightHighM != null && params.heightLowM != null) {
    h1M = params.heightHighM;
    h2M = params.heightLowM;
  } else if (params.heightM != null) {
    h1M = params.heightM;
    h2M = params.heightM;
  } else {
    return null;
  }

  const lengthM = params.lengthM;
  const sloping = h1M !== h2M;
  return {
    lengthM,
    h1M,
    h2M,
    faceAreaM2: faceAreaM2(lengthM, h1M, h2M),
    averageHeightM: averageHeightM(h1M, h2M),
    maxHeightM: Math.max(h1M, h2M),
    minHeightM: Math.min(h1M, h2M),
    sloping,
    readiness: sloping ? "SLOPING_HEIGHT_AVAILABLE" : "LEVEL_HEIGHT_AVAILABLE",
  };
}

/**
 * Drainage aggregate behind the wall: 300 mm deep, stopping 150 mm below
 * retained finished surface. Negative heights clip to zero.
 *
 * Result is IN-PLACE / GEOMETRIC volume. No bulking, compaction, or
 * purchase waste — those belong to 1B commercial procurement.
 */
export function backfillVolumeM3(params: {
  lengthM: number;
  h1M: number;
  h2M: number;
  depthM?: number;
  topOffsetM?: number;
}): number {
  const depthM = params.depthM ?? RETAINING_WALL_BACKFILL_DEPTH_M;
  const offset = params.topOffsetM ?? RETAINING_WALL_BACKFILL_TOP_OFFSET_M;
  const hb1 = Math.max(params.h1M - offset, 0);
  const hb2 = Math.max(params.h2M - offset, 0);
  if (hb1 === 0 && hb2 === 0) return 0;

  if (params.h1M >= offset && params.h2M >= offset) {
    return round2(depthM * params.lengthM * ((hb1 + hb2) / 2));
  }

  return round2(depthM * integratePositiveHeight(params.lengthM, hb1, hb2));
}

function integratePositiveHeight(lengthM: number, h1: number, h2: number): number {
  if (h1 >= 0 && h2 >= 0) {
    return lengthM * ((h1 + h2) / 2);
  }
  if (h1 <= 0 && h2 <= 0) return 0;
  const span = h1 - h2;
  if (span === 0) return 0;
  const zeroX = (h1 * lengthM) / span;
  const xClip = Math.min(Math.max(zeroX, 0), lengthM);
  if (h1 > 0) {
    return xClip * (h1 / 2);
  }
  return (lengthM - xClip) * (h2 / 2);
}

export function cylinderVolumeM3(diameterM: number, depthM: number): number {
  if (!(diameterM > 0) || !(depthM > 0)) return 0;
  return Math.PI * (diameterM / 2) ** 2 * depthM;
}

/**
 * Sleeper / product-length posts: ceil(L / productLength) + 1.
 * Last post is always at L. Do not use this for timber pile layout —
 * timber uses even-bay target/max spacing via timberPileLayout().
 */
export function postPositionsM(lengthM: number, spacingM: number): number[] {
  const spacing = spacingM > 0 ? spacingM : RETAINING_WALL_DEFAULT_PILE_SPACING_M;
  const count = Math.ceil(lengthM / spacing) + 1;
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (i === count - 1) {
      positions.push(round2(lengthM));
    } else {
      positions.push(round2(Math.min(i * spacing, lengthM)));
    }
  }
  return positions;
}

export function postCount(lengthM: number, spacingM: number): number {
  return postPositionsM(lengthM, spacingM).length;
}

export type TimberPileLayout = {
  readonly targetSpacingM: number;
  readonly actualSpacingM: number;
  readonly bayCount: number;
  readonly pileCount: number;
  readonly positionsM: number[];
};

/**
 * Timber estimating layout: spacing is a TARGET / MAXIMUM.
 * Bays are distributed evenly so the last bay is not a short remainder.
 * First pile at 0, last pile at L, actualSpacing <= targetSpacing.
 */
export function timberPileLayout(
  lengthM: number,
  targetSpacingM: number
): TimberPileLayout {
  const target =
    targetSpacingM > 0 ? targetSpacingM : RETAINING_WALL_DEFAULT_PILE_SPACING_M;
  if (!(lengthM > 0)) {
    return {
      targetSpacingM: target,
      actualSpacingM: target,
      bayCount: 0,
      pileCount: 0,
      positionsM: [],
    };
  }
  const bayCount = Math.max(1, Math.ceil(lengthM / target - 1e-12));
  const actualSpacingM = lengthM / bayCount;
  const positionsM: number[] = [];
  for (let i = 0; i < bayCount; i += 1) {
    positionsM.push(round2((i * lengthM) / bayCount));
  }
  positionsM.push(round2(lengthM));
  return {
    targetSpacingM: target,
    actualSpacingM,
    bayCount,
    pileCount: bayCount + 1,
    positionsM,
  };
}

export function geometryAssumptionTexts(geometry: RetainingWallGeometry): string[] {
  if (!geometry.sloping) return [];
  return [
    `Wall face area ${geometry.faceAreaM2} m² from ${geometry.lengthM} m × (${geometry.h1M} m + ${geometry.h2M} m) / 2, not a ${geometry.lengthM} × ${geometry.maxHeightM} rectangle.`,
  ];
}
