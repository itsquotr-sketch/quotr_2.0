import Link from "next/link";
import { BusinessStatusBadge } from "@/components/projects/BusinessStatusBadge";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { getStatusStripColor } from "@/components/projects/status-strip";
import { formatProjectDate } from "@/lib/projects/format";
import {
  DASHBOARD_ACTIVE_PROJECT_LIMIT,
  DASHBOARD_ACTIVE_PROJECT_PHONE_LIMIT,
} from "@/lib/dashboard/select-active-projects";
import { getProjectNextAction, getProjectNextActionHref } from "@/lib/projects/next-action";
import {
  projectCurrentState,
  projectPlace,
  projectUpdatedAt,
} from "@/lib/projects/list-presentation";
import type { ProjectListItem } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type DashboardActiveProjectsProps = {
  projects: ProjectListItem[];
  total: number;
};

export function DashboardActiveProjects({
  projects,
  total,
}: DashboardActiveProjectsProps) {
  const shownDesktop = Math.min(DASHBOARD_ACTIVE_PROJECT_LIMIT, total);
  const shownPhone = Math.min(DASHBOARD_ACTIVE_PROJECT_PHONE_LIMIT, total);

  return (
    <section
      className="overflow-hidden rounded-xl border border-border/60 bg-card"
      aria-labelledby="dashboard-active-projects-heading"
      data-dashboard-projects
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2">
        <div className="min-w-0">
          <h2
            id="dashboard-active-projects-heading"
            className="text-sm font-semibold tracking-tight"
          >
            Active projects
          </h2>
          {total > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="lg:hidden">
                Showing {shownPhone} of {total}
              </span>
              <span className="hidden lg:inline">
                Showing {shownDesktop} of {total}
              </span>
            </p>
          ) : null}
        </div>
        <Link
          href="/app/projects"
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        >
          View all projects
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          No active projects. Won, lost, and archived work stays in Projects.
        </p>
      ) : (
        <ul>
          {projects.map((project, index) => (
            <ActiveProjectRow
              key={project.id}
              project={project}
              className={index >= DASHBOARD_ACTIVE_PROJECT_PHONE_LIMIT ? "max-lg:hidden" : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActiveProjectRow({
  project,
  className,
}: {
  project: ProjectListItem;
  className?: string;
}) {
  const action = getProjectNextAction(project);
  const href = getProjectNextActionHref(project);
  const place = projectPlace(project);
  const state = projectCurrentState(project);
  const updated = formatProjectDate(projectUpdatedAt(project));
  const strip = getStatusStripColor(project.business_status, Boolean(project.archived_at));

  return (
    <li className={cn("border-b border-border/70 last:border-b-0", className)}>
      <div className="flex min-w-0 gap-2 px-3 py-2 lg:hidden">
        <div className={cn("mt-1 h-8 w-0.5 shrink-0 rounded-full", strip)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/app/projects/${project.id}`}
              className="min-w-0 flex-1 truncate text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
            >
              {project.title}
            </Link>
            <BusinessStatusBadge status={project.business_status} className="max-w-[45%]" />
          </div>
          {place ? (
            <p className="truncate text-xs text-muted-foreground">{place}</p>
          ) : null}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{state}</p>
          <div className="flex items-center justify-between gap-2">
            <Link
              href={href}
              className="inline-flex min-h-11 min-w-0 items-center text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
            >
              <span className="truncate">{action}</span>
            </Link>
            <ProjectActionsMenu project={project} variant="card" />
          </div>
        </div>
      </div>

      <div className="hidden min-w-0 items-center gap-3 px-3 py-2 lg:grid lg:grid-cols-[minmax(0,1.4fr)_6.75rem_minmax(0,1fr)_6.25rem_8.75rem_2.75rem]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cn("h-8 w-0.5 shrink-0 rounded-full", strip)} aria-hidden />
          <div className="min-w-0">
            <Link
              href={`/app/projects/${project.id}`}
              className="block truncate text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
            >
              {project.title}
            </Link>
            {place ? (
              <p className="truncate text-xs text-muted-foreground">{place}</p>
            ) : null}
          </div>
        </div>
        <BusinessStatusBadge status={project.business_status} className="max-w-full" />
        <p className="truncate text-xs text-muted-foreground">{state}</p>
        <p className="truncate text-xs text-muted-foreground">{updated}</p>
        <Link
          href={href}
          className="inline-flex min-h-11 min-w-0 items-center text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        >
          <span className="truncate">{action}</span>
        </Link>
        <div className="justify-self-end">
          <ProjectActionsMenu project={project} variant="card" />
        </div>
      </div>
    </li>
  );
}
