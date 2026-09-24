/**
 * CLADDING-02 — Details question copy.
 * Painting Yes discloses separate Painting scope and does not create money.
 */

import { CLADDING_APPROVED_PROFILES } from "@/lib/estimate/cladding-profiles";
import type { CladdingPortion } from "@/lib/estimate/cladding-portions";

export const CLADDING_PAINTING_DISCLOSURE =
  "Painting is separately scoped and calculated in Painting." as const;

export const CLADDING_BATTEN_DIRECT_AREA_DISCLOSURE =
  "Direct area can be kept, but batten quantities will need length and height or a later manual quantity." as const;

export const CLADDING_FIBRE_CEMENT_SYSTEM_DISCLOSURE =
  "V1 supports horizontal fibre-cement weatherboards." as const;

const SCOPE_OPTIONS = ["New cladding", "Replace / reclad", "Removal only"] as const;
const FAMILY_OPTIONS = [
  "Timber",
  "Fibre cement",
  "Brick veneer",
  "Masonry",
  "Other / custom",
] as const;
const ORIENTATION_OPTIONS = ["Horizontal", "Vertical"] as const;
const YES_NO = ["Yes", "No"] as const;

function profileLabel(id: string): string | null {
  const profile = CLADDING_APPROVED_PROFILES.find((row) => row.id === id);
  if (!profile) return null;
  if (profile.system === "timber_sheet_board_and_batten") {
    return "2400 × 1200 mm sheet, 8 mm gap";
  }
  if (profile.system === "fibre_cement_horizontal_weatherboard") {
    return `${profile.nominal_width_mm} mm (cover ${profile.effective_cover_mm} mm)`;
  }
  return `${profile.nominal_width_mm} × ${profile.nominal_thickness_mm} mm (cover ${profile.effective_cover_mm} mm)`;
}

export function claddingQuestionOptions(
  factKey: string,
  portion: CladdingPortion | null
): readonly string[] | undefined {
  if (factKey === "cladding.portion.scope_intent") return SCOPE_OPTIONS;
  if (factKey === "cladding.portion.cladding_family") return FAMILY_OPTIONS;
  if (factKey === "cladding.portion.orientation") return ORIENTATION_OPTIONS;
  if (factKey === "cladding.portion.cladding_system") {
    if (portion?.cladding_family === "fibre_cement") {
      return ["Horizontal weatherboard", "Other / custom"];
    }
    if (portion?.orientation === "vertical") {
      return ["Vertical shiplap", "Sheet board-and-batten", "Other / custom"];
    }
    return ["Bevelback", "Rusticated", "Other / custom"];
  }
  if (factKey === "cladding.portion.approved_profile") {
    const system = portion?.cladding_system;
    const rows = CLADDING_APPROVED_PROFILES.filter((profile) => profile.system === system)
      .map((profile) => profileLabel(profile.id))
      .filter((label): label is string => Boolean(label));
    return [...rows, "Other / custom"];
  }
  if (factKey === "cladding.portion.area_method") return ["Direct area", "Length × height"];
  if (
    factKey === "cladding.portion.openings_already_deducted" ||
    factKey === "cladding.portion.cavity_included" ||
    factKey === "cladding.portion.wall_underlay_or_rab_included" ||
    factKey === "cladding.portion.trims_flashings_corners_included" ||
    factKey === "cladding.portion.existing_cladding_removal_required" ||
    factKey === "cladding.portion.painting_or_coating_included"
  ) {
    return YES_NO;
  }
  return undefined;
}

