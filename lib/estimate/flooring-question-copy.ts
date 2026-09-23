/**
 * FLOORING-02 — builder-facing Details copy for nested Flooring Areas.
 */

import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
} from "@/lib/estimate/bathroom-identities";
import type { FlooringPortion, FlooringSubstrateFamily } from "@/lib/estimate/flooring-portions";

export const FLOORING_FINISH_OPTIONS = [
  "Carpet",
  "Vinyl plank / LVT",
  "Tile",
  "Hardwood / timber flooring",
  "Other / custom",
] as const;

export const FLOORING_AREA_METHOD_OPTIONS = [
  "Direct area",
  "Length and width",
] as const;

export const FLOORING_YES_NO_OPTIONS = ["Yes", "No"] as const;

export const FLOORING_TILE_SIZE_OPTIONS = [
  "500 × 500 mm",
  "600 × 600 mm",
  "300 × 600 mm",
  "600 × 1200 mm",
] as const;

export const FLOORING_TILE_WIDTH_OPTIONS = [
  "300 mm",
  "500 mm",
  "600 mm",
] as const;

export const FLOORING_TILE_LENGTH_OPTIONS = [
  "500 mm",
  "600 mm",
  "1200 mm",
] as const;

export const FLOORING_HARDWOOD_WIDTH_OPTIONS = [
  "145 mm",
  "165 mm",
  "186 mm",
  "190 mm",
  "220 mm",
] as const;

export const FLOORING_SUBSTRATE_FAMILY_OPTIONS = [
  "Plywood",
  "Particleboard",
  "Fibre cement",
  "Other / custom",
] as const;

export const FLOORING_FRAMING_LEVEL_OPTIONS = [
  "Minor",
  "Standard",
  "Major",
] as const;

export const FLOORING_EXISTING_FINISH_OPTIONS = [
  "Carpet",
  "Vinyl",
  "Tile",
  "Hardwood",
  "Other",
] as const;

export const FLOORING_SUBSTRATE_ITEM_OPTIONS = [
  "19 mm H3.2 structural plywood 2400 × 1200",
  "18 mm fibre-cement 2400 × 1200",
  "19 mm fibre-cement flooring 2700 × 600",
  "19 mm fibre-cement flooring 1800 × 900",
  "19 mm fibre-cement flooring",
  "Secura flooring 2400 × 600",
] as const;

export const FLOORING_SUBSTRATE_ITEM_KEY_BY_LABEL: Record<string, string> = {
  "19 mm H3.2 structural plywood 2400 × 1200":
    BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  "18 mm fibre-cement 2400 × 1200": BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  "19 mm fibre-cement flooring 2700 × 600":
    BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  "19 mm fibre-cement flooring 1800 × 900":
    BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  "19 mm fibre-cement flooring": BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  "Secura flooring 2400 × 600": BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
};

export const FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY: Record<string, string> = {
  [BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY]:
    "19 mm H3.2 structural plywood 2400 × 1200",
  [BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY]: "18 mm fibre-cement 2400 × 1200",
  [BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY]:
    "19 mm fibre-cement flooring 2700 × 600",
  [BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY]:
    "19 mm fibre-cement flooring 1800 × 900",
  [BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY]: "19 mm fibre-cement flooring",
  [BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY]: "Secura flooring 2400 × 600",
};

const QUESTIONS: Record<string, string> = {
  "flooring.portion.finish_type": "What flooring type is required?",
  "flooring.portion.label": "Where is this flooring area located?",
  "flooring.portion.area_input_method": "How should the floor area be entered?",
  "flooring.portion.area_m2": "What is the floor area?",
  "flooring.portion.length_m": "What is the floor length?",
  "flooring.portion.width_m": "What is the floor width?",
  "flooring.portion.underlay_required": "Is carpet underlay included?",
  "flooring.portion.floor_preparation_required":
    "Is floor preparation required?",
  "flooring.portion.tile_width_mm": "What is the tile width?",
  "flooring.portion.tile_length_mm": "What is the tile length?",
  "flooring.portion.hardwood_board_width_mm": "What is the board width?",
  "flooring.portion.other_description":
    "What flooring system or finish is required?",
  "flooring.portion.substrate_required": "Is new floor substrate required?",
  "flooring.portion.substrate_family": "What substrate material is required?",
  "flooring.portion.substrate_item_key": "Which substrate product is required?",
  "flooring.portion.framing_required": "Is new framing below the floor required?",
  "flooring.portion.framing_allowance_level":
    "What subfloor framing allowance is required?",
  "flooring.portion.finish_removal_required":
    "Is existing floor finish removal required?",
  "flooring.portion.existing_finish_type": "What existing floor finish is being removed?",
  "flooring.portion.substrate_removal_required":
    "Is existing floor substrate removal required?",
};

const LABELS: Record<string, string> = {
  "flooring.portion.finish_type": "Flooring type",
  "flooring.portion.label": "Location",
  "flooring.portion.area_input_method": "Area method",
  "flooring.portion.area_m2": "Floor area",
  "flooring.portion.length_m": "Length",
  "flooring.portion.width_m": "Width",
  "flooring.portion.underlay_required": "Underlay",
  "flooring.portion.floor_preparation_required": "Floor preparation",
  "flooring.portion.tile_width_mm": "Tile width",
  "flooring.portion.tile_length_mm": "Tile length",
  "flooring.portion.hardwood_board_width_mm": "Board width",
  "flooring.portion.other_description": "Description",
  "flooring.portion.substrate_required": "New substrate",
  "flooring.portion.substrate_family": "Substrate material",
  "flooring.portion.substrate_item_key": "Substrate product",
  "flooring.portion.framing_required": "New framing",
  "flooring.portion.framing_allowance_level": "Framing allowance",
  "flooring.portion.finish_removal_required": "Existing finish removal",
  "flooring.portion.existing_finish_type": "Existing finish",
  "flooring.portion.substrate_removal_required": "Substrate removal",
};

