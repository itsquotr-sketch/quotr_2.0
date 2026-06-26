/**
 * Canonical fact keys for scope templates, note proposals, and Scope Review.
 * Keeps AI/note proposal keys aligned with estimate engine expectations.
 */

export const DERIVED_FACT_KEYS = new Set([
  "deck.area_m2",
  "pergola.area_m2",
  "retaining_wall.height_m",
  "retaining_wall.backfill_volume_m3",
  "internal_walls.area_m2",
  "bathroom.total_tiling_area_m2",
  "external_stairs.approximate_riser_count",
  "external_stairs.approximate_total_rise_m",
]);

const CANONICAL_SUFFIX_BY_SCOPE: Record<string, Record<string, string>> = {
  deck: {
    length: "deck.length_m",
    length_m: "deck.length_m",
    deck_length: "deck.length_m",
    deck_length_m: "deck.length_m",
    "deck.length": "deck.length_m",
    width: "deck.width_m",
    width_m: "deck.width_m",
    deck_width: "deck.width_m",
    deck_width_m: "deck.width_m",
    "deck.width": "deck.width_m",
    area: "deck.area_m2",
    area_m2: "deck.area_m2",
    material: "deck.board_material",
    board_material: "deck.board_material",
    demolition_required: "deck.existing_deck_removal",
    has_balustrade: "deck.balustrade_required",
    has_stairs: "deck.access_type",
    handrail: "deck.handrail_required",
    has_handrail: "deck.handrail_required",
    access_difficulty: "deck.access",
  },
  fence: {
    length: "fence.length_m",
    length_m: "fence.length_m",
    fence_length: "fence.length_m",
    "fence.length": "fence.length_m",
    height: "fence.height_m",
    height_m: "fence.height_m",
    fence_height: "fence.height_m",
    "fence.height": "fence.height_m",
    has_gate: "fence.gate_included",
    gate_included: "fence.gate_included",
    demolition_required: "fence.demolition_required",
    existing_fence_removal: "fence.demolition_required",
  },
  pergola: {
    length: "pergola.length_m",
    length_m: "pergola.length_m",
    width: "pergola.width_m",
    width_m: "pergola.width_m",
    area: "pergola.area_m2",
    area_m2: "pergola.area_m2",
    attachment: "pergola.attached",
    roofing: "pergola.roofing_included",
    freestanding: "pergola.attached",
  },
  retaining_wall: {
    length: "retaining_wall.length_m",
    length_m: "retaining_wall.length_m",
    retaining_wall_length: "retaining_wall.length_m",
    "retaining_wall.length": "retaining_wall.length_m",
    height: "retaining_wall.height_m",
    height_m: "retaining_wall.height_m",
    height_high_m: "retaining_wall.height_high_m",
    height_low_m: "retaining_wall.height_low_m",
    high_height_m: "retaining_wall.height_high_m",
    low_height_m: "retaining_wall.height_low_m",
    is_raking: "retaining_wall.is_raking",
  },
  demolition: {
    waste_removal_required: "demolition.disposal_included",
    disposal_included: "demolition.disposal_included",
    wall_length_m: "demolition.wall_length_m",
    floor_area_m2: "demolition.floor_area_m2",
    ceiling_area_m2: "demolition.ceiling_area_m2",
    skip_bin_included: "demolition.skip_bin_included",
    carting_distance_m: "demolition.carting_distance_m",
    hazardous_materials_suspected: "demolition.hazardous_materials_risk",
    services_isolation_required: "demolition.services_isolated",
    floor_level: "demolition.floor_level",
  },
  external_stairs: {
    riser_count: "external_stairs.risers_count",
    risers_count: "external_stairs.risers_count",
    handrail_required: "external_stairs.handrail_included",
    total_rise_m: "external_stairs.total_rise_m",
    landing_included: "external_stairs.landing_included",
    balustrade_included: "external_stairs.balustrade_included",
    existing_removal: "external_stairs.existing_removal",
    ground_condition: "external_stairs.ground_condition",
    finish_type: "external_stairs.finish_type",
  },
  kitchen: {
    plumbing_required: "kitchen.plumbing_changes",
    electrical_required: "kitchen.electrical_changes",
    fixtures_client_supplied: "kitchen.cabinetry_client_supplied",
  },
  internal_walls: {
    length: "internal_walls.length_lm",
    length_m: "internal_walls.length_lm",
    length_lm: "internal_walls.length_lm",
    height: "internal_walls.height_m",
    height_m: "internal_walls.height_m",
    area: "internal_walls.area_m2",
    area_m2: "internal_walls.area_m2",
    lining_sides: "internal_walls.lining_sides",
    gib: "internal_walls.wall_lining_type",
    plasterboard: "internal_walls.wall_lining_type",
    demolition_included: "internal_walls.demolition_included",
    strip_out: "internal_walls.demolition_included",
  },
  bathroom: {
    waterproofing_required: "bathroom.waterproofing_included",
    plumbing_allowance: "bathroom.plumbing_changes",
    electrical_allowance: "bathroom.electrical_changes",
    demolition_included: "bathroom.demolition_required",
    strip_out: "bathroom.demolition_required",
  },
  doors: {
    supply_by: "doors.supply_scope",
    install_only: "doors.supply_scope",
    door_count: "doors.count",
    count: "doors.count",
  },
  flooring: {
    supply_by: "flooring.supply_scope",
    client_supplied: "flooring.client_supplied",
    removal: "flooring.existing_flooring_removal",
  },
  painting: {
    coats: "painting.coats_required",
    client_supplied: "painting.paint_client_supplied",
    area_m2: "painting.internal_area_m2",
    internal_area_m2: "painting.internal_area_m2",
    trim_length_lm: "painting.joinery_surround_length_lm",
  },
  plastering: {
    finish_level: "plastering.level",
    level: "plastering.level",
  },
};

export function normalizeCanonicalFactKey(
  key: string,
  workAreaType: string | null
): string {
  const trimmed = key.trim();
  if (DERIVED_FACT_KEYS.has(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes(".")) {
    return trimmed;
  }

  const underscored = trimmed.replace(/-/g, "_");

  if (workAreaType) {
    const byScope =
      CANONICAL_SUFFIX_BY_SCOPE[workAreaType]?.[trimmed] ??
      CANONICAL_SUFFIX_BY_SCOPE[workAreaType]?.[underscored];
    if (byScope) return byScope;
  }

  if (workAreaType && !trimmed.includes(".")) {
    return `${workAreaType}.${underscored}`;
  }

  return trimmed;
}

export function inferUnitFromFactKey(key: string): string | undefined {
  if (key.endsWith("_m2") || key.includes("area_m2")) return "m²";
  if (key.endsWith("_lm")) return "lm";
  if (
    key.endsWith("_m") ||
    key.includes("length_m") ||
    key.includes("width_m") ||
    key.includes("height_m")
  ) {
    return "m";
  }
  return undefined;
}
