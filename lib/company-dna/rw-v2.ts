/**
 * DNA-V2E — Retaining Wall task-level calibration.
 *
 * System-aware timber / sleeper / masonry structure. Shared productivity keys
 * are calibrated once. Work Area completion is any relevant system with all
 * Tier 1 tasks — not all 15 catalogue rows.
 */
import { companyDnaWorkAreaStatusV2 } from "@/lib/company-dna/derive";
import {
  getCompanyDnaFoundationTask,
  type CompanyDnaFoundationTask,
} from "@/lib/company-dna/v2-foundation";

export const COMPANY_DNA_RW_SYSTEMS = [
  "timber",
  "sleeper",
  "masonry",
] as const;

export type CompanyDnaRwSystem = (typeof COMPANY_DNA_RW_SYSTEMS)[number];

export const COMPANY_DNA_RW_SHARED_ALL_SYSTEMS = [
  "retaining_wall.excavation.machine.v1",
  "retaining_wall.excavation.manual.v1",
  "retaining_wall.drainage.v1",
  "retaining_wall.backfill.v1",
] as const;

/** Bagged post-hole concrete — timber and sleeper only, not masonry footing. */
export const COMPANY_DNA_RW_SHARED_POST_HOLE = [
  "retaining_wall.concrete.v1",
] as const;

export const COMPANY_DNA_RW_SHARED_KEYS = [
  ...COMPANY_DNA_RW_SHARED_ALL_SYSTEMS,
  ...COMPANY_DNA_RW_SHARED_POST_HOLE,
] as const;

export const COMPANY_DNA_RW_TIMBER_UNIQUE_KEYS = [
  "retaining_wall.piles.v1",
  "retaining_wall.face.v1",
] as const;

export const COMPANY_DNA_RW_SLEEPER_UNIQUE_KEYS = [
  "retaining_wall.sleeper.posts.v1",
  "retaining_wall.sleeper.sleepers.v1",
] as const;

export const COMPANY_DNA_RW_MASONRY_UNIQUE_KEYS = [
  "retaining_wall.masonry.block.v1",
  "retaining_wall.masonry.footing.v1",
  "retaining_wall.masonry.subbase.v1",
  "retaining_wall.masonry.rebar.v1",
  "retaining_wall.masonry.core_fill.v1",
  "retaining_wall.masonry.waterproof.v1",
] as const;

/** Timber flow: shared machine + unique T1, then optional shared. */
export const COMPANY_DNA_RW_TIMBER_FLOW_KEYS = [
  "retaining_wall.excavation.machine.v1",
  "retaining_wall.piles.v1",
  "retaining_wall.face.v1",
  "retaining_wall.excavation.manual.v1",
  "retaining_wall.drainage.v1",
  "retaining_wall.backfill.v1",
  "retaining_wall.concrete.v1",
] as const;

export const COMPANY_DNA_RW_SLEEPER_FLOW_KEYS = [
  "retaining_wall.excavation.machine.v1",
  "retaining_wall.sleeper.posts.v1",
  "retaining_wall.sleeper.sleepers.v1",
  "retaining_wall.excavation.manual.v1",
  "retaining_wall.drainage.v1",
  "retaining_wall.backfill.v1",
  "retaining_wall.concrete.v1",
] as const;

export const COMPANY_DNA_RW_MASONRY_FLOW_KEYS = [
  "retaining_wall.excavation.machine.v1",
  "retaining_wall.masonry.block.v1",
  "retaining_wall.masonry.footing.v1",
  "retaining_wall.excavation.manual.v1",
  "retaining_wall.drainage.v1",
  "retaining_wall.backfill.v1",
  "retaining_wall.masonry.subbase.v1",
  "retaining_wall.masonry.rebar.v1",
  "retaining_wall.masonry.core_fill.v1",
  "retaining_wall.masonry.waterproof.v1",
] as const;

export const COMPANY_DNA_RW_TIMBER_TIER1_KEYS = [
  "retaining_wall.excavation.machine.v1",
  "retaining_wall.piles.v1",
  "retaining_wall.face.v1",
] as const;

export const COMPANY_DNA_RW_SLEEPER_TIER1_KEYS = [
  "retaining_wall.excavation.machine.v1",
  "retaining_wall.sleeper.posts.v1",
  "retaining_wall.sleeper.sleepers.v1",
] as const;

export const COMPANY_DNA_RW_MASONRY_TIER1_KEYS = [
  "retaining_wall.excavation.machine.v1",
  "retaining_wall.masonry.block.v1",
] as const;

