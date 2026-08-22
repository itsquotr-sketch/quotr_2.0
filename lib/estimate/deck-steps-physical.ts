/**
 * DECK-MATURITY-2B — simple rectangular step estimating model.
 * Not stair compliance. No stringer engineering. No fascia duplication.
 */
import { getNumberFact, round2 } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";

export const DEFAULT_STEP_TARGET_RISER_M = 0.175;
export const MAX_STEP_ESTIMATING_RISER_M = 0.19;
export const DEFAULT_STEP_GOING_M = 0.28;
export const DEFAULT_STEP_WIDTH_M = 1;
export const DEFAULT_STEP_FRAMING_CENTRES_M = 0.45;

export type DeckStepsQuantities = {
  riseCount: number;
  riseCountDefaulted: boolean;
  estimatedRiserM: number;
  widthM: number;
  goingM: number;
  treadCount: number;
  treadAreaM2: number;
  framingOuterLm: number;
  framingInternalLm: number;
  framingNetLm: number;
  framingPurchaseLm: number;
};

export function deckStepsIncluded(params: {
  accessType: string | null;
  hasStairs: boolean | null;
}): boolean {
  if (params.hasStairs === true) return true;
  if (params.hasStairs === false) return false;
  const access = params.accessType?.trim().toLowerCase() ?? "";
  if (!access || access === "none") return false;
  return (
    access.includes("stair") ||
    access.includes("step") ||
    access.includes("multiple")
  );
}

export function estimateDeckRiseCount(deckHeightM: number): number {
  if (!(deckHeightM > 0)) return 0;
  let count = Math.max(1, Math.ceil(deckHeightM / DEFAULT_STEP_TARGET_RISER_M));
  while (deckHeightM / count > MAX_STEP_ESTIMATING_RISER_M) {
    count += 1;
  }
  return count;
}

export function calculateDeckStepsQuantities(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  deckHeightM: number | null;
  wastePercent: number;
}): DeckStepsQuantities | null {
  const facts = [...params.facts];
  const countFact = getNumberFact(facts, params.workAreaId, "deck.step_count");
  const riseCountDefaulted = countFact == null;
  const riseCount =
    countFact != null && countFact > 0
      ? Math.round(countFact)
      : params.deckHeightM != null
        ? estimateDeckRiseCount(params.deckHeightM)
        : 0;
  if (riseCount <= 0) return null;

  const widthM =
    getNumberFact(facts, params.workAreaId, "deck.step_width_m") ??
    DEFAULT_STEP_WIDTH_M;
  const goingM =
    getNumberFact(facts, params.workAreaId, "deck.step_going_m") ??
    DEFAULT_STEP_GOING_M;
  const estimatedRiserM =
    params.deckHeightM != null && riseCount > 0
      ? params.deckHeightM / riseCount
      : DEFAULT_STEP_TARGET_RISER_M;
  const treadCount = riseCount;
  const treadAreaM2 = round2(widthM * goingM * treadCount);

  const framingOuterLm = round2(treadCount * (2 * widthM + 2 * goingM));
  const internalSpaces = Math.max(
    0,
    Math.ceil(widthM / DEFAULT_STEP_FRAMING_CENTRES_M) - 1
  );
  const framingInternalLm = round2(treadCount * internalSpaces * goingM);
  const framingNetLm = round2(framingOuterLm + framingInternalLm);
  const framingPurchaseLm = round2(
    framingNetLm * (1 + params.wastePercent / 100)
  );

  return {
    riseCount,
    riseCountDefaulted,
    estimatedRiserM: round2(estimatedRiserM),
    widthM,
    goingM,
    treadCount,
    treadAreaM2,
    framingOuterLm,
    framingInternalLm,
    framingNetLm,
    framingPurchaseLm,
  };
}
