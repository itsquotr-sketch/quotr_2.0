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
  isCompanyDnaDeckV2WorkArea,
  listCompanyDnaUiTasksForWorkArea,
} from "@/lib/company-dna/deck-v2";
import { workAreaHubCta } from "@/lib/company-dna/progress";
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
  status: "benchmarks" | "partly" | "calibrated";
  statusLabel: string;
  cta: string;
  generation: "v1" | "v2c";
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
    const deckV2 = isCompanyDnaDeckV2WorkArea(workAreaType);
    const keyTaskTotal = deckV2
      ? catalogueTasks.filter((task) => task.priorityTier === 1).length
      : catalogueTasks.filter((task) => task.isHighImpact).length;
    const keyTaskCalibrated = deckV2
      ? catalogueTasks.filter(
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
    return {
      workAreaType,
      label: COMPANY_DNA_WORK_AREA_LABELS[workAreaType],
      calibratedCount,
      taskTotal: catalogueTasks.length,
      keyTaskCalibrated,
      keyTaskTotal,
      status,
      statusLabel:
        status === "benchmarks"
          ? "Not calibrated"
          : companyDnaWorkAreaStatusLabel(status),
      cta:
        status === "calibrated" ? "View / Continue" : workAreaHubCta(status),
      generation: deckV2 ? ("v2c" as const) : ("v1" as const),
      tasks,
    };
  });
}
