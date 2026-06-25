"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BusinessStatusBadge } from "@/components/projects/BusinessStatusBadge";
import { NextActionLabel } from "@/components/projects/NextActionLabel";
import { PriorityBadge } from "@/components/projects/ProjectMeta";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { getStatusStripColor } from "@/components/projects/status-strip";
import {
  formatDueDate,
  formatEstimateStatus,
  formatProjectDate,
} from "@/lib/projects/format";
import type { DashboardProjectListItem } from "@/lib/projects/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProjectRowProps = {
  project: DashboardProjectListItem;
  prefetch?: boolean;
};

function getWorkflowChip(project: DashboardProjectListItem) {
  const estimateDisplay = formatEstimateStatus({
    stage: project.stage,
    hasEstimate: project.has_estimate,
    estimateIsStale: project.estimate_is_stale,
  });

  if (estimateDisplay.variant === "warning") {
    return estimateDisplay;
  }

  const status = project.business_status;
  if (
    status === "quote_draft" ||
    status === "quote_sent" ||
    status === "won" ||
    status === "lost"
  ) {
    return null;
  }

  if (project.has_estimate && !project.estimate_is_stale) {
    if (status === "estimating" || status === "estimate_ready") {
      return null;
    }
    return { label: "Estimate ready", variant: "outline" as const };
  }

  if (estimateDisplay.variant === "outline") {
    return null;
  }

  return estimateDisplay;
}

function getValueHint(project: DashboardProjectListItem): string | null {
  if (project.quote_summary) {
    const status = project.quote_summary.status;
    return status === "sent"
      ? "Quote sent"
      : status === "accepted"
        ? "Quote accepted"
        : status === "declined"
          ? "Quote declined"
          : "Quote draft";
  }

  if (project.pricing_summary) {
    return project.pricing_summary.status === "reviewed"
      ? "Pricing reviewed"
      : "Pricing draft";
  }

  if (project.has_estimate) {
    return project.estimate_is_stale ? "Estimate outdated" : "Estimate ready";
  }

  return null;
}

export function ProjectRow({ project, prefetch = true }: ProjectRowProps) {
  const workflowChip = getWorkflowChip(project);
  const valueHint = getValueHint(project);

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
        "group relative flex items-stretch rounded-lg border border-border/60 bg-card transition-[border-color,background-color,box-shadow] hover:border-border hover:bg-muted/15 hover:shadow-sm",
        (isClosedStatus || isArchived) && "opacity-80"
      )}
    >
      <div
        className={cn("w-1 shrink-0 rounded-l-lg", stripColor)}
        aria-hidden
      />
      <Link
        href={`/app/projects/${project.id}`}
        prefetch={prefetch}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3.5 sm:gap-5 sm:px-4"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold leading-snug">
              {project.title}
            </p>
            <BusinessStatusBadge
              status={project.business_status}
              muted={isClosedStatus || isArchived}
            />
            <PriorityBadge priority={project.priority} />
            {isArchived ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                Archived
              </Badge>
            ) : null}
          </div>
          {clientLine ? (
            <p className="truncate text-xs text-muted-foreground">{clientLine}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {workflowChip ? (
              <Badge
                variant={
                  workflowChip.variant === "warning" ? "outline" : "secondary"
                }
                className={cn(
                  "text-[10px] font-normal",
                  workflowChip.variant === "warning" &&
                    "border-amber-300/80 bg-amber-50 text-amber-900"
                )}
              >
                {workflowChip.label}
              </Badge>
            ) : null}
            <NextActionLabel
              action={project.nextAction}
              compact
              muted={isClosedStatus || isArchived}
              className="md:hidden"
            />
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end justify-center gap-0.5 text-right sm:flex sm:min-w-[120px]">
          {valueHint ? (
            <p className="text-xs font-medium text-foreground">{valueHint}</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
        </div>

        <div className="hidden shrink-0 flex-col items-end justify-center md:flex md:min-w-[180px] lg:min-w-[200px]">
          <NextActionLabel
            action={project.nextAction}
            muted={isClosedStatus || isArchived}
          />
        </div>

        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-[var(--brand-orange)]" />
      </Link>
      <div
        className="flex shrink-0 items-center pr-2"
        onClick={(event) => event.stopPropagation()}
      >
        <ProjectActionsMenu project={project} variant="card" />
      </div>
    </div>
  );
}
