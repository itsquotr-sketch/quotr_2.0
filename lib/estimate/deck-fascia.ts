/**
 * DECK-MATURITY-2B — fascia coverage estimating model.
 * Not a compliance or weather-tightness check.
 */
import { getNumberFact, round2 } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

export const DEFAULT_FASCIA_GROUND_GAP_M = 0.02;
export const DEFAULT_FASCIA_BOARD_FACE_M = 0.14;

export type DeckFasciaQuantities = {
  edgeLengthM: number;
  groundGapM: number;
  groundGapDefaulted: boolean;
  deckHeightM: number | null;
  boardFaceM: number;
  effectiveHeightM: number;
  boardHeightEquivalents: number;
  fasciaNetLm: number;
  fasciaPurchaseLm: number;
  heightModelApplied: boolean;
};

export function deckFasciaBoardFaceM(boardWidthMm: number | null): number {
  if (boardWidthMm != null && boardWidthMm > 0) {
    return boardWidthMm / 1000;
  }
  return DEFAULT_FASCIA_BOARD_FACE_M;
}

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
  const facts = [...params.facts];
  const edgeFact = getNumberFact(
    facts,
    params.workAreaId,
    "deck.vertical_face_board_length_lm"
  );
  const edgeLengthM =
    edgeFact ??
    round2(
      params.lengthM && params.widthM
        ? 2 * (params.lengthM + params.widthM)
        : params.areaM2 * 0.5
    );

  const gapFact = getNumberFact(
    facts,
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
  const fasciaNetLm = round2(edgeLengthM * boardHeightEquivalents);
  const fasciaPurchaseLm = round2(
    fasciaNetLm * (1 + params.wastePercent / 100)
  );

  return {
    edgeLengthM,
    groundGapM,
    groundGapDefaulted,
    deckHeightM: params.deckHeightM,
    boardFaceM,
    effectiveHeightM,
    boardHeightEquivalents,
    fasciaNetLm,
    fasciaPurchaseLm,
    heightModelApplied,
  };
}
