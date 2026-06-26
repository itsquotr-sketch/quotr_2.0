import type { AIExtractionOutput } from "@/lib/ai/schema";
import { getCanonicalFactKey } from "@/lib/scopes/fact-labels";
import {
  DERIVED_FACT_KEYS,
  inferUnitFromFactKey,
  normalizeCanonicalFactKey,
} from "@/lib/scopes/fact-keys";
import { roundToTwoDecimals, toPositiveNumber } from "@/lib/scopes/fact-values";

const FORBIDDEN_PRICING_KEY_FRAGMENTS = [
  "price",
  "cost",
  "recommended_cost",
  "recommended_sell",
  "sell",
  "quote_total",
  "margin",
  "markup",
  "rate",
  "hourly_rate",
  "unit_rate",
];

function normaliseString(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function coerceCoatsValue(value: unknown): string | unknown {
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (lower === "two coats" || lower === "2 coats" || lower === "two coat") {
    return "2";
  }
  if (lower === "one coat" || lower === "1 coat") {
    return "1";
  }
  if (lower === "three coats" || lower === "3 coats") {
    return "3";
  }
  const bare = lower.match(/^(\d+)\s*coats?$/);
  if (bare) {
    return bare[1];
  }
  return value;
}

function normaliseTradeChangesValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (
    includesAny(lower, [
      "by others",
      "by other",
      "others",
      "excluded",
      "not included",
      "not in scope",
      "client arranged",
    ])
  ) {
    return "None";
  }
  if (
    lower === "yes" ||
    lower === "included" ||
    lower === "in scope" ||
    lower === "required"
  ) {
    return "Minor";
  }
  if (includesAny(lower, ["minor", "small", "limited"])) {
    return "Minor";
  }
  if (includesAny(lower, ["major", "full", "significant", "new"])) {
    return "Major";
  }
  return value;
}

function normaliseRenovationType(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (
    includesAny(lower, [
      "full",
      "full renovation",
      "full reno",
      "full_renovation",
      "strip-out and rebuild",
      "strip out and rebuild",
    ])
  ) {
    return "Full strip-out and rebuild";
  }
  if (includesAny(lower, ["minor", "refresh", "cosmetic"])) {
    return "Minor refresh";
  }
  return value;
}

function normalisePrepLevel(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["minor", "light", "minimal"])) {
    return "Light";
  }
  if (includesAny(lower, ["heavy", "full prep", "significant"])) {
    return "Heavy";
  }
  if (includesAny(lower, ["standard", "moderate", "normal"])) {
    return "Standard";
  }
  return value;
}

function normalisePlasteringLevel(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  const levelMatch = lower.match(/level\s*(\d+)/);
  if (levelMatch) {
    return `Level ${levelMatch[1]}`;
  }
  return value;
}

function normaliseClientSupplied(value: unknown): boolean | unknown {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (
    includesAny(lower, [
      "client supplied",
      "client-supplied",
      "client supplying",
      "supplied by client",
      "owner supplied",
      "owner-supplied",
    ])
  ) {
    return true;
  }
  if (includesAny(lower, ["install only", "install-only"])) {
    return true;
  }
  return value;
}

function normaliseSupplyScope(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (
    includesAny(lower, [
      "supply and install",
      "supply & install",
      "supply/install",
      "supply_and_install",
    ])
  ) {
    return "Supply and install";
  }
  if (includesAny(lower, ["install only", "install-only", "install_only"])) {
    return "Install only";
  }
  if (
    includesAny(lower, [
      "removal only",
      "removal-only",
      "removal_only",
      "remove only",
      "uplift only",
    ])
  ) {
    return "Removal only";
  }
  return value;
}

function normaliseLiningSides(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["both sides", "both side", "two sides", "both"])) {
    return "Both sides";
  }
  if (includesAny(lower, ["one side", "single side", "one"])) {
    return "One side";
  }
  return value;
}

function normaliseWallLining(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["gib", "plasterboard", "drywall"])) {
    return "Plasterboard";
  }
  return value;
}

