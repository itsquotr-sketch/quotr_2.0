import Link from "next/link";
import type { SetupSuggestion } from "@/lib/setup/readiness";
import { cn } from "@/lib/utils";

type SetupGuidanceBannerProps = {
  suggestions: SetupSuggestion[];
  className?: string;
  /** Soft guidance allows continuing; required still shows actions. */
  tone?: "info" | "warning";
  /**
   * Stage 3.2.2-R3 — when an estimate already exists, keep the tip but
   * do not let it compete with Quick Estimate.
   */
  compact?: boolean;
};

export function SetupGuidanceBanner({
  suggestions,
  className,
  tone = "info",
  compact = false,
}: SetupGuidanceBannerProps) {
  if (!suggestions.length) {
    return null;
  }

  const primary = suggestions[0];

  if (compact) {
    return (
      <div
        role="status"
        data-setup-guidance="compact"
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm",
          className
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            Improve future estimates
          </p>
          <p className="text-xs text-muted-foreground">
            {primary.id === "labour_rate"
              ? "Add your labour rate to personalise Quotr."
              : primary.title}
          </p>
        </div>
        <Link
          href={primary.href}
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-border/70 bg-background px-3 text-xs font-medium text-foreground"
        >
          {primary.id === "labour_rate" ? "Set rate" : "Update setup"}
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      data-setup-guidance="full"
      className={cn(
        "rounded-lg border px-3 py-3 text-sm",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-border/70 bg-muted/40 text-foreground",
        className
      )}
    >
      <p className="font-medium">{primary.title}</p>
      <p className="mt-1 text-muted-foreground dark:text-amber-100/80">
        {primary.reason}
      </p>
      <p className="mt-2">
        <Link
          href={primary.href}
          className="font-medium underline-offset-4 hover:underline"
        >
          {primary.severity === "required" ? "Complete now" : "Update setup"}
        </Link>
      </p>
    </div>
  );
}
