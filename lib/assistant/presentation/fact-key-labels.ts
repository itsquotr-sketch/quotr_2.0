/**
 * POLISH-02 — builder-facing labels for facts and assumptions.
 * Presentation only. Never dump canonical keys into product UX.
 */
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";

const GENERIC_ASSUMPTION = "An estimating assumption is being used.";

const FACT_KEY_PATTERN = /\b[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)+\b/;
const SCREAMING_ENUM = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/;

const FRIENDLY_LABELS: Record<string, string> = {
  "deck.substructure_included": "Deck substructure included",
  "deck.height_m": "Deck height",
  "deck.board_material": "Decking material",
  "deck.board_width_mm": "Decking board width",
  "deck.existing_deck_removal": "Existing deck removal",
  "deck.vertical_face_boards_required": "Fascia / edge boards",
  "deck.skirting_included": "Deck skirting",
  "deck.step_going_m": "Tread depth",
  "deck.ground_clearance_m": "Fascia ground gap",
  "internal_walls.job_scope": "Wall work",
  "internal_walls.structural_involvement": "Load-bearing or structural",
  "internal_walls.wall_type.frame_system": "Framing",
  "internal_walls.wall_type.frame_size": "Timber framing",
  "internal_walls.wall_type.wall_count": "Physical wall count",
  "internal_walls.wall_type.length_lm": "Total wall length",
  "internal_walls.wall_type.height_m": "Wall height",
  "internal_walls.wall_type.stud_centres_mm": "Stud spacing",
  "internal_walls.wall_type.side_a_product": "Side A lining",
  "internal_walls.wall_type.side_b_product": "Side B lining",
  "internal_walls.wall_type.same_lining_both_sides": "Same lining both sides",
  "internal_walls.wall_type.has_openings": "Openings",
  "internal_walls.wall_type.insulation_included": "Wall insulation",
  "internal_walls.wall_type.insulation": "Insulation type",
  "internal_walls.wall_type.skirting": "Skirting",
  "internal_walls.wall_type.cornice": "Cornice",
  "internal_walls.wall_type.electrical": "Electrical",
  "internal_walls.wall_type.electrical_note": "Electrical notes",
  "internal_walls.wall_type.stopping_side_a": "Stopping — Side A",
  "internal_walls.wall_type.stopping_side_b": "Stopping — Side B",
  "internal_walls.wall_type.painting": "Wall painting",
  "internal_walls.opening.type": "Opening type",
  "internal_walls.opening.width_m": "Opening width",
  "internal_walls.opening.height_m": "Opening height",
  "deck.step_width_m": "Step width",
  site_access: "Site access",
  material_carry_distance: "Carry distance",
  waste_bin_access: "Waste access",
  occupied_site: "Occupied site",
  quality_level: "Finish level",
};

export function looksLikeInternalFactKey(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (FACT_KEY_PATTERN.test(trimmed)) return true;
  if (SCREAMING_ENUM.test(trimmed)) return true;
  return false;
}

export function builderFacingFactLabel(key: string): string | null {
  const mapped = FRIENDLY_LABELS[key];
  if (mapped) return mapped;
  const template = getQuestionTemplateByKey(key);
  if (template?.label && !looksLikeInternalFactKey(template.label)) {
    return template.label;
  }
  return null;
}

/** Never returns a canonical fact key or enum identifier. */
export function safeFactPresentationLabel(key: string): string {
  return builderFacingFactLabel(key) ?? "This detail";
}

export function safeFactQuestion(
  key: string,
  templateQuestion?: string | null
): string {
  if (templateQuestion && !looksLikeInternalFactKey(templateQuestion)) {
    return templateQuestion;
  }
  const label = builderFacingFactLabel(key);
  if (label) return `What is the ${label.toLowerCase()}?`;
  return "Can you confirm this estimating detail?";
}

export function builderFacingAssumptionStatement(
  key: string | null | undefined,
  existingStatement?: string | null
): string {
  const existing = existingStatement?.trim() ?? "";
  if (existing && !looksLikeInternalFactKey(existing)) {
    return existing;
  }
  if (!key) return GENERIC_ASSUMPTION;
  const mapped = FRIENDLY_LABELS[key];
  if (mapped && existing.startsWith("Assumed for now:")) {
    return `Assuming ${mapped.toLowerCase()}.`;
  }
  if (key === "deck.substructure_included") {
    return "Assuming new framing / substructure is included.";
  }
  const label = builderFacingFactLabel(key);
  if (label) return `Assuming ${label.toLowerCase()}.`;
  return GENERIC_ASSUMPTION;
}
