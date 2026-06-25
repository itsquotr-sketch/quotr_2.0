import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPPER_STAGES = [
  { key: "brief", label: "Brief" },
  { key: "confirm_work_areas", label: "Work Areas" },
  { key: "quality", label: "Quality" },
  { key: "work_area_questions", label: "Questions" },
  { key: "constraints", label: "Scope Review" },
  { key: "estimate_ready", label: "Estimate" },
] as const;

export type StepperStageKey = (typeof STEPPER_STAGES)[number]["key"];

export type StepperStepState = "complete" | "active" | "pending" | "attention";

type StepperNavProps = {
  currentStage: string;
  needsAttention?: Partial<Record<StepperStageKey, boolean>>;
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
  complete: "text-muted-foreground",
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
  className,
}: StepperNavProps) {
  return (
    <nav aria-label="Assistant stages" className={cn("w-full", className)}>
      <ol className="space-y-1">
        {STEPPER_STAGES.map((step, index) => {
          const state = getStepState(
            step.key,
            currentStage,
            needsAttention[step.key]
          );

          return (
            <li key={step.key}>
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm",
                  state === "active" && "bg-muted/50"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    dotStyles[state]
                  )}
                >
                  {state === "complete" ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={cn("leading-tight", stateStyles[state])}>
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
