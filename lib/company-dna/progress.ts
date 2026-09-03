/**
 * COMPANY DNA-02 — hub progress and next-task selection.
 * Uses catalogue isHighImpact flags. Does not change RPCs or economics.
 */

import {
  COMPANY_DNA_TASKS,
  COMPANY_DNA_WORK_AREA_LABELS,
  COMPANY_DNA_WORK_AREA_TYPES,
  getCompanyDnaTask,
  listCompanyDnaTasksForWorkArea,
  type CompanyDnaTaskDefinition,
  type CompanyDnaWorkAreaType,
} from "@/lib/company-dna/catalogue";
import { companyDnaWorkAreaStatus } from "@/lib/company-dna/derive";

export function nextCompanyDnaTask(params: {
  workAreaType: string;
  calibratedTaskKeys: Iterable<string>;
  currentTaskKey?: string;
}): CompanyDnaTaskDefinition | null {
  const calibrated = new Set(params.calibratedTaskKeys);
  if (params.currentTaskKey) calibrated.add(params.currentTaskKey);
  const tasks = listCompanyDnaTasksForWorkArea(params.workAreaType);
  const nextHighImpact = tasks.find(
    (task) => task.isHighImpact && !calibrated.has(task.calibrationTaskKey)
  );
  if (nextHighImpact) return nextHighImpact;
  return (
    tasks.find((task) => !calibrated.has(task.calibrationTaskKey)) ?? null
  );
}

export function nextCompanyDnaTaskAcrossHub(params: {
  orderedWorkAreaTypes: readonly string[];
  calibratedTaskKeys: Iterable<string>;
  currentTaskKey?: string;
}): CompanyDnaTaskDefinition | null {
  const calibrated = new Set(params.calibratedTaskKeys);
  if (params.currentTaskKey) {
    const current = getCompanyDnaTask(params.currentTaskKey);
    if (current) {
      const sameArea = nextCompanyDnaTask({
        workAreaType: current.workAreaType,
        calibratedTaskKeys: calibrated,
        currentTaskKey: params.currentTaskKey,
      });
      if (sameArea) return sameArea;
    }
  }
  for (const workAreaType of params.orderedWorkAreaTypes) {
    const next = nextCompanyDnaTask({
      workAreaType,
      calibratedTaskKeys: calibrated,
    });
    if (next) return next;
  }
  return null;
}

export function orgHasHighImpactCalibration(
  calibratedTaskKeys: Iterable<string>
): boolean {
  const calibrated = new Set(calibratedTaskKeys);
  return COMPANY_DNA_WORK_AREA_TYPES.some((workAreaType) => {
    const tasks = COMPANY_DNA_TASKS.filter(
      (task) => task.workAreaType === workAreaType
    );
    const highImpactTotal = tasks.filter((task) => task.isHighImpact).length;
    const highImpactCalibrated = tasks.filter(
      (task) =>
        task.isHighImpact && calibrated.has(task.calibrationTaskKey)
    ).length;
    const anyCalibrated = tasks.some((task) =>
      calibrated.has(task.calibrationTaskKey)
    );
    return (
      companyDnaWorkAreaStatus({
        highImpactTotal,
        highImpactCalibrated,
        anyCalibrated,
      }) === "calibrated"
    );
  });
}

export function workAreaHubCta(status: "benchmarks" | "partly" | "calibrated"): string {
  if (status === "benchmarks") return "Start";
  if (status === "partly") return "Continue";
  return "Review";
}

export function workAreaLabel(workAreaType: CompanyDnaWorkAreaType): string {
  return COMPANY_DNA_WORK_AREA_LABELS[workAreaType];
}
