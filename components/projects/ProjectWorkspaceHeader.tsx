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
    <div className="flex min-w-0 items-start gap-1">
      <Link
        href="/app/dashboard"
        aria-label="Back to Dashboard"
        className="inline-flex size-11 min-h-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)] md:h-8 md:min-h-8 md:w-auto md:justify-start md:gap-1 md:px-1"
      >
        <ArrowLeft className="size-4" />
        <span className="hidden text-sm font-medium md:inline">Dashboard</span>
      </Link>
      <ProjectHeader project={project} subtitle={subtitle} />
    </div>
  );
}
