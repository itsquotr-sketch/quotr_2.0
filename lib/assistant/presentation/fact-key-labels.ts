/**
 * POLISH-02 — builder-facing labels for facts and assumptions.
 * Presentation only. Never dump canonical keys into product UX.
 */
import {
  ceilingQuestionCopy,
  ceilingQuestionLabel,
} from "@/lib/estimate/ceilings-question-copy";
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
  "internal_walls.wall_type.cornice_included": "Cornice / scotia",
  "internal_walls.wall_type.cornice": "Cornice / scotia location",
  "internal_walls.wall_type.cornice_type": "Cornice / scotia type",
  "internal_walls.wall_type.cornice_product": "Cornice / scotia product",
  "internal_walls.wall_type.cornice_note": "Cornice / scotia notes",
  "internal_walls.wall_type.electrical": "Electrical",
  "internal_walls.wall_type.electrical_note": "Electrical notes",
  "internal_walls.wall_type.stopping_side_a": "Stopping — Side A",
  "internal_walls.wall_type.stopping_side_b": "Stopping — Side B",
  "internal_walls.wall_type.painting": "Wall painting",
  "internal_walls.opening.type": "Opening type",
  "internal_walls.opening.width_m": "Opening width",
  "internal_walls.opening.height_m": "Opening height",
  "ceilings.portion.geometry_mode": "Ceiling geometry",
  "ceilings.portion.length_m": "Ceiling length",
  "ceilings.portion.width_m": "Ceiling width",
  "ceilings.portion.area_m2": "Ceiling area",
  "ceilings.portion.job_scope": "Ceiling work",
  "ceilings.portion.structure_family": "Ceiling structure",
  "ceilings.portion.lining_family": "Ceiling lining",
  "ceilings.portion.plasterboard_product": "Plasterboard type",
  "ceilings.portion.thickness_mm": "Plasterboard thickness",
  "ceilings.bulkhead.thickness_mm": "Bulkhead plasterboard thickness",
  "ceilings.portion.height_m": "Ceiling height",
  "ceilings.portion.insulation_included": "Ceiling insulation",
  "ceilings.portion.bulkheads_present": "Bulkheads",
  "ceilings.portion.demolition_included": "Ceiling demolition",
  "ceilings.portion.stopping_included": "Ceiling stopping",
  "ceilings.portion.painting_included": "Ceiling painting",
  "ceilings.portion.drop_height_m": "Drop height",
  "ceilings.portion.spacing_mm": "Framing spacing",
  "ceilings.portion.primary_spacing_mm": "Primary spacing",
  "ceilings.portion.furring_spacing_mm": "Furring spacing",
  "ceilings.portion.direction": "Run direction",
  "ceilings.portion.plywood_spec": "Plywood specification",
  "ceilings.portion.board_width_mm": "Board cover width",
  "ceilings.portion.gap_mm": "Board gap",
  "ceilings.portion.tile_size": "Tile size",
  "ceilings.portion.insulation_type": "Insulation type",
  "ceilings.portion.insulation_spec": "Insulation specification",
  "ceilings.portion.significant_penetrations": "Significant penetrations",
  "ceilings.portion.penetrations": "Penetration / hatch details",
  "ceilings.portion.fire_acoustic_requirement": "Fire / acoustic requirement",
  "ceilings.portion.fire_acoustic_system": "Fire / acoustic system",
  "ceilings.portion.edge_offset_m": "Edge offset",
  "ceilings.bulkhead.form": "Bulkhead type",
  "ceilings.bulkhead.length_m": "Bulkhead length",
  "ceilings.bulkhead.depth_m": "Bulkhead depth",
  "ceilings.bulkhead.height_m": "Bulkhead height",
  "ceilings.bulkhead.framing_type": "Bulkhead framing",
  "ceilings.bulkhead.lining_type": "Bulkhead lining",
  "doors.portions": "Door sets",
  "doors.portion.label": "Door set location",
  "doors.portion.installation_type": "Installation type",
  "doors.portion.leaf_construction": "Leaf construction",
  "doors.portion.height_mm": "Door height",
  "doors.portion.width_mm": "Door width",
  "doors.portion.quantity": "Door quantity",
  "doors.portion.hardware_included": "Hardware included",
  "doors.portion.other_description": "Door description",
  "deck.step_width_m": "Step width",
  site_access: "Site access",
  high_level_access: "High-level access",
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
  const ceiling = ceilingQuestionLabel(key);
  if (ceiling) return ceiling;
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
  const ceiling = ceilingQuestionCopy(key);
  if (ceiling) return ceiling;
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
