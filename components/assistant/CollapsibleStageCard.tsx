"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StageStatusVariant =
  | "current"
  | "complete"
  | "review"
  | "stale"
  | "needs_input";

type CollapsibleStageCardProps = {
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusVariant?: StageStatusVariant;
  defaultExpanded?: boolean;
  canCollapse?: boolean;
  summaryContent?: ReactNode;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  renderAction?: () => ReactNode;
  className?: string;
};

const cardVariantStyles: Record<StageStatusVariant, string> = {
  current: "border-[var(--brand-orange-muted)] ring-1 ring-[var(--brand-orange)]/15",
  complete: "border-border/60",
  review:
    "border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20",
  stale:
    "border-amber-300 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/30",
  needs_input: "border-[var(--brand-orange-muted)] ring-1 ring-[var(--brand-orange)]/15",
};

const badgeVariantStyles: Record<StageStatusVariant, string> = {
  current:
    "border-transparent bg-[var(--brand-orange-muted)] text-[var(--brand-orange)]",
  complete: "border-transparent bg-muted/60 text-muted-foreground",
  review: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  stale: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  needs_input: "border-transparent bg-primary/10 text-primary",
};

export function CollapsibleStageCard({
  title,
  subtitle,
  statusLabel,
  statusVariant = "current",
  defaultExpanded = true,
  canCollapse = true,
  summaryContent,
  children,
  actionLabel,
  onAction,
  renderAction,
  className,
}: CollapsibleStageCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isCollapsed = canCollapse && !expanded;

  const toggle = () => {
    if (canCollapse) {
      setExpanded((prev) => !prev);
    }
  };

  if (isCollapsed) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/60 bg-card text-card-foreground shadow-none",
          cardVariantStyles[statusVariant],
          className
        )}
      >
        <div className="flex min-h-11 items-center gap-2 px-3 py-2 sm:min-h-12 sm:px-4">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={false}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left sm:min-h-12"
          >
            <ChevronDown className="size-4 shrink-0 -rotate-90 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{title}</span>
                {statusLabel ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] font-normal",
                      badgeVariantStyles[statusVariant]
                    )}
                  >
                    {statusLabel}
                  </Badge>
                ) : null}
              </div>
              {summaryContent ? (
                <p className="truncate text-xs text-muted-foreground">
                  {summaryContent}
                </p>
              ) : null}
            </div>
          </button>
          {renderAction ? (
            renderAction()
          ) : actionLabel && onAction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 px-2 text-xs sm:h-10"
              onClick={(event) => {
                event.stopPropagation();
                onAction();
                setExpanded(true);
              }}
            >
              {actionLabel}
            </Button>
          ) : actionLabel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 px-2 text-xs sm:h-10"
              onClick={toggle}
            >
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        cardVariantStyles[statusVariant],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {canCollapse ? (
              <button
                type="button"
                onClick={toggle}
                aria-expanded
                className="flex min-h-11 items-center gap-2 rounded-md text-left sm:min-h-12"
              >
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-base font-semibold">{title}</span>
              </button>
            ) : (
              <h3 className="text-base font-semibold">{title}</h3>
            )}
            {statusLabel ? (
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 text-[10px] font-normal",
                  badgeVariantStyles[statusVariant]
                )}
              >
                {statusLabel}
              </Badge>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}
