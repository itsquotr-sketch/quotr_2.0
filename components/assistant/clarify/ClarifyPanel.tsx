"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ClarifyCandidate, ClarifyView } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineView } from "@/lib/assistant/refine/types";
import {
  ClarifyReadinessCard,
  RefineEstimatePanel,
} from "@/components/assistant/clarify/ClarifyReadiness";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { cn } from "@/lib/utils";

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
              className="min-h-11 rounded-xl border border-border px-4 py-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onAnswerValue?.(candidate, option)}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          inputMode={candidate.inputType === "number" ? "decimal" : "text"}
          aria-label={candidate.label}
          disabled={isSaving}
          onBlur={(event) => {
            const raw = event.target.value;
            if (!raw.trim()) return;
            const value =
              candidate.inputType === "number" ? Number(raw) : raw;
            if (candidate.inputType === "number" && !Number.isFinite(value)) {
              return;
            }
            onAnswerValue?.(candidate, value);
          }}
        />
      )}
    </div>
  );
}

export function ClarifyPanel({
  view,
  readiness,
  refineView,
  isSaving,
  onAnswerBoolean,
  onAnswerValue,
  onEstimateNow,
}: ClarifyPanelProps) {
  const [refineOpen, setRefineOpen] = useState(false);
  const current = view.candidates[0] ?? null;

  if (refineOpen && refineView.hasCandidates) {
    return (
      <RefineEstimatePanel
        view={refineView}
        isSaving={isSaving}
        canEstimateNow={view.canEstimateNow}
        onDone={() => setRefineOpen(false)}
        onEstimateNow={onEstimateNow}
        onAnswerBoolean={onAnswerBoolean}
        onAnswerValue={onAnswerValue}
      />
    );
  }

  if (view.enoughToEstimate || !current) {
    return (
      <ClarifyReadinessCard
        readiness={readiness}
        showRefine={refineView.hasCandidates}
        isSaving={isSaving}
        onEstimateNow={onEstimateNow}
        onRefine={() => setRefineOpen(true)}
      />
    );
  }

  return (
    <div
      className="space-y-5 overflow-x-hidden"
      data-clarify-panel
      data-clarify-count={view.visibleCount}
    >
      <p className="text-sm text-muted-foreground">
        A few things could improve this estimate
      </p>
      <ClarifyQuestion
        candidate={current}
        isSaving={isSaving}
        onAnswerBoolean={onAnswerBoolean}
        onAnswerValue={onAnswerValue}
      />
      <div
        className="sticky bottom-0 z-10 border-t border-border bg-background/95 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        data-clarify-cta-bar
      >
        {view.canEstimateNow ? (
          <button
            type="button"
            className={cn(
              "block text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            data-clarify-estimate-assumptions
            disabled={isSaving}
            onClick={onEstimateNow}
          >
            {ASSISTANT_ACTION_LABELS.estimateNowUsingAssumptions}
          </button>
        ) : null}
      </div>
    </div>
  );
}
