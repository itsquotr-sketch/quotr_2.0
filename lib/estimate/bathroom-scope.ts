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

export function bathroomGeometryNeed(
  scope: BathroomJobScope | null,
  flags?: {
    tilingIncluded?: boolean | null;
    wallLiningIncluded?: boolean | null;
    ceilingLiningIncluded?: boolean | null;
    floorPrepIncluded?: boolean | null;
    floorSubstrate?: string | null;
    waterproofingIncluded?: boolean | null;
    floorFinish?: string | null;
  }
): BathroomGeometryNeed {
  if (!scope) return "none";
  switch (scope) {
    case "vanity_only":
    case "fixture_replacement":
      return "none";
    case "shower_only": {
      const finishes =
        flags?.tilingIncluded === true ||
        flags?.wallLiningIncluded === true ||
        flags?.ceilingLiningIncluded === true ||
        flags?.floorPrepIncluded === true ||
        Boolean(flags?.floorSubstrate && flags.floorSubstrate !== "none") ||
        flags?.waterproofingIncluded === true ||
        Boolean(flags?.floorFinish && flags.floorFinish !== "none");
      return finishes ? "full" : "none";
    }
    case "retile_floor":
      return "floor";
    case "strip_out_only":
      return "floor";
    case "reline":
    case "new_fitout":
    case "full_renovation":
      return "full";
    case "custom": {
      const finishes =
        flags?.tilingIncluded === true ||
        flags?.wallLiningIncluded === true ||
        flags?.ceilingLiningIncluded === true ||
        flags?.floorPrepIncluded === true ||
        Boolean(flags?.floorSubstrate && flags.floorSubstrate !== "none") ||
        flags?.waterproofingIncluded === true ||
        Boolean(flags?.floorFinish && flags.floorFinish !== "none");
      return finishes ? "full" : "none";
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
  | "tiling"
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
  "bathroom.tiling_included": "tiling",
  "bathroom.floor_tiling_area_m2": "tiling",
  "bathroom.wall_tiling_area_m2": "tiling",
  "bathroom.tile_extent": "tiling",
  "bathroom.wall_tile_height": "tiling",
  "bathroom.waterproofing_included": "waterproofing",
  "bathroom.waterproofing_extent": "waterproofing",
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
  if (lower === "not sure" || lower === "unknown") return null;
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
  if (
    params.factKey === "bathroom.tile_extent" ||
    params.factKey === "bathroom.floor_tiling_area_m2" ||
    params.factKey === "bathroom.wall_tiling_area_m2" ||
    params.factKey === "bathroom.wall_tile_height"
  ) {
    if (params.tilingIncluded !== true) return true;
  }
  if (params.factKey === "bathroom.waterproofing_extent") {
    if (params.waterproofingIncluded !== true) return true;
  }
  if (params.factKey === "bathroom.fixtures_included") {
    if (params.clientSuppliedFixtures === true) return true;
    if (params.clientSuppliedFixtures === null) return true;
  }
  if (params.factKey === "bathroom.plumbing_changes") return true;
  if (params.factKey === "bathroom.electrical_changes") return true;
  return false;
}

