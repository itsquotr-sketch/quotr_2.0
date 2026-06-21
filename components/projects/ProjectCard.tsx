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
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { PriorityBadge } from "@/components/projects/ProjectMeta";
import {
  formatDueDate,
  formatProjectDate,
  formatProjectStatus,
  formatStage,
} from "@/lib/projects/format";
import type { ProjectListItem } from "@/lib/projects/types";

type ProjectCardProps = {
  project: ProjectListItem;
};

export function ProjectCard({ project }: ProjectCardProps) {
  const statusDisplay = formatProjectStatus({
    stage: project.stage,
    hasEstimate: project.has_estimate,
    estimateIsStale: project.estimate_is_stale,
  });

  return (
    <Card className="transition-colors hover:bg-muted/30">
      <div className="flex items-start gap-1">
        <Link
          href={`/app/projects/${project.id}`}
          className="block min-w-0 flex-1"
        >
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle className="text-base">{project.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
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
            {project.brief_text ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {project.brief_text}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <Badge
              variant={
                statusDisplay.variant === "warning"
                  ? "outline"
                  : statusDisplay.variant === "default"
                    ? "default"
                    : "secondary"
              }
              className={
                statusDisplay.variant === "warning"
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                  : undefined
              }
            >
              {statusDisplay.label}
            </Badge>
            <span className="capitalize">{formatStage(project.stage)}</span>
            {project.due_date ? (
              <>
                <span aria-hidden>·</span>
                <span>Due {formatDueDate(project.due_date)}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>Created {formatProjectDate(project.created_at)}</span>
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
