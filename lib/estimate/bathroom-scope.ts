/**
 * WA-BATHROOM-02 — canonical job-scope model.
 *
 * Estimating SoT is project_facts. This module maps display / legacy values
 * to canonical ids and decides which facts/questions a scope needs.
 * It does not own tiling/plumbing/fixture money.
 */

export const BATHROOM_JOB_SCOPE_VALUES = [
  "strip_out_only",
  "vanity_only",
  "shower_only",
  "fixture_replacement",
  "retile_floor",
  "reline",
  "new_fitout",
  "full_renovation",
  "custom",
] as const;

export type BathroomJobScope = (typeof BATHROOM_JOB_SCOPE_VALUES)[number];

export const BATHROOM_JOB_SCOPE_FACT_KEY = "bathroom.job_scope" as const;
export const BATHROOM_RENOVATION_TYPE_FACT_KEY =
  "bathroom.renovation_type" as const;

export const BATHROOM_JOB_SCOPE_OPTIONS = [
  "Strip-out only",
  "Vanity replacement only",
  "Shower replacement only",
  "Fixture replacement",
  "Retile floor",
  "Reline bathroom",
  "New bathroom fitout",
  "Full renovation",
  "Custom / other",
  "Not sure",
] as const;

const JOB_SCOPE_BY_NORMALISED: Record<string, BathroomJobScope> = {
  strip_out_only: "strip_out_only",
  "strip-out only": "strip_out_only",
  "strip out only": "strip_out_only",
  "strip-out": "strip_out_only",
  "strip out": "strip_out_only",
  vanity_only: "vanity_only",
  replace_vanity: "vanity_only",
  "vanity replacement only": "vanity_only",
  "vanity only": "vanity_only",
  "replace vanity": "vanity_only",
  shower_only: "shower_only",
  replace_shower: "shower_only",
  "shower replacement only": "shower_only",
  "shower only": "shower_only",
  "replace shower": "shower_only",
  fixture_replacement: "fixture_replacement",
  replace_fixtures: "fixture_replacement",
  "fixture replacement": "fixture_replacement",
  "replace fixtures": "fixture_replacement",
  retile_floor: "retile_floor",
  "retile floor": "retile_floor",
  reline: "reline",
  "reline bathroom": "reline",
  new_fitout: "new_fitout",
  "new bathroom fitout": "new_fitout",
  "new fitout": "new_fitout",
  full_renovation: "full_renovation",
  "full renovation": "full_renovation",
  custom: "custom",
  "custom / other": "custom",
  "custom/other": "custom",
};

export const BATHROOM_FLOOR_FINISH_VALUES = [
  "tile",
  "sheet_vinyl",
  "vinyl_plank",
  "other",
  "none",
] as const;

export type BathroomFloorFinishSystem =
  (typeof BATHROOM_FLOOR_FINISH_VALUES)[number];

export const BATHROOM_FLOOR_FINISH_FACT_KEY =
  "bathroom.floor_finish_system" as const;

export const BATHROOM_FLOOR_FINISH_OPTIONS = [
  "Tile",
  "Sheet vinyl",
  "Vinyl plank / slat",
  "Other",
  "None",
  "Not sure",
] as const;

export const BATHROOM_WALL_TILE_EXTENT_VALUES = [
  "none",
  "shower_only",
  "half_height",
  "full_height",
  "custom",
] as const;

export type BathroomWallTileExtent =
  (typeof BATHROOM_WALL_TILE_EXTENT_VALUES)[number];

export const BATHROOM_WALL_TILE_EXTENT_OPTIONS = [
  "None",
  "Shower only",
  "Half height (1.2 m)",
  "Full height",
  "Custom area",
  "Not sure",
] as const;

export const BATHROOM_TILE_FORMAT_VALUES = [
  "600x600",
  "600x300",
  "300x300",
  "mosaic",
  "custom",
] as const;

export type BathroomTileFormat = (typeof BATHROOM_TILE_FORMAT_VALUES)[number];

export const BATHROOM_TILE_FORMAT_FACT_KEY = "bathroom.tile_format" as const;

