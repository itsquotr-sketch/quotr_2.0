import {
  factHasValue,
  getFactValue,
  toPositiveNumber,
  type ProjectFactRecord,
} from "@/lib/scopes/fact-values";
import { isNotSureValue } from "@/lib/scopes/fact-labels";
import type { ScopeQuestionTemplate } from "@/lib/scopes/types";

type FactLookup = Map<string, ProjectFactRecord>;

function lookupValue(
  lookup: FactLookup,
  workAreaId: string,
  key: string
): unknown {
  return getFactValue(lookup, workAreaId, key);
}

function boolFact(
  lookup: FactLookup,
  workAreaId: string,
  key: string
): boolean | null {
  const value = lookupValue(lookup, workAreaId, key);
  if (!factHasValue(value) || isNotSureValue(value)) return null;
  if (value === true || value === "true" || value === "Yes" || value === "yes") {
    return true;
  }
  if (value === false || value === "false" || value === "No" || value === "no") {
    return false;
  }
  return null;
}

function numFact(
  lookup: FactLookup,
  workAreaId: string,
  key: string
): number | null {
  return toPositiveNumber(lookupValue(lookup, workAreaId, key));
}

function strFact(
  lookup: FactLookup,
  workAreaId: string,
  key: string
): string | null {
  const value = lookupValue(lookup, workAreaId, key);
  if (!factHasValue(value) || isNotSureValue(value)) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function hasAnswer(lookup: FactLookup, workAreaId: string, key: string): boolean {
  const value = lookupValue(lookup, workAreaId, key);
  return factHasValue(value) && !isNotSureValue(value);
}

function deckHeightM(lookup: FactLookup, workAreaId: string): number | null {
  const direct = numFact(lookup, workAreaId, "deck.height_m");
  if (direct !== null) return direct;
  const level = strFact(lookup, workAreaId, "deck.level");
  if (!level) return null;
  if (level.toLowerCase().includes("ground")) return 0;
  if (level.toLowerCase().includes("elevated")) return 0.5;
  return null;
}

function paintingLocation(
  lookup: FactLookup,
  workAreaId: string
): string | null {
  return strFact(lookup, workAreaId, "painting.location");
}

function includesPaintingInternal(location: string | null): boolean {
  if (!location) return false;
  const lower = location.toLowerCase();
  return lower.includes("internal") || lower === "both";
}

function includesPaintingExternal(location: string | null): boolean {
  if (!location) return false;
  const lower = location.toLowerCase();
  return lower.includes("external") || lower === "both";
}

function isPlasterboardLining(value: string | null): boolean {
  if (!value) return false;
  return value.toLowerCase().includes("plasterboard");
}

/**
 * Returns true when a template question should be hidden (not asked).
 */
export function shouldHideConditionalQuestion(
  template: ScopeQuestionTemplate,
  workAreaId: string,
  lookup: FactLookup
): boolean {
  const key = template.factKey;

  if (key === "deck.stairs_required") {
    return true;
  }

  if (key === "deck.access_type") {
    const height = deckHeightM(lookup, workAreaId);
    if (height !== null && height <= 0.2) return true;
    return false;
  }

  if (key === "deck.balustrade_required" || key === "deck.has_balustrade") {
    const height = deckHeightM(lookup, workAreaId);
    if (height !== null && height <= 1) return true;
    return false;
  }

  if (key === "deck.vertical_face_board_length_lm") {
    const required = boolFact(lookup, workAreaId, "deck.vertical_face_boards_required");
    if (required === false) return true;
    if (required === null) return true;
    return false;
  }

  if (key === "retaining_wall.height_m") {
    const heightFact = lookup.get(`${workAreaId}:retaining_wall.height_m`);
    if (heightFact?.source === "derived") return true;
    const isRaking = boolFact(lookup, workAreaId, "retaining_wall.is_raking");
    if (isRaking === true) {
      const high = numFact(lookup, workAreaId, "retaining_wall.height_high_m");
      const low = numFact(lookup, workAreaId, "retaining_wall.height_low_m");
      if (high !== null && low !== null) return true;
    }
    return false;
  }

  if (
    key === "retaining_wall.height_high_m" ||
    key === "retaining_wall.height_low_m"
  ) {
    const isRaking = boolFact(lookup, workAreaId, "retaining_wall.is_raking");
    if (isRaking === false) return true;
    if (isRaking === null) return true;
    return false;
  }

  if (
    key === "retaining_wall.backfill_height_m" ||
    key === "retaining_wall.backfill_depth_m" ||
    key === "retaining_wall.backfill_length_m"
  ) {
    const included = boolFact(lookup, workAreaId, "retaining_wall.backfill_included");
    if (included === false) return true;
    if (included === null) return true;
    return false;
  }

  if (key === "retaining_wall.drain_connection_required") {
    const drainage = boolFact(lookup, workAreaId, "retaining_wall.drainage_required");
    if (drainage === false) return true;
    if (drainage === null) return true;
    return false;
  }

  if (key === "bathroom.fixtures_included") {
    const clientSupplied = boolFact(
      lookup,
      workAreaId,
      "bathroom.fixtures_client_supplied"
    );
    if (clientSupplied === true) return true;
    if (clientSupplied === null) return true;
    return false;
  }

  if (
    key === "bathroom.floor_tiling_area_m2" ||
    key === "bathroom.wall_tiling_area_m2"
  ) {
    const tiling = boolFact(lookup, workAreaId, "bathroom.tiling_included");
    if (tiling === false) return true;
    if (tiling === null) return true;
    return false;
  }

  if (key === "kitchen.flooring_area_m2" || key === "kitchen.flooring_type") {
    const included = boolFact(lookup, workAreaId, "kitchen.flooring_included");
    if (included === false) return true;
    if (included === null) return true;
    return false;
  }

  if (key === "doors.frames_included" || key === "doors.hardware_install_included") {
    const prehung = boolFact(lookup, workAreaId, "doors.prehung");
    if (prehung === true) return true;
    if (prehung === null) return true;
    return false;
  }

  if (key === "internal_walls.plasterboard_type") {
    const lining = strFact(lookup, workAreaId, "internal_walls.wall_lining_type");
    if (!lining) return true;
    if (!isPlasterboardLining(lining)) return true;
    return false;
  }

  if (key === "internal_walls.skirting_length_lm") {
    const included = boolFact(lookup, workAreaId, "internal_walls.skirtings_included");
    if (included === false) return true;
    if (included === null) return true;
    return false;
  }

  if (key === "ceilings.plasterboard_type") {
    const ceilingType = strFact(lookup, workAreaId, "ceilings.ceiling_type");
    if (!ceilingType) return true;
    if (!isPlasterboardLining(ceilingType)) return true;
    return false;
  }

  if (key === "ceilings.edge_lining_length_lm") {
    const edgeType = strFact(lookup, workAreaId, "ceilings.edge_lining_type");
    if (!edgeType) return true;
    if (edgeType.toLowerCase() === "none") return true;
    return false;
  }

  if (key === "painting.internal_area_m2") {
    const location = paintingLocation(lookup, workAreaId);
    if (!location) return true;
    if (!includesPaintingInternal(location)) return true;
    return false;
  }

  if (key === "painting.external_area_m2") {
    const location = paintingLocation(lookup, workAreaId);
    if (!location) return true;
    if (!includesPaintingExternal(location)) return true;
    return false;
  }

  if (key === "painting.door_count") {
    const included = boolFact(lookup, workAreaId, "painting.door_painting_included");
    if (included === false) return true;
    if (included === null) return true;
    return false;
  }

  if (key === "painting.joinery_surround_length_lm") {
    const required = boolFact(
      lookup,
      workAreaId,
      "painting.joinery_surround_painting_required"
    );
    if (required === false) return true;
    if (required === null) return true;
    return false;
  }

  if (key === "flooring.stair_count" || key === "flooring.landing_area_m2") {
    const included = boolFact(
      lookup,
      workAreaId,
      "flooring.stairs_or_landings_included"
    );
    if (included === false) return true;
    if (included === null) return true;
    return false;
  }

  return false;
}

export function isQuestionAnswered(
  lookup: FactLookup,
  workAreaId: string,
  factKey: string
): boolean {
  const value = lookupValue(lookup, workAreaId, factKey);
  if (!factHasValue(value)) return false;
  if (isNotSureValue(value)) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}
