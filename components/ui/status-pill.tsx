import { cn } from "@/lib/utils";

type StatusPillTone = "neutral" | "positive" | "warning" | "check";

const TONE: Record<StatusPillTone, string> = {
  neutral: "border-border/70 bg-muted/40 text-muted-foreground",
  positive: "border-border/70 bg-background text-foreground",
  warning:
    "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100",
  check: "border-border/80 bg-muted/30 text-foreground",
};

export function StatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: StatusPillTone;
  className?: string;
}) {
  return (
    <span
      data-status-pill={tone}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