function normalisePlasterboardType(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["aqualine", "wet area", "wet-area"])) {
    return "Aqualine";
  }
  if (includesAny(lower, ["fyreline", "fire rated", "fire-rated"])) {
    return "Fyreline";
  }
  if (includesAny(lower, ["braceline", "bracing"])) {
    return "Braceline";
  }
  if (includesAny(lower, ["standard", "13mm", "10mm"])) {
    return "Standard";
  }
  return value;
}

function normaliseShowerType(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (
    includesAny(lower, [
      "tiled shower",
      "tiled_shower",
      "walk-in tiled",
      "walk in tiled",
      "walk_in_tiled_shower",
    ])
  ) {
    return "Tiled shower";
  }
  return value;
}

function normaliseDoorType(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["solid core", "solid_core", "solid-core"])) {
    return "Solid core";
  }
  return value;
}

function normaliseFlooringType(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (lower.includes("vinyl")) {
    return "Vinyl";
  }
  if (lower.includes("carpet")) {
    return "Carpet";
  }
  if (lower.includes("laminate")) {
    return "Laminate";
  }
  if (lower.includes("hardwood") || lower.includes("timber")) {
    return "Hardwood/timber";
  }
  return value;
}

function normaliseDeckBoardMaterial(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (lower.includes("kwila")) {
    return "Kwila";
  }
  if (includesAny(lower, ["hardwood", "hard wood"])) {
    return "Hardwood";
  }
  if (lower.includes("treated")) {
    return "Treated Pine";
  }
  if (lower.includes("composite")) {
    return "Composite";
  }
  return value;
}

function normaliseDeckLevel(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["ground level", "ground-level", "ground_level", "at ground"])) {
    return "Ground-level";
  }
  if (lower.includes("elevated")) {
    return "Elevated";
  }
  return value;
}

function normaliseDeckAccessType(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value ? "Stair set" : "None";
  }
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (
    includesAny(lower, [
      "no stair",
      "no stairs",
      "without stair",
      "without stairs",
      "none",
      "no access",
    ])
  ) {
    return "None";
  }
  if (includesAny(lower, ["stair set", "stairs", "staircase"])) {
    return "Stair set";
  }
  if (includesAny(lower, ["single step", "step-down", "step down"])) {
    return "Single step or step-down";
  }
  if (includesAny(lower, ["multiple sides", "multi side"])) {
    return "Multiple sides step-down";
  }
  return value;
}

function normaliseFixingType(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["face fixed", "face-fixed", "face_fixed"])) {
    return "Face-fixed";
  }
  if (lower.includes("standard") || lower.includes("post")) {
    return "Standard";
  }
  return value;
}

function normaliseIsRaking(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["raking", "raked", "sloping", "stepped"])) {
    return true;
  }
  if (includesAny(lower, ["straight", "level", "uniform", "not raking"])) {
    return false;
  }
  return value;
}

function coerceBoardWidthMm(value: unknown): unknown {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  const match = value.match(/(\d+)\s*mm?/i);
  if (match) {
    return match[1];
  }
  const bare = value.trim();
  if (/^\d+$/.test(bare)) {
    return bare;
  }
  return value;
}

function inferNegativeBooleanFromPhrase(
  value: unknown,
  key: string
): boolean | unknown {
  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);

  if (
    key.endsWith("_included") ||
    key.endsWith("_required") ||
    key.endsWith("_removal") ||
    key.endsWith(".existing_deck_removal") ||
    key.endsWith(".demolition_required")
  ) {
    if (includesAny(lower, ["no new flooring", "removal only", "remove only"])) {
      return value;
    }
    if (
      lower === "no" ||
      lower === "false" ||
      lower === "none" ||
      includesAny(lower, [
        "not included",
        "not required",
        "excluded",
        "without balustrade",
        "without handrail",
        "no balustrade",
        "no handrail",
      ])
    ) {
      return false;
    }
    if (lower.startsWith("no ") && !lower.includes("new flooring")) {
      return false;
    }
  }

  if (
    key.endsWith(".balustrade_required") ||
    key.endsWith(".balustrade_included") ||
    key.endsWith(".handrail_required") ||
    key.endsWith(".handrail_included")
  ) {
    if (
      includesAny(lower, [
        "no balustrade",
        "no handrail",
        "without balustrade",
        "without handrail",
      ])
    ) {
      return false;
    }
  }

  return value;
}

