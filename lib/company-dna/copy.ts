/**
 * COMPANY DNA-02 — builder-facing copy.
 * Presentation only. Does not change derivation, RPCs, or economics.
 */

import { formatDnaProductivityHours, formatDnaScenarioMeasure } from "@/lib/company-dna/quantity-format";

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
  "We'll show you a typical task. Tell us how many workers you'd normally use and how long they'd take.";

export const DNA_DECK_NORMAL_CONDITIONS =
  "Assume straightforward residential access, normal working conditions and materials close to the work area.";

export const DNA_DECK_TIER1_COMPLETE_TITLE =
  "Your Deck estimates are now using your key productivity.";

export const DNA_DECK_TIER1_COMPLETE_BODY =
  "You can keep refining other tasks now, or come back later.";

export const DNA_FENCE_INTRO_TITLE =
  "Calibrate how your team normally completes common fence tasks.";

export const DNA_FENCE_INTRO_BODY =
  "We'll show you a typical task. Tell us how many workers you'd normally use and how long they'd take.";

export const DNA_FENCE_NORMAL_CONDITIONS =
  "Assume straightforward residential access, normal ground conditions and materials close to the work area.";

export const DNA_FENCE_TIER1_COMPLETE_TITLE =
  "Your Fence estimates are now using your key productivity.";

export const DNA_FENCE_TIER1_COMPLETE_BODY =
  "You can keep refining other fence tasks now, or come back later.";

export const DNA_RW_INTRO_TITLE =
  "Calibrate how your team normally completes common retaining wall tasks.";

export const DNA_RW_INTRO_BODY =
  "We'll show you typical retaining wall work. Tell us how many workers you'd normally use and how long they'd take.";

export const DNA_RW_NORMAL_CONDITIONS =
  "Assume straightforward residential access, normal ground conditions and materials close to the work area.";

export const DNA_RW_TIER1_COMPLETE_TITLE =
  "Your timber retaining estimates are now using your key productivity.";

export const DNA_RW_TIER1_COMPLETE_BODY =
  "You can keep refining other retaining wall tasks now, or come back later.";

export const DNA_HUB_TITLE = "Company DNA";
export const DNA_HUB_INTRO =
  "Teach Quotr how your team normally works so future estimates use your productivity.";
export const DNA_HUB_CONCEPT =
  "Quotr learns how long your crew normally takes on key tasks and uses that productivity in future estimates.";

export const DNA_SOURCE_YOUR_CALIBRATION = "Your calibration";
export const DNA_SOURCE_QUOTR_BENCHMARK = "Quotr benchmark";
export const DNA_SOURCE_COMPANY_RATE = "Your company rate";
export const DNA_CALIBRATE = "Calibrate";

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
  if (unit === "m3") return "cubic metre";
  if (unit === "ea") return "each";
  if (unit === "bag") return "bag";
  if (unit === "post") return "post";
  if (unit === "gate") return "gate";
  if (unit === "section") return "section";
  return unit;
}

export function formatDnaPersonMinutesPerUnit(
  productivityHoursPerUnit: number,
  unit: string
): string {
  const minutes = Math.round(productivityHoursPerUnit * 60);
  return `${minutes} person-minutes per ${formatDnaAuthorityUnitLabel(unit)}`;
}

export function formatDnaPersonHoursPerUnit(
  productivityHoursPerUnit: number,
  unit: string
): string {
  return `${formatDnaProductivityHours(productivityHoursPerUnit)} person-hours per ${formatDnaAuthorityUnitLabel(unit)}`;
}

export function formatDnaDeckResultPrimary(params: {
  productivityHoursPerUnit: number;
  unit: string;
}): string {
  const useHours = params.productivityHoursPerUnit >= 1.5;
  const allowance = useHours
    ? formatDnaPersonHoursPerUnit(
        params.productivityHoursPerUnit,
        params.unit
      )
    : formatDnaPersonMinutesPerUnit(
        params.productivityHoursPerUnit,
        params.unit
      );
  return `Your crew normally allows about ${allowance}.`;
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
  const displayUnit =
    unit === "m2" ? "m²" : unit === "m3" ? "m³" : unit;
  return `${formatDnaProductivityHours(value)} person-hours / ${displayUnit}`;
}

