/**
 * DECK-MATURITY-2B / R8 / R8-R1 — simple rectangular step estimating model.
 * Not stair compliance. No stringer engineering. No fascia duplication.
 *
 * Shared Step geometry (width, going, tread count) is KNOWN, DERIVED,
 * ASSUMED (disclosed), or INFORMATION_REQUIRED. Material, framing, and
 * labour consume this object — never a silent raw fallback.
 */
import { isDisclosedAssumptionSource } from "@/lib/estimate/deck-board-width";
import { deckStepsCommerciallyIncluded } from "@/lib/estimate/deck-scope-2c";
import {
  getFact,
  getNumberFact,
  hasFactValue,
  isNotSureValue,
  round2,
} from "@/lib/estimate/facts";
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
export const STEP_GOING_ASSUMPTION_STATEMENT =
  "Assuming 280 mm stair tread depth for pricing (LOW-CONFIDENCE).";

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

export const DECK_STEP_DIMENSION_FACT_KEYS = [
  "deck.step_width_m",
  "deck.step_going_m",
] as const;

export type DeckStepDimensionFactKey =
  (typeof DECK_STEP_DIMENSION_FACT_KEYS)[number];

export type DeckStepDimensionSurface =
  | { surface: "off" }
  | { surface: "details" }
  | { surface: "refine_assumed"; value: number }
  | { surface: "refine_owned"; value: number };

function disclosedStepDimensionValue(
  factKey: DeckStepDimensionFactKey,
  numeric: number | null
): number {
  if (numeric != null && numeric > 0) return numeric;
  return factKey === "deck.step_width_m"
    ? DEFAULT_STEP_WIDTH_M
    : DEFAULT_STEP_GOING_M;
}

/**
 * Unresolved step dimensions stay in Details.
 * A captured or disclosed assumption is a Refine Improve row.
 * A user or extracted number is Refine-editable and is not an Improve item.
 * A non-user width that copies the deck edge is the disclosed 1.0 m assumption.
 */
export function classifyDeckStepDimensionForRefine(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  factKey: DeckStepDimensionFactKey;
}): DeckStepDimensionSurface {
  if (
    !deckStepsCommerciallyIncluded({
      facts: params.facts,
      workAreaId: params.workAreaId,
    })
  ) {
    return { surface: "off" };
  }

  const row = getFact([...params.facts], params.workAreaId, params.factKey);
  if (!row || !hasFactValue(row.value)) return { surface: "details" };

  const numeric = getNumberFact(
    [...params.facts],
    params.workAreaId,
    params.factKey
  );

  if (
    isNotSureValue(row.value) ||
    isDisclosedAssumptionSource(row.source)
  ) {
    return {
      surface: "refine_assumed",
      value: disclosedStepDimensionValue(params.factKey, numeric),
    };
  }

  if (
    params.factKey === "deck.step_width_m" &&
    numeric != null &&
    looksLikeUnstatedFullDeckEdgeWidth({
      facts: params.facts,
      workAreaId: params.workAreaId,
      widthM: numeric,
    })
  ) {
    return { surface: "refine_assumed", value: DEFAULT_STEP_WIDTH_M };
  }

  if (numeric != null && numeric > 0) {
    return { surface: "refine_owned", value: numeric };
  }

  return { surface: "details" };
}

export function deckRefineKeepsDisclosedStepWidth(params: {
  factKey: string | null | undefined;
  facts: readonly EstimateFact[];
  workAreaId: string;
  storedValue: unknown;
  candidateAssumed: boolean | undefined;
}): boolean {
  if (params.factKey !== "deck.step_width_m" || params.candidateAssumed !== true) {
    return false;
  }
  const widthM =
    typeof params.storedValue === "number"
      ? params.storedValue
      : Number(params.storedValue);
  if (!Number.isFinite(widthM)) return false;
  return looksLikeUnstatedFullDeckEdgeWidth({
    facts: params.facts,
    workAreaId: params.workAreaId,
    widthM,
  });
}

function splitStepDimension(params: {
  facts: EstimateFact[];
  workAreaId: string;
  factKey: string;
  rejectUnstatedDeckEdge: boolean;
}): { known: number | null; assumed: number | null } {
  const row = getFact(params.facts, params.workAreaId, params.factKey);
  const numeric = getNumberFact(params.facts, params.workAreaId, params.factKey);
  if (numeric == null || !(numeric > 0)) return { known: null, assumed: null };
  if (isNotSureValue(row?.value) || isDisclosedAssumptionSource(row?.source)) {
    return { known: null, assumed: numeric };
  }
  if (
    params.rejectUnstatedDeckEdge &&
    looksLikeUnstatedFullDeckEdgeWidth({
      facts: params.facts,
      workAreaId: params.workAreaId,
      widthM: numeric,
    })
  ) {
    return { known: null, assumed: null };
  }
  return { known: numeric, assumed: null };
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

  const widthParts = splitStepDimension({
    facts,
    workAreaId: params.workAreaId,
    factKey: "deck.step_width_m",
    rejectUnstatedDeckEdge: true,
  });
  const widthResolved = resolvePhysicalRequirement({
    knownValue: widthParts.known,
    assumptionValue: widthParts.assumed ?? DEFAULT_STEP_WIDTH_M,
    assumptionAllowed: params.assumeWidthIfMissing !== false,
  });

  const goingParts = splitStepDimension({
    facts,
    workAreaId: params.workAreaId,
    factKey: "deck.step_going_m",
    rejectUnstatedDeckEdge: false,
  });
  const goingResolved = resolvePhysicalRequirement({
    knownValue: goingParts.known,
    assumptionValue: goingParts.assumed ?? DEFAULT_STEP_GOING_M,
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
