import { StatusBadge } from "@/components/ui/status-badge";
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
    <StatusBadge
      variant={definition.variant}
      className={cn(muted && "opacity-70", className)}
    >
      {definition.label}
    </StatusBadge>
  );
}
