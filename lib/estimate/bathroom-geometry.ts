/**
 * WA-BATHROOM-02 — deterministic bathroom geometry.
 *
 * AI may extract length / width / height.
 * Code owns floor, ceiling, and gross wall area.
 * Bathroom V1 does not deduct openings.
 */

import {
  getNumberFact,
  getStringFact,
  isNotSureValue,
  round2,
} from "@/lib/estimate/facts";
import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  resolvePhysicalRequirement,
  type PhysicalRequirementResolution,
} from "@/lib/estimate/physical-requirement-resolution";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  bathroomGeometryNeed,
  resolveBathroomJobScope,
  type BathroomGeometryNeed,
  type BathroomJobScope,
} from "@/lib/estimate/bathroom-scope";

export const BATHROOM_LENGTH_FACT_KEY = "bathroom.length_m" as const;
export const BATHROOM_WIDTH_FACT_KEY = "bathroom.width_m" as const;
export const BATHROOM_WALL_HEIGHT_FACT_KEY = "bathroom.wall_height_m" as const;
export const BATHROOM_FLOOR_AREA_FACT_KEY = "bathroom.floor_area_m2" as const;
export const BATHROOM_CEILING_AREA_FACT_KEY = "bathroom.ceiling_area_m2" as const;
export const BATHROOM_GROSS_WALL_AREA_FACT_KEY =
  "bathroom.gross_wall_area_m2" as const;
export const BATHROOM_LEGACY_AREA_FACT_KEY = "bathroom.area_m2" as const;
export const BATHROOM_FLOOR_TILING_AREA_FACT_KEY =
  "bathroom.floor_tiling_area_m2" as const;

export const BATHROOM_WALL_HEIGHT_ASSUMPTION_M = 2.4;
export const BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT =
  "Wall height assumed at 2.4 m.";

export const BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT =
  "Door and window openings are not currently deducted from wall area.";

export const BATHROOM_LENGTH_WIDTH_REQUIRED_MESSAGE =
  "Add the bathroom length and width so Quotr can calculate the room.";

export function disclosedWallHeightForNotSure(value: unknown): {
  value: number;
  source: "assumption";
} | null {
  if (!isNotSureValue(value)) return null;
  return {
    value: BATHROOM_WALL_HEIGHT_ASSUMPTION_M,
    source: "assumption",
  };
}

export function isDisclosedAssumptionSource(
  source: string | null | undefined
): boolean {
  return source === "assumption" || source === "default";
}

export function deriveBathroomGeometry(params: {
  lengthM: number;
  widthM: number;
  wallHeightM: number;
}): {
  floorAreaM2: number;
  ceilingAreaM2: number;
  grossWallAreaM2: number;
} {
  const floorAreaM2 = round2(params.lengthM * params.widthM);
  return {
    floorAreaM2,
    ceilingAreaM2: floorAreaM2,
    grossWallAreaM2: round2(
      2 * (params.lengthM + params.widthM) * params.wallHeightM
    ),
  };
}

export type BathroomGeometryResolution = {
  jobScope: BathroomJobScope | null;
  geometryNeed: BathroomGeometryNeed;
  lengthM: number | null;
  widthM: number | null;
  wallHeightM: number | null;
  floorAreaM2: number | null;
  ceilingAreaM2: number | null;
  grossWallAreaM2: number | null;
  floorResolution: PhysicalRequirementResolution;
  heightResolution: PhysicalRequirementResolution;
  usedLegacyArea: boolean;
  usedDirectFloorTileArea: boolean;
  assumedHeight: boolean;
  geometryRequired: boolean;
  geometrySatisfied: boolean;
};

