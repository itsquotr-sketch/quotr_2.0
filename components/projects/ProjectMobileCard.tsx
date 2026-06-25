"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BusinessStatusBadge } from "@/components/projects/BusinessStatusBadge";
import { NextActionLabel } from "@/components/projects/NextActionLabel";
import { PriorityBadge } from "@/components/projects/ProjectMeta";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { getStatusStripColor } from "@/components/projects/status-strip";
import { formatDueDate, formatProjectDate } from "@/lib/projects/format";
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
  const stripColor = getStatusStripColor(
    project.business_status,
    isArchived
  );

  const clientLine = [project.client_name, project.site_address]
    .filter(Boolean)
    .join(" · ");

  const dateLabel = project.due_date
    ? `Due ${formatDueDate(project.due_date)}`
    : `Updated ${formatProjectDate(project.created_at)}`;

  return (
    <div
      className={cn(
        "relative flex overflow-hidden rounded-lg border border-border/60 bg-card transition-[border-color,background-color] active:bg-muted/20",
        (isClosedStatus || isArchived) && "opacity-80"
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-1", stripColor)} />
      <Link
        href={`/app/projects/${project.id}`}
        prefetch={prefetch}
        className="flex min-w-0 flex-1 flex-col gap-2.5 py-3.5 pl-4 pr-2"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug">{project.title}</p>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
        </div>
        {clientLine ? (
          <p className="text-xs text-muted-foreground">{clientLine}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <BusinessStatusBadge
            status={project.business_status}
            muted={isClosedStatus || isArchived}
          />
          <PriorityBadge priority={project.priority} />
        </div>
        <NextActionLabel
          action={project.nextAction}
          compact
          muted={isClosedStatus || isArchived}
        />
        <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
      </Link>
      <div
        className="flex shrink-0 items-start pt-2 pr-1"
        onClick={(event) => event.stopPropagation()}
      >
        <ProjectActionsMenu project={project} variant="card" />
      </div>
    </div>
  );
}
