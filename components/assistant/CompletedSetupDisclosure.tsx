"use client";

/**
 * Stage 3.2.2-R2 — Compress completed Assistant stages into one contractor-first summary.
 * Presentation only — does not change the underlying stage machine.
 */

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CompletedSetupDisclosureProps = {
  summaryLine: string;
  chips?: readonly string[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  className?: string;
};

export function CompletedSetupDisclosure({
  summaryLine,
  chips = [],
  expanded,
  onExpandedChange,
  className,
}: CompletedSetupDisclosureProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/20",
        className
      )}
      data-completed-setup-disclosure="true"
      data-expanded={expanded ? "true" : "false"}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        data-completed-setup-toggle="true"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            Project setup{" "}
            <span className="text-muted-foreground" aria-hidden>
              ✓
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{summaryLine}</p>
          {chips.length > 0 ? (
            <p className="text-[11px] text-muted-foreground/90">
              {chips.filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {expanded ? "Hide completed steps" : "Review or edit completed steps"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}
