import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PriorityBadge } from "@/components/projects/ProjectMeta";
import {
  formatDueDate,
  formatProjectDate,
  formatStage,
} from "@/lib/projects/format";
import type { Project } from "@/lib/projects/types";

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/app/projects/${project.id}`} className="block min-w-0">
      <Card className="transition-colors hover:bg-muted/30">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-base">{project.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <PriorityBadge priority={project.priority} />
              <Badge variant="secondary" className="capitalize">
                {project.status}
              </Badge>
            </div>
          </div>
          {project.client_name ? (
            <CardDescription>{project.client_name}</CardDescription>
          ) : null}
          {project.site_address ? (
            <p className="text-sm text-muted-foreground">{project.site_address}</p>
          ) : null}
          {project.brief_text ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {project.brief_text}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
      </Card>
    </Link>
  );
}
