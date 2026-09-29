import type { ProductivityWorkAreaSummary } from "@/lib/rates/productivity-work-area-summary";
import { v2HubHref } from "@/lib/company-dna/v2-ui";

export function calibrationStatusLabel(
  status: ProductivityWorkAreaSummary["status"]
): string {
  if (status === "calibrated") return "Company calibration";
  if (status === "partly") return "Partial calibration";
  return "Quotr benchmarks";
}

/** Opens the existing calibration flow for this work area. */
export function calibrationWorkAreaHref(
  summary: ProductivityWorkAreaSummary
): string {
  const next = summary.tasks.find((row) => !row.calibrated);
  return v2HubHref({
    workAreaType: summary.workAreaType,
    status: summary.status,
    nextTaskKey: next?.task.calibrationTaskKey ?? null,
  });
}
