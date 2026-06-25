import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type NextActionLabelProps = {
  action: string;
  className?: string;
  compact?: boolean;
  muted?: boolean;
};

export function NextActionLabel({
  action,
  className,
  compact = false,
  muted = false,
}: NextActionLabelProps) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5",
        compact ? "text-sm" : "text-sm",
        muted ? "text-muted-foreground" : "text-foreground",
        className
      )}
    >
      {!compact ? (
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          Next
        </span>
      ) : (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          Next:
        </span>
      )}
      <span
        className={cn(
          "min-w-0 truncate",
          !compact && !muted && "font-medium",
          compact && !muted && "font-medium"
        )}
      >
        {action}
      </span>
      {!muted ? (
        <ArrowRight
          className="size-3.5 shrink-0 text-[var(--brand-orange)]"
          aria-hidden
        />
      ) : null}
    </span>
  );
}
