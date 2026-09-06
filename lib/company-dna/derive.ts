import type { CompanyDnaTaskDefinition } from "@/lib/company-dna/catalogue";

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export type ProductivityDerivation = {
  personHours: number;
  productivity: number;
  ratioToBenchmark: number;
  percentVsBenchmark: number;
  faster: boolean;
};

export function deriveCompanyProductivity(params: {
  task: CompanyDnaTaskDefinition;
  crewSize: number;
  durationHours: number;
}): ProductivityDerivation {
  const personHours = round4(params.crewSize * params.durationHours);
  const productivity = round4(personHours / params.task.authorityQuantity);
  const ratioToBenchmark = productivity / params.task.benchmarkProductivity;
  const percentVsBenchmark = round4((1 - ratioToBenchmark) * 100);
  return {
    personHours,
    productivity,
    ratioToBenchmark,
    percentVsBenchmark,
    faster: productivity < params.task.benchmarkProductivity,
  };
}

export const DNA_HARD_CREW_MIN = 1;
export const DNA_HARD_CREW_MAX = 20;
export const DNA_HARD_HOURS_MIN = 0.25;
export const DNA_HARD_HOURS_MAX = 200;
export const DNA_WARN_CREW = 8;
export const DNA_WARN_HOURS = 40;
export const DNA_HARD_RATIO_MIN = 0.05;
export const DNA_HARD_RATIO_MAX = 20;
export const DNA_WARN_RATIO_FAST = 0.5;
export const DNA_WARN_RATIO_SLOW = 2;

export type DnaValidationCode =
  | "INVALID_CREW"
  | "INVALID_DURATION"
  | "OUTLIER_HARD"
  | "OUTLIER_CONFIRM_REQUIRED";

export type DnaValidationResult =
  | { ok: true; warning: boolean }
  | { ok: false; code: DnaValidationCode; warning: boolean };

export function validateCompanyDnaInputs(params: {
  crewSize: number;
  durationHours: number;
  ratioToBenchmark: number;
  outlierConfirmed: boolean;
}): DnaValidationResult {
  const { crewSize, durationHours, ratioToBenchmark, outlierConfirmed } =
    params;

  if (
    !Number.isFinite(crewSize) ||
    crewSize < DNA_HARD_CREW_MIN ||
    crewSize > DNA_HARD_CREW_MAX
  ) {
    return { ok: false, code: "INVALID_CREW", warning: false };
  }

  if (
    !Number.isFinite(durationHours) ||
    durationHours < DNA_HARD_HOURS_MIN ||
    durationHours > DNA_HARD_HOURS_MAX
  ) {
    return { ok: false, code: "INVALID_DURATION", warning: false };
  }

  if (
    !Number.isFinite(ratioToBenchmark) ||
    ratioToBenchmark < DNA_HARD_RATIO_MIN ||
    ratioToBenchmark > DNA_HARD_RATIO_MAX
  ) {
    return { ok: false, code: "OUTLIER_HARD", warning: false };
  }

  const warning =
    crewSize > DNA_WARN_CREW ||
    durationHours > DNA_WARN_HOURS ||
    ratioToBenchmark < DNA_WARN_RATIO_FAST ||
    ratioToBenchmark > DNA_WARN_RATIO_SLOW;

  if (warning && !outlierConfirmed) {
    return { ok: false, code: "OUTLIER_CONFIRM_REQUIRED", warning: true };
  }

  return { ok: true, warning };
}

export function companyDnaWorkAreaStatus(params: {
  highImpactTotal: number;
  highImpactCalibrated: number;
  anyCalibrated: boolean;
}): "benchmarks" | "partly" | "calibrated" {
  if (params.highImpactCalibrated >= 2) return "calibrated";
  if (params.anyCalibrated || params.highImpactCalibrated > 0) return "partly";
  return "benchmarks";
}

export function companyDnaWorkAreaStatusLabel(
  status: ReturnType<typeof companyDnaWorkAreaStatus>
): string {
  if (status === "calibrated") return "Using your calibration";
  if (status === "partly") return "Partly calibrated";
  return "Using Quotr benchmarks";
}

/**
 * DNA-V2 completion helper. Not wired into V1 hub / Rates UX.
 *
 * Not calibrated: 0 Tier 1
 * Partly calibrated: some but not all Tier 1
 * Using your calibration: every Tier 1 task for that Work Area
 */
export function companyDnaWorkAreaStatusV2(params: {
  tier1Total: number;
  tier1Calibrated: number;
}): "benchmarks" | "partly" | "calibrated" {
  if (params.tier1Total <= 0 || params.tier1Calibrated <= 0) {
    return "benchmarks";
  }
  if (params.tier1Calibrated >= params.tier1Total) return "calibrated";
  return "partly";
}

export function durationHoursFromClock(
  clockHours: number,
  minutes: number
): number {
  const hours = Number.isFinite(clockHours) ? clockHours : NaN;
  const mins = Number.isFinite(minutes) ? minutes : NaN;
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return NaN;
  if (hours < 0 || mins < 0 || mins >= 60) return NaN;
  return round4(hours + mins / 60);
}

export function clockFromDurationHours(durationHours: number): {
  hours: number;
  minutes: number;
} {
  if (!Number.isFinite(durationHours) || durationHours < 0) {
    return { hours: 0, minutes: 0 };
  }
  const totalMinutes = Math.round(durationHours * 60);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function deriveCompanyProductivityFromClock(params: {
  task: CompanyDnaTaskDefinition;
  crewSize: number;
  clockHours: number;
  minutes: number;
}): ProductivityDerivation & { durationHours: number } {
  const durationHours = durationHoursFromClock(
    params.clockHours,
    params.minutes
  );
  return {
    durationHours,
    ...deriveCompanyProductivity({
      task: params.task,
      crewSize: params.crewSize,
      durationHours: Number.isFinite(durationHours) ? durationHours : 0,
    }),
  };
}
