import { STEPPER_STAGES } from "@/components/assistant/StepperNav";
import type { AssistantStage } from "@/components/assistant/types";

type AssistantProgressProps = {
  currentStage: AssistantStage;
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

function resolveStageIndex(stage: AssistantStage): number {
  if (stage === "ready_to_estimate") {
    return STAGE_ORDER.indexOf("constraints") + 1;
  }

  const idx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  return idx === -1 ? 0 : idx;
}

function getMobileStepLabel(stage: AssistantStage): string {
  const idx = resolveStageIndex(stage);
  if (stage === "estimate_ready" || stage === "ready_to_estimate") {
    return "Estimate";
  }
  if (stage === "constraints") {
    return "Scope Review";
  }

  const step = STEPPER_STAGES.find((item) => {
    const stepIdx = STAGE_ORDER.indexOf(
      item.key === "estimate_ready" ? "estimate_ready" : item.key
    );
    return stepIdx === idx;
  });

  return step?.label ?? "Brief";
}

export function AssistantProgress({ currentStage }: AssistantProgressProps) {
  const currentIdx = resolveStageIndex(currentStage);
  const totalSteps = STEPPER_STAGES.length;
  const progressPercent = Math.round(((currentIdx + 1) / totalSteps) * 100);
  const stepLabel = getMobileStepLabel(currentStage);

  return (
    <nav aria-label="Assistant progress" className="w-full lg:hidden">
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
