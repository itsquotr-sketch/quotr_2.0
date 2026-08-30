/**
 * DECK-R7 / R8 — fascia (edge boards) vs full-height skirting / screening.
 *
 * These are not the same physical scope.
 * Fascia: exposed deck perimeter × courses. Not height-driven.
 * Skirting: optional explicit full-height screening. Height-sensitive.
 * Elevation / fascia Yes does not auto-include skirting.
 */

export const DECK_FASCIA_BUILDER_LABEL = "Fascia / edge boards";
export const DECK_SKIRTING_BUILDER_LABEL =
  "Full-height deck skirting / screening";
export const DECK_SKIRTING_INSTALL_LABEL = "Full-height skirting installation";
import { getBooleanFact, getNumberFact, round2 } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

export const DEFAULT_FASCIA_GROUND_GAP_M = 0.02;
export const DEFAULT_FASCIA_BOARD_FACE_M = 0.14;
export const DEFAULT_FASCIA_COURSES = 1;

export const DECK_SKIRTING_INCLUDED_FACT_KEY = "deck.skirting_included";
export const DECK_FASCIA_COMPONENT_KEY = "deck.fascia";
export const DECK_FASCIA_INSTALL_COMPONENT_KEY = "deck.fascia.install";
export const DECK_SKIRTING_COMPONENT_KEY = "deck.skirting";
export const DECK_SKIRTING_INSTALL_COMPONENT_KEY = "deck.skirting.install";

export type DeckFasciaQuantities = {
  edgeLengthM: number;
  courses: number;
  fasciaNetLm: number;
  fasciaPurchaseLm: number;
  /** @deprecated height belongs to skirting, not fascia */
  groundGapM: number;
  groundGapDefaulted: boolean;
  deckHeightM: number | null;
  boardFaceM: number;
  effectiveHeightM: number;
  boardHeightEquivalents: number;
  heightModelApplied: boolean;
};

export type DeckSkirtingQuantities = {
  edgeLengthM: number;
  groundGapM: number;
  groundGapDefaulted: boolean;
  deckHeightM: number | null;
  boardFaceM: number;
  effectiveHeightM: number;
  boardHeightEquivalents: number;
  skirtingNetLm: number;
  skirtingPurchaseLm: number;
  heightModelApplied: boolean;
};

export function deckFasciaBoardFaceM(boardWidthMm: number | null): number {
  if (boardWidthMm != null && boardWidthMm > 0) {
    return boardWidthMm / 1000;
  }
  return DEFAULT_FASCIA_BOARD_FACE_M;
}

export function deckExposedPerimeterM(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  lengthM: number | null;
  widthM: number | null;
  areaM2: number;
}): number {
  const edgeFact = getNumberFact(
    [...params.facts],
    params.workAreaId,
    "deck.vertical_face_board_length_lm"
  );
  if (edgeFact != null) return edgeFact;
  return round2(
    params.lengthM && params.widthM
      ? 2 * (params.lengthM + params.widthM)
      : params.areaM2 * 0.5
  );
}

function wastePurchaseLm(netLm: number, wastePercent: number): number {
  return round2(netLm * (1 + wastePercent / 100));
}

/**
 * Ordinary fascia / edge boards.
 * Driver: exposed perimeter × courses. Not deck elevation height.
 */
export function calculateDeckFasciaQuantities(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  lengthM: number | null;
  widthM: number | null;
  areaM2: number;
  deckHeightM: number | null;
  boardWidthMm: number | null;
  wastePercent: number;
}): DeckFasciaQuantities {
  const edgeLengthM = deckExposedPerimeterM(params);
  const coursesFact = getNumberFact(
    [...params.facts],
    params.workAreaId,
    "deck.fascia_courses"
  );
  const courses =
    coursesFact != null && coursesFact > 0 ? coursesFact : DEFAULT_FASCIA_COURSES;
  const fasciaNetLm = round2(edgeLengthM * courses);
  const boardFaceM = deckFasciaBoardFaceM(params.boardWidthMm);

  return {
    edgeLengthM,
    courses,
    fasciaNetLm,
    fasciaPurchaseLm: wastePurchaseLm(fasciaNetLm, params.wastePercent),
    groundGapM: DEFAULT_FASCIA_GROUND_GAP_M,
    groundGapDefaulted: true,
    deckHeightM: params.deckHeightM,
    boardFaceM,
    effectiveHeightM: 0,
    boardHeightEquivalents: courses,
    heightModelApplied: false,
  };
}

/**
 * Optional full-height vertical deck face / skirting.
 * Only when the builder explicitly includes skirting.
 */
export function calculateDeckSkirtingQuantities(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  lengthM: number | null;
  widthM: number | null;
  areaM2: number;
  deckHeightM: number | null;
  boardWidthMm: number | null;
  wastePercent: number;
}): DeckSkirtingQuantities {
  const edgeLengthM = deckExposedPerimeterM(params);
  const gapFact = getNumberFact(
    [...params.facts],
    params.workAreaId,
    "deck.ground_clearance_m"
  );
  const groundGapDefaulted = gapFact == null;
  const groundGapM = gapFact ?? DEFAULT_FASCIA_GROUND_GAP_M;
  const boardFaceM = deckFasciaBoardFaceM(params.boardWidthMm);

  const heightModelApplied =
    params.deckHeightM != null && params.deckHeightM > 0 && boardFaceM > 0;
  const effectiveHeightM = heightModelApplied
    ? Math.max(params.deckHeightM! - groundGapM, 0)
    : 0;
  const boardHeightEquivalents = heightModelApplied
    ? effectiveHeightM / boardFaceM
    : 1;
  const skirtingNetLm = round2(edgeLengthM * boardHeightEquivalents);

  return {
    edgeLengthM,
    groundGapM,
    groundGapDefaulted,
    deckHeightM: params.deckHeightM,
    boardFaceM,
    effectiveHeightM,
    boardHeightEquivalents,
    skirtingNetLm,
    skirtingPurchaseLm: wastePurchaseLm(skirtingNetLm, params.wastePercent),
    heightModelApplied,
  };
}

export function deckSkirtingIncluded(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  return (
    getBooleanFact(
      [...params.facts],
      params.workAreaId,
      DECK_SKIRTING_INCLUDED_FACT_KEY
    ) === true
  );
}

export function deckFasciaIncluded(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  return (
    getBooleanFact(
      [...params.facts],
      params.workAreaId,
      "deck.vertical_face_boards_required"
    ) === true
  );
}
