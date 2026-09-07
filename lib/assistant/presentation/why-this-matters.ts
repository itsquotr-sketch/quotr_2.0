/**
 * Stage 3.1B.7C — Deterministic “Why this matters” copy (presentation only).
 * No AI, no legal conclusions, no fabricated cost claims.
 */

const WHY_THIS_MATTERS: Readonly<Record<string, string>> = Object.freeze({
  "deck.length_m":
    "Length is used with width to establish deck area for materials and labour.",
  "deck.width_m":
    "Width is used with length to establish deck area for materials and labour.",
  "deck.area_m2":
    "Deck area drives material quantity and labour allowances for the estimate range.",
  "deck.height_m":
    "Deck height can affect framing, access and safety allowances.",
  "deck.existing_deck_removal":
    "Existing deck removal affects demolition and disposal allowances.",
  "deck.substructure_condition":
    "Existing pile or substructure condition affects whether replacement should be allowed for.",
  "deck.balustrade_required":
    "Balustrade requirements affect barrier and compliance allowances.",
  "deck.has_stairs":
    "Stairs affect access scope and related labour.",
  "deck.board_material":
    "Decking material affects material rates and finish allowances.",
  "deck.board_width_mm":
    "Board width drives how many lineal metres of decking are required.",
  "deck.fascia_included":
    "Fascia affects edge finishing materials and labour.",
  "pergola.length_m":
    "Length is used with width to establish covering area.",
  "pergola.width_m":
    "Width is used with length to establish covering area.",
  "pergola.area_m2":
    "Covered area drives material and labour allowances.",
  material_carry_distance:
    "Carting distance can affect labour and waste handling.",
  site_access:
    "Site access can affect labour productivity and handling allowances.",
  "retaining_wall.disposal_included":
    "Asked only when excavation creates spoil. Removal from site is extra commercial cost, not excavation labour.",
  "retaining_wall.spoil_removal_portion":
    "All uses the measured excavation quantity. Some needs a removal volume.",
  "retaining_wall.spoil_removal_volume_m3":
    "Removal volume prices hardfill leaving site. Leave blank if not sure.",
  working_hours:
    "Working-hour restrictions can affect programme and labour productivity.",
  floor_level:
    "Floor level can affect access, carrying and handling effort.",
  "bathroom.floor_finish_system":
    "Bathroom floor finish is one primary system. Floor substrate is separate.",
  "bathroom.tile_extent":
    "Wall tiling extent. Floor tiles come from the floor finish, not this question.",
  "bathroom.tile_format":
    "Tile format is used for an approximate tile count. Quantity is still priced in m².",
  "bathroom.shower.width_m":
    "Shower width is used with depth and wall height for shower-only tiling and waterproofing.",
  "bathroom.shower.depth_m":
    "Shower depth is used with width and wall height for shower-only tiling and waterproofing.",
  "bathroom.shower.wall_height_m":
    "Shower wall height is used for tiled or waterproofed shower walls, not the whole bathroom.",
  "bathroom.waterproofing_extent":
    "Waterproofing uses selected wet areas only. It is not copied from the tiling area.",
  "bathroom.floor_substrate_system":
    "Floor substrate quantity uses the bathroom floor area and a 10% sheet waste.",
  "bathroom.wall_lining_included":
    "Wall lining quantity uses gross wall area. Door and window openings are not deducted.",
  "bathroom.ceiling_lining_included":
    "Ceiling lining uses the same area as the bathroom floor when it is nested in Bathroom.",
  "bathroom.framing_level":
    "Local framing and nogging is bathroom fixture support, not a complete new wall.",
  "bathroom.fixtures_included":
    "Selected fixtures drive PC allowances, builder install hours, and plumbing or electrical modifiers.",
  "bathroom.plumbing.level":
    "Plumbing uses a mobilisation/rough-in allowance plus fixture modifiers. Bathroom floor area does not change it.",
  "bathroom.electrical.level":
    "Electrical uses a mobilisation/rough-in allowance plus selected points. Bathroom floor area does not change it.",
  "bathroom.plumbing.scope_text":
    "Scope notes travel with the plumbing allowance so a future subcontractor quote can replace the estimate without rebuilding the bathroom.",
  "bathroom.electrical.scope_text":
    "Scope notes travel with the electrical allowance so a future subcontractor quote can replace the estimate without rebuilding the bathroom.",
  "bathroom.demolition_required":
    "Bathroom demolition is optional. It is priced from selected surfaces and fixtures, not a hidden package.",
  "bathroom.demolition.components":
    "Selected removal drives demolition labour hours and the disposal allowance level.",
  "bathroom.stopping_included":
    "Stopping uses selected new plasterboard lining area. Tiled walls are not deducted.",
  "bathroom.painting_included":
    "Painting uses remaining paintable wall plus ceiling. Tiled wall surfaces are not painted.",
});

/**
 * Returns concise explanation text when a reliable entry exists.
 * Omit rather than fabricate.
 */
export function whyThisMattersForKey(key: string): string | null {
  if (WHY_THIS_MATTERS[key]) return WHY_THIS_MATTERS[key]!;
  // Flat constraint keys and dotted fact keys both supported
  const suffix = key.includes(".") ? key : key;
  return WHY_THIS_MATTERS[suffix] ?? null;
}

export function shouldShowWhyThisMatters(key: string): boolean {
  return whyThisMattersForKey(key) != null;
}
