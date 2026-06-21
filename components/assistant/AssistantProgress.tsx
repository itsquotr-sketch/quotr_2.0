import { cn } from "@/lib/utils";
import { PROGRESS_STAGES } from "@/lib/assistant/mock-seed";
import type { AssistantStage } from "@/components/assistant/types";

type AssistantProgressProps = {
  currentStage: AssistantStage;
};

function stageIndex(stage: AssistantStage): number {
  if (stage === "ready_to_estimate") {
    return PROGRESS_STAGES.findIndex((s) => s.key === "estimate_ready") - 1;
  }
  const idx = PROGRESS_STAGES.findIndex((s) => s.key === stage);
  return idx === -1 ? 0 : idx;
}

export function AssistantProgress({ currentStage }: AssistantProgressProps) {
  const currentIdx = stageIndex(currentStage);
  const totalSteps = PROGRESS_STAGES.length;
  const progressPercent = Math.round(((currentIdx + 1) / totalSteps) * 100);

  return (
    <nav aria-label="Assistant progress" className="w-full">
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            Step {currentIdx + 1} of {totalSteps}
          </p>
          <p className="truncate text-xs font-medium">
            {PROGRESS_STAGES[currentIdx]?.label}
          </p>
        </div>
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={currentIdx + 1}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <ol className="hidden flex-wrap items-center gap-2 sm:flex sm:gap-0">
        {PROGRESS_STAGES.map((step, index) => {
          const isComplete = index < currentIdx;
          const isCurrent = index === currentIdx;

          return (
            <li
              key={step.key}
              className="flex items-center gap-2 sm:flex-1 sm:last:flex-none"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    isComplete && "bg-primary text-primary-foreground",
                    isCurrent &&
                      "bg-primary/10 text-primary ring-2 ring-primary/30",
                    !isComplete &&
                      !isCurrent &&
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium sm:text-sm",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < PROGRESS_STAGES.length - 1 ? (
                <div
                  className={cn(
                    "mx-2 hidden h-px flex-1 sm:block",
                    isComplete ? "bg-primary/40" : "bg-border"
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