function normaliseFloorPrepLevel(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["minor", "light", "minimal"])) {
    return "Minor";
  }
  if (includesAny(lower, ["major", "heavy", "significant", "levelling"])) {
    return "Moderate";
  }
  return value;
}

function normaliseCabinetryType(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (lower.includes("flatpack") || lower.includes("flat pack")) {
    return "Flatpack";
  }
  if (lower.includes("custom")) {
    return "Custom";
  }
  return value;
}

function normalisePaintingLocation(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);
  if (includesAny(lower, ["internal", "interior", "inside"])) {
    return "Internal";
  }
  if (includesAny(lower, ["external", "exterior", "outside"])) {
    return "External";
  }
  if (includesAny(lower, ["both"])) {
    return "Both";
  }
  return value;
}

function normaliseSurfacesArray(value: unknown): unknown {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.includes(",")) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
          const lower = item.toLowerCase();
          if (lower.includes("wall")) return "Walls";
          if (lower.includes("ceiling")) return "Ceilings";
          if (lower.includes("door")) return "Doors";
          if (lower.includes("trim")) return "Trims";
          return item;
        });
    }
    return value;
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      return item;
    }
    const lower = item.toLowerCase();
    if (lower.includes("wall")) return "Walls";
    if (lower.includes("ceiling")) return "Ceilings";
    if (lower.includes("door")) return "Doors";
    if (lower.includes("trim")) return "Trims";
    return item;
  });
}

function inferBooleanFromPhrase(value: unknown, key: string): boolean | unknown {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return value;
  }
  const lower = normaliseString(value);

  if (
    key.endsWith(".demolition_required") ||
    key.endsWith(".demolition_included") ||
    key.endsWith(".existing_flooring_removal")
  ) {
    if (
      includesAny(lower, [
        "strip-out",
        "strip out",
        "remove existing",
        "removal",
        "demolition",
        "rip out",
      ])
    ) {
      return true;
    }
  }

  if (key.endsWith(".sanding_included")) {
    if (includesAny(lower, ["sand ready", "sanding", "sand for paint"])) {
      return true;
    }
  }

  if (key.endsWith(".existing_removal")) {
    if (includesAny(lower, ["remove old", "remove existing", "replace existing"])) {
      return true;
    }
  }

  if (key.endsWith(".landing_included") && lower.includes("landing")) {
    return true;
  }

  if (
    (key.endsWith(".handrail_included") && lower.includes("handrail")) ||
    (key.endsWith(".balustrade_included") && lower.includes("balustrade")) ||
    (key.endsWith(".balustrade_required") && lower.includes("balustrade")) ||
    (key.endsWith(".handrail_required") && lower.includes("handrail"))
  ) {
    if (
      !lower.startsWith("no ") &&
      !includesAny(lower, ["without balustrade", "without handrail", "no balustrade", "no handrail"])
    ) {
      return true;
    }
  }

  if (
    key.endsWith(".vertical_face_boards_required") &&
    includesAny(lower, ["vertical face", "face board", "fascia", "vertical board"])
  ) {
    return true;
  }

  if (
    key.endsWith(".tiling_included") ||
    key.endsWith(".waterproofing_included") ||
    key.endsWith(".ventilation_included") ||
    key.endsWith(".wall_lining_included") ||
    key.endsWith(".floor_prep_included") ||
    key.endsWith(".splashback_included") ||
    key.endsWith(".benchtop_included") ||
    key.endsWith(".backfill_included") ||
    key.endsWith(".drainage_required")
  ) {
    if (
      lower === "yes" ||
      lower === "included" ||
      lower === "true" ||
      includesAny(lower, ["with ", "including"])
    ) {
      return true;
    }
  }

  if (key.endsWith(".finish_required") && (lower.includes("stain") || lower.includes("paint"))) {
    return true;
  }

  if (
    (key.endsWith(".disposal_included") || key.endsWith(".skip_bin_included")) &&
    includesAny(lower, ["not included", "no disposal", "no skip", "excluded", "not required"])
  ) {
    return false;
  }

  if (
    (key.endsWith(".disposal_included") || key.endsWith(".skip_bin_included")) &&
    includesAny(lower, ["skip", "dispose", "disposal", "cart", "waste"])
  ) {
    return true;
  }

  return value;
}

