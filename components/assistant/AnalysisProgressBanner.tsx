/**
 * Shared non-blocking analysis progress banner (3.1B.6R3 / 3.1B.7D).
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
        "flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5 text-sm",
        className
      )}
      role="status"
      aria-live={assertiveness}
    >
      <Loader2
        className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
