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