export function flooringQuestionCopy(factKey: string): string {
  return QUESTIONS[factKey] ?? LABELS[factKey] ?? factKey;
}

export function flooringQuestionLabel(factKey: string): string | null {
  return LABELS[factKey] ?? null;
}

export function flooringSubstrateFamilyOfItemKey(
  itemKey: string | null | undefined
): FlooringSubstrateFamily | null {
  if (!itemKey) return null;
  if (itemKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) {
    return "structural_plywood";
  }
  if (itemKey === BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY) return "secura";
  if (
    itemKey === BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY ||
    itemKey === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY ||
    itemKey === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY ||
    itemKey === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY
  ) {
    return "fibre_cement";
  }
  return null;
}

export function flooringSubstrateItemKeyBelongsToFamily(
  itemKey: string | null | undefined,
  family: FlooringSubstrateFamily | null | undefined
): boolean {
  if (!itemKey || !family) return false;
  const ofKey = flooringSubstrateFamilyOfItemKey(itemKey);
  if (ofKey == null) return family === "other";
  if (ofKey === family) return true;
  if (family === "fibre_cement" && ofKey === "secura") return true;
  return false;
}

export function flooringSubstrateItemOptionsForFamily(
  family: FlooringSubstrateFamily | null | undefined
): readonly string[] {
  if (family === "structural_plywood") {
    return [FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY]];
  }
  if (family === "fibre_cement") {
    return [
      FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY],
      FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY],
      FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY],
      FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY],
      FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY],
    ];
  }
  if (family === "secura") {
    return [FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY]];
  }
  return [];
}

export function flooringSubstrateProductUsesDescription(
  family: FlooringSubstrateFamily | null | undefined
): boolean {
  return family === "other";
}

export function flooringQuestionOptions(
  factKey: string,
  portion?: FlooringPortion | null
): readonly string[] | undefined {
  if (factKey === "flooring.portion.finish_type") return FLOORING_FINISH_OPTIONS;
  if (factKey === "flooring.portion.area_input_method") {
    return FLOORING_AREA_METHOD_OPTIONS;
  }
  if (
    factKey === "flooring.portion.underlay_required" ||
    factKey === "flooring.portion.floor_preparation_required" ||
    factKey === "flooring.portion.substrate_required" ||
    factKey === "flooring.portion.framing_required" ||
    factKey === "flooring.portion.finish_removal_required" ||
    factKey === "flooring.portion.substrate_removal_required"
  ) {
    return FLOORING_YES_NO_OPTIONS;
  }
  if (factKey === "flooring.portion.tile_width_mm") {
    return FLOORING_TILE_WIDTH_OPTIONS;
  }
  if (factKey === "flooring.portion.tile_length_mm") {
    return FLOORING_TILE_LENGTH_OPTIONS;
  }
  if (factKey === "flooring.portion.hardwood_board_width_mm") {
    return FLOORING_HARDWOOD_WIDTH_OPTIONS;
  }
  if (factKey === "flooring.portion.substrate_family") {
    return FLOORING_SUBSTRATE_FAMILY_OPTIONS;
  }
  if (factKey === "flooring.portion.substrate_item_key") {
    if (flooringSubstrateProductUsesDescription(portion?.substrate_family)) {
      return undefined;
    }
    return flooringSubstrateItemOptionsForFamily(portion?.substrate_family);
  }
  if (factKey === "flooring.portion.framing_allowance_level") {
    return FLOORING_FRAMING_LEVEL_OPTIONS;
  }
  if (factKey === "flooring.portion.existing_finish_type") {
    return FLOORING_EXISTING_FINISH_OPTIONS;
  }
  return undefined;
}

export function flooringQuestionUnit(factKey: string): string | undefined {
  if (factKey === "flooring.portion.area_m2") return "m²";
  if (factKey === "flooring.portion.length_m" || factKey === "flooring.portion.width_m") {
    return "m";
  }
  if (
    factKey === "flooring.portion.tile_width_mm" ||
    factKey === "flooring.portion.tile_length_mm" ||
    factKey === "flooring.portion.hardwood_board_width_mm"
  ) {
    return "mm";
  }
  return undefined;
}

export function flooringQuestionInputType(
  factKey: string,
  portion?: FlooringPortion | null
): "boolean" | "select" | "number" | "text" {
  if (
    factKey === "flooring.portion.label" ||
    factKey === "flooring.portion.other_description"
  ) {
    return "text";
  }
  if (
    factKey === "flooring.portion.substrate_item_key" &&
    flooringSubstrateProductUsesDescription(portion?.substrate_family)
  ) {
    return "text";
  }
  if (
    factKey === "flooring.portion.area_m2" ||
    factKey === "flooring.portion.length_m" ||
    factKey === "flooring.portion.width_m" ||
    factKey === "flooring.portion.tile_width_mm" ||
    factKey === "flooring.portion.tile_length_mm" ||
    factKey === "flooring.portion.hardwood_board_width_mm"
  ) {
    return "number";
  }
  if (
    factKey === "flooring.portion.underlay_required" ||
    factKey === "flooring.portion.floor_preparation_required" ||
    factKey === "flooring.portion.substrate_required" ||
    factKey === "flooring.portion.framing_required" ||
    factKey === "flooring.portion.finish_removal_required" ||
    factKey === "flooring.portion.substrate_removal_required"
  ) {
    return "boolean";
  }
  return "select";
}
