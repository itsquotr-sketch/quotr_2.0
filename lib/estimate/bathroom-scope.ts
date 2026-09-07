/**
 * WA-BATHROOM-02 — canonical job-scope model.
 *
 * Estimating SoT is project_facts. This module maps display / legacy values
 * to canonical ids and decides which facts/questions a scope needs.
 * It does not own tiling/plumbing/fixture money.
 */

import {
  getArrayFact,
  getBooleanFact,
  getStringFact,
} from "@/lib/estimate/facts";

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
  demolitionComponents?: readonly string[] | null;
  paintingIncluded?: boolean | null;
  stoppingIncluded?: boolean | null;
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

function strongerGeometryNeed(
  a: BathroomGeometryNeed,
  b: BathroomGeometryNeed
): BathroomGeometryNeed {
  if (a === "full" || b === "full") return "full";
  if (a === "floor" || b === "floor") return "floor";
  return "none";
}

function demolitionFinishGeometryNeed(
  flags?: BathroomGeometryFlags
): BathroomGeometryNeed {
  const comps = (flags?.demolitionComponents ?? [])
    .map((row) => parseBathroomDemolitionComponent(row))
    .filter((id): id is BathroomDemolitionComponentId => id != null);
  const demo: BathroomGeometryNeed =
    comps.includes("wall_lining") || comps.includes("ceiling")
      ? "full"
      : comps.includes("floor_finish")
        ? "floor"
        : "none";
  const finish: BathroomGeometryNeed =
    flags?.paintingIncluded === true || flags?.stoppingIncluded === true
      ? "full"
      : "none";
  return strongerGeometryNeed(demo, finish);
}

