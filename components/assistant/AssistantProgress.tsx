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

  return (
    <nav aria-label="Assistant progress" className="w-full">
      <ol className="flex flex-wrap items-center gap-2 sm:gap-0">
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
                    isCurrent && "bg-primary/10 text-primary ring-2 ring-primary/30",
                    !isComplete && !isCurrent && "bg-muted text-muted-foreground"
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
