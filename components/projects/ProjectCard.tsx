"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BusinessStatusBadge } from "@/components/projects/BusinessStatusBadge";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { PriorityBadge } from "@/components/projects/ProjectMeta";
import {
  formatDueDate,
  formatEstimateStatus,
  formatProjectDate,
} from "@/lib/projects/format";
import { getProjectNextAction } from "@/lib/projects/next-action";
import type { ProjectListItem } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type ProjectCardProps = {
  project: ProjectListItem;
  prefetch?: boolean;
};

export function ProjectCard({ project, prefetch = true }: ProjectCardProps) {
  const estimateDisplay = formatEstimateStatus({
    stage: project.stage,
    hasEstimate: project.has_estimate,
    estimateIsStale: project.estimate_is_stale,
  });

  const isClosedStatus =
    project.business_status === "won" || project.business_status === "lost";
  const nextAction = getProjectNextAction(project);

  const showWorkflowBadge =
    !project.quote_summary &&
    !project.pricing_summary &&
    (estimateDisplay.variant === "warning" ||
      estimateDisplay.variant === "secondary" ||
      estimateDisplay.variant === "outline");

  return (
    <Card
      className={cn(
        "border-border/60 shadow-none transition-colors hover:border-border hover:bg-muted/20",
        isClosedStatus && "opacity-85"
      )}
    >
      <div className="flex items-start gap-1">
        <Link
          href={`/app/projects/${project.id}`}
          prefetch={prefetch}
          className="block min-w-0 flex-1"
        >
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle className="text-base leading-snug">
                {project.title}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <BusinessStatusBadge
                  status={project.business_status}
                  muted={isClosedStatus}
                />
                <PriorityBadge priority={project.priority} />
                {project.archived_at ? (
                  <Badge variant="outline">Archived</Badge>
                ) : null}
              </div>
            </div>
            {project.client_name ? (
              <CardDescription>{project.client_name}</CardDescription>
            ) : null}
            {project.site_address ? (
              <p className="text-sm text-muted-foreground">
                {project.site_address}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {showWorkflowBadge ? (
                <Badge
                  variant={
                    estimateDisplay.variant === "warning" ? "outline" : "secondary"
                  }
                  className={
                    estimateDisplay.variant === "warning"
                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                      : undefined
                  }
                >
                  {estimateDisplay.label}
                </Badge>
              ) : null}
              {project.pricing_summary ? (
                <Badge variant="outline">
                  Pricing{" "}
                  {project.pricing_summary.status === "reviewed"
                    ? "reviewed"
                    : "draft"}
                </Badge>
              ) : null}
              {project.quote_summary ? (
                <Badge
                  variant="outline"
                  className="border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)]"
                >
                  Quote {project.quote_summary.status}
                </Badge>
              ) : null}
            </div>

            <p className="text-sm font-medium text-foreground">
              Next: {nextAction}
            </p>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {project.due_date ? (
                <span>Due {formatDueDate(project.due_date)}</span>
              ) : null}
              {project.due_date ? <span aria-hidden>·</span> : null}
              <span>Created {formatProjectDate(project.created_at)}</span>
            </div>
          </CardContent>
        </Link>
        <div
          className="shrink-0 pt-3 pr-2"
          onClick={(event) => event.stopPropagation()}
        >
          <ProjectActionsMenu project={project} variant="card" />
        </div>
      </div>
    </Card>
  );
}
