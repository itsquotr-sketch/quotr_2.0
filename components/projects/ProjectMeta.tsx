import { Badge } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";
import {
  formatDueDate,
  priorityLabel,
} from "@/lib/projects/format";
import type { ProjectPriority } from "@/lib/projects/types";

function priorityVariant(
  priority: ProjectPriority
): VariantProps<typeof badgeVariants>["variant"] {
  switch (priority) {
    case "low":
      return "outline";
    case "normal":
      return "secondary";
    case "high":
      return "default";
    case "urgent":
      return "destructive";
  }
}

type PriorityBadgeProps = {
  priority: ProjectPriority;
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <Badge variant={priorityVariant(priority)} className="capitalize">
      {priorityLabel(priority)}
    </Badge>
  );
}

type ProjectMetaLineProps = {
  clientName?: string | null;
  siteAddress?: string | null;
  priority?: ProjectPriority;
  dueDate?: string | null;
  className?: string;
};

export function ProjectMetaLine({
  clientName,
  siteAddress,
  priority,
  dueDate,
  className,
}: ProjectMetaLineProps) {
  const hasMeta = clientName || siteAddress || priority || dueDate;
  if (!hasMeta) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground ${className ?? ""}`}
    >
      {clientName ? <span>{clientName}</span> : null}
      {clientName && siteAddress ? <span aria-hidden>·</span> : null}
      {siteAddress ? <span className="min-w-0">{siteAddress}</span> : null}
      {priority ? <PriorityBadge priority={priority} /> : null}
      {dueDate ? <span>Due {formatDueDate(dueDate)}</span> : null}
    </div>
  );
}
