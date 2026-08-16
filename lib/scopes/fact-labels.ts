import { factHasValue, normalizeBooleanForUi } from "@/lib/scopes/fact-values";

/** Free-text / boolean tokens that mean “not answered with certainty”. */
const NOT_SURE_VALUES = new Set([
  "not sure",
  "not_sure",
  "unknown",
  "unsure",
]);

/** Tokens that remain “not sure” even when listed as select options. */
const EXPLICIT_NOT_SURE_OPTIONS = new Set([
  "not sure",
  "not_sure",
  "unsure",
]);

/** Maps alternate fact keys to a canonical key for deduplication. */
const FACT_KEY_ALIASES: Record<string, string> = {
  "deck.decking_material": "deck.board_material",
  "deck.material": "deck.board_material",
  "deck.stairs": "deck.access_type",
  "deck.has_stairs": "deck.access_type",
  "deck.balustrade": "deck.balustrade_required",
  "deck.has_balustrade": "deck.balustrade_required",
  "deck.demolition_required": "deck.existing_deck_removal",
  "fence.has_gate": "fence.gate_included",
  "fence.gate": "fence.gate_included",
  "pergola.attachment": "pergola.attached",
  "bathroom.waterproofing_required": "bathroom.waterproofing_included",
  "demolition.waste_removal_required": "demolition.disposal_included",
  "external_stairs.riser_count": "external_stairs.risers_count",
  "external_stairs.handrail_required": "external_stairs.handrail_included",
  "retaining_wall.high_height_m": "retaining_wall.height_high_m",
  "retaining_wall.low_height_m": "retaining_wall.height_low_m",
  "kitchen.plumbing_required": "kitchen.plumbing_changes",
  "kitchen.electrical_required": "kitchen.electrical_changes",
  "kitchen.has_island": "kitchen.island_included",
  "bathroom.waterproofing_scope": "bathroom.waterproofing_extent",
  "fence.post_centres_m": "fence.post_spacing_m",
  "fence.panel_type": "fence.paling_or_panel_type",
  "bathroom.plumbing_allowance": "bathroom.plumbing_changes",
  "bathroom.electrical_allowance": "bathroom.electrical_changes",
  "doors.door_count": "doors.count",
  "internal_walls.length_m": "internal_walls.length_lm",
  "painting.coats": "painting.coats_required",
  "painting.client_supplied": "painting.paint_client_supplied",
  "flooring.supply_by": "flooring.supply_scope",
  "plastering.finish_level": "plastering.level",
  "demolition.hazardous_materials_suspected": "demolition.hazardous_materials_risk",
  "demolition.services_isolation_required": "demolition.services_isolated",
};

/** Display labels for canonical fact keys. */
const FACT_DISPLAY_LABELS: Record<string, string> = {
  "deck.length_m": "Length",
  "deck.width_m": "Width",
  "deck.area_m2": "Area",
  "deck.material": "Decking material",
  "deck.level": "Deck level",
  "deck.demolition_required": "Existing deck removal",
  "deck.has_stairs": "Stairs",
  "deck.has_balustrade": "Balustrade",
  "deck.pergola_included": "Pergola",
  "pergola.area_m2": "Area",
  "pergola.material": "Material",
  "pergola.roofing_included": "Roofing/covering",
  "pergola.attached": "Attachment",
  "fence.has_gate": "Gate",
  "fence.demolition_required": "Existing fence removal",
  "fence.access": "Access",
  "fence.slope_condition": "Ground slope",
  "pergola.length_m": "Length",
  "pergola.width_m": "Width",
  "pergola.roofing_type": "Roofing type",
  "pergola.gutters_included": "Gutters",
  "deck.access": "Access",
  "deck.handrail_required": "Handrail",
  "retaining_wall.length_m": "Wall length",
  "retaining_wall.height_m": "Wall height",
  "retaining_wall.height_high_m": "High point",
  "retaining_wall.height_low_m": "Low point",
  "retaining_wall.average_height_m": "Average height",
  "retaining_wall.material": "Wall material",
  "retaining_wall.drainage_required": "Drainage",
  "retaining_wall.excavation_required": "Excavation",
  "retaining_wall.backfill_included": "Backfill",
  "retaining_wall.carting_distance_m": "Carting distance",
  "retaining_wall.disposal_included": "Disposal included",
  "retaining_wall.access": "Access",
  "deck.pile_or_post_replacement_required": "Pile/post replacement",
  "deck.pile_or_post_count": "Piles/posts count",
  "deck.substructure_condition": "Substructure condition",
  "fence.finish_required": "Fence finish",
  "fence.finish_type": "Finish type",
  "fence.finish_sides": "Finish sides",
  "pergola.finish_required": "Pergola finish",
  "pergola.finish_type": "Pergola finish type",
  "bathroom.area_m2": "Area",
  "bathroom.demolition_required": "Demolition",
  "bathroom.waterproofing_required": "Waterproofing",
  "bathroom.tile_extent": "Tiling extent",
  "bathroom.includes_vanity": "Vanity",
  "bathroom.includes_shower": "Shower",
  "bathroom.includes_toilet": "Toilet",
  "bathroom.finish_level": "Finish level",
  "kitchen.area_m2": "Area",
  "kitchen.demolition_required": "Demolition",
  "kitchen.plumbing_required": "Plumbing",
  "kitchen.electrical_required": "Electrical",
  "kitchen.cabinetry_included": "Cabinetry",
  "kitchen.benchtop_included": "Benchtop",
  "kitchen.benchtop_material": "Benchtop material",
  "kitchen.island_included": "Island",
  "kitchen.island_length_m": "Island length",
  "kitchen.cabinetry_lm": "Cabinetry length",
  "kitchen.finish_level": "Finish level",
  "bathroom.waterproofing_extent": "Waterproofing extent",
  "retaining_wall.post_spacing_m": "Post spacing",
  "pergola.height_m": "Height",
  "internal_walls.fire_or_acoustic": "Fire or acoustic rating",
  "fence.post_spacing_m": "Post spacing",
  "fence.paling_or_panel_type": "Paling or panel type",
  "fence.gate_width_m": "Gate width",
};

