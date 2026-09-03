/**
 * COMPANY DNA-02 — builder-facing copy.
 * Presentation only. Does not change derivation, RPCs, or economics.
 */

export const DNA_CREW_HELPER =
  "How many people from your team would normally work on this task? Include everyone on it — an approximate answer is fine.";

export const DNA_TIME_HELPER =
  "How many total hours would that crew usually spend on the task? Enter the time on the clock, not person-hours. Example: 2 people working 8 hours → enter 8 hours, not 16.";

export const DNA_WHY_GENERIC =
  "Quotr uses this to estimate how many labour hours your crew needs.";

export const DNA_OUTLIER_WARNING =
  "This is quite different from the Quotr benchmark. That may be correct — check the crew size and hours before saving.";

export const DNA_OUTLIER_SAVE_ANYWAY = "Save anyway";
export const DNA_SAVE_PRIMARY = "Save for future estimates";
export const DNA_RESET_CTA = "Use Quotr benchmark";
export const DNA_RESET_CONSEQUENCE =
  "Future estimates will use the Quotr benchmark for this task. Existing estimates will not change until updated.";

export const DNA_NEXT_TASK_CTA = "Calibrate next task";
export const DNA_BACK_TO_HUB = "Back to Company DNA";

export const DNA_RATES_PRODUCTIVITY_HELPER =
  "Lower means fewer labour hours per unit.";

export const DNA_STALE_EXPLANATION =
  "Update this estimate to apply the latest job details and company settings.";

export const DNA_STALE_KNOWN_SETTINGS =
  "Your company settings changed. Update this estimate to apply your latest productivity.";

export function formatDnaPersonHoursLine(crewSize: number, durationHours: number): string {
  const crew = Number.isFinite(crewSize) ? crewSize : 0;
  const hours = Number.isFinite(durationHours) ? durationHours : 0;
  const personHours = Math.round(crew * hours * 10000) / 10000;
  return `${crew} people × ${hours} hours = ${personHours} person-hours.`;
}

export function formatDnaComparisonCopy(params: {
  faster: boolean;
  percentVsBenchmark: number;
}): string {
  const abs = Math.round(Math.abs(params.percentVsBenchmark));
  if (!Number.isFinite(abs) || abs < 5) {
    return "This is close to the Quotr benchmark for this task.";
  }
  if (params.faster) {
    return `Your crew is about ${abs}% faster than the Quotr benchmark for this task.`;
  }
  return `Your crew takes about ${abs}% more labour time than the Quotr benchmark.`;
}

export function formatDnaSavedResult(params: {
  taskLabel: string;
  workAreaLabel: string;
  faster?: boolean;
  percentVsBenchmark?: number;
}): string {
  const comparison =
    params.percentVsBenchmark != null && Number.isFinite(params.percentVsBenchmark)
      ? formatDnaComparisonCopy({
          faster: Boolean(params.faster),
          percentVsBenchmark: params.percentVsBenchmark,
        })
      : null;
  const saved = `Saved. Quotr will use your ${params.taskLabel} productivity in future ${params.workAreaLabel.toLowerCase()} estimates.`;
  return comparison ? `${saved} ${comparison}` : saved;
}

export function formatDnaProgressCopy(params: {
  calibratedCount: number;
  taskTotal: number;
  highImpactCalibrated: number;
  highImpactTotal: number;
}): string {
  if (params.highImpactTotal > 0) {
    return `${params.highImpactCalibrated} of ${params.highImpactTotal} key tasks calibrated`;
  }
  return `${params.calibratedCount} of ${params.taskTotal} tasks calibrated`;
}

export function formatLabourProductivityDisclosure(params: {
  calibratedLabourCount: number;
  labourCount: number;
  dominantWorkAreaLabel?: string | null;
}): string | null {
  if (params.labourCount <= 0) return null;
  if (params.calibratedLabourCount <= 0) {
    return "Some labour productivity still uses Quotr benchmarks.";
  }
  if (
    params.calibratedLabourCount === params.labourCount &&
    params.dominantWorkAreaLabel
  ) {
    return `${params.dominantWorkAreaLabel} labour uses your calibrated productivity.`;
  }
  if (params.calibratedLabourCount === params.labourCount) {
    return "Labour uses your calibrated productivity.";
  }
  return "Some labour productivity still uses Quotr benchmarks.";
}
