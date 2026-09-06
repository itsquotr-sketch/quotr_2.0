/**
 * Dashboard personalisation ladder (BETA-1.5).
 *
 * One recommended next step at a time, after first-run is usable:
 *   1. Primary work areas (existing orgs that skipped the new step)
 *   2. Calibrate how you work
 *   3. Review your rates
 *   4. Finish your company profile
 *
 * Never blocks creating an estimate.
 */

import { formatDnaV2DashboardCta } from "@/lib/company-dna/copy";
import { orderCompanyDnaWorkAreas } from "@/lib/company-dna/catalogue";
import { v2LandingPath } from "@/lib/company-dna/v2-ui";

export type PersonalisationStepId =
  | "work_areas"
  | "calibrate"
  | "rates"
  | "company_profile";

export type PersonalisationStep = {
  id: PersonalisationStepId;
  title: string;
  reason: string;
  cta: string;
  href: string;
  helper?: string;
};

export type PersonalisationLadderInput = {
  /** True once pricing has been visited (ready) or first-run is done. */
  firstRunComplete: boolean;
  hasWorkTypePreferences: boolean;
  hasCalibration: boolean;
  /**
   * True when at least one Work Area has two high-impact tasks calibrated.
   * When omitted, hasCalibration is treated as complete (existing callers).
   */
  hasHighImpactCalibration?: boolean;
  /** Active company rates with a cost (labour, material, scope, …). */
  companyRateCount: number;
  hasContactEmail: boolean;
  hasAddress: boolean;
  hasLogo: boolean;
  /** False when organisation_settings.timezone is NULL. */
  hasTimezone?: boolean;
  preferredWorkAreaTypes?: string[];
  deckKeyTasksCalibrated?: number;
  deckKeyTasksTotal?: number;
  fenceKeyTasksCalibrated?: number;
  fenceKeyTasksTotal?: number;
};

const WORK_STEP: PersonalisationStep = {
  id: "work_areas",
  title: "What work does your company normally do?",
  reason: "Tell Quotr the jobs you usually price so calibration and rates match your work first.",
  cta: "Choose your work",
  href: "/app/setup?mode=improve&section=work_areas",
};

const CALIBRATE_STEP: PersonalisationStep = {
  id: "calibrate",
  title: "Make Quotr price more like you",
  reason: "Tell us how long common jobs normally take your crew.",
  cta: "Calibrate how you work",
  href: "/app/setup?mode=improve&section=calibrate",
  helper: "About 3 minutes",
};

const CONTINUE_CALIBRATE_STEP: PersonalisationStep = {
  id: "calibrate",
  title: "Continue making Quotr price more like you",
  reason:
    "Finish the key tasks for the work you do most. One minor task is not enough.",
  cta: "Continue calibration",
  href: "/app/setup?mode=improve&section=calibrate",
};

const RATES_STEP: PersonalisationStep = {
  id: "rates",
  title: "Review your rates",
  reason: "Quotr is using benchmark rates where you haven't added your own.",
  cta: "Review rates",
  href: "/app/rates?section=core",
};

const PROFILE_STEP: PersonalisationStep = {
  id: "company_profile",
  title: "Finish your company profile",
  reason: "Add your logo, address, NZBN and terms when you are ready to send professional quotes.",
  cta: "Open company settings",
  href: "/app/settings/company",
};

/**
 * After first-run labour (0–1 company rates), still prompt rate review.
 * Two or more company cost rates counts as having started the library.
 */
export const RATE_REVIEW_MIN_COMPANY_RATES = 2;

export function resolvePersonalisationNextStep(
  input: PersonalisationLadderInput
): PersonalisationStep | null {
  if (!input.firstRunComplete) return null;

  if (!input.hasWorkTypePreferences) return WORK_STEP;
  const preferred = input.preferredWorkAreaTypes ?? [];
  const deckTotal = input.deckKeyTasksTotal ?? 3;
  const deckCalibrated = input.deckKeyTasksCalibrated ?? 0;
  const fenceTotal = input.fenceKeyTasksTotal ?? 3;
  const fenceCalibrated = input.fenceKeyTasksCalibrated ?? 0;
  const prefersDeck = preferred.includes("deck");
  const prefersFence = preferred.includes("fence");
  const ordered = orderCompanyDnaWorkAreas(preferred);
  const nextV2Area = ordered.find((workArea) => {
    if (workArea === "deck" && prefersDeck && deckCalibrated < deckTotal) {
      return true;
    }
    if (workArea === "fence" && prefersFence && fenceCalibrated < fenceTotal) {
      return true;
    }
    return false;
  });
  const v2CalibrationComplete =
    (!prefersDeck || deckCalibrated >= deckTotal) &&
    (!prefersFence || fenceCalibrated >= fenceTotal);
  const calibrationComplete =
    prefersDeck || prefersFence
      ? v2CalibrationComplete
      : (input.hasHighImpactCalibration ?? input.hasCalibration);
  if (!calibrationComplete) {
    if (nextV2Area === "deck" || nextV2Area === "fence") {
      const remaining =
        nextV2Area === "deck"
          ? Math.max(0, deckTotal - deckCalibrated)
          : Math.max(0, fenceTotal - fenceCalibrated);
      const total = nextV2Area === "deck" ? deckTotal : fenceTotal;
      const copy = formatDnaV2DashboardCta({
        workAreaLabel: nextV2Area === "deck" ? "Deck" : "Fence",
        remainingKeyTasks: remaining,
      });
      const landing = v2LandingPath(nextV2Area);
      return {
        id: "calibrate",
        title: copy.title,
        reason: copy.reason,
        cta: copy.cta,
        href: remaining === total ? landing : `${landing}?view=continue`,
      };
    }
    return input.hasCalibration ? CONTINUE_CALIBRATE_STEP : CALIBRATE_STEP;
  }
  if (input.companyRateCount < RATE_REVIEW_MIN_COMPANY_RATES) return RATES_STEP;

  const profileIncomplete =
    !input.hasContactEmail ||
    !input.hasAddress ||
    !input.hasLogo ||
    input.hasTimezone === false;
  if (profileIncomplete) return PROFILE_STEP;

  return null;
}
