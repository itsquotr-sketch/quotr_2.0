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
