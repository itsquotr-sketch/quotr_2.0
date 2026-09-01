"use client";

import { ActionFooter } from "@/components/ui/action-footer";
import { Button } from "@/components/ui/button";
import type { ClarifyCandidate, ClarifyView } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineView } from "@/lib/assistant/refine/types";
import { ClarifyReadinessCard } from "@/components/assistant/clarify/ClarifyReadiness";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { ClarifyValueField } from "@/components/assistant/clarify/ClarifyValueField";

type ClarifyPanelProps = {
  view: ClarifyView;
  readiness: EstimateReadinessView;
  refineView: RefineView;
  isSaving?: boolean;
  onAnswerBoolean?: (
    candidate: ClarifyCandidate,
    presentation: "INCLUDED" | "NOT_INCLUDED"
  ) => void;
  onAnswerValue?: (
    candidate: ClarifyCandidate,
    value: string | number | boolean
  ) => void;
  onEstimateNow?: () => void;
};

function ContextLabel({ candidate }: { candidate: ClarifyCandidate }) {
  if (candidate.workAreaName) {
    return (
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {candidate.workAreaName}
      </p>
    );
  }
  return (
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      Project
    </p>
  );
}

function ClarifyQuestion({
  candidate,
  isSaving,
  onAnswerBoolean,
  onAnswerValue,
}: {
  candidate: ClarifyCandidate;
  isSaving?: boolean;
  onAnswerBoolean?: ClarifyPanelProps["onAnswerBoolean"];
  onAnswerValue?: ClarifyPanelProps["onAnswerValue"];
}) {
  return (
    <div
      className="space-y-3"
      data-clarify-question
      data-clarify-id={candidate.id}
    >
      <ContextLabel candidate={candidate} />
      <p className="text-base font-medium leading-snug">{candidate.question}</p>
      {candidate.inputType === "boolean" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={isSaving}
            aria-label={`Include ${candidate.label}`}
            onClick={() => onAnswerBoolean?.(candidate, "INCLUDED")}
          >
            Include
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            disabled={isSaving}
            aria-label={`Mark ${candidate.label} as not included`}
            onClick={() => onAnswerBoolean?.(candidate, "NOT_INCLUDED")}
          >
            Not included
          </Button>
        </div>
      ) : candidate.options && candidate.options.length > 0 ? (
        <div className="grid gap-2">
          {candidate.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={isSaving}
              className="min-h-11 rounded-xl border border-border bg-background px-4 py-3 text-left text-sm font-medium hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onAnswerValue?.(candidate, option)}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <ClarifyValueField
          candidate={candidate}
          isSaving={isSaving}
          onSubmit={(value) => onAnswerValue?.(candidate, value)}
        />
      )}
    </div>
  );
}

export function ClarifyPanel({
  view,
  readiness,
  isSaving,
  onAnswerBoolean,
  onAnswerValue,
  onEstimateNow,
}: ClarifyPanelProps) {
  const current = view.candidates[0] ?? null;
  const remaining = view.remainingRequiredCount ?? view.visibleCount;

  if (view.enoughToEstimate || !current) {
    return (
      <ClarifyReadinessCard
        readiness={readiness}
        isSaving={isSaving}
        onEstimateNow={onEstimateNow}
      />
    );
  }

  return (
    <div
      className="space-y-5 overflow-x-hidden"
      data-clarify-panel
      data-clarify-count={view.visibleCount}
    >
      <p className="text-sm text-muted-foreground" data-clarify-progress>
        {remaining === 1
          ? "1 detail remaining"
          : `${remaining} details remaining`}
      </p>
      <ClarifyQuestion
        candidate={current}
        isSaving={isSaving}
        onAnswerBoolean={onAnswerBoolean}
        onAnswerValue={onAnswerValue}
      />
      <ActionFooter
        className="-mx-1"
        data-clarify-cta-bar=""
      >
        {view.canEstimateNow ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            data-clarify-estimate-assumptions
            disabled={isSaving}
            onClick={onEstimateNow}
          >
            {ASSISTANT_ACTION_LABELS.estimateNowUsingAssumptions}
          </Button>
        ) : null}
      </ActionFooter>
    </div>
  );
}