export const BATHROOM_TILE_FORMAT_OPTIONS = [
  "600 × 600",
  "600 × 300",
  "300 × 300",
  "Mosaic",
  "Custom",
  "Not sure",
] as const;

export const BATHROOM_WATERPROOFING_EXTENT_VALUES = [
  "none",
  "floor_only",
  "floor_and_shower",
  "shower_only",
  "bath_surround",
  "custom",
] as const;

export type BathroomWaterproofingExtent =
  (typeof BATHROOM_WATERPROOFING_EXTENT_VALUES)[number];

export const BATHROOM_WATERPROOFING_EXTENT_OPTIONS = [
  "None",
  "Floor only",
  "Floor and shower",
  "Shower only",
  "Bath surround",
  "Custom area",
  "Not sure",
] as const;

export const BATHROOM_SHOWER_WIDTH_FACT_KEY = "bathroom.shower.width_m" as const;
export const BATHROOM_SHOWER_DEPTH_FACT_KEY = "bathroom.shower.depth_m" as const;
export const BATHROOM_SHOWER_WALL_HEIGHT_FACT_KEY =
  "bathroom.shower.wall_height_m" as const;
export const BATHROOM_BATH_SURROUND_AREA_FACT_KEY =
  "bathroom.bath_surround_area_m2" as const;

export const BATHROOM_FRAMING_LEVEL_VALUES = [
  "none",
  "minor",
  "standard",
  "major",
] as const;

export type BathroomFramingLevel =
  (typeof BATHROOM_FRAMING_LEVEL_VALUES)[number];

export const BATHROOM_FRAMING_LEVEL_FACT_KEY =
  "bathroom.framing_level" as const;

export const BATHROOM_FRAMING_LEVEL_OPTIONS = [
  "None",
  "Minor — a few supports/nogs",
  "Standard — several supports and local framing changes",
  "Major — extensive local bathroom framing",
  "Not sure",
] as const;

export const BATHROOM_FLOOR_SUBSTRATE_VALUES = [
  "treated_plywood",
  "fibre_cement",
  "none",
  "other",
] as const;

export type BathroomFloorSubstrateSystem =
  (typeof BATHROOM_FLOOR_SUBSTRATE_VALUES)[number];

export const BATHROOM_FLOOR_SUBSTRATE_FACT_KEY =
  "bathroom.floor_substrate_system" as const;

export const BATHROOM_FLOOR_SUBSTRATE_OPTIONS = [
  "19 mm treated plywood",
  "18 mm fibre cement",
  "Other",
  "None",
  "Not sure",
] as const;

export const BATHROOM_CEILING_LINING_FACT_KEY =
  "bathroom.ceiling_lining_included" as const;

export const BATHROOM_TRADE_LEVEL_VALUES = [
  "none",
  "minor",
  "standard",
  "major",
] as const;

export type BathroomTradeLevel = (typeof BATHROOM_TRADE_LEVEL_VALUES)[number];

export const BATHROOM_PLUMBING_LEVEL_FACT_KEY =
  "bathroom.plumbing.level" as const;
export const BATHROOM_ELECTRICAL_LEVEL_FACT_KEY =
  "bathroom.electrical.level" as const;
export const BATHROOM_PLUMBING_CHANGES_FACT_KEY =
  "bathroom.plumbing_changes" as const;
export const BATHROOM_ELECTRICAL_CHANGES_FACT_KEY =
  "bathroom.electrical_changes" as const;

export const BATHROOM_TRADE_LEVEL_OPTIONS = [
  "None",
  "Minor",
  "Standard",
  "Major",
  "Not sure",
] as const;

export type BathroomGeometryNeed = "none" | "floor" | "full";

function normaliseToken(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

export function parseBathroomJobScope(
  value: unknown
): BathroomJobScope | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  if (lower === "not sure" || lower === "unknown" || lower === "unsure") {
    return null;
  }
  if ((BATHROOM_JOB_SCOPE_VALUES as readonly string[]).includes(raw)) {
    return raw as BathroomJobScope;
  }
  const fromMap = JOB_SCOPE_BY_NORMALISED[lower] ?? JOB_SCOPE_BY_NORMALISED[normaliseToken(raw)];
  return fromMap ?? null;
}

