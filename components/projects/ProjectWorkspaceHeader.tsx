"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import type { Project } from "@/lib/projects/types";

type ProjectWorkspaceHeaderProps = {
  project: Project;
  subtitle?: string | null;
};

export function ProjectWorkspaceHeader({
  project,
  subtitle,
}: ProjectWorkspaceHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        href="/app/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Dashboard
      </Link>
      <ProjectHeader project={project} subtitle={subtitle} />
    </div>
  );
}
