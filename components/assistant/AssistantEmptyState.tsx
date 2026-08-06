"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { AssistantStageKey } from "@/lib/assistant/presentation/ui-states";
import { emptyStateForStage } from "@/lib/assistant/presentation/ui-states";

type AssistantEmptyStateProps = {
  stage: AssistantStageKey;
  /** Override catalogue title when a more specific empty reason is known. */
  title?: string;
  nextActionLabel?: string | null;
  onNextAction?: () => void;
  className?: string;
};

export function AssistantEmptyState({
  stage,
  title,
  nextActionLabel,
  onNextAction,
  className,
}: AssistantEmptyStateProps) {
  const catalogue = emptyStateForStage(stage);
  const heading = title ?? catalogue.title;
  const action =
    nextActionLabel === undefined ? catalogue.nextAction : nextActionLabel;

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border/60 bg-muted/15 px-3 py-4 text-center sm:px-4",
        className
      )}
      role="status"
    >
      <p className="text-sm text-muted-foreground">{heading}</p>
      {action ? (
        <p className="mt-1.5 text-xs text-muted-foreground/90">{action}</p>
      ) : null}
      {onNextAction && action ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-8"
          onClick={onNextAction}
        >
          Continue
        </Button>
      ) : null}
    </div>
  );
}
