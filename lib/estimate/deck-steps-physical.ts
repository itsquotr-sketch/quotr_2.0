/**
 * DECK-MATURITY-2B / R8 / R8-R1 — simple rectangular step estimating model.
 * Not stair compliance. No stringer engineering. No fascia duplication.
 *
 * Shared Step geometry (width, going, tread count) is KNOWN, DERIVED,
 * ASSUMED (disclosed), or INFORMATION_REQUIRED. Material, framing, and
 * labour consume this object — never a silent raw fallback.
 */
import { deckStepsCommerciallyIncluded } from "@/lib/estimate/deck-scope-2c";
import { getFact, getNumberFact, round2 } from "@/lib/estimate/facts";
import {
  detailedMoneyAllowed,
  resolvePhysicalRequirement,
  type PhysicalRequirementResolution,
} from "@/lib/estimate/physical-requirement-resolution";
import type { EstimateFact } from "@/lib/estimate/types";

export const DEFAULT_STEP_TARGET_RISER_M = 0.175;
export const MAX_STEP_ESTIMATING_RISER_M = 0.19;
export const DEFAULT_STEP_GOING_M = 0.28;
export const DEFAULT_STEP_WIDTH_M = 1;
export const DEFAULT_STEP_FRAMING_CENTRES_M = 0.45;

export const STEP_ARRANGEMENT_FROM_HEIGHT_STATEMENT =
  "Step arrangement estimated from deck height for pricing. Final compliant dimensions to be confirmed.";
export const STEP_WIDTH_ASSUMPTION_STATEMENT =
  "Assuming 1.0 m step width for pricing. Not the full deck edge unless specified.";

export type DeckStepsQuantities = {
  riseCount: number;
  riseCountDefaulted: boolean;
  riseCountResolution: PhysicalRequirementResolution;
  estimatedRiserM: number;
  widthM: number;
  widthDefaulted: boolean;
  widthResolution: PhysicalRequirementResolution;
  goingM: number;
  goingDefaulted: boolean;
  goingResolution: PhysicalRequirementResolution;
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
  facts?: readonly EstimateFact[];
  workAreaId?: string;
}): boolean {
  if (params.facts && params.workAreaId) {
    return deckStepsCommerciallyIncluded({
      facts: params.facts,
      workAreaId: params.workAreaId,
    });
  }
  if (params.hasStairs === true) return true;
  if (params.hasStairs === false) return false;
  const access = params.accessType?.trim().toLowerCase() ?? "";
  if (!access || access === "none") return false;
  return access.includes("stair set") || access === "stair set";
}

export function estimateDeckRiseCount(deckHeightM: number): number {
  if (!(deckHeightM > 0)) return 0;
  let count = Math.max(1, Math.ceil(deckHeightM / DEFAULT_STEP_TARGET_RISER_M));
  while (deckHeightM / count > MAX_STEP_ESTIMATING_RISER_M) {
    count += 1;
  }
  return count;
}

function provenanceWord(resolution: PhysicalRequirementResolution): string {
  if (resolution === "KNOWN") return "known";
  if (resolution === "ASSUMED") return "assumed";
  if (resolution === "DERIVED") return "derived";
  return "required";
}

/** Builder Review takeoff copy for Step decking. */
export function formatStepGeometryTakeoff(steps: DeckStepsQuantities): string {
  const goingMm = Math.round(steps.goingM * 1000);
  return [
    `Steps: ${steps.treadCount}`,
    `Width: ${steps.widthM.toFixed(1)}m ${provenanceWord(steps.widthResolution)}`,
    `Tread depth: ${goingMm}mm ${provenanceWord(steps.goingResolution)}`,
  ].join(". ");
}

export function stepPhysicalGeometryReady(steps: DeckStepsQuantities): boolean {
  return (
    detailedMoneyAllowed(steps.widthResolution) &&
    detailedMoneyAllowed(steps.goingResolution) &&
    steps.treadCount > 0 &&
    detailedMoneyAllowed(steps.riseCountResolution)
  );
}

function emptyQuantities(params: {
  riseCount: number;
  riseCountDefaulted: boolean;
  riseCountResolution: PhysicalRequirementResolution;
  estimatedRiserM: number;
  widthM: number;
  widthDefaulted: boolean;
  widthResolution: PhysicalRequirementResolution;
  goingM: number;
  goingDefaulted: boolean;
  goingResolution: PhysicalRequirementResolution;
}): DeckStepsQuantities {
  return {
    ...params,
    treadCount: params.riseCount,
    treadAreaM2: 0,
    framingOuterLm: 0,
    framingInternalLm: 0,
    framingNetLm: 0,
    framingPurchaseLm: 0,
  };
}

