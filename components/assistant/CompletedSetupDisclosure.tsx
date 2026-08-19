"use client";

/**
 * Stage 3.2.2-R2/R3 — Compress completed Assistant stages into one contractor-first summary.
 * RECOVERY-5B — expanded body shows concise job context (not Builder Review).
 */

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CompletedSetupDisclosureProps = {
  summaryLine: string;
  chips?: readonly string[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children?: ReactNode;
  className?: string;
};

export function CompletedSetupDisclosure({
  summaryLine,
  chips = [],
  expanded,
  onExpandedChange,
  children,
  className,
}: CompletedSetupDisclosureProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-muted/10",
        className
      )}
      data-completed-setup-disclosure="true"
      data-expanded={expanded ? "true" : "false"}
    >
      <button
        type="button"
        className="flex w-full min-h-11 items-start gap-3 px-3.5 py-3 text-left"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        data-completed-setup-toggle="true"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            Job details{" "}
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
          <p className="text-[11px] font-medium text-muted-foreground">
            {expanded ? "Hide details" : "Show details"}
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
      {expanded && children ? (
        <div
          className="border-t border-border/40 px-3.5 py-3"
          data-completed-setup-details="true"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