export function getCanonicalFactKey(
  rawKey: string,
  workAreaType: string
): string {
  const withPrefix = rawKey.includes(".")
    ? rawKey
    : `${workAreaType}.${rawKey}`;
  return FACT_KEY_ALIASES[withPrefix] ?? withPrefix;
}

export function getFactDisplayLabel(
  canonicalKey: string,
  fallbackLabel?: string | null
): string {
  if (FACT_DISPLAY_LABELS[canonicalKey]) {
    return FACT_DISPLAY_LABELS[canonicalKey];
  }
  if (fallbackLabel?.trim()) {
    return fallbackLabel.trim();
  }
  const suffix = canonicalKey.includes(".")
    ? canonicalKey.split(".").pop()!
    : canonicalKey;
  return formatSnakeCase(suffix);
}

export function getDerivedHeightLabel(canonicalKey: string): string | null {
  if (canonicalKey === "retaining_wall.height_m") {
    return "Average height";
  }
  return null;
}

function formatSnakeCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && (lower === "m" || lower === "m2")) {
        return lower === "m2" ? "m²" : lower;
      }
      if (lower === "m2") return "m²";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ")
    .replace(/ m²/g, " m²")
    .replace(/\s+m$/g, " m");
}

function titleCaseSafe(value: string): string {
  if (value.includes("_")) {
    return formatSnakeCase(value);
  }
  if (value === value.toUpperCase() && value.length <= 4) {
    return value;
  }
  return value
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Whether a stored value means “not sure / unanswered with certainty”.
 *
 * When `selectOptions` is provided, a value that is an explicit listed option
 * is treated as a deliberate answer unless it is an explicit not-sure token
 * (`Not sure`, `not_sure`, `unsure`). Listed `"unknown"` / `"none"` therefore
 * count as answered for select questions (BUG-001 / UX-002).
 */
export function isNotSureValue(
  value: unknown,
  selectOptions?: string[]
): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (selectOptions && selectOptions.length > 0) {
    const isListed = selectOptions.some(
      (option) => option.trim().toLowerCase() === lower
    );
    if (isListed) {
      return (
        EXPLICIT_NOT_SURE_OPTIONS.has(lower) || trimmed === "Not sure"
      );
    }
  }

  return NOT_SURE_VALUES.has(lower) || trimmed === "Not sure";
}

const ENUM_ANSWER_LABELS: Record<string, string> = {
  good_existing: "Good existing",
  good_condition: "Good condition",
  partial_replacement: "Partial replacement",
  full_replacement: "Full replacement",
  unknown: "Unknown",
  none: "None",
  not_required: "Not required",
  required: "Required",
  one_side: "One side",
  both_sides: "Both sides",
  clear_coat: "Clear coat",
  paint: "Paint",
  stain: "Stain",
};

/**
 * Presentation-only label for stored enum / select option values.
 * Does not mutate persisted values.
 */
export function formatAnswerOptionLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value);
  const mapped =
    ENUM_ANSWER_LABELS[raw] ?? ENUM_ANSWER_LABELS[raw.toLowerCase()];
  if (mapped) return mapped;
  if (raw.includes("_")) return formatSnakeCase(raw);
  return titleCaseSafe(raw);
}

export function formatSelectAnswerValue(value: unknown): string {
  return formatAnswerOptionLabel(value);
}

export function formatFactValueForDisplay(
  value: unknown,
  unit?: string | null,
  selectOptions?: string[]
): string | null {
  if (!factHasValue(value)) return null;

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatAnswerOptionLabel(item))
      .filter((item) => item && item !== "—");
    return parts.length > 0 ? parts.join(", ") : null;
  }

  const boolLabel = normalizeBooleanForUi(value);
  if (boolLabel) return boolLabel;

  if (typeof value === "number") {
    const formatted = Number.isInteger(value) ? String(value) : String(value);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  if (typeof value === "string") {
    if (isNotSureValue(value, selectOptions)) return "Not sure";
    return formatAnswerOptionLabel(value);
  }

  return String(value);
}