/**
 * Dual-read legacy renovation_type when job_scope is absent.
 * Does not mutate stored facts.
 */
export function mapLegacyRenovationTypeToJobScope(
  renovationType: unknown
): BathroomJobScope | null {
  if (renovationType == null || renovationType === "") return null;
  const lower = String(renovationType).trim().toLowerCase();
  if (lower === "not sure" || lower === "unknown") return null;
  if (lower.includes("full") || lower.includes("strip") || lower.includes("rebuild")) {
    return "full_renovation";
  }
  if (lower.includes("standard")) {
    return "full_renovation";
  }
  if (lower.includes("minor") || lower.includes("refresh")) {
    return "fixture_replacement";
  }
  return parseBathroomJobScope(renovationType);
}

export function resolveBathroomJobScope(params: {
  jobScope: unknown;
  renovationType?: unknown;
}): BathroomJobScope | null {
  return (
    parseBathroomJobScope(params.jobScope) ??
    mapLegacyRenovationTypeToJobScope(params.renovationType)
  );
}

export function isMatureBathroomPath(jobScopeRaw: unknown): boolean {
  return parseBathroomJobScope(jobScopeRaw) != null;
}

export type BathroomGeometryFlags = {
  tilingIncluded?: boolean | null;
  wallLiningIncluded?: boolean | null;
  ceilingLiningIncluded?: boolean | null;
  floorPrepIncluded?: boolean | null;
  floorSubstrate?: string | null;
  waterproofingIncluded?: boolean | null;
  floorFinish?: string | null;
  wallTileExtent?: string | null;
  waterproofingExtent?: string | null;
};

function wallExtentNeedsRoomGeometry(extent: string | null | undefined): boolean {
  const parsed = parseBathroomWallTileExtent(extent);
  return parsed === "full_height" || parsed === "half_height";
}

function finishNeedsFloorGeometry(flags?: BathroomGeometryFlags): boolean {
  const finish = parseBathroomFloorFinish(flags?.floorFinish);
  if (
    finish === "tile" ||
    finish === "sheet_vinyl" ||
    finish === "vinyl_plank" ||
    finish === "other"
  ) {
    return true;
  }
  const wp = parseBathroomWaterproofingExtent(flags?.waterproofingExtent);
  return (
    wp === "floor_only" ||
    wp === "floor_and_shower" ||
    wp === "bath_surround"
  );
}

function structuralFinishNeedsFullGeometry(flags?: BathroomGeometryFlags): boolean {
  return (
    flags?.wallLiningIncluded === true ||
    flags?.ceilingLiningIncluded === true ||
    flags?.floorPrepIncluded === true ||
    Boolean(
      flags?.floorSubstrate &&
        flags.floorSubstrate !== "none" &&
        parseBathroomFloorSubstrate(flags.floorSubstrate) !== "none"
    )
  );
}

export function bathroomGeometryNeed(
  scope: BathroomJobScope | null,
  flags?: BathroomGeometryFlags
): BathroomGeometryNeed {
  if (!scope) return "none";
  switch (scope) {
    case "vanity_only":
    case "fixture_replacement":
      return "none";
    case "shower_only": {
      if (wallExtentNeedsRoomGeometry(flags?.wallTileExtent)) return "full";
      if (structuralFinishNeedsFullGeometry(flags)) return "full";
      if (finishNeedsFloorGeometry(flags)) return "floor";
      return "none";
    }
    case "retile_floor":
      return wallExtentNeedsRoomGeometry(flags?.wallTileExtent) ? "full" : "floor";
    case "strip_out_only":
      return "floor";
    case "reline":
    case "new_fitout":
    case "full_renovation":
      return "full";
    case "custom": {
      if (wallExtentNeedsRoomGeometry(flags?.wallTileExtent)) return "full";
      if (structuralFinishNeedsFullGeometry(flags)) return "full";
      if (finishNeedsFloorGeometry(flags) || flags?.tilingIncluded === true) {
        return "floor";
      }
      return "none";
    }
    default:
      return "none";
  }
}