function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveBathroomGeometry(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  tilingIncluded?: boolean | null;
  wallLiningIncluded?: boolean | null;
  ceilingLiningIncluded?: boolean | null;
  floorPrepIncluded?: boolean | null;
  floorSubstrate?: string | null;
  waterproofingIncluded?: boolean | null;
  floorFinish?: string | null;
}): BathroomGeometryResolution {
  const facts = params.facts as EstimateFact[];
  const jobScope = resolveBathroomJobScope({
    jobScope: getStringFact(facts, params.workAreaId, "bathroom.job_scope"),
    renovationType: getStringFact(
      facts,
      params.workAreaId,
      "bathroom.renovation_type"
    ),
  });
  const geometryNeed = bathroomGeometryNeed(jobScope, {
    tilingIncluded: params.tilingIncluded,
    wallLiningIncluded: params.wallLiningIncluded,
    ceilingLiningIncluded: params.ceilingLiningIncluded,
    floorPrepIncluded: params.floorPrepIncluded,
    floorSubstrate: params.floorSubstrate,
    waterproofingIncluded: params.waterproofingIncluded,
    floorFinish: params.floorFinish,
  });
  const geometryRequired = geometryNeed !== "none";

  const lengthM = positive(
    getNumberFact(facts, params.workAreaId, BATHROOM_LENGTH_FACT_KEY)
  );
  const widthM = positive(
    getNumberFact(facts, params.workAreaId, BATHROOM_WIDTH_FACT_KEY)
  );
  const storedFloorArea = positive(
    getNumberFact(facts, params.workAreaId, BATHROOM_FLOOR_AREA_FACT_KEY)
  );
  const legacyArea = positive(
    getNumberFact(facts, params.workAreaId, BATHROOM_LEGACY_AREA_FACT_KEY)
  );
  const floorTileArea = positive(
    getNumberFact(facts, params.workAreaId, BATHROOM_FLOOR_TILING_AREA_FACT_KEY)
  );

  let derivedFloor: number | null = null;
  if (lengthM != null && widthM != null) {
    derivedFloor = round2(lengthM * widthM);
  }

  const floorResolved = resolvePhysicalRequirement({
    knownValue: derivedFloor == null ? storedFloorArea : null,
    derivedValue: derivedFloor ?? undefined,
    assumptionAllowed: false,
  });

  let usedLegacyArea = false;
  let usedDirectFloorTileArea = false;
  let floorAreaM2 = floorResolved.value;
  let floorResolution = floorResolved.resolution;

  if (floorAreaM2 == null && legacyArea != null && derivedFloor == null) {
    floorAreaM2 = legacyArea;
    floorResolution = PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN;
    usedLegacyArea = true;
  }

  if (
    floorAreaM2 == null &&
    floorTileArea != null &&
    (geometryNeed === "floor" || jobScope === "retile_floor")
  ) {
    floorAreaM2 = floorTileArea;
    floorResolution = PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN;
    usedDirectFloorTileArea = true;
  }

  if (!geometryRequired) {
    floorResolution =
      floorAreaM2 != null
        ? floorResolution
        : PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN;
  } else if (floorAreaM2 == null) {
    floorResolution = PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED;
  }

  const heightFact = facts.find(
    (f) =>
      f.key === BATHROOM_WALL_HEIGHT_FACT_KEY &&
      f.work_area_id === params.workAreaId
  );
  const numericHeight = positive(
    getNumberFact(facts, params.workAreaId, BATHROOM_WALL_HEIGHT_FACT_KEY)
  );
  const assumedSource = isDisclosedAssumptionSource(heightFact?.source);
  const knownHeight =
    numericHeight != null && !assumedSource ? numericHeight : null;
  const assumptionHeight =
    numericHeight != null && assumedSource
      ? numericHeight
      : BATHROOM_WALL_HEIGHT_ASSUMPTION_M;
  const heightAllowed = geometryNeed === "full";
  const heightResolved = resolvePhysicalRequirement({
    knownValue: knownHeight,
    assumptionValue: assumptionHeight,
    assumptionAllowed: heightAllowed,
  });

  const needsHeight = geometryNeed === "full";
  const wallHeightM = needsHeight
    ? heightResolved.value
    : knownHeight ?? (assumedSource ? numericHeight : null);
  const assumedHeight =
    needsHeight &&
    heightResolved.resolution === PHYSICAL_REQUIREMENT_RESOLUTION.ASSUMED;
  const heightResolution = needsHeight
    ? heightResolved.resolution
    : knownHeight != null
      ? PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN
      : PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN;

  let ceilingAreaM2: number | null = null;
  let grossWallAreaM2: number | null = null;
  if (lengthM != null && widthM != null) {
    const derived = deriveBathroomGeometry({
      lengthM,
      widthM,
      wallHeightM: wallHeightM ?? BATHROOM_WALL_HEIGHT_ASSUMPTION_M,
    });
    ceilingAreaM2 = derived.ceilingAreaM2;
    if (wallHeightM != null) {
      grossWallAreaM2 = derived.grossWallAreaM2;
    }
  } else if (floorAreaM2 != null) {
    ceilingAreaM2 = floorAreaM2;
  }

  const geometrySatisfied =
    !geometryRequired ||
    (floorAreaM2 != null &&
      (geometryNeed === "floor" || wallHeightM != null));

  return {
    jobScope,
    geometryNeed,
    lengthM,
    widthM,
    wallHeightM,
    floorAreaM2,
    ceilingAreaM2,
    grossWallAreaM2,
    floorResolution,
    heightResolution,
    usedLegacyArea,
    usedDirectFloorTileArea,
    assumedHeight: Boolean(assumedHeight),
    geometryRequired,
    geometrySatisfied,
  };
}
