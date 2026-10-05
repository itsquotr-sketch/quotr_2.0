"use client";

import Link from "next/link";
import { BusinessStatusBadge } from "@/components/projects/BusinessStatusBadge";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { getStatusStripColor } from "@/components/projects/status-strip";
import { formatProjectDate } from "@/lib/projects/format";
import { PROJECT_REGISTER_GRID } from "@/lib/projects/register-columns";
import { getProjectNextActionHref } from "@/lib/projects/next-action";
import {
  projectCurrentState,
  projectPlace,
  projectUpdatedAt,
} from "@/lib/projects/list-presentation";
import type { DashboardProjectListItem } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type ProjectRowProps = {
  project: DashboardProjectListItem;
  prefetch?: boolean;
};

export function ProjectRow({ project, prefetch = true }: ProjectRowProps) {
  const isClosedStatus =
    project.business_status === "won" || project.business_status === "lost";
  const isArchived = Boolean(project.archived_at);
  const stripColor = getStatusStripColor(project.business_status, isArchived);
  const place = projectPlace(project);
  const updated = formatProjectDate(projectUpdatedAt(project));
  const state = projectCurrentState(project);

  return (
    <div
      className={cn(
        PROJECT_REGISTER_GRID,
        "border-b border-border/70 px-3 py-1.5 last:border-b-0",
        (isClosedStatus || isArchived) && "opacity-80"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={cn("h-8 w-0.5 shrink-0 rounded-full", stripColor)} aria-hidden />
        <div className="min-w-0">
          <Link
            href={`/app/projects/${project.id}`}
            prefetch={prefetch}
            className="block truncate text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
          >
            {project.title}
          </Link>
          {place ? (
            <p className="truncate text-xs text-muted-foreground">
              {isArchived ? `${place} · Archived` : place}
            </p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              {isArchived ? "Archived" : state}
            </p>
          )}
        </div>
      </div>
      <BusinessStatusBadge
        status={project.business_status}
        muted={isClosedStatus || isArchived}
        className="max-w-full"
      />
      <p className="whitespace-nowrap text-xs text-muted-foreground">{updated}</p>
      <Link
        href={getProjectNextActionHref(project)}
        className={cn(
          "inline-flex min-h-11 items-center whitespace-nowrap text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]",
          isClosedStatus || isArchived
            ? "text-muted-foreground"
            : "font-medium text-foreground"
        )}
      >
        {project.nextAction}
      </Link>
      <div className="justify-self-end">
        <ProjectActionsMenu project={project} variant="card" />
      </div>
    </div>
  );
}