const POOR_ACCESS_WORK_AREAS = new Set(["demolition", "external_stairs"]);

function normaliseAccessLevel(value: unknown, workAreaType: string): unknown {
  if (typeof value !== "string") return value;
  const lower = normaliseString(value);
  const usesPoorVocabulary = POOR_ACCESS_WORK_AREAS.has(workAreaType);

  if (usesPoorVocabulary) {
    if (includesAny(lower, ["very poor", "very_poor"])) return "Very poor";
    if (includesAny(lower, ["poor", "difficult"])) return "Poor";
    if (includesAny(lower, ["moderate"])) return "Moderate";
    if (includesAny(lower, ["easy"])) return "Easy";
    return value;
  }

  if (includesAny(lower, ["poor", "difficult", "very poor", "very_poor"])) {
    return "Difficult";
  }
  if (includesAny(lower, ["moderate"])) return "Moderate";
  if (includesAny(lower, ["easy"])) return "Easy";
  return value;
}

function normaliseFloorLevel(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const lower = normaliseString(value);
  if (includesAny(lower, ["upper", "upstairs", "first floor", "apartment"])) {
    return "Upper floor";
  }
  if (lower.includes("basement")) return "Basement";
  if (lower.includes("ground")) return "Ground";
  return value;
}

function normaliseHazardousRisk(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const lower = normaliseString(value);
  if (includesAny(lower, ["asbestos"])) return "Possible asbestos";
  if (includesAny(lower, ["lead"])) return "Possible lead paint";
  if (includesAny(lower, ["mould", "mold"])) return "Possible mould";
  if (includesAny(lower, ["none known", "none_known", "no"])) return "None known";
  return value;
}

function normaliseServicesIsolated(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const lower = normaliseString(value);
  if (includesAny(lower, ["by others", "by other", "others"])) return "By others";
  if (lower === "yes" || lower === "true") return "Yes";
  if (lower === "no" || lower === "false") return "No";
  return value;
}

function normaliseStairMaterial(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const lower = normaliseString(value);
  if (includesAny(lower, ["treated timber", "treated pine", "treated_timber"])) {
    return "Treated timber";
  }
  if (lower.includes("hardwood")) return "Hardwood";
  if (lower.includes("steel")) return "Steel";
  if (lower.includes("concrete")) return "Concrete";
  if (lower.includes("composite")) return "Composite";
  return value;
}

function normaliseGroundCondition(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const lower = normaliseString(value);
  if (lower.includes("slop")) return "Sloping";
  if (lower.includes("uneven")) return "Uneven";
  if (lower.includes("level")) return "Level";
  return value;
}

function normaliseStairFinishType(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const lower = normaliseString(value);
  if (lower.includes("stain")) return "Stain";
  if (lower.includes("paint")) return "Paint";
  if (lower.includes("none")) return "None";
  return value;
}

function coerceRiserCount(value: unknown): unknown {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const lower = normaliseString(value);
  const match = lower.match(/(\d+)\s*steps?/);
  if (match) return Number(match[1]);
  const stepMatch = lower.match(/(\d+)[- ]step/);
  if (stepMatch) return Number(stepMatch[1]);
  return value;
}

function normaliseScopeItemsArray(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (typeof item !== "string") return item;
    const lower = item.toLowerCase();
    if (lower.includes("bathroom")) return "Bathroom";
    if (lower.includes("kitchen")) return "Kitchen";
    if (lower.includes("wall") || lower.includes("lining")) return "Internal walls";
    if (lower.includes("floor") || lower.includes("carpet") || lower.includes("vinyl")) {
      return "Flooring";
    }
    if (lower.includes("ceiling")) return "Ceilings";
    if (lower.includes("fixture")) return "Fixtures";
    if (lower.includes("joinery")) return "Joinery";
    if (lower.includes("door")) return "Doors";
    if (lower.includes("strip")) return "General strip-out";
    return item;
  });
}

