import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepperStepSummary } from "@/lib/assistant/stage-completion-summaries";

export const STEPPER_STAGES = [
  { key: "brief", label: "Brief" },
  { key: "confirm_work_areas", label: "Work Areas" },
  { key: "quality", label: "Specification" },
  { key: "work_area_questions", label: "Scope Details" },
  { key: "constraints", label: "Site Constraints" },
  { key: "estimate_ready", label: "Estimate" },
] as const;

export type StepperStageKey = (typeof STEPPER_STAGES)[number]["key"];

export type StepperStepState = "complete" | "active" | "pending" | "attention";

type StepperNavProps = {
  currentStage: string;
  needsAttention?: Partial<Record<StepperStageKey, boolean>>;
  /** Compact secondary lines — presentation only (3.1B.7B). */
  stepSummaries?: Partial<Record<StepperStageKey, StepperStepSummary>>;
  className?: string;
};

const STAGE_ORDER = [
  "brief",
  "confirm_work_areas",
  "quality",
  "work_area_questions",
  "constraints",
  "ready_to_estimate",
  "estimate_ready",
] as const;

function resolveStageIndex(stage: string): number {
  if (stage === "ready_to_estimate") {
    return STAGE_ORDER.indexOf("constraints") + 1;
  }

  const idx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  return idx === -1 ? 0 : idx;
}

function getStepIndex(key: StepperStageKey): number {
  if (key === "estimate_ready") {
    return STAGE_ORDER.indexOf("estimate_ready");
  }

  return STAGE_ORDER.indexOf(key);
}

function getStepState(
  stepKey: StepperStageKey,
  currentStage: string,
  needsAttention?: boolean
): StepperStepState {
  const currentIdx = resolveStageIndex(currentStage);
  const stepIdx = getStepIndex(stepKey);

  if (needsAttention) {
    return "attention";
  }

  if (stepKey === "estimate_ready") {
    if (currentStage === "estimate_ready") return "active";
    if (currentIdx > getStepIndex("constraints")) return "complete";
    return "pending";
  }

  if (stepIdx < currentIdx) return "complete";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

const stateStyles: Record<StepperStepState, string> = {
  complete: "text-foreground/80",
  active: "font-medium text-foreground",
  pending: "text-muted-foreground/60",
  attention: "font-medium text-amber-700 dark:text-amber-300",
};

const dotStyles: Record<StepperStepState, string> = {
  complete: "border-[var(--brand-orange)] bg-[var(--brand-orange)] text-white",
  active:
    "border-[var(--brand-orange)] bg-[var(--brand-orange-muted)] text-[var(--brand-orange)] ring-2 ring-[var(--brand-orange)]/20",
  pending: "border-border bg-muted text-muted-foreground",
  attention:
    "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200",
};

export function StepperNav({
  currentStage,
  needsAttention = {},
  stepSummaries = {},
  className,
}: StepperNavProps) {
  return (
    <nav aria-label="Assistant stages" className={cn("w-full", className)}>
      <ol className="space-y-0.5">
        {STEPPER_STAGES.map((step, index) => {
          const state = getStepState(
            step.key,
            currentStage,
            needsAttention[step.key]
          );
          const summary = stepSummaries[step.key];

          return (
            <li key={step.key}>
              <div
                className={cn(
                  "flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm",
                  state === "active" && "bg-muted/50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    dotStyles[state]
                  )}
                >
                  {state === "complete" ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <span className={cn("block", stateStyles[state])}>
                    {step.label}
                  </span>
                  {summary?.primary ? (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {summary.primary}
                      {summary.secondary ? (
                        <span className="text-muted-foreground/80">
                          {" "}
                          · {summary.secondary}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
