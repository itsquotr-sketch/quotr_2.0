"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AssistantLoadingBannerProps = {
  readonly label: string;
  readonly className?: string;
  readonly assertiveness?: "assertive" | "polite";
};

/**
 * Shared non-blocking loading presentation (3.1B.7D).
 * No fake percentages, provider names, or technical config text.
 */
export function AssistantLoadingBanner({
  label,
  className,
  assertiveness = "polite",
}: AssistantLoadingBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-sm",
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
