/**
 * Optional personalisation after required onboarding.
 * Opens the next unfinished calibration task. Never the setup wizard.
 */

import { v2LandingPath } from "@/lib/company-dna/v2-ui";

const CALIBRATABLE = ["deck", "fence", "retaining_wall", "bathroom"] as const;

const LABELS: Record<(typeof CALIBRATABLE)[number], string> = {
  deck: "Deck",
  fence: "Fence",
  retaining_wall: "Retaining Wall",
  bathroom: "Bathroom",
};

export type OptionalCalibrationProgress = {
  workAreaType: string;
  calibrated: number;
  total: number;
  complete: boolean;
};

export type OptionalPersonalisationTarget = {
  href: string;
  title: string;
  reason: string;
  workAreaType: (typeof CALIBRATABLE)[number];
};

export function resolveOptionalPersonalisationTarget(input: {
  preferredWorkAreaTypes: readonly string[];
  progress: readonly OptionalCalibrationProgress[];
  dismissed?: boolean;
}): OptionalPersonalisationTarget | null {
  if (input.dismissed) return null;

  for (const workAreaType of CALIBRATABLE) {
    if (!input.preferredWorkAreaTypes.includes(workAreaType)) continue;
    const row = input.progress.find((item) => item.workAreaType === workAreaType);
    if (row?.complete) continue;
    const landing = v2LandingPath(workAreaType);
    const started = (row?.calibrated ?? 0) > 0;
    const label = LABELS[workAreaType];
    return {
      workAreaType,
      href: started ? `${landing}?view=continue` : landing,
      title: started ? `Continue ${label} calibration` : `Calibrate ${label}`,
      reason:
        "This is optional. Quotr can price the job with your labour costs now, and you can personalise crew times later.",
    };
  }

  return null;
}

export function optionalRatesHref(): string {
  return "/app/rates?section=core";
}

export const RATES_CALIBRATION_HREF = "/app/rates?section=calibration";

/** Next unfinished calibration, or the Rates calibration list. Never the setup wizard. */
export function improveRatesAndProductivityHref(input: {
  preferredWorkAreaTypes: readonly string[];
  progress: readonly OptionalCalibrationProgress[];
}): string {
  return (
    resolveOptionalPersonalisationTarget({
      preferredWorkAreaTypes: input.preferredWorkAreaTypes,
      progress: input.progress,
    })?.href ?? RATES_CALIBRATION_HREF
  );
}
