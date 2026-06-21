import { Badge } from "@/components/ui/badge";
import { getBusinessStatusDefinition } from "@/lib/projects/status";
import type { BusinessStatus } from "@/lib/projects/status";
import { cn } from "@/lib/utils";

type BusinessStatusBadgeProps = {
  status: BusinessStatus | string;
  className?: string;
  muted?: boolean;
};

export function BusinessStatusBadge({
  status,
  className,
  muted = false,
}: BusinessStatusBadgeProps) {
  const definition = getBusinessStatusDefinition(status);

  return (
    <Badge
      variant={definition.variant}
      className={cn(
        "shrink-0 text-xs font-normal",
        muted && "opacity-70",
        className
      )}
    >
      {definition.label}
    </Badge>
  );
}
