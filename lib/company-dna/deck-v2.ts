/**
 * DNA-V2C — Deck-only UI exposure and progressive task order.
 *
 * Fence / Retaining Wall stay on V1 `COMPANY_DNA_TASKS`.
 * Foundation `exposeInCurrentUi` is unchanged (V2B new rows remain false).
 */
import {
  COMPANY_DNA_TASKS,
  type CompanyDnaWorkAreaType,
} from "@/lib/company-dna/catalogue";
import {
  companyDnaWorkAreaStatus,
  companyDnaWorkAreaStatusV2,
} from "@/lib/company-dna/derive";
import {
  getCompanyDnaFoundationTask,
  listCompanyDnaTier1Tasks,
  listCompanyDnaTasksVisibleInCurrentUi,
  type CompanyDnaFoundationTask,
} from "@/lib/company-dna/v2-foundation";

export const COMPANY_DNA_V2C_EXPOSED_WORK_AREAS = ["deck"] as const;

export const COMPANY_DNA_DECK_V2_UI_KEYS = [
  "deck.posts.v1",
  "deck.framing.v1",
  "deck.decking.v1",
  "deck.concrete.v1",
  "deck.fascia.v1",
  "deck.demolition.v1",
  "deck.skirting.v1",
] as const;

export const COMPANY_DNA_DECK_TIER1_KEYS = [
  "deck.posts.v1",
  "deck.framing.v1",
  "deck.decking.v1",
] as const;

export const COMPANY_DNA_DECK_OPTIONAL_KEYS = [
  "deck.concrete.v1",
  "deck.fascia.v1",
  "deck.demolition.v1",
  "deck.skirting.v1",
] as const;

export function isCompanyDnaDeckV2WorkArea(workAreaType: string): boolean {
  return workAreaType === "deck";
}

export function listCompanyDnaDeckV2UiTasks(): CompanyDnaFoundationTask[] {
  return COMPANY_DNA_DECK_V2_UI_KEYS.map((key) => {
    const task = getCompanyDnaFoundationTask(key);
    if (!task) {
      throw new Error(`DNA-V2C missing Deck foundation task ${key}`);
    }
    return task;
  });
}

export function listCompanyDnaUiTasksForWorkArea(
  workAreaType: string
): CompanyDnaFoundationTask[] {
  if (isCompanyDnaDeckV2WorkArea(workAreaType)) {
    return listCompanyDnaDeckV2UiTasks();
  }
  return listCompanyDnaTasksVisibleInCurrentUi(workAreaType);
}

export function companyDnaUiWorkAreaStatus(params: {
  workAreaType: string;
  calibratedTaskKeys: Iterable<string>;
}): "benchmarks" | "partly" | "calibrated" {
  const calibrated = new Set(params.calibratedTaskKeys);
  if (isCompanyDnaDeckV2WorkArea(params.workAreaType)) {
    const tier1 = listCompanyDnaTier1Tasks("deck");
    return companyDnaWorkAreaStatusV2({
      tier1Total: tier1.length,
      tier1Calibrated: tier1.filter((task) =>
        calibrated.has(task.calibrationTaskKey)
      ).length,
    });
  }
  const tasks = COMPANY_DNA_TASKS.filter(
    (task) => task.workAreaType === params.workAreaType
  );
  const highImpactTotal = tasks.filter((task) => task.isHighImpact).length;
  const highImpactCalibrated = tasks.filter(
    (task) =>
      task.isHighImpact && calibrated.has(task.calibrationTaskKey)
  ).length;
  const anyCalibrated = tasks.some((task) =>
    calibrated.has(task.calibrationTaskKey)
  );
  return companyDnaWorkAreaStatus({
    highImpactTotal,
    highImpactCalibrated,
    anyCalibrated,
  });
}

export function nextCompanyDnaDeckV2Task(params: {
  calibratedTaskKeys: Iterable<string>;
  currentTaskKey?: string;
}): CompanyDnaFoundationTask | null {
  const calibrated = new Set(params.calibratedTaskKeys);
  if (params.currentTaskKey) calibrated.add(params.currentTaskKey);
  const tasks = listCompanyDnaDeckV2UiTasks();
  const nextTier1 = tasks.find(
    (task) =>
      task.priorityTier === 1 && !calibrated.has(task.calibrationTaskKey)
  );
  if (nextTier1) return nextTier1;
  return (
    tasks.find((task) => !calibrated.has(task.calibrationTaskKey)) ?? null
  );
}

export function deckV2ProgressCounts(calibratedTaskKeys: Iterable<string>): {
  tier1Total: number;
  tier1Calibrated: number;
  optionalTotal: number;
  optionalCalibrated: number;
  calibratedCount: number;
  taskTotal: number;
} {
  const calibrated = new Set(calibratedTaskKeys);
  const tasks = listCompanyDnaDeckV2UiTasks();
  const tier1 = tasks.filter((task) => task.priorityTier === 1);
  const optional = tasks.filter((task) => task.priorityTier !== 1);
  return {
    tier1Total: tier1.length,
    tier1Calibrated: tier1.filter((task) =>
      calibrated.has(task.calibrationTaskKey)
    ).length,
    optionalTotal: optional.length,
    optionalCalibrated: optional.filter((task) =>
      calibrated.has(task.calibrationTaskKey)
    ).length,
    calibratedCount: tasks.filter((task) =>
      calibrated.has(task.calibrationTaskKey)
    ).length,
    taskTotal: tasks.length,
  };
}

export function isCompanyDnaDeckV2TaskKey(taskKey: string): boolean {
  return (COMPANY_DNA_DECK_V2_UI_KEYS as readonly string[]).includes(taskKey);
}

export function deckV2HubHref(params: {
  status: "benchmarks" | "partly" | "calibrated";
  nextTaskKey?: string | null;
}): string {
  if (params.status === "partly" && params.nextTaskKey) {
    return `/app/setup/dna/${encodeURIComponent(params.nextTaskKey)}`;
  }
  if (params.status === "calibrated") {
    return "/app/setup/dna/deck?view=summary";
  }
  return "/app/setup/dna/deck";
}

export function workAreaUsesCompanyDnaV2Ui(
  workAreaType: CompanyDnaWorkAreaType
): boolean {
  return (COMPANY_DNA_V2C_EXPOSED_WORK_AREAS as readonly string[]).includes(
    workAreaType
  );
}