/** Unique UI catalogue (15). Shared keys appear once. */
export const COMPANY_DNA_RW_V2_UI_KEYS = [
  "retaining_wall.excavation.machine.v1",
  "retaining_wall.piles.v1",
  "retaining_wall.face.v1",
  "retaining_wall.sleeper.posts.v1",
  "retaining_wall.sleeper.sleepers.v1",
  "retaining_wall.masonry.block.v1",
  "retaining_wall.excavation.manual.v1",
  "retaining_wall.drainage.v1",
  "retaining_wall.backfill.v1",
  "retaining_wall.concrete.v1",
  "retaining_wall.masonry.footing.v1",
  "retaining_wall.masonry.subbase.v1",
  "retaining_wall.masonry.rebar.v1",
  "retaining_wall.masonry.core_fill.v1",
  "retaining_wall.masonry.waterproof.v1",
] as const;

const FORBIDDEN_RW_KEYS = [
  "retaining_wall.piles.manual.v1",
  "plant.",
  "package",
  "movement",
  "waste",
  "spoil",
  "cartage",
  "carting",
] as const;

export const COMPANY_DNA_RW_SYSTEM_LABELS: Record<CompanyDnaRwSystem, string> =
  {
    timber: "Timber",
    sleeper: "Sleeper",
    masonry: "Masonry",
  };

const FLOW_BY_SYSTEM: Record<
  CompanyDnaRwSystem,
  readonly string[]
> = {
  timber: COMPANY_DNA_RW_TIMBER_FLOW_KEYS,
  sleeper: COMPANY_DNA_RW_SLEEPER_FLOW_KEYS,
  masonry: COMPANY_DNA_RW_MASONRY_FLOW_KEYS,
};

const TIER1_BY_SYSTEM: Record<
  CompanyDnaRwSystem,
  readonly string[]
> = {
  timber: COMPANY_DNA_RW_TIMBER_TIER1_KEYS,
  sleeper: COMPANY_DNA_RW_SLEEPER_TIER1_KEYS,
  masonry: COMPANY_DNA_RW_MASONRY_TIER1_KEYS,
};

function tasksForKeys(
  keys: readonly string[],
  label: string
): CompanyDnaFoundationTask[] {
  return keys.map((key) => {
    const task = getCompanyDnaFoundationTask(key);
    if (!task) {
      throw new Error(`DNA V2E missing ${label} foundation task ${key}`);
    }
    return task;
  });
}

export function listCompanyDnaRwV2UiTasks(): CompanyDnaFoundationTask[] {
  return tasksForKeys(COMPANY_DNA_RW_V2_UI_KEYS, "Retaining Wall");
}

export function isCompanyDnaRwV2TaskKey(taskKey: string): boolean {
  return (COMPANY_DNA_RW_V2_UI_KEYS as readonly string[]).includes(taskKey);
}

export function isCompanyDnaRwSharedTaskKey(taskKey: string): boolean {
  return (COMPANY_DNA_RW_SHARED_KEYS as readonly string[]).includes(taskKey);
}

export function parseCompanyDnaRwSystem(
  value: string | null | undefined
): CompanyDnaRwSystem | null {
  if (value === "timber" || value === "sleeper" || value === "masonry") {
    return value;
  }
  return null;
}

export function rwSystemOfTask(taskKey: string): CompanyDnaRwSystem | "shared" {
  if (
    (COMPANY_DNA_RW_TIMBER_UNIQUE_KEYS as readonly string[]).includes(taskKey)
  ) {
    return "timber";
  }
  if (
    (COMPANY_DNA_RW_SLEEPER_UNIQUE_KEYS as readonly string[]).includes(taskKey)
  ) {
    return "sleeper";
  }
  if (
    (COMPANY_DNA_RW_MASONRY_UNIQUE_KEYS as readonly string[]).includes(taskKey)
  ) {
    return "masonry";
  }
  if (isCompanyDnaRwSharedTaskKey(taskKey)) return "shared";
  return "shared";
}

export function rwDefaultSystemForTask(taskKey: string): CompanyDnaRwSystem {
  const owned = rwSystemOfTask(taskKey);
  if (owned !== "shared") return owned;
  return "timber";
}

export function rwSystemFlowKeys(
  system: CompanyDnaRwSystem
): readonly string[] {
  return FLOW_BY_SYSTEM[system];
}

export function rwSystemTier1Keys(
  system: CompanyDnaRwSystem
): readonly string[] {
  return TIER1_BY_SYSTEM[system];
}

export function rwOptionalKeysForSystem(
  system: CompanyDnaRwSystem
): readonly string[] {
  return rwSystemFlowKeys(system).filter(
    (key) => !rwSystemTier1Keys(system).includes(key)
  );
}

export type CompanyDnaRwSystemProgress = {
  system: CompanyDnaRwSystem;
  label: string;
  tier1Total: number;
  tier1Calibrated: number;
  status: "benchmarks" | "partly" | "calibrated";
  statusLabel: string;
};

