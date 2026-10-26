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
    <div className="min-w-0 space-y-1">
      <Link
        href="/app/dashboard"
        aria-label="Back to Dashboard"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>
      <ProjectHeader project={project} subtitle={subtitle} />
    </div>
  );
}
