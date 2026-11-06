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
import { getBooleanFact, getNumberFact, getStringFact, round2 } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

export const DECK_FASCIA_LENGTH_KEY = "deck.vertical_face_board_length_lm";
export const DECK_FASCIA_LENGTH_BASIS_KEY = "deck.fascia_length_basis";
export const DECK_FASCIA_RECTANGULAR_PERIMETER = "rectangular_perimeter";
export const DECK_FASCIA_RECTANGULAR_PERIMETER_LABEL =
  "Use the full rectangular perimeter";

export const DEFAULT_FASCIA_GROUND_GAP_M = 0.02;
export const DEFAULT_FASCIA_BOARD_FACE_M = 0.14;
export const DEFAULT_FASCIA_COURSES = 1;

export const DECK_SKIRTING_INCLUDED_FACT_KEY = "deck.skirting_included";
export const DECK_FASCIA_COMPONENT_KEY = "deck.fascia";
export const DECK_FASCIA_INSTALL_COMPONENT_KEY = "deck.fascia.install";
export const DECK_FASCIA_MATERIAL_ITEM_KEY = "deck.fascia.lm";
/** Dollar-per-lm cost allowance when fascia productivity is not trusted. */
export const DECK_FASCIA_LABOUR_FALLBACK_COST_PER_LM = 35;
export const DECK_SKIRTING_COMPONENT_KEY = "deck.skirting";
export const DECK_SKIRTING_INSTALL_COMPONENT_KEY = "deck.skirting.install";
export const DECK_SKIRTING_MATERIAL_ITEM_KEY = "deck.skirting.lm";

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

export type DeckFasciaEdgeResolution =
  | { status: "stated"; lengthM: number }
  | { status: "rectangular_perimeter"; lengthM: number }
  | { status: "needs_length"; rectangularChoiceAvailable: boolean };

/**
 * Stated length wins. The rectangular perimeter is used only after an
 * explicit choice, and only when both plan dimensions are known.
 * Inclusion alone does not invent a length.
 */
export function resolveDeckFasciaEdgeLength(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  lengthM: number | null;
  widthM: number | null;
}): DeckFasciaEdgeResolution {
  const stated = getNumberFact(
    [...params.facts],
    params.workAreaId,
    DECK_FASCIA_LENGTH_KEY
  );
  if (stated != null && stated > 0) {
    return { status: "stated", lengthM: round2(stated) };
  }
  const rectangular =
    params.lengthM != null &&
    params.widthM != null &&
    params.lengthM > 0 &&
    params.widthM > 0;
  const basis = getStringFact(
    [...params.facts],
    params.workAreaId,
    DECK_FASCIA_LENGTH_BASIS_KEY
  );
  if (
    (basis === DECK_FASCIA_RECTANGULAR_PERIMETER ||
      basis === DECK_FASCIA_RECTANGULAR_PERIMETER_LABEL) &&
    rectangular
  ) {
    return {
      status: "rectangular_perimeter",
      lengthM: round2(2 * (params.lengthM! + params.widthM!)),
    };
  }
  return { status: "needs_length", rectangularChoiceAvailable: rectangular };
}

export type FasciaLengthDetailCandidate = {
  factKey: string;
  label: string;
  question: string;
  inputType: "number" | "select";
  unit?: string;
  options?: readonly string[];
  blocksEstimate: boolean;
};

export function fasciaLengthDetailCandidates(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  lengthM: number | null;
  widthM: number | null;
}): FasciaLengthDetailCandidate[] {
  if (!deckFasciaIncluded(params)) return [];
  const edge = resolveDeckFasciaEdgeLength(params);
  if (edge.status !== "needs_length") return [];
  const candidates: FasciaLengthDetailCandidate[] = [
    {
      factKey: DECK_FASCIA_LENGTH_KEY,
      label: "Fascia length",
      question:
        "How much fascia length is exposed? A partial edge is enough. Leaving this blank does not price the full perimeter.",
      inputType: "number",
      unit: "lm",
      blocksEstimate: true,
    },
  ];
  if (edge.rectangularChoiceAvailable) {
    candidates.push({
      factKey: DECK_FASCIA_LENGTH_BASIS_KEY,
      label: "Fascia length basis",
      question: "Or use the full perimeter of this rectangle?",
      inputType: "select",
      options: [DECK_FASCIA_RECTANGULAR_PERIMETER_LABEL],
      blocksEstimate: false,
    });
  }
  return candidates;
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