export function dnaV2TaskTitle(taskKey: string, fallbackLabel: string): string {
  if (taskKey === "deck.posts.v1") return "Deck posts";
  if (taskKey === "deck.framing.v1") return "Deck framing";
  if (taskKey === "deck.decking.v1") return "Decking";
  if (taskKey === "deck.concrete.v1") {
    return "Mix and place concrete for deck posts";
  }
  if (taskKey === "deck.fascia.v1") return "Fascia / edge boards";
  if (taskKey === "deck.skirting.v1") return "Full-height deck skirting";
  if (taskKey === "deck.demolition.v1") return "Existing deck removal";
  if (taskKey === "fence.posts.v1") return "Fence posts";
  if (taskKey === "fence.rails.v1") return "Rails";
  if (taskKey === "fence.boards.v1") return "Palings";
  if (taskKey === "fence.boards.horizontal.v1") return "Horizontal slats";
  if (taskKey === "fence.concrete.v1") {
    return "Mix and place concrete for fence posts";
  }
  if (taskKey === "fence.section.v1") return "Fence sections";
  if (taskKey === "fence.capping.v1") return "Capping";
  if (taskKey === "fence.gate.v1") return "Gate";
  if (taskKey === "fence.demolition.v1") return "Demolition";
  if (taskKey === "retaining_wall.excavation.machine.v1") {
    return "Machine excavation";
  }
  if (taskKey === "retaining_wall.excavation.manual.v1") {
    return "Manual excavation";
  }
  if (taskKey === "retaining_wall.piles.v1") {
    return "Timber retaining piles (machine-assisted)";
  }
  if (taskKey === "retaining_wall.face.v1") {
    return "Retaining wall face boards";
  }
  if (taskKey === "retaining_wall.drainage.v1") return "Drainage coil";
  if (taskKey === "retaining_wall.backfill.v1") return "Drainage backfill";
  if (taskKey === "retaining_wall.concrete.v1") {
    return "Mix and place post-hole concrete";
  }
  if (taskKey === "retaining_wall.sleeper.posts.v1") {
    return "Steel sleeper posts (machine-assisted)";
  }
  if (taskKey === "retaining_wall.sleeper.sleepers.v1") {
    return "Concrete sleepers";
  }
  if (taskKey === "retaining_wall.masonry.subbase.v1") {
    return "Prepare sub-base";
  }
  if (taskKey === "retaining_wall.masonry.footing.v1") {
    return "Form and pour footing";
  }
  if (taskKey === "retaining_wall.masonry.rebar.v1") {
    return "Install reinforcing";
  }
  if (taskKey === "retaining_wall.masonry.block.v1") return "Lay blockwork";
  if (taskKey === "retaining_wall.masonry.core_fill.v1") return "Core fill";
  if (taskKey === "retaining_wall.masonry.waterproof.v1") {
    return "Waterproof the retaining face";
  }
  return fallbackLabel;
}

export function deckV2TaskTitle(taskKey: string, fallbackLabel: string): string {
  return dnaV2TaskTitle(taskKey, fallbackLabel);
}

