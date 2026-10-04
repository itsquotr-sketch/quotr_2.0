"use client";

import Link from "next/link";
import { BusinessStatusBadge } from "@/components/projects/BusinessStatusBadge";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { getProjectNextActionHref } from "@/lib/projects/next-action";
import { projectPlace } from "@/lib/projects/list-presentation";
import type { DashboardProjectListItem } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type ProjectMobileCardProps = {
  project: DashboardProjectListItem;
  prefetch?: boolean;
};

export function ProjectMobileCard({
  project,
  prefetch = true,
}: ProjectMobileCardProps) {
  const isClosedStatus =
    project.business_status === "won" || project.business_status === "lost";
  const isArchived = Boolean(project.archived_at);
  const place = projectPlace(project);

  return (
    <div
      className={cn(
        "border-b border-border/70 px-3 py-2 last:border-b-0",
        (isClosedStatus || isArchived) && "opacity-80"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/app/projects/${project.id}`}
          prefetch={prefetch}
          className="min-w-0 flex-1 truncate text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        >
          {project.title}
        </Link>
        <BusinessStatusBadge
          status={project.business_status}
          muted={isClosedStatus || isArchived}
          className="text-[10px]"
        />
      </div>
      {place ? (
        <p className="truncate text-xs text-muted-foreground">
          {isArchived ? `${place} · Archived` : place}
        </p>
      ) : isArchived ? (
        <p className="truncate text-xs text-muted-foreground">Archived</p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={getProjectNextActionHref(project)}
          className="inline-flex min-h-11 min-w-0 items-center text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
        >
          <span className="truncate">{project.nextAction}</span>
        </Link>
        <ProjectActionsMenu project={project} variant="card" />
      </div>
    </div>
  );
}
