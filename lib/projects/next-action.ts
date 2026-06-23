import type { ProjectListItem } from "@/lib/projects/types";

export function getProjectNextAction(project: ProjectListItem): string {
  if (project.archived_at) {
    return "View project";
  }

  if (project.business_status === "won" || project.business_status === "lost") {
    return "View project";
  }

  if (project.quote_summary) {
    const status = project.quote_summary.status;
    if (status === "sent") return "Follow up quote";
    if (status === "accepted") return "View quote";
    if (status === "declined" || status === "expired") return "Review quote";
    return "Open quote";
  }

  if (project.pricing_summary) {
    if (project.pricing_summary.status !== "reviewed") {
      return "Review pricing";
    }
    return "Create quote";
  }

  if (project.estimate_is_stale) {
    return "Regenerate estimate";
  }

  if (project.has_estimate) {
    return "Prepare final pricing";
  }

  switch (project.stage) {
    case "estimate_ready":
    case "ready_to_estimate":
      return "Generate estimate";
    case "work_area_questions":
      return "Answer questions";
    case "confirm_work_areas":
    case "quality":
      return "Confirm work areas";
    case "constraints":
      return "Review scope";
    case "brief":
    default:
      return "Analyse project";
  }
}
