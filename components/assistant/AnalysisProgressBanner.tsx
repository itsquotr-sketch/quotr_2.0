/**
 * Shared non-blocking analysis progress banner (3.1B.6R3 / 3.1B.7D).
 * Task-specific copy is passed in — no provider/model details.
 */

"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AnalysisProgressBannerProps = {
  readonly label: string;
  readonly elapsedLabel?: string | null;
  readonly className?: string;
  /** assertive while actively analysing; polite for preparatory copy */
  readonly assertiveness?: "assertive" | "polite";
};

export function AnalysisProgressBanner({
  label,
  elapsedLabel = null,
  className,
  assertiveness = "assertive",
}: AnalysisProgressBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5 text-sm",
        className
      )}
      role="status"
      aria-live={assertiveness}
      data-analysis-progress
    >
      <Loader2
        className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">{label}</span>
        {elapsedLabel ? (
          <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
            {elapsedLabel}
          </span>
        ) : null}
      </span>
      <span
        className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-border motion-reduce:hidden"
        aria-hidden
      >
        <span className="block h-full w-1/2 rounded-full bg-[var(--brand-orange-muted)] motion-safe:animate-pulse" />
      </span>
    </div>
  );
}
