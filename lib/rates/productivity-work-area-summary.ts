import {
  COMPANY_DNA_WORK_AREA_LABELS,
  orderCompanyDnaWorkAreas,
  type CompanyDnaTaskDefinition,
  type CompanyDnaWorkAreaType,
} from "@/lib/company-dna/catalogue";
import {
  companyDnaWorkAreaStatusLabel,
} from "@/lib/company-dna/derive";
import {
  companyDnaUiWorkAreaStatus,
  companyDnaV2Generation,
  isCompanyDnaV2WorkArea,
  listCompanyDnaUiTasksForWorkArea,
} from "@/lib/company-dna/v2-ui";
import {
  listRwSystemProgress,
} from "@/lib/company-dna/rw-v2";
import { formatDnaRwRatesSummary } from "@/lib/company-dna/copy";
import { ratesProductivityCta } from "@/lib/company-dna/progress";
import type { RatesPageRate } from "@/lib/rates/types";

export type ProductivityTaskRow = {
  task: CompanyDnaTaskDefinition;
  companyHours: number | null;
  calibrated: boolean;
};

export type ProductivityWorkAreaSummary = {
  workAreaType: CompanyDnaWorkAreaType;
  label: string;
  calibratedCount: number;
  taskTotal: number;
  keyTaskCalibrated: number;
  keyTaskTotal: number;
  optionalCalibrated: number;
  optionalTotal: number;
  status: "benchmarks" | "partly" | "calibrated";
  statusLabel: string;
  cta: string;
  generation: "v1" | "v2c" | "v2d" | "v2e";
  summaryLine?: string;
  tasks: ProductivityTaskRow[];
};

function isCompanyProductivityRate(rate: RatesPageRate | undefined): boolean {
  return Boolean(rate?.active && rate.cost_rate != null);
}

export function summarizeProductivityWorkAreas(
  rates: RatesPageRate[],
  preferredWorkAreaTypes: string[] = []
): ProductivityWorkAreaSummary[] {
  const order = orderCompanyDnaWorkAreas(preferredWorkAreaTypes);
  return order.map((workAreaType) => {
    const catalogueTasks = listCompanyDnaUiTasksForWorkArea(workAreaType);
    const tasks: ProductivityTaskRow[] = catalogueTasks.map((task) => {
      const row = rates.find(
        (rate) =>
          rate.item_key === task.productivityRateKey &&
          rate.rate_type === "productivity"
      );
      const company = isCompanyProductivityRate(row);
      return {
        task,
        companyHours: company && row?.cost_rate != null ? Number(row.cost_rate) : null,
        calibrated: company && row?.source === "calibrated_productivity",
      };
    });
    const calibratedCount = tasks.filter((row) => row.calibrated).length;
    const calibratedKeys = tasks
      .filter((row) => row.calibrated)
      .map((row) => row.task.calibrationTaskKey);
    const status = companyDnaUiWorkAreaStatus({
      workAreaType,
      calibratedTaskKeys: calibratedKeys,
    });
    const v2 = isCompanyDnaV2WorkArea(workAreaType);
    const systems =
      workAreaType === "retaining_wall"
        ? listRwSystemProgress(calibratedKeys)
        : [];
    const rwKeyTotal =
      workAreaType === "retaining_wall"
        ? systems.reduce((sum, row) => sum + row.tier1Total, 0)
        : 0;
    const rwKeyCalibrated =
      workAreaType === "retaining_wall"
        ? systems.reduce((sum, row) => sum + row.tier1Calibrated, 0)
        : 0;
    const keyTaskTotal = v2
      ? workAreaType === "retaining_wall"
        ? rwKeyTotal
        : catalogueTasks.filter((task) => task.priorityTier === 1).length
      : catalogueTasks.filter((task) => task.isHighImpact).length;
    const keyTaskCalibrated = v2
      ? workAreaType === "retaining_wall"
        ? rwKeyCalibrated
        : catalogueTasks.filter(
            (task) =>
              task.priorityTier === 1 &&
              tasks.some(
                (row) =>
                  row.task.calibrationTaskKey === task.calibrationTaskKey &&
                  row.calibrated
              )
          ).length
      : catalogueTasks.filter(
          (task) =>
            task.isHighImpact &&
            tasks.some(
              (row) =>
                row.task.calibrationTaskKey === task.calibrationTaskKey &&
                row.calibrated
            )
        ).length;
    const optionalTotal = v2
      ? catalogueTasks.filter((task) => task.priorityTier !== 1).length
      : 0;
    const optionalCalibrated = v2
      ? catalogueTasks.filter(
          (task) =>
            task.priorityTier !== 1 &&
            tasks.some(
              (row) =>
                row.task.calibrationTaskKey === task.calibrationTaskKey &&
                row.calibrated
            )
        ).length
      : 0;
    return {
      workAreaType,
      label: COMPANY_DNA_WORK_AREA_LABELS[workAreaType],
      calibratedCount,
      taskTotal: catalogueTasks.length,
      keyTaskCalibrated,
      keyTaskTotal,
      optionalCalibrated,
      optionalTotal,
      status,
      statusLabel:
        status === "benchmarks"
          ? "Not calibrated"
          : companyDnaWorkAreaStatusLabel(status),
      cta: ratesProductivityCta(status),
      generation: companyDnaV2Generation(workAreaType),
      summaryLine:
        workAreaType === "retaining_wall"
          ? formatDnaRwRatesSummary({ systems })
          : undefined,
      tasks,
    };
  });
}
