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

export const DNA_DECK_INTRO_TITLE =
  "Calibrate how your team normally completes common deck tasks.";

export const DNA_DECK_INTRO_BODY =
  "We'll show you a typical task. Tell us how many workers you'd use and how long they'd take. Quotr will use that to make future estimates more like yours.";

export const DNA_DECK_NORMAL_CONDITIONS =
  "Assume straightforward residential access, normal working conditions and materials close to the work area.";

export const DNA_DECK_TIER1_COMPLETE_TITLE =
  "Your Deck estimates are now using your key productivity.";

export const DNA_DECK_TIER1_COMPLETE_BODY =
  "You can keep refining other tasks now, or come back later.";

export const DNA_SAVE_CONTINUE = "Save and continue";
export const DNA_OUTLIER_YES = "Yes, use this";
export const DNA_OUTLIER_BACK = "Go back";
export const DNA_SKIP_FOR_NOW = "Skip for now";
export const DNA_KEEP_REFINING = "Keep refining";
export const DNA_DONE = "Done";
export const DNA_RECALIBRATE = "Recalibrate";
export const DNA_RESET_CONFIRM_TITLE = "Use the Quotr benchmark?";

export function formatDnaAuthorityUnitLabel(unit: string): string {
  if (unit === "lm") return "lineal metre";
  if (unit === "m2") return "m²";
  if (unit === "ea") return "each";
  if (unit === "bag") return "bag";
  if (unit === "post") return "post";
  return unit;
}

export function formatDnaPersonMinutesPerUnit(
  productivityHoursPerUnit: number,
  unit: string
): string {
  const minutes = Math.round(productivityHoursPerUnit * 60);
  return `${minutes} person-minutes per ${formatDnaAuthorityUnitLabel(unit)}`;
}

export function formatDnaDeckResultPrimary(params: {
  productivityHoursPerUnit: number;
  unit: string;
}): string {
  return `Your crew normally allows about ${formatDnaPersonMinutesPerUnit(
    params.productivityHoursPerUnit,
    params.unit
  )}.`;
}

export function formatDnaDeckResultComparison(params: {
  faster: boolean;
  percentVsBenchmark: number;
}): string {
  const abs = Math.round(Math.abs(params.percentVsBenchmark));
  if (!Number.isFinite(abs) || abs < 5) {
    return "That's about the same as the Quotr benchmark.";
  }
  if (params.faster) {
    return `That's about ${abs}% faster than the Quotr benchmark.`;
  }
  return `That's about ${abs}% slower than the Quotr benchmark.`;
}

export function formatDnaOutlierPrompt(faster: boolean): string {
  return faster
    ? "That looks much faster than the Quotr benchmark. Is that right?"
    : "That looks much slower than the Quotr benchmark. Is that right?";
}

export function formatDnaClockTimePerUnit(params: {
  crewSize: number;
  productivityHoursPerUnit: number;
  unit: string;
}): string | null {
  if (!Number.isFinite(params.crewSize) || params.crewSize < 1) return null;
  const clockMinutes = Math.round(
    (params.productivityHoursPerUnit / params.crewSize) * 60
  );
  if (!Number.isFinite(clockMinutes) || clockMinutes <= 0) return null;
  return `With a ${params.crewSize}-person crew, that works out to about ${clockMinutes} minutes of clock time per ${formatDnaAuthorityUnitLabel(params.unit)}.`;
}

export function formatDnaHoursPerUnit(value: number, unit: string): string {
  const displayUnit = unit === "m2" ? "m²" : unit;
  return `${value} person-hours / ${displayUnit}`;
}

export function deckV2TaskTitle(taskKey: string, fallbackLabel: string): string {
  if (taskKey === "deck.posts.v1") return "Deck posts";
  if (taskKey === "deck.framing.v1") return "Deck framing";
  if (taskKey === "deck.decking.v1") return "Decking";
  if (taskKey === "deck.concrete.v1") {
    return "Mix and place concrete for deck posts";
  }
  if (taskKey === "deck.fascia.v1") return "Fascia / edge boards";
  if (taskKey === "deck.skirting.v1") return "Full-height deck skirting";
  if (taskKey === "deck.demolition.v1") return "Existing deck removal";
  return fallbackLabel;
}

export function deckV2ScenarioCopy(task: {
  calibrationTaskKey: string;
  authorityQuantity: number;
  authorityUnit: string;
  referenceQuantity: number;
  referenceUnit: string;
}): string {
  const qty = task.authorityQuantity;
  switch (task.calibrationTaskKey) {
    case "deck.posts.v1":
      return `Install ${qty} deck posts — include normal hole digging, setting, plumbing and securing the posts. Do not include mixing or placing concrete; that is a separate task.`;
    case "deck.framing.v1":
      return `Install ${qty} lineal metres of deck framing — roughly the framing for a straightforward 20 m² deck.`;
    case "deck.decking.v1":
      return `Lay the decking boards for a typical 20 m² deck — about ${qty} lineal metres of boards.`;
    case "deck.concrete.v1":
      return `Mix and place ${qty} bags of 20 kg post-hole concrete, with the posts already set. This is labour time only — not the bag price.`;
    case "deck.fascia.v1":
      return `Fit about ${qty} lineal metres of fascia / edge boards. Installation only.`;
    case "deck.skirting.v1":
      return `Fit about ${qty} lineal metres of full-height deck skirting / screening.`;
    case "deck.demolition.v1":
      return `Strip and remove an existing ${qty} m² timber deck at the workface. Does not include skip-bin cartage, tip fees, or off-site disposal.`;
    default:
      return `Typical quantity: ${qty} ${task.authorityUnit}.`;
  }
}

export function deckV2IncludedCopy(workIncluded: string): string {
  return workIncluded;
}

export function formatDnaDeckProgressIndicator(params: {
  tier1Calibrated: number;
  tier1Total: number;
  optionalIndex: number;
  optionalTotal: number;
  currentIsTier1: boolean;
}): string {
  if (params.currentIsTier1) {
    const taskNumber = Math.min(
      params.tier1Calibrated + 1,
      params.tier1Total
    );
    return `Deck calibration · Task ${taskNumber} of ${params.tier1Total} key tasks`;
  }
  return `Refine your Deck calibration · Optional task ${params.optionalIndex} of ${params.optionalTotal}`;
}

export function formatDnaDeckDashboardCta(remainingKeyTasks: number): {
  title: string;
  reason: string;
  cta: string;
} {
  if (remainingKeyTasks <= 0) {
    return {
      title: "Your Deck estimates use your key productivity",
      reason: "You can keep refining other deck tasks when you have a moment.",
      cta: "Review Deck calibration",
    };
  }
  if (remainingKeyTasks === 3) {
    return {
      title: "Improve your Deck estimates",
      reason:
        "Tell Quotr how your crew normally completes a few common deck tasks.",
      cta: "Improve your Deck estimates",
    };
  }
  return {
    title: "Improve your Deck estimates",
    reason: "Finish the key Deck tasks so estimates use your crew's pace.",
    cta: `Calibrate ${remainingKeyTasks} more key Deck ${
      remainingKeyTasks === 1 ? "task" : "tasks"
    }`,
  };
}
