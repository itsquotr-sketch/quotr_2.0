/**
 * EF02-D1 — accepted ASSUME_IF_SKIPPED values persist as assumption-quality
 * facts (ASSUMED_DISCLOSED). Not converted to KNOWN / source "user".
 */

import { disclosedWallHeightForNotSure } from "@/lib/estimate/bathroom-geometry";
import {
  DECK_BOARD_WIDTH_ASSUMPTION_MM,
  disclosedBoardWidthForNotSure,
} from "@/lib/estimate/deck-board-width";
import { DEFAULT_FASCIA_GROUND_GAP_M } from "@/lib/estimate/deck-fascia";
import {
  DEFAULT_STEP_GOING_M,
  DEFAULT_STEP_WIDTH_M,
} from "@/lib/estimate/deck-steps-physical";
import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";

export const DECK_HEIGHT_ASSUMPTION_M = 0.6;
export const DECK_BOARD_MATERIAL_ASSUMPTION = "Hardwood";

export const DECK_HEIGHT_ASSUMPTION_STATEMENT =
  "Assuming 0.6 m deck height for pricing.";
export const DECK_BOARD_MATERIAL_ASSUMPTION_STATEMENT =
  "Assuming hardwood decking for pricing.";

const VALUE_BY_KEY: Record<string, string | number> = {
  "deck.height_m": DECK_HEIGHT_ASSUMPTION_M,
  "deck.board_material": DECK_BOARD_MATERIAL_ASSUMPTION,
  "deck.board_width_mm": DECK_BOARD_WIDTH_ASSUMPTION_MM,
  "deck.step_width_m": DEFAULT_STEP_WIDTH_M,
  "deck.step_going_m": DEFAULT_STEP_GOING_M,
  "deck.ground_clearance_m": DEFAULT_FASCIA_GROUND_GAP_M,
};

export function disclosedAssumptionValue(
  factKey: string
): { value: string | number; source: "assumption" } | null {
  if (factKey === "deck.board_width_mm") {
    return {
      value: DECK_BOARD_WIDTH_ASSUMPTION_MM,
      source: "assumption",
    };
  }
  if (factKey === "bathroom.wall_height_m") {
    return disclosedWallHeightForNotSure("Not sure");
  }
  const value = VALUE_BY_KEY[factKey];
  if (value === undefined) return null;
  return { value, source: "assumption" };
}

/** Persist Not sure as the disclosed assumed value. Leave real answers as user. */
export function disclosedAssumptionForNotSure(
  factKey: string,
  value: unknown
): { value: string | number; source: "assumption" } | null {
  if (!isNotSureValue(value)) return null;
  if (factKey === "deck.board_width_mm") {
    return disclosedBoardWidthForNotSure(value);
  }
  if (factKey === "bathroom.wall_height_m") {
    return disclosedWallHeightForNotSure(value);
  }
  return disclosedAssumptionValue(factKey);
}

export function isUnresolvedCaptureValue(value: unknown): boolean {
  return !hasFactValue(value) || isNotSureValue(value);
}