export type BathroomQuestionGroup =
  | "job_scope"
  | "demolition"
  | "geometry"
  | "wall_height"
  | "legacy_area"
  | "floor_finish"
  | "tile_format"
  | "tiling"
  | "wall_tiling"
  | "shower_geometry"
  | "waterproofing"
  | "fixtures"
  | "shower_type"
  | "plumbing"
  | "electrical"
  | "ventilation"
  | "linings"
  | "ceiling_lining"
  | "floor_prep"
  | "floor_substrate"
  | "underfloor_heating"
  | "framing"
  | "finish_level"
  | "legacy_renovation_type"
  | "always";

const GROUP_BY_FACT_KEY: Record<string, BathroomQuestionGroup> = {
  "bathroom.job_scope": "job_scope",
  "bathroom.demolition_required": "demolition",
  "bathroom.length_m": "geometry",
  "bathroom.width_m": "geometry",
  "bathroom.wall_height_m": "wall_height",
  "bathroom.area_m2": "legacy_area",
  "bathroom.floor_finish_system": "floor_finish",
  "bathroom.tile_format": "tile_format",
  "bathroom.tiling_included": "tiling",
  "bathroom.floor_tiling_area_m2": "tiling",
  "bathroom.wall_tiling_area_m2": "wall_tiling",
  "bathroom.tile_extent": "wall_tiling",
  "bathroom.wall_tile_height": "wall_tiling",
  "bathroom.shower.width_m": "shower_geometry",
  "bathroom.shower.depth_m": "shower_geometry",
  "bathroom.shower.wall_height_m": "shower_geometry",
  "bathroom.waterproofing_included": "waterproofing",
  "bathroom.waterproofing_extent": "waterproofing",
  "bathroom.waterproofing_area_m2": "waterproofing",
  "bathroom.bath_surround_area_m2": "waterproofing",
  "bathroom.fixtures_client_supplied": "fixtures",
  "bathroom.fixtures_included": "fixtures",
  "bathroom.shower_type": "shower_type",
  "bathroom.plumbing.level": "plumbing",
  "bathroom.plumbing_changes": "plumbing",
  "bathroom.electrical.level": "electrical",
  "bathroom.electrical_changes": "electrical",
  "bathroom.ventilation_included": "ventilation",
  "bathroom.wall_lining_included": "linings",
  "bathroom.ceiling_lining_included": "ceiling_lining",
  "bathroom.floor_prep_included": "floor_prep",
  "bathroom.floor_substrate_system": "floor_substrate",
  "bathroom.underfloor_heating_included": "underfloor_heating",
  "bathroom.framing_level": "framing",
  "bathroom.finish_level": "finish_level",
  "bathroom.renovation_type": "legacy_renovation_type",
};

export function bathroomQuestionGroupForFact(
  factKey: string
): BathroomQuestionGroup | null {
  return GROUP_BY_FACT_KEY[factKey] ?? null;
}

export type BathroomQuestionFlags = {
  tilingIncluded?: boolean | null;
  wallLiningIncluded?: boolean | null;
  ceilingLiningIncluded?: boolean | null;
  floorPrepIncluded?: boolean | null;
  floorSubstrate?: string | null;
  waterproofingIncluded?: boolean | null;
  floorFinish?: string | null;
  wallTileExtent?: string | null;
  waterproofingExtent?: string | null;
};

