/**
 * DNA-V2C/V2D — Work Area V2 UI exposure.
 *
 * Deck and Fence use the V2 task-level experience.
 * Retaining Wall stays on V1 `COMPANY_DNA_TASKS`.
 * Foundation `exposeInCurrentUi` is unchanged (new rows remain false).
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

export const COMPANY_DNA_V2_UI_WORK_AREAS = ["deck", "fence"] as const;

export type CompanyDnaV2UiWorkArea =
  (typeof COMPANY_DNA_V2_UI_WORK_AREAS)[number];

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

export const COMPANY_DNA_FENCE_V2_UI_KEYS = [
  "fence.posts.v1",
  "fence.rails.v1",
  "fence.boards.v1",
  "fence.concrete.v1",
  "fence.boards.horizontal.v1",
  "fence.section.v1",
  "fence.capping.v1",
  "fence.gate.v1",
  "fence.demolition.v1",
] as const;

export const COMPANY_DNA_FENCE_TIER1_KEYS = [
  "fence.posts.v1",
  "fence.rails.v1",
  "fence.boards.v1",
] as const;

export const COMPANY_DNA_FENCE_OPTIONAL_KEYS = [
  "fence.concrete.v1",
  "fence.boards.horizontal.v1",
  "fence.section.v1",
  "fence.capping.v1",
  "fence.gate.v1",
  "fence.demolition.v1",
] as const;

const KEYS_BY_AREA: Record<CompanyDnaV2UiWorkArea, readonly string[]> = {
  deck: COMPANY_DNA_DECK_V2_UI_KEYS,
  fence: COMPANY_DNA_FENCE_V2_UI_KEYS,
};

export function isCompanyDnaV2WorkArea(
  workAreaType: string
): workAreaType is CompanyDnaV2UiWorkArea {
  return workAreaType === "deck" || workAreaType === "fence";
}

export function isCompanyDnaDeckV2WorkArea(workAreaType: string): boolean {
  return workAreaType === "deck";
}

export function isCompanyDnaFenceV2WorkArea(workAreaType: string): boolean {
  return workAreaType === "fence";
}

function tasksForKeys(keys: readonly string[], label: string): CompanyDnaFoundationTask[] {
  return keys.map((key) => {
    const task = getCompanyDnaFoundationTask(key);
    if (!task) {
      throw new Error(`DNA V2 missing ${label} foundation task ${key}`);
    }
    return task;
  });
}

export function listCompanyDnaDeckV2UiTasks(): CompanyDnaFoundationTask[] {
  return tasksForKeys(COMPANY_DNA_DECK_V2_UI_KEYS, "Deck");
}

export function listCompanyDnaFenceV2UiTasks(): CompanyDnaFoundationTask[] {
  return tasksForKeys(COMPANY_DNA_FENCE_V2_UI_KEYS, "Fence");
}

export function listCompanyDnaV2UiTasks(
  workAreaType: string
): CompanyDnaFoundationTask[] {
  if (workAreaType === "deck") return listCompanyDnaDeckV2UiTasks();
  if (workAreaType === "fence") return listCompanyDnaFenceV2UiTasks();
  return [];
}

export function listCompanyDnaUiTasksForWorkArea(
  workAreaType: string
): CompanyDnaFoundationTask[] {
  if (isCompanyDnaV2WorkArea(workAreaType)) {
    return listCompanyDnaV2UiTasks(workAreaType);
  }
  return listCompanyDnaTasksVisibleInCurrentUi(workAreaType);
}

export function companyDnaUiWorkAreaStatus(params: {
  workAreaType: string;
  calibratedTaskKeys: Iterable<string>;
}): "benchmarks" | "partly" | "calibrated" {
  const calibrated = new Set(params.calibratedTaskKeys);
  if (isCompanyDnaV2WorkArea(params.workAreaType)) {
    const tier1 = listCompanyDnaTier1Tasks(params.workAreaType);
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

export function nextCompanyDnaV2Task(params: {
  workAreaType: string;
  calibratedTaskKeys: Iterable<string>;
  currentTaskKey?: string;
}): CompanyDnaFoundationTask | null {
  const calibrated = new Set(params.calibratedTaskKeys);
  if (params.currentTaskKey) calibrated.add(params.currentTaskKey);
  const tasks = listCompanyDnaV2UiTasks(params.workAreaType);
  const nextTier1 = tasks.find(
    (task) =>
      task.priorityTier === 1 && !calibrated.has(task.calibrationTaskKey)
  );
  if (nextTier1) return nextTier1;
  return (
    tasks.find((task) => !calibrated.has(task.calibrationTaskKey)) ?? null
  );
}

export function nextCompanyDnaDeckV2Task(params: {
  calibratedTaskKeys: Iterable<string>;
  currentTaskKey?: string;
}): CompanyDnaFoundationTask | null {
  return nextCompanyDnaV2Task({
    workAreaType: "deck",
    calibratedTaskKeys: params.calibratedTaskKeys,
    currentTaskKey: params.currentTaskKey,
  });
}

export function v2ProgressCounts(
  workAreaType: string,
  calibratedTaskKeys: Iterable<string>
): {
  tier1Total: number;
  tier1Calibrated: number;
  optionalTotal: number;
  optionalCalibrated: number;
  calibratedCount: number;
  taskTotal: number;
} {
  const calibrated = new Set(calibratedTaskKeys);
  const tasks = listCompanyDnaV2UiTasks(workAreaType);
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

export function deckV2ProgressCounts(calibratedTaskKeys: Iterable<string>) {
  return v2ProgressCounts("deck", calibratedTaskKeys);
}

export function fenceV2ProgressCounts(calibratedTaskKeys: Iterable<string>) {
  return v2ProgressCounts("fence", calibratedTaskKeys);
}

export function isCompanyDnaV2TaskKey(taskKey: string): boolean {
  return (
    (COMPANY_DNA_DECK_V2_UI_KEYS as readonly string[]).includes(taskKey) ||
    (COMPANY_DNA_FENCE_V2_UI_KEYS as readonly string[]).includes(taskKey)
  );
}

export function isCompanyDnaDeckV2TaskKey(taskKey: string): boolean {
  return (COMPANY_DNA_DECK_V2_UI_KEYS as readonly string[]).includes(taskKey);
}

export function isCompanyDnaFenceV2TaskKey(taskKey: string): boolean {
  return (COMPANY_DNA_FENCE_V2_UI_KEYS as readonly string[]).includes(taskKey);
}

export function v2LandingPath(workAreaType: string): string {
  if (workAreaType === "fence") return "/app/setup/dna/fence";
  return "/app/setup/dna/deck";
}

export function v2HubHref(params: {
  workAreaType: string;
  status: "benchmarks" | "partly" | "calibrated";
  nextTaskKey?: string | null;
}): string {
  const landing = v2LandingPath(params.workAreaType);
  if (params.status === "partly" && params.nextTaskKey) {
    return `/app/setup/dna/${encodeURIComponent(params.nextTaskKey)}`;
  }
  if (params.status === "calibrated") {
    return `${landing}?view=summary`;
  }
  return landing;
}

export function deckV2HubHref(params: {
  status: "benchmarks" | "partly" | "calibrated";
  nextTaskKey?: string | null;
}): string {
  return v2HubHref({
    workAreaType: "deck",
    status: params.status,
    nextTaskKey: params.nextTaskKey,
  });
}

export function workAreaUsesCompanyDnaV2Ui(
  workAreaType: CompanyDnaWorkAreaType
): boolean {
  return isCompanyDnaV2WorkArea(workAreaType);
}

export function companyDnaV2Generation(
  workAreaType: string
): "v1" | "v2c" | "v2d" {
  if (workAreaType === "deck") return "v2c";
  if (workAreaType === "fence") return "v2d";
  return "v1";
}

export function v2OptionalKeys(workAreaType: string): readonly string[] {
  if (workAreaType === "fence") return COMPANY_DNA_FENCE_OPTIONAL_KEYS;
  return COMPANY_DNA_DECK_OPTIONAL_KEYS;
}

export function listCompanyDnaV2UiKeys(workAreaType: string): readonly string[] {
  if (isCompanyDnaV2WorkArea(workAreaType)) {
    return KEYS_BY_AREA[workAreaType];
  }
  return [];
}
