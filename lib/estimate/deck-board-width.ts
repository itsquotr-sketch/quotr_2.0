/**
 * POLISH-01 — Deck board width as a physical quantity driver.
 *
 * Canonical fact: deck.board_width_mm (continuous mm).
 * Missing / Not sure uses a disclosed 140 mm assumption — never a silent
 * package substitution for lineal takeoff.
 */
import { getFact, getNumberFact, isNotSureValue } from "@/lib/estimate/facts";
import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  resolvePhysicalRequirement,
  type PhysicalRequirementResolution,
} from "@/lib/estimate/physical-requirement-resolution";
import type { EstimateFact } from "@/lib/estimate/types";

export const DECK_BOARD_WIDTH_FACT_KEY = "deck.board_width_mm";
export const DECK_BOARD_WIDTH_ASSUMPTION_MM = 140;
export const DECK_BOARD_WIDTH_ASSUMPTION_STATEMENT =
  "Assuming 140 mm decking boards. Confirm board width to calculate this from the job details.";

export function isDisclosedAssumptionSource(
  source: string | null | undefined
): boolean {
  return source === "assumption" || source === "default";
}

/** Persist Not sure as ASSUMED_DISCLOSED 140 mm, never as a KNOWN user fact. */
export function disclosedBoardWidthForNotSure(value: unknown): {
  value: number;
  source: "assumption";
} | null {
  if (!isNotSureValue(value)) return null;
  return {
    value: DECK_BOARD_WIDTH_ASSUMPTION_MM,
    source: "assumption",
  };
}

export function resolveDeckBoardWidthMm(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): {
  mm: number;
  resolution: PhysicalRequirementResolution;
} {
  const facts = params.facts as EstimateFact[];
  const fact = getFact(facts, params.workAreaId, DECK_BOARD_WIDTH_FACT_KEY);
  const numeric = getNumberFact(
    facts,
    params.workAreaId,
    DECK_BOARD_WIDTH_FACT_KEY
  );
  const assumedSource = isDisclosedAssumptionSource(fact?.source);
  const knownValue =
    numeric != null && numeric > 0 && !assumedSource ? numeric : null;
  const assumptionValue =
    numeric != null && numeric > 0 && assumedSource
      ? numeric
      : DECK_BOARD_WIDTH_ASSUMPTION_MM;

  const resolved = resolvePhysicalRequirement({
    knownValue,
    assumptionValue,
    assumptionAllowed: true,
  });

  return {
    mm: resolved.value ?? DECK_BOARD_WIDTH_ASSUMPTION_MM,
    resolution:
      resolved.resolution ?? PHYSICAL_REQUIREMENT_RESOLUTION.ASSUMED,
  };
}