export function bathroomQuestionGroupVisible(
  group: BathroomQuestionGroup,
  scope: BathroomJobScope | null,
  flags?: BathroomQuestionFlags
): boolean {
  if (group === "job_scope") return true;
  if (group === "always") return true;
  if (group === "legacy_renovation_type") return false;
  if (!scope) return false;

  const geometryNeed = bathroomGeometryNeed(scope, flags);

  switch (group) {
    case "demolition":
      return (
        scope === "strip_out_only" ||
        scope === "reline" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "geometry":
    case "legacy_area":
      return geometryNeed !== "none";
    case "wall_height":
      return geometryNeed === "full";
    case "floor_finish":
      return (
        scope === "retile_floor" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "tiling":
      return (
        scope === "retile_floor" ||
        scope === "shower_only" ||
        scope === "reline" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "wall_tiling":
      return (
        scope === "retile_floor" ||
        scope === "shower_only" ||
        scope === "reline" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "tile_format": {
      const finish = parseBathroomFloorFinish(flags?.floorFinish);
      const wallExtent = parseBathroomWallTileExtent(flags?.wallTileExtent);
      const wallTiled =
        wallExtent != null && wallExtent !== "none";
      return finish === "tile" || wallTiled;
    }
    case "shower_geometry": {
      const wallExtent = parseBathroomWallTileExtent(flags?.wallTileExtent);
      const wpExtent = parseBathroomWaterproofingExtent(
        flags?.waterproofingExtent
      );
      return (
        wallExtent === "shower_only" ||
        wpExtent === "shower_only" ||
        wpExtent === "floor_and_shower"
      );
    }
    case "waterproofing":
      return (
        scope === "shower_only" ||
        scope === "retile_floor" ||
        scope === "reline" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "fixtures":
      return (
        scope === "vanity_only" ||
        scope === "shower_only" ||
        scope === "fixture_replacement" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "shower_type":
      return (
        scope === "shower_only" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom" ||
        scope === "fixture_replacement"
      );
    case "plumbing":
      return (
        scope === "vanity_only" ||
        scope === "shower_only" ||
        scope === "fixture_replacement" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "electrical":
    case "ventilation":
    case "underfloor_heating":
      return (
        scope === "shower_only" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "linings":
    case "ceiling_lining":
    case "framing":
      return (
        scope === "reline" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "floor_prep":
    case "floor_substrate":
      return (
        scope === "retile_floor" ||
        scope === "reline" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "finish_level":
      return (
        scope === "reline" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom" ||
        scope === "retile_floor" ||
        scope === "fixture_replacement"
      );
    default:
      return true;
  }
}

export function parseBathroomFloorSubstrate(
  value: unknown
): BathroomFloorSubstrateSystem | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === "not sure" || lower === "unknown" || lower === "unsure") {
    return null;
  }
  if (lower === "none" || lower === "no") return "none";
  if (lower === "other") return "other";
  if (lower.includes("fibre") || lower.includes("fiber") || lower.includes("cement")) {
    return "fibre_cement";
  }
  if (
    lower.includes("ply") ||
    lower.includes("treated_plywood") ||
    lower === "treated_plywood"
  ) {
    return "treated_plywood";
  }
  if ((BATHROOM_FLOOR_SUBSTRATE_VALUES as readonly string[]).includes(lower)) {
    return lower as BathroomFloorSubstrateSystem;
  }
  return null;
}

export function parseBathroomFloorFinish(
  value: unknown
): BathroomFloorFinishSystem | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === "not sure" || lower === "unknown" || lower === "unsure") {
    return null;
  }
  if (lower === "tile" || lower.includes("tiling")) return "tile";
  if (lower.includes("sheet") && lower.includes("vinyl")) return "sheet_vinyl";
  if (lower.includes("plank") || lower.includes("slat")) return "vinyl_plank";
  if (lower === "none" || lower === "no") return "none";
  if (lower === "other") return "other";
  if ((BATHROOM_FLOOR_FINISH_VALUES as readonly string[]).includes(lower)) {
    return lower as BathroomFloorFinishSystem;
  }
  return null;
}

export function parseBathroomWallTileExtent(
  value: unknown
): BathroomWallTileExtent | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === "not sure" || lower === "unknown" || lower === "unsure") {
    return null;
  }
  if (
    lower === "none" ||
    lower === "no" ||
    lower === "floor only" ||
    lower === "floor_only"
  ) {
    return "none";
  }
  if (
    lower === "shower_only" ||
    lower.includes("shower") ||
    lower.includes("wet area")
  ) {
    return "shower_only";
  }
  if (lower === "half_height" || lower.includes("half")) return "half_height";
  if (
    lower === "full_height" ||
    lower.includes("full height") ||
    lower === "floor and walls" ||
    lower === "floor_and_walls"
  ) {
    return "full_height";
  }
  if (lower === "custom" || lower.includes("custom") || lower.includes("splashback")) {
    return "custom";
  }
  if ((BATHROOM_WALL_TILE_EXTENT_VALUES as readonly string[]).includes(lower)) {
    return lower as BathroomWallTileExtent;
  }
  return null;
}

export function parseBathroomTileFormat(
  value: unknown
): BathroomTileFormat | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase().replace(/\s+/g, "");
  if (lower === "notsure" || lower === "unknown" || lower === "unsure") {
    return null;
  }
  if (lower === "600x600" || lower === "600×600") return "600x600";
  if (lower === "600x300" || lower === "600×300") return "600x300";
  if (lower === "300x300" || lower === "300×300") return "300x300";
  if (lower.includes("mosaic")) return "mosaic";
  if (lower.includes("custom")) return "custom";
  if ((BATHROOM_TILE_FORMAT_VALUES as readonly string[]).includes(lower)) {
    return lower as BathroomTileFormat;
  }
  return null;
}

export function parseBathroomWaterproofingExtent(
  value: unknown
): BathroomWaterproofingExtent | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === "not sure" || lower === "unknown" || lower === "unsure") {
    return null;
  }
  if (lower === "none" || lower === "no") return "none";
  if (lower === "floor_only" || lower === "floor only") return "floor_only";
  if (
    lower === "floor_and_shower" ||
    lower === "floor and shower" ||
    lower === "floor and walls" ||
    lower === "floor_and_walls"
  ) {
    return "floor_and_shower";
  }
  if (
    lower === "shower_only" ||
    lower.includes("shower") ||
    lower.includes("wet area")
  ) {
    return "shower_only";
  }
  if (lower.includes("bath")) return "bath_surround";
  if (lower === "custom" || lower.includes("custom") || lower.includes("selected")) {
    return "custom";
  }
  if (
    (BATHROOM_WATERPROOFING_EXTENT_VALUES as readonly string[]).includes(lower)
  ) {
    return lower as BathroomWaterproofingExtent;
  }
  return null;
}

export function resolveBathroomWallTileExtent(params: {
  tileExtent: unknown;
  wallTileHeight?: unknown;
}): BathroomWallTileExtent | null {
  return (
    parseBathroomWallTileExtent(params.tileExtent) ??
    parseBathroomWallTileExtent(params.wallTileHeight)
  );
}

export function parseBathroomFramingLevel(
  value: unknown
): BathroomFramingLevel | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === "not sure" || lower === "unknown") return null;
  if (lower === "none" || lower === "no") return "none";
  if (lower.includes("minor")) return "minor";
  if (lower.includes("major")) return "major";
  if (lower.includes("standard")) return "standard";
  return null;
}

