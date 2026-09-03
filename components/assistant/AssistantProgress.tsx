import { STEPPER_STAGES } from "@/components/assistant/StepperNav";
import type { AssistantStage } from "@/components/assistant/types";
import { toPlanningDisplayStage } from "@/lib/assistant/clarify/planning-stage";

type AssistantProgressProps = {
  currentStage: AssistantStage;
  preferProjectConditionsLabel?: boolean;
  deemphasised?: boolean;
};

function resolveDisplayIndex(stage: AssistantStage): number {
  const display = toPlanningDisplayStage(stage);
  if (display === "brief") return 0;
  if (display === "job_plan") return 1;
  if (display === "clarify") return 2;
  return 3;
}

function getMobileStepLabel(stage: AssistantStage): string {
  const display = toPlanningDisplayStage(stage);
  if (display === "brief") return "Job details";
  if (display === "job_plan") return "Work";
  if (display === "clarify") return "Details";
  return "Estimate";
}

export function AssistantProgress({
  currentStage,
  deemphasised = false,
}: AssistantProgressProps) {
  const currentIdx = resolveDisplayIndex(currentStage);
  const totalSteps = STEPPER_STAGES.length;
  const progressPercent = Math.round(((currentIdx + 1) / totalSteps) * 100);
  const stepLabel = getMobileStepLabel(currentStage);

  if (deemphasised) {
    return (
      <nav
        aria-label="Assistant progress"
        className="mb-1 hidden w-full lg:mb-0"
        data-assistant-progress
        data-assistant-progress-secondary="true"
      />
    );
  }

  return (
    <nav
      aria-label="Assistant progress"
      className="mb-1 w-full lg:mb-0 lg:hidden"
      data-assistant-progress
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">
          Step {Math.min(currentIdx + 1, totalSteps)} of {totalSteps}
        </p>
        <p className="truncate text-xs font-semibold">{stepLabel}</p>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.min(currentIdx + 1, totalSteps)}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
      >
        <div
          className="h-full rounded-full bg-[var(--brand-orange)] transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </nav>
  );
}