export function dnaV2ScenarioCopy(task: {
  calibrationTaskKey: string;
  authorityQuantity: number;
  authorityUnit: string;
  referenceQuantity: number;
  referenceUnit: string;
}): string {
  const qty = task.authorityQuantity;
  const lm = (value: number) => formatDnaScenarioMeasure(value, "lm");
  switch (task.calibrationTaskKey) {
    case "deck.posts.v1":
      return `Install ${qty} deck posts — include normal hole digging, setting, plumbing and securing the posts. Do not include mixing or placing concrete; that is a separate task.`;
    case "deck.framing.v1":
      return `Install ${lm(qty)} of deck framing — roughly the framing for a straightforward 20 m² deck.`;
    case "deck.decking.v1":
      return `Lay the decking boards for a typical 20 m² deck — ${lm(qty)} of boards.`;
    case "deck.concrete.v1":
      return `Mix and place ${qty} bags of 20 kg post-hole concrete, with the posts already set. This is labour time only — not the bag price.`;
    case "deck.fascia.v1":
      return `Fit ${lm(qty)} of fascia / edge boards. Installation only.`;
    case "deck.skirting.v1":
      return `Fit ${lm(qty)} of full-height deck skirting / screening.`;
    case "deck.demolition.v1":
      return `Strip and remove an existing ${qty} m² timber deck at the workface. Does not include skip-bin cartage, tip fees, or off-site disposal.`;
    case "fence.posts.v1":
      return `Install ${qty} fence posts — include normal hole digging, positioning, plumbing and setting the posts. Do not include mixing or placing concrete; that is a separate task.`;
    case "fence.rails.v1":
      return `Install ${lm(qty)} of fence rails — three rails on a typical 20 m paling fence.`;
    case "fence.boards.v1":
      return `Hang ${lm(qty)} of vertical palings / boards. This is not horizontal slats.`;
    case "fence.boards.horizontal.v1":
      return `Install about ${qty} lineal metres of horizontal slats — roughly a typical 18 m horizontal-slat fence. This is not vertical palings.`;
    case "fence.concrete.v1":
      return `Mix and place ${qty} bags of 20 kg post-hole concrete, with the posts already set. This is labour time only — not the bag price. Do not include digging holes or setting posts.`;
    case "fence.section.v1":
      return `Install ${qty} prefabricated fence sections, with the posts already in.`;
    case "fence.capping.v1":
      return `Fit ${lm(qty)} of fence capping. Installation only.`;
    case "fence.gate.v1":
      return `Build and hang ${qty} timber fence gate — frame, hinges and latch. Palings stay on paling labour.`;
    case "fence.demolition.v1":
      return `Take down ${lm(qty)} of existing timber fence at the workface. Does not include skip-bin cartage, tip fees, or off-site disposal.`;
    case "retaining_wall.excavation.machine.v1":
      return `Excavate ${formatDnaScenarioMeasure(qty, "m3")} using a small excavator. This is your crew's labour attending the machine — not the plant hire cost. Do not include hand digging, pile holes, or spoil cartage.`;
    case "retaining_wall.excavation.manual.v1":
      return `Hand-dig ${formatDnaScenarioMeasure(qty, "m3")} when a digger cannot reach the workface. This is manual excavation — not machine excavation.`;
    case "retaining_wall.piles.v1":
      return `Install ${qty} timber retaining piles with machine-assisted / accessible access. Include set-out, attending the machine-dug hole, placing, aligning and plumbing. Do not include mixing concrete, bulk excavation, or mini-excavator hire. This does not apply to hand-dug or fully manual pile installation.`;
    case "retaining_wall.face.v1":
      return `Install retaining wall face boards / timber facing for ${formatDnaScenarioMeasure(qty, "m2")}. Piles already in. Do not include piles, drainage, or bulk excavation.`;
    case "retaining_wall.drainage.v1":
      return `Lay ${lm(qty)} of drainage coil (novacoil) behind the wall. Include joining and positioning. Do not include drainage metal, bulk excavation, or plant.`;
    case "retaining_wall.backfill.v1":
      return `Place, spread and basically consolidate ${formatDnaScenarioMeasure(qty, "m3")} of drainage metal. Does not include laying coil, bulk excavation, plate-compactor hire, or spoil haulage.`;
    case "retaining_wall.concrete.v1":
      return `Mix and place ${qty} bags of post-hole concrete, with piles or posts already set. Labour only — not the bag price, and not pile or post installation.`;
    case "retaining_wall.sleeper.posts.v1":
      return `Install ${qty} steel sleeper posts with machine-assisted / accessible access. Include set-out, attending the machine hole, placing, aligning and plumbing. Do not include sleeper install, mixing concrete, or mini-excavator hire. This does not apply to fully manual post installation.`;
    case "retaining_wall.sleeper.sleepers.v1":
      return `Set ${qty} concrete sleepers once the steel posts are in. Lift, slot, pack and level. Do not include post installation, concrete, or drainage.`;
    case "retaining_wall.masonry.subbase.v1":
      return `Place and compact ${formatDnaScenarioMeasure(qty, "m2")} of masonry footing sub-base. Trench already prepared. Do not include bulk excavation or pouring the footing.`;
    case "retaining_wall.masonry.footing.v1":
      return `Form and pour ${formatDnaScenarioMeasure(qty, "m3")} of masonry strip-footing concrete. Place, level and consolidate. This is not bagged post-hole concrete.`;
    case "retaining_wall.masonry.rebar.v1":
      return `Install ${lm(qty)} of stated masonry reinforcing. Do not invent a bar schedule.`;
    case "retaining_wall.masonry.block.v1":
      return `Lay ${formatDnaScenarioMeasure(qty, "m2")} of masonry retaining blockwork — self-perform, not a subcontractor. Do not include core fill, waterproofing, or the footing.`;
    case "retaining_wall.masonry.core_fill.v1":
      return `Core fill ${formatDnaScenarioMeasure(qty, "m3")} of grout once the blocks are laid. Do not include laying blockwork.`;
    case "retaining_wall.masonry.waterproof.v1":
      return `Waterproof ${formatDnaScenarioMeasure(qty, "m2")} of the retaining-side masonry face — self-perform. Do not include drainage metal or novacoil.`;
    default:
      return `Typical quantity: ${formatDnaScenarioMeasure(qty, task.authorityUnit)}.`;
  }
}

