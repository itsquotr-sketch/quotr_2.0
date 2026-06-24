import { factHasValue, normalizeBooleanForUi } from "@/lib/scopes/fact-values";

const NOT_SURE_VALUES = new Set([
  "not sure",
  "not_sure",
  "unknown",
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
  "pergola.attachment": "pergola.attached",
  "bathroom.waterproofing_required": "bathroom.waterproofing_included",
  "demolition.waste_removal_required": "demolition.disposal_included",
  "external_stairs.riser_count": "external_stairs.risers_count",
  "external_stairs.handrail_required": "external_stairs.handrail_included",
  "retaining_wall.high_height_m": "retaining_wall.height_high_m",
  "retaining_wall.low_height_m": "retaining_wall.height_low_m",
  "kitchen.plumbing_required": "kitchen.plumbing_changes",
  "kitchen.electrical_required": "kitchen.electrical_changes",
  "bathroom.plumbing_allowance": "bathroom.plumbing_changes",
  "bathroom.electrical_allowance": "bathroom.electrical_changes",
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
  "retaining_wall.access": "Access",
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
  "kitchen.finish_level": "Finish level",
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
    .join("-")
    .replace(/-m²/g, " m²")
    .replace(/-m/g, " m");
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

export function isNotSureValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return NOT_SURE_VALUES.has(value.trim().toLowerCase()) || value === "Not sure";
}

export function formatFactValueForDisplay(
  value: unknown,
  unit?: string | null
): string | null {
  if (!factHasValue(value)) return null;

  const boolLabel = normalizeBooleanForUi(value);
  if (boolLabel) return boolLabel;

  if (typeof value === "number") {
    const formatted = Number.isInteger(value) ? String(value) : String(value);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  if (typeof value === "string") {
    if (isNotSureValue(value)) return "Not sure";
    if (value.includes("_")) return formatSnakeCase(value);
    return titleCaseSafe(value);
  }

  return String(value);
}