export function parseBathroomTradeLevel(
  value: unknown
): BathroomTradeLevel | null {
  if (value == null || value === "") return null;
  if (value === true) return "minor";
  if (value === false) return "none";
  const lower = String(value).trim().toLowerCase();
  if (lower === "not sure" || lower === "unknown") return null;
  if (
    lower === "none" ||
    lower === "no" ||
    lower.includes("by others") ||
    lower.includes("excluded") ||
    lower.includes("not included")
  ) {
    return "none";
  }
  if (lower.includes("major")) return "major";
  if (lower.includes("standard")) return "standard";
  if (lower.includes("minor") || lower === "yes" || lower === "included") {
    return "minor";
  }
  return null;
}

export function resolveBathroomTradeLevel(params: {
  canonical: unknown;
  legacy?: unknown;
}): BathroomTradeLevel | null {
  return (
    parseBathroomTradeLevel(params.canonical) ??
    parseBathroomTradeLevel(params.legacy)
  );
}

export function bathroomTradeLevelIncluded(
  level: BathroomTradeLevel | null
): boolean | null {
  if (level == null) return null;
  return level !== "none";
}

export function bathroomTradeLevelIsMajor(
  level: BathroomTradeLevel | null
): boolean {
  return level === "major";
}

/** Canonical tile extent. `bathroom.wall_tile_height` is legacy refinement only. */
export const BATHROOM_TILE_EXTENT_FACT_KEY = "bathroom.tile_extent" as const;
export const BATHROOM_WALL_TILE_HEIGHT_FACT_KEY =
  "bathroom.wall_tile_height" as const;