export function deckV2ScenarioCopy(task: {
  calibrationTaskKey: string;
  authorityQuantity: number;
  authorityUnit: string;
  referenceQuantity: number;
  referenceUnit: string;
}): string {
  return dnaV2ScenarioCopy(task);
}

export function deckV2IncludedCopy(workIncluded: string): string {
  return workIncluded;
}

export function formatDnaV2ProgressIndicator(params: {
  workAreaLabel: string;
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
    return `${params.workAreaLabel} calibration · Task ${taskNumber} of ${params.tier1Total} key tasks`;
  }
  return `Refine your ${params.workAreaLabel} calibration · Optional task ${params.optionalIndex} of ${params.optionalTotal}`;
}

export function formatDnaDeckProgressIndicator(params: {
  tier1Calibrated: number;
  tier1Total: number;
  optionalIndex: number;
  optionalTotal: number;
  currentIsTier1: boolean;
}): string {
  return formatDnaV2ProgressIndicator({
    workAreaLabel: "Deck",
    ...params,
  });
}

export function formatDnaV2DashboardCta(params: {
  workAreaLabel: string;
  remainingKeyTasks: number;
  totalKeyTasks?: number;
}): {
  title: string;
  reason: string;
  cta: string;
} {
  const area = params.workAreaLabel;
  const total = params.totalKeyTasks ?? 3;
  if (params.remainingKeyTasks <= 0) {
    return {
      title: `Your ${area} estimates use your key productivity`,
      reason: `You can keep refining other ${area.toLowerCase()} tasks when you have a moment.`,
      cta: `Review ${area} calibration`,
    };
  }
  if (params.remainingKeyTasks === total) {
    return {
      title: `Improve your ${area} estimates`,
      reason: `Tell Quotr how your crew normally completes a few common ${area.toLowerCase()} tasks.`,
      cta: "Continue calibration",
    };
  }
  return {
    title: `Calibrate ${params.remainingKeyTasks} more key ${area} ${
      params.remainingKeyTasks === 1 ? "task" : "tasks"
    }`,
    reason: `Finish the key ${area} tasks so estimates use your crew's pace.`,
    cta: "Continue calibration",
  };
}

export function formatDnaDeckDashboardCta(remainingKeyTasks: number): {
  title: string;
  reason: string;
  cta: string;
} {
  return formatDnaV2DashboardCta({
    workAreaLabel: "Deck",
    remainingKeyTasks,
  });
}

export function formatDnaFenceDashboardCta(remainingKeyTasks: number): {
  title: string;
  reason: string;
  cta: string;
} {
  return formatDnaV2DashboardCta({
    workAreaLabel: "Fence",
    remainingKeyTasks,
  });
}

export function formatDnaRwDashboardCta(params: {
  remainingKeyTasks: number;
  totalKeyTasks?: number;
}): {
  title: string;
  reason: string;
  cta: string;
} {
  return formatDnaV2DashboardCta({
    workAreaLabel: "Retaining Wall",
    remainingKeyTasks: params.remainingKeyTasks,
    totalKeyTasks: params.totalKeyTasks,
  });
}