export function rwSystemProgress(
  system: CompanyDnaRwSystem,
  calibratedTaskKeys: Iterable<string>
): CompanyDnaRwSystemProgress {
  const calibrated = new Set(calibratedTaskKeys);
  const tier1 = rwSystemTier1Keys(system);
  const tier1Calibrated = tier1.filter((key) => calibrated.has(key)).length;
  const status = companyDnaWorkAreaStatusV2({
    tier1Total: tier1.length,
    tier1Calibrated,
  });
  return {
    system,
    label: COMPANY_DNA_RW_SYSTEM_LABELS[system],
    tier1Total: tier1.length,
    tier1Calibrated,
    status,
    statusLabel:
      status === "calibrated"
        ? "Using your calibration"
        : status === "partly"
          ? "Partly calibrated"
          : "Not calibrated",
  };
}

export function listRwSystemProgress(
  calibratedTaskKeys: Iterable<string>
): CompanyDnaRwSystemProgress[] {
  return COMPANY_DNA_RW_SYSTEMS.map((system) =>
    rwSystemProgress(system, calibratedTaskKeys)
  );
}

export function companyDnaRwWorkAreaStatus(params: {
  calibratedTaskKeys: Iterable<string>;
}): "benchmarks" | "partly" | "calibrated" {
  const systems = listRwSystemProgress(params.calibratedTaskKeys);
  if (systems.some((system) => system.status === "calibrated")) {
    return "calibrated";
  }
  if (systems.some((system) => system.tier1Calibrated > 0)) {
    return "partly";
  }
  return "benchmarks";
}

export function rwAllSystemsCalibrated(
  calibratedTaskKeys: Iterable<string>
): boolean {
  return listRwSystemProgress(calibratedTaskKeys).every(
    (system) => system.status === "calibrated"
  );
}

export function rwNextIncompleteSystem(
  calibratedTaskKeys: Iterable<string>
): CompanyDnaRwSystemProgress | null {
  return (
    listRwSystemProgress(calibratedTaskKeys).find(
      (system) => system.status !== "calibrated"
    ) ?? null
  );
}

export function nextCompanyDnaRwV2Task(params: {
  calibratedTaskKeys: Iterable<string>;
  currentTaskKey?: string;
  system?: CompanyDnaRwSystem | null;
}): CompanyDnaFoundationTask | null {
  const calibrated = new Set(params.calibratedTaskKeys);
  if (params.currentTaskKey) calibrated.add(params.currentTaskKey);
  const systems: CompanyDnaRwSystem[] = params.system
    ? [params.system]
    : [...COMPANY_DNA_RW_SYSTEMS];
  for (const system of systems) {
    const flow = rwSystemFlowKeys(system);
    const tier1 = rwSystemTier1Keys(system);
    const nextTier1 = flow.find(
      (key) => tier1.includes(key) && !calibrated.has(key)
    );
    if (nextTier1) {
      return getCompanyDnaFoundationTask(nextTier1) ?? null;
    }
  }
  for (const system of systems) {
    const nextOptional = rwSystemFlowKeys(system).find(
      (key) => !calibrated.has(key)
    );
    if (nextOptional) {
      return getCompanyDnaFoundationTask(nextOptional) ?? null;
    }
  }
  if (params.system) {
    return nextCompanyDnaRwV2Task({
      calibratedTaskKeys: calibrated,
      currentTaskKey: undefined,
      system: null,
    });
  }
  return null;
}

export function rwTaskHref(
  taskKey: string,
  system?: CompanyDnaRwSystem | null
): string {
  const path = `/app/setup/dna/${encodeURIComponent(taskKey)}`;
  if (!system) return path;
  return `${path}?system=${system}`;
}

export function rwForbiddenFakeTasks(): readonly string[] {
  return FORBIDDEN_RW_KEYS;
}

export function rwProgressCounts(calibratedTaskKeys: Iterable<string>): {
  tier1Total: number;
  tier1Calibrated: number;
  optionalTotal: number;
  optionalCalibrated: number;
  calibratedCount: number;
  taskTotal: number;
} {
  const calibrated = new Set(calibratedTaskKeys);
  const tasks = listCompanyDnaRwV2UiTasks();
  const uniqueTier1 = new Set<string>([
    ...COMPANY_DNA_RW_TIMBER_TIER1_KEYS,
    ...COMPANY_DNA_RW_SLEEPER_TIER1_KEYS,
    ...COMPANY_DNA_RW_MASONRY_TIER1_KEYS,
  ]);
  const optional = tasks.filter(
    (task) => !uniqueTier1.has(task.calibrationTaskKey)
  );
  return {
    tier1Total: uniqueTier1.size,
    tier1Calibrated: [...uniqueTier1].filter((key) => calibrated.has(key))
      .length,
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
