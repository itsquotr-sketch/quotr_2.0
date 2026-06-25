"use client";

import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { BusinessStatusControl } from "@/components/projects/BusinessStatusControl";
import { PriorityBadge } from "@/components/projects/ProjectMeta";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { formatDueDate } from "@/lib/projects/format";
import type { Project } from "@/lib/projects/types";

type ProjectHeaderProps = {
  project: Project;
  subtitle?: string | null;
};

export function ProjectHeader({
  project,
  subtitle = null,
}: ProjectHeaderProps) {
  const detailItems: React.ReactNode[] = [];

  if (project.client_name) {
    detailItems.push(<span key="client">{project.client_name}</span>);
  }

  if (project.site_address) {
    detailItems.push(
      <span key="address" className="min-w-0 break-words">
        {project.site_address}
      </span>
    );
  }

  const isArchived = Boolean(project.archived_at);

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-lg font-semibold tracking-tight sm:text-xl">
              {project.title}
            </h1>
            {!isArchived ? (
              <BusinessStatusControl
                projectId={project.id}
                currentStatus={project.business_status}
              />
            ) : (
              <Badge variant="outline">Archived</Badge>
            )}
            <PriorityBadge priority={project.priority} />
          </div>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProjectActionsMenu project={project} variant="header" showEdit />
        </div>
      </div>

      {detailItems.length > 0 || project.due_date ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {detailItems.map((item, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
              ) : null}
              {item}
            </Fragment>
          ))}
          {detailItems.length > 0 && project.due_date ? (
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          ) : null}
          {project.due_date ? (
            <span>Due {formatDueDate(project.due_date)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