function looksLikeUnstatedFullDeckEdgeWidth(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  widthM: number;
}): boolean {
  if (!(params.widthM >= 2)) return false;
  const row = getFact([...params.facts], params.workAreaId, "deck.step_width_m");
  if (row?.source === "user") return false;
  const length = getNumberFact([...params.facts], params.workAreaId, "deck.length_m");
  const deckWidth = getNumberFact(
    [...params.facts],
    params.workAreaId,
    "deck.width_m"
  );
  return [length, deckWidth].some(
    (edge) => edge != null && Math.abs(edge - params.widthM) < 0.05
  );
}

export function calculateDeckStepsQuantities(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  deckHeightM: number | null;
  wastePercent: number;
  /** ASSUME_IF_SKIPPED for tread depth. Set false only to prove the money guard. */
  assumeGoingIfMissing?: boolean;
  /** ASSUME_IF_SKIPPED for stair width. Set false only to prove the money guard. */
  assumeWidthIfMissing?: boolean;
}): DeckStepsQuantities | null {
  const facts = [...params.facts];
  const countFact = getNumberFact(facts, params.workAreaId, "deck.step_count");
  const knownCount =
    countFact != null && countFact > 0 ? Math.round(countFact) : null;
  const derivedRise =
    knownCount == null
      ? params.deckHeightM != null
        ? estimateDeckRiseCount(params.deckHeightM)
        : null
      : null;
  const riseResolved = resolvePhysicalRequirement({
    knownValue: knownCount,
    derivedValue: derivedRise != null && derivedRise > 0 ? derivedRise : null,
    assumptionAllowed: false,
  });
  const riseCount = riseResolved.value ?? 0;
  if (riseCount <= 0) {
    return emptyQuantities({
      riseCount: 0,
      riseCountDefaulted: false,
      riseCountResolution: riseResolved.resolution,
      estimatedRiserM: DEFAULT_STEP_TARGET_RISER_M,
      widthM: 0,
      widthDefaulted: false,
      widthResolution: "INFORMATION_REQUIRED",
      goingM: 0,
      goingDefaulted: false,
      goingResolution: "INFORMATION_REQUIRED",
    });
  }

  const rawWidthFact = getNumberFact(facts, params.workAreaId, "deck.step_width_m");
  const widthFact =
    rawWidthFact != null &&
    rawWidthFact > 0 &&
    !looksLikeUnstatedFullDeckEdgeWidth({
      facts,
      workAreaId: params.workAreaId,
      widthM: rawWidthFact,
    })
      ? rawWidthFact
      : null;
  const widthResolved = resolvePhysicalRequirement({
    knownValue: widthFact != null && widthFact > 0 ? widthFact : null,
    assumptionValue: DEFAULT_STEP_WIDTH_M,
    assumptionAllowed: params.assumeWidthIfMissing !== false,
  });

  const goingFact = getNumberFact(facts, params.workAreaId, "deck.step_going_m");
  const goingResolved = resolvePhysicalRequirement({
    knownValue: goingFact != null && goingFact > 0 ? goingFact : null,
    assumptionValue: DEFAULT_STEP_GOING_M,
    assumptionAllowed: params.assumeGoingIfMissing !== false,
  });

  const estimatedRiserM = round2(
    params.deckHeightM != null && riseCount > 0
      ? params.deckHeightM / riseCount
      : DEFAULT_STEP_TARGET_RISER_M
  );
  const base = {
    riseCount,
    riseCountDefaulted: riseResolved.resolution !== "KNOWN",
    riseCountResolution: riseResolved.resolution,
    estimatedRiserM,
    widthM: widthResolved.value ?? 0,
    widthDefaulted: widthResolved.resolution === "ASSUMED",
    widthResolution: widthResolved.resolution,
    goingM: goingResolved.value ?? 0,
    goingDefaulted: goingResolved.resolution === "ASSUMED",
    goingResolution: goingResolved.resolution,
  };

  if (
    !detailedMoneyAllowed(widthResolved.resolution) ||
    widthResolved.value == null ||
    !detailedMoneyAllowed(goingResolved.resolution) ||
    goingResolved.value == null
  ) {
    return emptyQuantities(base);
  }

  const widthM = widthResolved.value;
  const goingM = goingResolved.value;
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
    ...base,
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
