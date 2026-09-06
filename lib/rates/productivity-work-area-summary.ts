import {
  COMPANY_DNA_TASKS,
  COMPANY_DNA_WORK_AREA_LABELS,
  orderCompanyDnaWorkAreas,
  type CompanyDnaTaskDefinition,
  type CompanyDnaWorkAreaType,
} from "@/lib/company-dna/catalogue";
import {
  companyDnaWorkAreaStatus,
  companyDnaWorkAreaStatusLabel,
} from "@/lib/company-dna/derive";
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
  status: "benchmarks" | "partly" | "calibrated";
  statusLabel: string;
  cta: string;
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
    const catalogueTasks = COMPANY_DNA_TASKS.filter(
      (task) => task.workAreaType === workAreaType
    );
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
    const highImpactTotal = catalogueTasks.filter((task) => task.isHighImpact).length;
    const highImpactCalibrated = catalogueTasks.filter(
      (task) =>
        task.isHighImpact &&
        tasks.some(
          (row) =>
            row.task.calibrationTaskKey === task.calibrationTaskKey &&
            row.calibrated
        )
    ).length;
    const status = companyDnaWorkAreaStatus({
      highImpactTotal,
      highImpactCalibrated,
      anyCalibrated: calibratedCount > 0,
    });
    return {
      workAreaType,
      label: COMPANY_DNA_WORK_AREA_LABELS[workAreaType],
      calibratedCount,
      taskTotal: catalogueTasks.length,
      status,
      statusLabel:
        status === "benchmarks"
          ? "Not calibrated"
          : companyDnaWorkAreaStatusLabel(status),
      cta:
        status === "calibrated" ? "View / Edit" : workAreaHubCta(status),
      tasks,
    };
  });
}
