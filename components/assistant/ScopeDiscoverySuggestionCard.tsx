"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SafeSuggestionView } from "@/lib/scope-discovery/application/types";
import {
  SCOPE_DISCOVERY_UI_COPY,
  confidenceBandLabel,
  decisionStateLabel,
  suggestionKindLabel,
} from "@/lib/scope-discovery/ui/labels";

type ScopeDiscoverySuggestionCardProps = {
  suggestion: SafeSuggestionView;
  pendingAction: "accept" | "modify" | "reject" | null;
  disabled?: boolean;
  defaultExpanded?: boolean;
  onAccept: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  onScrollToWorkArea?: (workAreaId: string) => void;
};

export function ScopeDiscoverySuggestionCard({
  suggestion,
  pendingAction,
  disabled,
  defaultExpanded = false,
  onAccept,
  onEdit,
  onDismiss,
  onScrollToWorkArea,
}: ScopeDiscoverySuggestionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const detailsId = useId();
  const isPending = pendingAction != null;
  const isDecided =
    suggestion.decisionState === "ACCEPTED" ||
    suggestion.decisionState === "MODIFIED" ||
    suggestion.decisionState === "REJECTED";
  const isAdded =
    suggestion.decisionState === "ACCEPTED" ||
    suggestion.decisionState === "MODIFIED";
  const isDismissed = suggestion.decisionState === "REJECTED";
  const canAct = !isDecided && !disabled && !isPending;

  return (
    <article
      className={cn(
        "rounded-lg border border-border/70 bg-card px-3 py-3",
        isDismissed && "opacity-70"
      )}
      data-suggestion-id={suggestion.suggestionId}
      aria-busy={isPending || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-sm font-medium leading-snug">
              {suggestion.proposedTitle}
            </h4>
            <Badge variant="outline" className="text-[10px] font-normal">
              {suggestionKindLabel(suggestion.suggestionKind)}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {confidenceBandLabel(suggestion.confidenceBand)}
            </Badge>
            {isDecided ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-normal",
                  isAdded &&
                    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
                  isDismissed && "text-muted-foreground"
                )}
              >
                {decisionStateLabel(suggestion.decisionState)}
              </Badge>
            ) : null}
          </div>
          {suggestion.proposedDescription ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {suggestion.proposedDescription}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span className="sr-only">
            {expanded ? "Hide details" : "Show details"}
          </span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              !expanded && "-rotate-90"
            )}
            aria-hidden
          />
        </button>
      </div>

      {expanded ? (
        <div id={detailsId} className="mt-3 space-y-3 border-t border-border/50 pt-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Why Quotr suggested this
            </p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/90">
              {suggestion.whySuggested}
            </p>
          </div>

          {suggestion.evidence.summaries.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Evidence
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {suggestion.evidence.summaries.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {suggestion.missingInformationSummaries.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Missing information
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {suggestion.missingInformationSummaries.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {suggestion.whySuggested}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {isAdded && suggestion.createdWorkAreaId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 justify-center sm:min-h-9"
            onClick={() =>
              onScrollToWorkArea?.(suggestion.createdWorkAreaId as string)
            }
          >
            {SCOPE_DISCOVERY_UI_COPY.added} — view work area
          </Button>
        ) : null}

        {canAct ? (
          <>
            <Button
              type="button"
              size="sm"
              className="min-h-10 justify-center sm:min-h-9"
              disabled={!canAct}
              onClick={onAccept}
            >
              {pendingAction === "accept" ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                  Adding…
                </>
              ) : (
                SCOPE_DISCOVERY_UI_COPY.addWorkArea
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 justify-center sm:min-h-9"
              disabled={!canAct}
              onClick={onEdit}
            >
              {SCOPE_DISCOVERY_UI_COPY.editAndAdd}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-10 justify-center sm:min-h-9"
              disabled={!canAct}
              onClick={onDismiss}
            >
              {pendingAction === "reject" ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                  Dismissing…
                </>
              ) : (
                SCOPE_DISCOVERY_UI_COPY.dismiss
              )}
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}