export function formatDnaRwHubProgress(params: {
  systems: ReadonlyArray<{
    label: string;
    status: "benchmarks" | "partly" | "calibrated";
    tier1Calibrated: number;
    tier1Total: number;
  }>;
}): string {
  const complete = params.systems.filter((row) => row.status === "calibrated");
  const remaining = params.systems.filter((row) => row.status !== "calibrated");
  if (complete.length === params.systems.length) {
    return "Timber, sleeper and masonry key tasks calibrated";
  }
  if (complete.length > 0) {
    const names = complete.map((row) => row.label).join(", ");
    const still = remaining.map((row) => row.label.toLowerCase()).join(" and ");
    return `${names} retaining is calibrated · ${still} still use Quotr benchmarks`;
  }
  const next = params.systems.find((row) => row.tier1Calibrated > 0) ?? params.systems[0];
  if (!next) return "Not calibrated";
  return `${next.tier1Calibrated} of ${next.tier1Total} ${next.label.toLowerCase()} key tasks calibrated`;
}

export function formatDnaRwSystemLine(params: {
  label: string;
  status: "benchmarks" | "partly" | "calibrated";
  tier1Calibrated: number;
  tier1Total: number;
}): string {
  if (params.status === "calibrated") return `${params.label}: Calibrated`;
  if (params.status === "partly") {
    return `${params.label}: ${params.tier1Calibrated} of ${params.tier1Total} key tasks`;
  }
  return `${params.label}: Uses Quotr benchmarks`;
}

export function formatDnaRwRatesSummary(params: {
  systems: ReadonlyArray<{
    label: string;
    status?: "benchmarks" | "partly" | "calibrated";
    tier1Calibrated: number;
    tier1Total: number;
  }>;
}): string {
  const complete = params.systems.filter((row) =>
    row.status
      ? row.status === "calibrated"
      : row.tier1Calibrated >= row.tier1Total && row.tier1Total > 0
  );
  const remaining = params.systems.filter((row) => !complete.includes(row));
  if (complete.length === 0) return "Not calibrated";
  if (remaining.length === 0) {
    return "Timber, sleeper and masonry calibrated";
  }
  const names = complete.map((row) => row.label).join(" and ");
  if (remaining.length > 1) {
    return `${names} calibrated · Other systems using Quotr benchmarks`;
  }
  return `${names} calibrated · ${remaining[0]?.label ?? "Other systems"} using Quotr benchmarks`;
}

export function formatDnaOptionalRemaining(params: {
  optionalTotal: number;
  optionalCalibrated: number;
}): string | null {
  const remaining = Math.max(0, params.optionalTotal - params.optionalCalibrated);
  if (params.optionalTotal <= 0 || remaining <= 0) return null;
  return `${remaining} optional ${remaining === 1 ? "task" : "tasks"} still using Quotr benchmarks`;
}

export function formatDnaSupportedTaskCoverage(params: {
  calibratedCount: number;
  taskTotal: number;
}): string {
  return `${params.calibratedCount} of ${params.taskTotal} supported tasks calibrated`;
}

export function formatDnaCompactHoursPerUnit(value: number, unit: string): string {
  const displayUnit = unit === "m2" ? "m²" : unit === "m3" ? "m³" : unit;
  return `${formatDnaProductivityHours(value)} h/${displayUnit}`;
}

export function dnaV2CompleteCopy(
  workAreaType: string,
  system?: string | null
): {
  title: string;
  body: string;
} {
  if (workAreaType === "fence") {
    return {
      title: DNA_FENCE_TIER1_COMPLETE_TITLE,
      body: DNA_FENCE_TIER1_COMPLETE_BODY,
    };
  }
  if (workAreaType === "retaining_wall") {
    if (system === "sleeper") {
      return {
        title: "Your sleeper retaining estimates are now using your key productivity.",
        body: DNA_RW_TIER1_COMPLETE_BODY,
      };
    }
    if (system === "masonry") {
      return {
        title: "Your masonry retaining estimates are now using your key productivity.",
        body: DNA_RW_TIER1_COMPLETE_BODY,
      };
    }
    return {
      title: DNA_RW_TIER1_COMPLETE_TITLE,
      body: DNA_RW_TIER1_COMPLETE_BODY,
    };
  }
  return {
    title: DNA_DECK_TIER1_COMPLETE_TITLE,
    body: DNA_DECK_TIER1_COMPLETE_BODY,
  };
}
