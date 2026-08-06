/**
 * Shared non-blocking analysis progress banner (3.1B.6R3).
 * Task-specific copy is passed in — no provider/model details.
 */

"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AnalysisProgressBannerProps = {
  readonly label: string;
  readonly className?: string;
  /** assertive while actively analysing; polite for preparatory copy */
  readonly assertiveness?: "assertive" | "polite";
};

export function AnalysisProgressBanner({
  label,
  className,
  assertiveness = "assertive",
}: AnalysisProgressBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-sm",
        className
      )}
      role="status"
      aria-live={assertiveness}
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