export const BATHROOM_WATERPROOFING_EXTENT_FACT_KEY =
  "bathroom.waterproofing_extent" as const;
export const BATHROOM_DEMOLITION_FACT_KEY =
  "bathroom.demolition_required" as const;

export const BATHROOM_FIXTURE_CATALOGUE = [
  "Toilet",
  "Shower",
  "Bath",
  "Vanity",
  "Basin",
  "Mixer/tapware",
  "Mirror/cabinet",
  "Towel rail",
  "Accessories",
  "Other",
] as const;

export function shouldHideBathroomQuestion(params: {
  factKey: string;
  jobScope: BathroomJobScope | null;
  floorAreaSatisfied: boolean;
  wallHeightKnown: boolean;
  lengthKnown: boolean;
  widthKnown: boolean;
  tilingIncluded: boolean | null;
  waterproofingIncluded: boolean | null;
  clientSuppliedFixtures: boolean | null;
  wallLiningIncluded?: boolean | null;
  ceilingLiningIncluded?: boolean | null;
  floorPrepIncluded?: boolean | null;
  floorSubstrate?: string | null;
  floorFinish?: string | null;
  wallTileExtent?: string | null;
  waterproofingExtent?: string | null;
}): boolean {
  const group = bathroomQuestionGroupForFact(params.factKey);
  if (!group) return false;
  if (group === "job_scope") return false;
  const flags: BathroomQuestionFlags = {
    tilingIncluded: params.tilingIncluded,
    waterproofingIncluded: params.waterproofingIncluded,
    wallLiningIncluded: params.wallLiningIncluded,
    ceilingLiningIncluded: params.ceilingLiningIncluded,
    floorPrepIncluded: params.floorPrepIncluded,
    floorSubstrate: params.floorSubstrate,
    floorFinish: params.floorFinish,
    wallTileExtent: params.wallTileExtent,
    waterproofingExtent: params.waterproofingExtent,
  };
  if (!bathroomQuestionGroupVisible(group, params.jobScope, flags)) return true;

  if (params.factKey === "bathroom.length_m" || params.factKey === "bathroom.width_m") {
    if (params.floorAreaSatisfied) return true;
  }
  if (params.factKey === "bathroom.length_m" && params.lengthKnown) return true;
  if (params.factKey === "bathroom.width_m" && params.widthKnown) return true;
  if (params.factKey === "bathroom.wall_height_m" && params.wallHeightKnown) {
    return true;
  }
  if (params.factKey === "bathroom.area_m2") {
    if (params.lengthKnown && params.widthKnown) return true;
    if (params.floorAreaSatisfied) return true;
  }
  if (params.factKey === "bathroom.tiling_included") {
    if (params.jobScope != null) return true;
  }
  if (params.factKey === "bathroom.wall_tile_height") {
    if (params.jobScope != null) return true;
  }
  if (params.factKey === "bathroom.floor_tiling_area_m2") {
    return true;
  }
  if (params.factKey === "bathroom.wall_tiling_area_m2") {
    return parseBathroomWallTileExtent(params.wallTileExtent) !== "custom";
  }
  if (params.factKey === "bathroom.waterproofing_extent") {
    if (params.waterproofingIncluded !== true) return true;
  }
  if (params.factKey === "bathroom.waterproofing_area_m2") {
    return parseBathroomWaterproofingExtent(params.waterproofingExtent) !== "custom";
  }
  if (params.factKey === "bathroom.bath_surround_area_m2") {
    return (
      parseBathroomWaterproofingExtent(params.waterproofingExtent) !==
      "bath_surround"
    );
  }
  if (params.factKey === "bathroom.fixtures_included") {
    if (params.clientSuppliedFixtures === true) return true;
    if (params.clientSuppliedFixtures === null) return true;
  }
  if (params.factKey === "bathroom.plumbing_changes") return true;
  if (params.factKey === "bathroom.electrical_changes") return true;
  return false;
}

