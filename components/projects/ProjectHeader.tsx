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
 * Row 1 is the project name, status, and actions.
 * Row 2 is the customer and site, when those details exist.
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

  const context = detailItems.length > 0 || project.due_date || subtitle;

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h1 className="break-words text-lg font-semibold leading-6 tracking-tight [overflow-wrap:anywhere] md:text-xl">
            {project.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
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
        <div className="shrink-0">
          <ProjectActionsMenu project={project} variant="header" showEdit />
        </div>
      </div>
      {context ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-5 text-muted-foreground">
          {subtitle ? <span className="font-medium text-foreground/80">{subtitle}</span> : null}
          {subtitle && (detailItems.length > 0 || project.due_date) ? (
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          ) : null}
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
          {project.due_date ? <span>Due {formatDueDate(project.due_date)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
