"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import type { Project } from "@/lib/projects/types";

type ProjectWorkspaceHeaderProps = {
  project: Project;
  subtitle?: string | null;
};

/**
 * Desktop: back + full ProjectHeader metadata.
 * Mobile: compact Back / title / actions only (3.1B.7F-R2).
 */
export function ProjectWorkspaceHeader({
  project,
  subtitle,
}: ProjectWorkspaceHeaderProps) {
  return (
    <div className="flex items-center gap-1 md:block md:space-y-2">
      <Link
        href="/app/dashboard"
        aria-label="Back to Dashboard"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground md:h-auto md:min-h-11 md:w-auto md:justify-start md:gap-1.5"
      >
        <ArrowLeft className="size-4" />
        <span className="hidden text-sm font-medium md:inline">Dashboard</span>
      </Link>
      <ProjectHeader project={project} subtitle={subtitle} />
    </div>
  );
}
