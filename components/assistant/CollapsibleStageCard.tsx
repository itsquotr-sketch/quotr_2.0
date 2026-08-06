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
  /** Initial expand when preferredExpanded is not provided. */
  defaultExpanded?: boolean;
  /**
   * Progressive disclosure preference for this stage.
   * When this value changes (stage advances), manual expand overrides reset
   * so only the active incomplete stage stays open by default.
   * Manual toggle never changes completion or triggers AI.
   */
  preferredExpanded?: boolean;
  /** When true, the card expands and stays expanded regardless of preference. */
  forceExpanded?: boolean;
  canCollapse?: boolean;
  /** Collapsed at-a-glance content (string or rich summary). */
  summaryContent?: ReactNode;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  renderAction?: () => ReactNode;
  className?: string;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  /** Stronger elevation for the single active incomplete stage. */
  isActive?: boolean;
};

const cardVariantStyles: Record<StageStatusVariant, string> = {
  current: "border-[var(--brand-orange-muted)] ring-1 ring-[var(--brand-orange)]/15",
  complete: "border-border/50 bg-card/80",
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
  preferredExpanded,
  forceExpanded = false,
  canCollapse = true,
  summaryContent,
  children,
  actionLabel,
  onAction,
  renderAction,
  className,
  cardRef,
  isActive = false,
}: CollapsibleStageCardProps) {
  const preferred = preferredExpanded ?? defaultExpanded;
  const [expansion, setExpansion] = useState<{
    preferred: boolean;
    userExpanded: boolean | null;
  }>(() => ({ preferred, userExpanded: null }));

  // When progressive-disclosure preference changes, drop manual override
  // (React-supported adjust-state-during-render pattern — no effect).
  if (expansion.preferred !== preferred) {
    setExpansion({ preferred, userExpanded: null });
  }

  const isExpanded =
    forceExpanded || (expansion.userExpanded ?? expansion.preferred);
  const showCollapsedChrome = canCollapse && !isExpanded;

  const toggle = () => {
    if (!canCollapse) return;
    const next = !isExpanded;
    setExpansion({ preferred, userExpanded: next });
  };

  const openAndAct = () => {
    onAction?.();
    if (canCollapse) setExpansion({ preferred, userExpanded: true });
  };

  return (
    <div
      ref={cardRef}
      data-stage-active={isActive ? "true" : "false"}
      data-stage-expanded={isExpanded ? "true" : "false"}
      className={cn(
        "rounded-lg border bg-card text-card-foreground motion-safe:transition-[box-shadow,border-color,background-color,opacity] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
        cardVariantStyles[statusVariant],
        isActive
          ? "border-[var(--brand-orange-muted)] shadow-md ring-1 ring-[var(--brand-orange)]/25"
          : "shadow-none",
        !isActive && !isExpanded && "opacity-[0.94]",
        className
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2 px-3 py-1.5 sm:px-3.5",
          isExpanded && "border-b border-border/50 py-2.5"
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isExpanded}
          disabled={!canCollapse}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-start gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-12",
            !canCollapse && "cursor-default"
          )}
        >
          {canCollapse ? (
            <ChevronDown
              className={cn(
                "mt-1 size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
                !isExpanded && "-rotate-90"
              )}
              aria-hidden
            />
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  isExpanded
                    ? "text-sm font-semibold text-foreground"
                    : "text-sm font-medium text-foreground/90"
                )}
              >
                {title}
              </span>
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
            {isExpanded && subtitle ? (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
            {showCollapsedChrome && summaryContent ? (
              <div className="pt-0.5">{summaryContent}</div>
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
              openAndAct();
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
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
        aria-hidden={!isExpanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "px-3.5 py-3 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none sm:px-4",
              isExpanded ? "opacity-100" : "opacity-0"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}
