"use client";

import { useState } from "react";
import { ActionFooter } from "@/components/ui/action-footer";
import { Button } from "@/components/ui/button";
import type { ClarifyCandidate, ClarifyView } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineView } from "@/lib/assistant/refine/types";
import { ClarifyReadinessCard } from "@/components/assistant/clarify/ClarifyReadiness";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { ClarifyValueField } from "@/components/assistant/clarify/ClarifyValueField";
import { shouldShowWhyThisMatters, whyThisMattersForKey } from "@/lib/assistant/presentation/why-this-matters";

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
  const [whyOpen, setWhyOpen] = useState(false);
  const whyKey = candidate.factKey ?? candidate.constraintKey ?? candidate.questionKey;
  const whyText =
    candidate.askClass === "HARD_MINIMUM" ||
    candidate.askClass === "ASK_NOW" ||
    candidate.blocksEstimate
      ? whyThisMattersForKey(whyKey)
      : null;
  const showWhy = Boolean(whyText) && shouldShowWhyThisMatters(whyKey);

  return (
    <div
      className="space-y-3"
      data-clarify-question
      data-clarify-id={candidate.id}
    >
      <ContextLabel candidate={candidate} />
      <p className="text-base font-medium leading-snug">{candidate.question}</p>
      {showWhy ? (
        <div data-why-this-matters>
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setWhyOpen((open) => !open)}
          >
            Why this matters
          </button>
          {whyOpen && whyText ? (
            <p className="mt-1 text-xs text-muted-foreground">{whyText}</p>
          ) : null}
        </div>
      ) : null}
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
  const [past, setPast] = useState<ClarifyCandidate[]>([]);
  const [rewind, setRewind] = useState<ClarifyCandidate | null>(null);
  const showing = rewind ?? current;

  const wrapBoolean: ClarifyPanelProps["onAnswerBoolean"] = (
    candidate,
    presentation
  ) => {
    setPast((rows) => [...rows, candidate]);
    setRewind(null);
    onAnswerBoolean?.(candidate, presentation);
  };
  const wrapValue: ClarifyPanelProps["onAnswerValue"] = (candidate, value) => {
    setPast((rows) => [...rows, candidate]);
    setRewind(null);
    onAnswerValue?.(candidate, value);
  };

  if (view.enoughToEstimate || !current) {
    return (
      <ClarifyReadinessCard
        readiness={readiness}
        isSaving={isSaving}
        onEstimateNow={onEstimateNow}
      />
    );
  }

  const countCopy =
    remaining <= 0
      ? "Just a couple of things to confirm."
      : remaining === 1
        ? "1 important detail remaining"
        : remaining === 2
          ? "Just a couple of things to confirm."
          : `${remaining} important details remaining`;

  return (
    <div
      className="space-y-5 overflow-x-hidden"
      data-clarify-panel
      data-clarify-count={view.visibleCount}
    >
      <p className="text-sm text-muted-foreground" data-clarify-progress>
        {countCopy}
      </p>
      <ClarifyQuestion
        candidate={showing ?? current}
        isSaving={isSaving}
        onAnswerBoolean={wrapBoolean}
        onAnswerValue={wrapValue}
      />
      <ActionFooter
        className="-mx-1"
        data-clarify-cta-bar=""
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            data-clarify-back
            disabled={isSaving || (past.length === 0 && !rewind)}
            onClick={() => {
              setPast((rows) => {
                if (rows.length === 0) {
                  setRewind(null);
                  return rows;
                }
                const last = rows[rows.length - 1]!;
                setRewind(last);
                return rows.slice(0, -1);
              });
            }}
          >
            Back
          </Button>
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
        </div>
      </ActionFooter>
    </div>
  );
}
