"use client";

import { Fragment } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { BusinessStatusControl } from "@/components/projects/BusinessStatusControl";
import { PriorityBadge } from "@/components/projects/ProjectMeta";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { formatDueDate } from "@/lib/projects/format";
import type { Project } from "@/lib/projects/types";

type ProjectHeaderProps = {
  project: Project;
  subtitle?: string | null;
};

/**
 * Desktop: full metadata. Mobile: title + actions only (3.1B.7F-R2).
 */
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
    <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="min-w-0 break-words text-base font-semibold leading-5 tracking-tight [overflow-wrap:anywhere] md:text-lg">
            {project.title}
          </h1>
          <div className="hidden items-center gap-1.5 sm:flex">
            {!isArchived ? (
              <BusinessStatusControl
                projectId={project.id}
                currentStatus={project.business_status}
              />
            ) : (
              <StatusBadge variant="outline">Archived</StatusBadge>
            )}
            <PriorityBadge priority={project.priority} />
          </div>
        </div>
        {subtitle ? (
          <p className="text-sm leading-5 text-muted-foreground">{subtitle}</p>
        ) : null}
        {detailItems.length > 0 || project.due_date ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-5 text-muted-foreground">
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
      <div className="shrink-0">
        <ProjectActionsMenu project={project} variant="header" showEdit />
      </div>
    </div>
  );
}