export function normaliseExtractedFactKey(
  key: string,
  workAreaType: string | null
): string {
  const canonical = normalizeCanonicalFactKey(key, workAreaType);
  if (workAreaType) {
    return getCanonicalFactKey(canonical, workAreaType);
  }
  return getCanonicalFactKey(canonical, canonical.split(".")[0] ?? "");
}

export function normaliseExtractedFactValue(
  key: string,
  value: string | number | boolean | string[],
  workAreaType: string | null
): string | number | boolean | string[] {
  if (Array.isArray(value)) {
    if (key.endsWith(".surfaces")) {
      return normaliseSurfacesArray(value) as string[];
    }
    if (key.endsWith(".scope_items")) {
      return normaliseScopeItemsArray(value) as string[];
    }
    return value;
  }

  let next: unknown = value;

  if (typeof next === "string") {
    const trimmed = next.trim();
    if (trimmed === "true") next = true;
    else if (trimmed === "false") next = false;
    else next = trimmed;
  }

  next = inferBooleanFromPhrase(next, key);
  next = inferNegativeBooleanFromPhrase(next, key);

  if (key.endsWith(".renovation_type")) {
    next = normaliseRenovationType(next);
  }

  if (key.endsWith(".plumbing_changes") || key.endsWith(".electrical_changes")) {
    next = normaliseTradeChangesValue(next);
    if (next === true) {
      next = "Minor";
    }
  }

  if (key.endsWith(".coats_required") || key.endsWith(".coats")) {
    next = coerceCoatsValue(next);
  }

  if (key.endsWith(".prep_level")) {
    next = normalisePrepLevel(next);
  }

  if (key.endsWith(".level") || key.endsWith(".finish_level")) {
    if (key.startsWith("plastering.")) {
      next = normalisePlasteringLevel(next);
    }
  }

  if (
    key.endsWith(".fixtures_client_supplied") ||
    key.endsWith(".cabinetry_client_supplied") ||
    key.endsWith(".paint_client_supplied") ||
    key.endsWith(".client_supplied") ||
    key.endsWith(".hardware_client_supplied")
  ) {
    next = normaliseClientSupplied(next);
  }

  if (key.endsWith(".supply_scope")) {
    next = normaliseSupplyScope(next);
  }

  if (key.endsWith(".lining_sides")) {
    next = normaliseLiningSides(next);
  }

  if (key.endsWith(".wall_lining_type") || key.endsWith(".ceiling_type")) {
    next = normaliseWallLining(next);
  }

  if (key.endsWith(".plasterboard_type")) {
    next = normalisePlasterboardType(next);
  }

  if (key.endsWith(".shower_type")) {
    next = normaliseShowerType(next);
  }

  if (key.endsWith(".door_type")) {
    next = normaliseDoorType(next);
  }

  if (key.endsWith(".type") && workAreaType === "flooring") {
    next = normaliseFlooringType(next);
  }

  if (key.endsWith(".board_material") && workAreaType === "deck") {
    next = normaliseDeckBoardMaterial(next);
  }

  if (key.endsWith(".level") && workAreaType === "deck") {
    next = normaliseDeckLevel(next);
  }

  if (key.endsWith(".access_type") && workAreaType === "deck") {
    next = normaliseDeckAccessType(next);
  }

  if (key.endsWith(".fixing_type") && workAreaType === "retaining_wall") {
    next = normaliseFixingType(next);
  }

  if (key.endsWith(".is_raking")) {
    next = normaliseIsRaking(next);
  }

  if (key.endsWith(".board_width_mm")) {
    next = coerceBoardWidthMm(next);
  }

  if (key.endsWith(".floor_prep_level")) {
    next = normaliseFloorPrepLevel(next);
  }

  if (key.endsWith(".cabinetry_type")) {
    next = normaliseCabinetryType(next);
  }

  if (key.endsWith(".location") && workAreaType === "painting") {
    next = normalisePaintingLocation(next);
  }

  if (key.endsWith(".surfaces")) {
    next = normaliseSurfacesArray(next);
  }

  if (key.endsWith(".access")) {
    next = normaliseAccessLevel(next, workAreaType ?? "");
  }

  if (key.endsWith(".floor_level")) {
    next = normaliseFloorLevel(next);
  }

  if (key.endsWith(".hazardous_materials_risk") || key.endsWith(".hazardous_materials_suspected")) {
    next = normaliseHazardousRisk(next);
  }

  if (key.endsWith(".services_isolated") || key.endsWith(".services_isolation_required")) {
    next = normaliseServicesIsolated(next);
  }

  if (key.endsWith(".ground_condition")) {
    next = normaliseGroundCondition(next);
  }

  if (key.endsWith(".finish_type") && workAreaType === "external_stairs") {
    next = normaliseStairFinishType(next);
  }

  if (
    key.endsWith(".risers_count") ||
    key.endsWith(".riser_count") ||
    key.endsWith("_count")
  ) {
    if (typeof next === "string" && next.trim() !== "") {
      const parsed = Number(next);
      if (Number.isFinite(parsed)) {
        next = parsed;
      }
    }
  }

  if (
    key.endsWith(".risers_count") ||
    key.endsWith(".riser_count")
  ) {
    next = coerceRiserCount(next);
  }

  if (key.endsWith(".material") && workAreaType === "external_stairs") {
    next = normaliseStairMaterial(next);
  }

  if (
    key.endsWith(".disposal_included") ||
    key.endsWith(".skip_bin_included") ||
    key.endsWith(".landing_included") ||
    key.endsWith(".balustrade_included") ||
    key.endsWith(".existing_removal") ||
    key.endsWith(".finish_required")
  ) {
    if (typeof next === "string") {
      const lower = normaliseString(next);
      if (includesAny(lower, ["no disposal", "no skip", "not included", "excluded"])) {
        next = false;
      } else if (includesAny(lower, ["skip", "dispose", "disposal", "cart"])) {
        next = true;
      }
    }
  }

  if (typeof next === "string" && next.length > 0) {
    return next;
  }
  if (typeof next === "number" || typeof next === "boolean") {
    return next;
  }

  return value;
}