export function claddingQuestionCopy(
  factKey: string,
  portion: CladdingPortion | null
): string {
  if (factKey === "cladding.portion.scope_intent") return "What work is required?";
  if (factKey === "cladding.portion.label") return "Where is this section?";
  if (factKey === "cladding.portion.cladding_family") return "What cladding family is required?";
  if (factKey === "cladding.portion.orientation") return "What timber orientation is required?";
  if (factKey === "cladding.portion.cladding_system") {
    if (portion?.cladding_family === "fibre_cement") {
      return `Which fibre-cement system is required? ${CLADDING_FIBRE_CEMENT_SYSTEM_DISCLOSURE}`;
    }
    return "Which timber system is required?";
  }
  if (factKey === "cladding.portion.approved_profile") return "Which approved profile is required?";
  if (factKey === "cladding.portion.other_description") {
    return "Describe this cladding section.";
  }
  if (factKey === "cladding.portion.area_method") {
    if (portion?.cladding_system === "timber_sheet_board_and_batten") {
      return `How should the area be entered? Length × height is preferred. ${CLADDING_BATTEN_DIRECT_AREA_DISCLOSURE}`;
    }
    return "How should the area be entered?";
  }
  if (factKey === "cladding.portion.direct_area_m2") {
    return portion?.cladding_system === "timber_sheet_board_and_batten"
      ? `What is the direct area? ${CLADDING_BATTEN_DIRECT_AREA_DISCLOSURE}`
      : "What is the direct area?";
  }
  if (factKey === "cladding.portion.length_m") return "What is the section length?";
  if (factKey === "cladding.portion.height_m") return "What is the section height?";
  if (factKey === "cladding.portion.openings_already_deducted") {
    return "Does the entered area already exclude openings?";
  }
  if (factKey === "cladding.portion.opening_area_m2") {
    return "What opening area should be deducted? Zero means no deduction.";
  }
  if (factKey === "cladding.portion.cavity_included") {
    return "Include a drained cavity or cavity battens?";
  }
  if (factKey === "cladding.portion.wall_underlay_or_rab_included") {
    return "Include wall underlay or a rigid air barrier?";
  }
  if (factKey === "cladding.portion.trims_flashings_corners_included") {
    return "Include trims, corners and flashings?";
  }
  if (factKey === "cladding.portion.existing_cladding_removal_required") {
    return "Remove the existing cladding?";
  }
  if (factKey === "cladding.portion.painting_or_coating_included") {
    return `Include painting or coating? ${CLADDING_PAINTING_DISCLOSURE}`;
  }
  return "Confirm this cladding detail.";
}

export function claddingQuestionLabel(factKey: string): string {
  const labels: Record<string, string> = {
    "cladding.portion.scope_intent": "Work required",
    "cladding.portion.label": "Location",
    "cladding.portion.cladding_family": "Cladding family",
    "cladding.portion.orientation": "Orientation",
    "cladding.portion.cladding_system": "Cladding system",
    "cladding.portion.approved_profile": "Profile",
    "cladding.portion.other_description": "Description",
    "cladding.portion.area_method": "Area method",
    "cladding.portion.direct_area_m2": "Direct area",
    "cladding.portion.length_m": "Length",
    "cladding.portion.height_m": "Height",
    "cladding.portion.openings_already_deducted": "Openings already excluded",
    "cladding.portion.opening_area_m2": "Opening deduction",
    "cladding.portion.cavity_included": "Cavity",
    "cladding.portion.wall_underlay_or_rab_included": "Underlay or air barrier",
    "cladding.portion.trims_flashings_corners_included": "Trims and flashings",
    "cladding.portion.existing_cladding_removal_required": "Remove existing cladding",
    "cladding.portion.painting_or_coating_included": "Painting or coating",
  };
  return labels[factKey] ?? "Cladding detail";
}

export function claddingQuestionInputType(
  factKey: string
): "boolean" | "select" | "number" | "text" {
  if (
    factKey === "cladding.portion.label" ||
    factKey === "cladding.portion.other_description"
  ) {
    return "text";
  }
  if (
    factKey === "cladding.portion.direct_area_m2" ||
    factKey === "cladding.portion.length_m" ||
    factKey === "cladding.portion.height_m" ||
    factKey === "cladding.portion.opening_area_m2"
  ) {
    return "number";
  }
  if (
    factKey === "cladding.portion.openings_already_deducted" ||
    factKey === "cladding.portion.cavity_included" ||
    factKey === "cladding.portion.wall_underlay_or_rab_included" ||
    factKey === "cladding.portion.trims_flashings_corners_included" ||
    factKey === "cladding.portion.existing_cladding_removal_required" ||
    factKey === "cladding.portion.painting_or_coating_included"
  ) {
    return "boolean";
  }
  return "select";
}

export function claddingQuestionUnit(factKey: string): string | undefined {
  if (factKey === "cladding.portion.direct_area_m2" || factKey === "cladding.portion.opening_area_m2") {
    return "m²";
  }
  if (factKey === "cladding.portion.length_m" || factKey === "cladding.portion.height_m") {
    return "m";
  }
  return undefined;
}
