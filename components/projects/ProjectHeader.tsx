"use client";

import { Fragment } from "react";
import { PriorityBadge } from "@/components/projects/ProjectMeta";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import { formatDueDate } from "@/lib/projects/format";
import type { Project } from "@/lib/projects/types";

type ProjectHeaderProps = {
  project: Project;
};

export function ProjectHeader({ project }: ProjectHeaderProps) {
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

  if (project.due_date) {
    detailItems.push(
      <span key="due">Due {formatDueDate(project.due_date)}</span>
    );
  }

  const hasDetails = detailItems.length > 0;

  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 text-xl font-semibold tracking-tight sm:text-2xl">
          {project.title}
        </h1>
        <EditProjectDialog project={project} />
      </div>

      <p className="text-sm text-muted-foreground">Project assistant</p>

      {hasDetails || project.priority ? (
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
          {hasDetails && project.priority ? (
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          ) : null}
          <PriorityBadge priority={project.priority} />
        </div>
      ) : null}
    </div>
  );
}
