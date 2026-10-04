"use client";

import Link from "next/link";
import { BusinessStatusBadge } from "@/components/projects/BusinessStatusBadge";
import { NextActionLabel } from "@/components/projects/NextActionLabel";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { getStatusStripColor } from "@/components/projects/status-strip";
import { formatProjectDate } from "@/lib/projects/format";
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
        "grid grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_minmax(8rem,11rem)_2.75rem] items-center gap-3 border-b border-border/70 px-3 py-1.5 last:border-b-0",
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
        className="w-fit text-[10px]"
      />
      <p className="truncate text-xs text-muted-foreground">{updated}</p>
      <Link
        href={getProjectNextActionHref(project)}
        className="inline-flex min-h-11 min-w-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
      >
        <NextActionLabel
          action={project.nextAction}
          muted={isClosedStatus || isArchived}
        />
      </Link>
      <ProjectActionsMenu project={project} variant="card" />
    </div>
  );
}
