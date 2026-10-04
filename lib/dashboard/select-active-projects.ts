import { getProjectNextAction } from "@/lib/projects/next-action";
import { isActivePipelineStatus } from "@/lib/projects/status";
import type { ProjectListItem } from "@/lib/projects/types";

/** Desktop command-centre cap. Phone hides rows after the fifth. */
export const DASHBOARD_ACTIVE_PROJECT_LIMIT = 8;
export const DASHBOARD_ACTIVE_PROJECT_PHONE_LIMIT = 5;

const PASSIVE_NEXT_ACTIONS = new Set(["View project", "View quote"]);

/**
 * Recency uses fields already on the project.
 * status_updated_at is the latest business-status change.
 * created_at is the fallback. There is no separate updated_at column.
 */
export function projectRecencyTime(project: ProjectListItem): number {
  const stamp = project.status_updated_at ?? project.created_at;
  const time = Date.parse(stamp);
  return Number.isNaN(time) ? 0 : time;
}

/** Existing next-action copy, excluding passive view actions. */
export function projectNeedsNextAction(project: ProjectListItem): boolean {
  return !PASSIVE_NEXT_ACTIONS.has(getProjectNextAction(project));
}

export function isDashboardCurrentWork(project: ProjectListItem): boolean {
  return !project.archived_at && isActivePipelineStatus(project.business_status);
}

/**
 * Command-centre selection. Not a new commercial rank.
 * 1. Current work only (non-archived active pipeline).
 * 2. Projects whose existing next action is not "View project" or "View quote".
 * 3. Then most recently updated current work.
 */
export function selectDashboardActiveProjects(
  projects: ProjectListItem[],
  limit = DASHBOARD_ACTIVE_PROJECT_LIMIT
): { projects: ProjectListItem[]; total: number } {
  const ranked = projects.filter(isDashboardCurrentWork).sort((a, b) => {
    const actionDelta =
      Number(projectNeedsNextAction(b)) - Number(projectNeedsNextAction(a));
    if (actionDelta !== 0) return actionDelta;
    const timeDelta = projectRecencyTime(b) - projectRecencyTime(a);
    if (timeDelta !== 0) return timeDelta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return {
    projects: ranked.slice(0, limit),
    total: ranked.length,
  };
}
