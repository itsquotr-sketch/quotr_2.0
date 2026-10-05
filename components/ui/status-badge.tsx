import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Compact record or document status.
 * Uses the Badge primitive for radius, weight and 12px type.
 * Long labels wrap instead of clipping.
 */
export function StatusBadge({
  className,
  variant = "secondary",
  ...props
}: React.ComponentProps<typeof Badge>) {
  return (
    <Badge
      variant={variant}
      className={cn(
        "h-auto max-w-full overflow-visible whitespace-normal font-medium leading-4 shadow-none",
        className
      )}
      {...props}
    />
  );
}