function expandDeckAreaFactsToDimensions(
  extraction: AIExtractionOutput
): AIExtractionOutput {
  const extraFacts: AIExtractionOutput["facts"] = [];

  for (const fact of extraction.facts) {
    const key = normaliseExtractedFactKey(fact.key, fact.work_area_type);
    if (key !== "deck.area_m2" || fact.work_area_type !== "deck") {
      continue;
    }

    const area = toPositiveNumber(fact.value);
    if (!area) {
      continue;
    }

    const side = roundToTwoDecimals(Math.sqrt(area));
    if (!side) {
      continue;
    }

    extraFacts.push(
      {
        ...fact,
        key: "deck.length_m",
        label: "Deck length",
        value: side,
        unit: "m",
      },
      {
        ...fact,
        key: "deck.width_m",
        label: "Deck width",
        value: side,
        unit: "m",
      }
    );
  }

  if (extraFacts.length === 0) {
    return extraction;
  }

  return {
    ...extraction,
    facts: [...extraction.facts, ...extraFacts],
  };
}

export function normaliseAIExtraction(
  extraction: AIExtractionOutput
): AIExtractionOutput {
  const withDeckDimensions = expandDeckAreaFactsToDimensions(extraction);
  const facts = withDeckDimensions.facts
    .map((fact) => {
      const key = normaliseExtractedFactKey(fact.key, fact.work_area_type);
      if (DERIVED_FACT_KEYS.has(key)) {
        return null;
      }

      const forbidden = FORBIDDEN_PRICING_KEY_FRAGMENTS.some((fragment) =>
        key.toLowerCase().includes(fragment)
      );
      if (forbidden) {
        return null;
      }

      return {
        ...fact,
        key,
        value: normaliseExtractedFactValue(
          key,
          fact.value,
          fact.work_area_type
        ),
        unit: fact.unit ?? inferUnitFromFactKey(key),
      };
    })
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);

  return {
    ...extraction,
    facts,
  };
}

export { FORBIDDEN_PRICING_KEY_FRAGMENTS };
