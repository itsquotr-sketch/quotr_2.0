import type { ProjectPriority } from "@/lib/projects/types";

export function formatProjectDate(iso: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDueDate(date: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatStage(stage: string): string {
  const labels: Record<string, string> = {
    brief: "Brief",
    confirm_work_areas: "Work areas",
    quality: "Quality",
    work_area_questions: "Questions",
    constraints: "Constraints",
    ready_to_estimate: "Ready to estimate",
    estimate_ready: "Estimate ready",
  };

  return labels[stage] ?? stage.replaceAll("_", " ");
}

export function priorityLabel(priority: ProjectPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export type ProjectStatusDisplay = {
  label: string;
  variant: "default" | "secondary" | "warning" | "outline";
};

export function formatEstimateStatus(input: {
  stage: string;
  hasEstimate: boolean;
  estimateIsStale: boolean;
}): ProjectStatusDisplay {
  if (input.hasEstimate && input.estimateIsStale) {
    return { label: "Estimate outdated", variant: "warning" };
  }

  if (input.stage === "estimate_ready" && input.hasEstimate) {
    return { label: "Estimate ready", variant: "default" };
  }

  if (input.hasEstimate && !input.estimateIsStale) {
    return { label: "Estimate ready", variant: "default" };
  }

  const stageLabels: Record<string, string> = {
    brief: "Draft / Brief",
    confirm_work_areas: "Work areas",
    quality: "Work areas",
    work_area_questions: "Questions",
    constraints: "Constraints",
    ready_to_estimate: "Constraints",
  };

  if (stageLabels[input.stage]) {
    return { label: stageLabels[input.stage], variant: "secondary" };
  }

  if (!input.hasEstimate) {
    return { label: "No estimate", variant: "outline" };
  }

  return { label: formatStage(input.stage), variant: "secondary" };
}

/** @deprecated Use formatEstimateStatus for estimate workflow display */
export const formatProjectStatus = formatEstimateStatus;
