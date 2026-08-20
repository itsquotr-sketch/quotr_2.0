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
    <div className="space-y-1 sm:space-y-2">
      <Link
        href="/app/dashboard"
        className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        <span className="sm:inline">Dashboard</span>
      </Link>
      <ProjectHeader project={project} subtitle={subtitle} />
    </div>
  );
}