export function bathroomGeometryNeed(
  scope: BathroomJobScope | null,
  flags?: BathroomGeometryFlags
): BathroomGeometryNeed {
  if (!scope) return "none";
  const extra = demolitionFinishGeometryNeed(flags);
  switch (scope) {
    case "vanity_only":
    case "fixture_replacement":
      return extra;
    case "shower_only": {
      if (wallExtentNeedsRoomGeometry(flags?.wallTileExtent)) {
        return strongerGeometryNeed("full", extra);
      }
      if (structuralFinishNeedsFullGeometry(flags)) {
        return strongerGeometryNeed("full", extra);
      }
      if (finishNeedsFloorGeometry(flags)) {
        return strongerGeometryNeed("floor", extra);
      }
      return extra;
    }
    case "retile_floor":
      return strongerGeometryNeed(
        wallExtentNeedsRoomGeometry(flags?.wallTileExtent) ? "full" : "floor",
        extra
      );
    case "strip_out_only":
      return strongerGeometryNeed("floor", extra);
    case "reline":
    case "new_fitout":
    case "full_renovation":
      return "full";
    case "custom": {
      if (wallExtentNeedsRoomGeometry(flags?.wallTileExtent)) {
        return strongerGeometryNeed("full", extra);
      }
      if (structuralFinishNeedsFullGeometry(flags)) {
        return strongerGeometryNeed("full", extra);
      }
      if (finishNeedsFloorGeometry(flags) || flags?.tilingIncluded === true) {
        return strongerGeometryNeed("floor", extra);
      }
      return extra;
    }
    default:
      return extra;
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
  | "fixture_ownership"
  | "shower_type"
  | "plumbing"
  | "electrical"
  | "electrical_components"
  | "ventilation"
  | "linings"
  | "ceiling_lining"
  | "floor_prep"
  | "floor_substrate"
  | "underfloor_heating"
  | "framing"
  | "finish_level"
  | "trade_scope_text"
  | "finishing"
  | "legacy_renovation_type"
  | "always";

const GROUP_BY_FACT_KEY: Record<string, BathroomQuestionGroup> = {
  "bathroom.job_scope": "job_scope",
  "bathroom.demolition_required": "demolition",
  "bathroom.demolition.components": "demolition",
  "bathroom.waste.level": "demolition",
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
  "bathroom.fixture.toilet.ownership": "fixture_ownership",
  "bathroom.fixture.vanity.ownership": "fixture_ownership",
  "bathroom.fixture.basin.ownership": "fixture_ownership",
  "bathroom.fixture.shower.ownership": "fixture_ownership",
  "bathroom.fixture.shower_enclosure.ownership": "fixture_ownership",
  "bathroom.fixture.bath.ownership": "fixture_ownership",
  "bathroom.fixture.tapware.ownership": "fixture_ownership",
  "bathroom.fixture.heated_towel_rail.ownership": "fixture_ownership",
  "bathroom.fixture.mirror.ownership": "fixture_ownership",
  "bathroom.fixture.extract_fan.ownership": "fixture_ownership",
  "bathroom.fixture.accessories.ownership": "fixture_ownership",
  "bathroom.fixture.other.ownership": "fixture_ownership",
  "bathroom.shower_type": "shower_type",
  "bathroom.plumbing.level": "plumbing",
  "bathroom.plumbing_changes": "plumbing",
  "bathroom.plumbing.floor_waste_included": "plumbing",
  "bathroom.plumbing.relocation_count": "plumbing",
  "bathroom.plumbing.scope_text": "trade_scope_text",
  "bathroom.electrical.level": "electrical",
  "bathroom.electrical_changes": "electrical",
  "bathroom.electrical.light_count": "electrical_components",
  "bathroom.electrical.gpo_count": "electrical_components",
  "bathroom.electrical.mirror_power_included": "electrical_components",
  "bathroom.electrical.new_circuit_included": "electrical_components",
  "bathroom.electrical.scope_text": "trade_scope_text",
  "bathroom.stopping_included": "finishing",
  "bathroom.painting_included": "finishing",
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
  demolitionRequired?: boolean | null;
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
        flags?.demolitionRequired === true ||
        scope === "strip_out_only" ||
        scope === "reline" ||
        scope === "new_fitout" ||
        scope === "full_renovation" ||
        scope === "custom"
      );
    case "finishing":
      return (
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
    case "fixture_ownership":
      return bathroomQuestionGroupVisible("fixtures", scope, flags);
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
    case "electrical_components":
      return bathroomQuestionGroupVisible("electrical", scope, flags);
    case "trade_scope_text":
      return (
        bathroomQuestionGroupVisible("plumbing", scope, flags) ||
        bathroomQuestionGroupVisible("electrical", scope, flags)
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
export const BATHROOM_DEMOLITION_COMPONENTS_FACT_KEY =
  "bathroom.demolition.components" as const;
export const BATHROOM_WASTE_LEVEL_FACT_KEY = "bathroom.waste.level" as const;
export const BATHROOM_STOPPING_INCLUDED_FACT_KEY =
  "bathroom.stopping_included" as const;
export const BATHROOM_PAINTING_INCLUDED_FACT_KEY =
  "bathroom.painting_included" as const;

export const BATHROOM_DEMOLITION_COMPONENT_VALUES = [
  "floor_finish",
  "wall_lining",
  "ceiling",
  "vanity",
  "toilet",
  "shower",
  "bath",
  "fixture",
] as const;

export type BathroomDemolitionComponentId =
  (typeof BATHROOM_DEMOLITION_COMPONENT_VALUES)[number];

export const BATHROOM_DEMOLITION_COMPONENT_OPTIONS = [
  "Floor finish",
  "Wall lining",
  "Ceiling lining",
  "Vanity",
  "Toilet",
  "Shower / enclosure",
  "Bath",
  "Other fixtures",
] as const;

const DEMOLITION_COMPONENT_BY_NORMALISED: Record<
  string,
  BathroomDemolitionComponentId
> = {
  floor_finish: "floor_finish",
  "floor finish": "floor_finish",
  floor: "floor_finish",
  wall_lining: "wall_lining",
  "wall lining": "wall_lining",
  walls: "wall_lining",
  ceiling: "ceiling",
  "ceiling lining": "ceiling",
  vanity: "vanity",
  toilet: "toilet",
  wc: "toilet",
  shower: "shower",
  "shower enclosure": "shower",
  "shower / enclosure": "shower",
  bath: "bath",
  fixture: "fixture",
  fixtures: "fixture",
  "other fixtures": "fixture",
};

export function parseBathroomDemolitionComponent(
  value: unknown
): BathroomDemolitionComponentId | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase();
  return DEMOLITION_COMPONENT_BY_NORMALISED[lower] ?? null;
}

export function parseBathroomDemolitionComponents(params: {
  facts: readonly { key: string; work_area_id?: string | null; value: unknown }[];
  workAreaId: string;
}): BathroomDemolitionComponentId[] {
  const listed = getArrayFact(
    params.facts as never,
    params.workAreaId,
    BATHROOM_DEMOLITION_COMPONENTS_FACT_KEY
  );
  const out: BathroomDemolitionComponentId[] = [];
  for (const row of listed ?? []) {
    const id = parseBathroomDemolitionComponent(row);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function bathroomDemolitionImpliedByScope(
  scope: BathroomJobScope | null
): boolean {
  return scope === "strip_out_only";
}

export const BATHROOM_WASTE_LEVEL_VALUES = [
  "minor",
  "standard",
  "major",
] as const;
export type BathroomWasteLevel = (typeof BATHROOM_WASTE_LEVEL_VALUES)[number];

export function parseBathroomWasteLevel(
  value: unknown
): BathroomWasteLevel | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === "minor" || lower.includes("small")) return "minor";
  if (lower === "major" || lower.includes("full")) return "major";
  if (lower === "standard") return "standard";
  return null;
}

export const BATHROOM_FIXTURE_CATALOGUE = [
  "Toilet",
  "Vanity",
  "Basin",
  "Shower",
  "Shower enclosure",
  "Bath",
  "Mixer/tapware",
  "Heated towel rail",
  "Mirror/cabinet",
  "Extract fan",
  "Accessories",
  "Other",
] as const;

export const BATHROOM_FIXTURE_OWNERSHIP_OPTIONS = [
  "Supply and install",
  "Supply only",
  "Install only",
] as const;

export type BathroomFixtureOwnership = "supply" | "install" | "supply_and_install";

export type BathroomFixtureId =
  | "toilet"
  | "vanity"
  | "basin"
  | "shower"
  | "shower_enclosure"
  | "bath"
  | "tapware"
  | "heated_towel_rail"
  | "mirror"
  | "extract_fan"
  | "accessories"
  | "other";

const FIXTURE_ALIASES: Array<{ id: BathroomFixtureId; match: RegExp }> = [
  { id: "shower_enclosure", match: /enclosure|screen/ },
  { id: "heated_towel_rail", match: /heated|towel/ },
  { id: "extract_fan", match: /extract|extractor|fan/ },
  { id: "tapware", match: /tapware|mixer|tap/ },
  { id: "shower", match: /shower/ },
  { id: "toilet", match: /toilet|\bwc\b/ },
  { id: "vanity", match: /vanity/ },
  { id: "basin", match: /basin/ },
  { id: "bath", match: /\bbath\b/ },
  { id: "mirror", match: /mirror|cabinet/ },
  { id: "accessories", match: /accessor/ },
  { id: "other", match: /other/ },
];

export function parseBathroomFixtureId(value: unknown): BathroomFixtureId | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase();
  if (lower === "not sure" || lower === "unknown" || lower === "unsure") return null;
  for (const row of FIXTURE_ALIASES) {
    if (row.match.test(lower)) return row.id;
  }
  return null;
}

export function parseBathroomFixtureOwnership(
  value: unknown
): BathroomFixtureOwnership | null {
  if (value == null || value === "") return null;
  const lower = String(value).trim().toLowerCase().replace(/[_-]+/g, " ");
  if (lower === "not sure" || lower === "unknown" || lower === "unsure") return null;
  if (lower === "supply" || lower === "supply only" || lower === "supply_only") {
    return "supply";
  }
  if (
    lower === "install" ||
    lower === "install only" ||
    lower === "install_only" ||
    lower.includes("client")
  ) {
    return "install";
  }
  if (
    lower === "both" ||
    lower === "supply and install" ||
    lower === "supply_and_install"
  ) {
    return "supply_and_install";
  }
  return null;
}

export function bathroomFixtureOwnershipFactKey(id: BathroomFixtureId): string {
  return `bathroom.fixture.${id}.ownership`;
}

export function parseBathroomSelectedFixtures(params: {
  facts: readonly { key: string; work_area_id: string | null; value: unknown }[];
  workAreaId: string;
}): BathroomFixtureId[] {
  const facts = params.facts as never;
  const listed = getArrayFact(facts, params.workAreaId, "bathroom.fixtures_included");
  const ids: BathroomFixtureId[] = [];
  const seen = new Set<BathroomFixtureId>();
  const push = (id: BathroomFixtureId | null) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const row of listed) push(parseBathroomFixtureId(row));
  if (getBooleanFact(facts, params.workAreaId, "bathroom.includes_vanity")) {
    push("vanity");
  }
  if (getBooleanFact(facts, params.workAreaId, "bathroom.includes_shower")) {
    push("shower");
  }
  if (getBooleanFact(facts, params.workAreaId, "bathroom.includes_toilet")) {
    push("toilet");
  }
  if (ids.length === 0) {
    const scope = resolveBathroomJobScope({
      jobScope: getStringFact(facts, params.workAreaId, "bathroom.job_scope"),
      renovationType: getStringFact(facts, params.workAreaId, "bathroom.renovation_type"),
    });
    if (scope === "vanity_only") push("vanity");
    if (scope === "shower_only") push("shower");
  }
  return ids;
}

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
  if (params.factKey === "bathroom.demolition_required") {
    if (params.jobScope === "strip_out_only") return true;
  }
  if (params.factKey === "bathroom.waste.level") return true;
  if (
    params.factKey === "bathroom.stopping_included" ||
    params.factKey === "bathroom.painting_included"
  ) {
    return true;
  }
  if (params.factKey === "bathroom.fixtures_included") {
    if (params.jobScope === "vanity_only" || params.jobScope === "shower_only") {
      return true;
    }
  }
  if (params.factKey === "bathroom.fixtures_client_supplied") return true;
  if (params.factKey.endsWith(".ownership")) return true;
  if (
    params.factKey === "bathroom.plumbing.scope_text" ||
    params.factKey === "bathroom.electrical.scope_text" ||
    params.factKey === "bathroom.electrical.light_count" ||
    params.factKey === "bathroom.electrical.gpo_count" ||
    params.factKey === "bathroom.electrical.mirror_power_included" ||
    params.factKey === "bathroom.electrical.new_circuit_included" ||
    params.factKey === "bathroom.plumbing.floor_waste_included" ||
    params.factKey === "bathroom.plumbing.relocation_count"
  ) {
    return true;
  }
  if (params.factKey === "bathroom.plumbing_changes") return true;
  if (params.factKey === "bathroom.electrical_changes") return true;
  return false;
}

