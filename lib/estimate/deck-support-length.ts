/**
 * DECK-MATURITY-2B — pile/post length estimating heuristic.
 * Not embedment design, not NZS 3604, not stock-length optimisation.
 */
import { round2 } from "@/lib/estimate/facts";

export type DeckPostLengthEstimate = {
  embedmentM: number;
  aboveGroundM: number;
  lengthEachM: number;
  totalLm: number;
};

/** Embedment from deck height. Estimating assumption only. */
export function deckPostEmbedmentM(deckHeightM: number): number {
  if (deckHeightM < 0.45) return 0.2;
  if (deckHeightM <= 2) return 0.45;
  return 0.9;
}

export function calculateDeckPostLength(params: {
  deckHeightM: number;
  supportCount: number;
}): DeckPostLengthEstimate {
  const embedmentM = deckPostEmbedmentM(params.deckHeightM);
  const aboveGroundM = (2 / 3) * params.deckHeightM;
  const lengthEachM = embedmentM + aboveGroundM;
  const totalLm = params.supportCount * lengthEachM;
  return {
    embedmentM,
    aboveGroundM: round2(aboveGroundM),
    lengthEachM: round2(lengthEachM),
    totalLm: round2(totalLm),
  };
}
