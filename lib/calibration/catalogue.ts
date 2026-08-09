import { BATHROOM_STANDARD_RENO_V1 } from "@/lib/calibration/scenarios/bathroom-standard-reno";
import { DECK_STANDARD_PINE_V1 } from "@/lib/calibration/scenarios/deck-standard-pine";
import type { CalibrationScenario } from "@/lib/calibration/types";

/** Static, versioned calibration catalogue — MVP: Deck + Bathroom only. */
export const CALIBRATION_SCENARIOS: readonly CalibrationScenario[] = [
  DECK_STANDARD_PINE_V1,
  BATHROOM_STANDARD_RENO_V1,
] as const;

export function listCalibrationScenarios(): CalibrationScenario[] {
  return [...CALIBRATION_SCENARIOS];
}

export function getCalibrationScenario(
  scenarioId: string
): CalibrationScenario | undefined {
  return CALIBRATION_SCENARIOS.find((scenario) => scenario.id === scenarioId);
}

/**
 * Prefer company work-type preferences for ordering; never hide scenarios.
 * When multiple preferences match, respect preference list order.
 */
export function orderCalibrationScenarios(
  preferredWorkAreaTypes: string[]
): CalibrationScenario[] {
  const preferenceRank = new Map(
    preferredWorkAreaTypes.map((type, index) => [type, index])
  );
  return [...CALIBRATION_SCENARIOS].sort((a, b) => {
    const aRank = preferenceRank.has(a.workAreaType)
      ? preferenceRank.get(a.workAreaType)!
      : Number.POSITIVE_INFINITY;
    const bRank = preferenceRank.has(b.workAreaType)
      ? preferenceRank.get(b.workAreaType)!
      : Number.POSITIVE_INFINITY;
    if (aRank !== bRank) return aRank - bRank;
    return (
      CALIBRATION_SCENARIOS.indexOf(a) - CALIBRATION_SCENARIOS.indexOf(b)
    );
  });
}
