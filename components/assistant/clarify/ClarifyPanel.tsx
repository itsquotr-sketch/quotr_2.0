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
import { OptionSelect } from "@/components/assistant/selection/OptionSelect";
import { shouldShowWhyThisMatters, whyThisMattersForKey } from "@/lib/assistant/presentation/why-this-matters";
import {
  booleanChoiceOptions,
  booleanChoiceToPresentation,
  booleanPresentationToChoice,
} from "@/lib/assistant/clarify/question-contract";

type ClarifyPanelProps = {
  view: ClarifyView;
  readiness: EstimateReadinessView;
  refineView: RefineView;
  isSaving?: boolean;
  persistError?: string | null;
  onAnswerBoolean?: (
    candidate: ClarifyCandidate,
    presentation: "INCLUDED" | "NOT_INCLUDED"
  ) => void;
  onAnswerValue?: (
    candidate: ClarifyCandidate,
    value: string | number | boolean | string[]
  ) => void | Promise<unknown>;
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
  value,
  persistError,
  onAnswerBoolean,
  onAnswerValue,
  onContinueMulti,
}: {
  candidate: ClarifyCandidate;
  value: string | number | boolean | string[] | null | undefined;
  persistError?: string | null;
  onAnswerBoolean?: ClarifyPanelProps["onAnswerBoolean"];
  onAnswerValue?: ClarifyPanelProps["onAnswerValue"];
  onContinueMulti?: () => void;
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
  const isMulti = candidate.inputType === "multi_select";
  const multiSelectedCount = Array.isArray(value) ? value.length : 0;
  const booleanOptions = booleanChoiceOptions(candidate);

  return (
    <div
      className="space-y-3"
      data-clarify-question
      data-clarify-id={candidate.id}
      data-clarify-fact-key={candidate.factKey ?? undefined}
      data-clarify-input-type={candidate.inputType}
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
        <OptionSelect
          options={booleanOptions}
          value={booleanPresentationToChoice(value, booleanOptions)}
          error={persistError}
          onSelect={(next) => {
            const picked = Array.isArray(next) ? next[0] : next;
            onAnswerBoolean?.(
              candidate,
              booleanChoiceToPresentation(String(picked ?? ""))
            );
          }}
        />
      ) : candidate.options && candidate.options.length > 0 ? (
        <>
          <OptionSelect
            options={candidate.options}
            value={value}
            multiple={isMulti}
            error={persistError}
            onSelect={(next) => onAnswerValue?.(candidate, next)}
          />
          {isMulti ? (
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              data-clarify-multi-continue
              disabled={candidate.blocksEstimate && multiSelectedCount === 0}
              onClick={onContinueMulti}
            >
              Continue
            </Button>
          ) : null}
        </>
      ) : (
        <ClarifyValueField
          candidate={candidate}
          onSubmit={(next) => onAnswerValue?.(candidate, next)}
        />
      )}
    </div>
  );
}

export function ClarifyPanel({
  view,
  readiness,
  isSaving,
  persistError,
  onAnswerBoolean,
  onAnswerValue,
  onEstimateNow,
}: ClarifyPanelProps) {
  const current = view.candidates[0] ?? null;
  const remaining = view.remainingRequiredCount ?? view.visibleCount;
  const [past, setPast] = useState<ClarifyCandidate[]>([]);
  const [rewind, setRewind] = useState<ClarifyCandidate | null>(null);
  const [heldMulti, setHeldMulti] = useState<ClarifyCandidate | null>(null);
  const [localValues, setLocalValues] = useState<
    Record<string, string | number | boolean | string[]>
  >({});

  const showing = rewind ?? heldMulti ?? current;

  const advance = (candidate: ClarifyCandidate) => {
    setPast((rows) => [...rows, candidate]);
    setRewind(null);
    setHeldMulti(null);
  };

  const wrapBoolean: ClarifyPanelProps["onAnswerBoolean"] = (
    candidate,
    presentation
  ) => {
    setLocalValues((prev) => ({
      ...prev,
      [candidate.id]:
        presentation === "INCLUDED"
          ? booleanChoiceOptions(candidate).includes("Yes")
            ? "Yes"
            : "Include"
          : booleanChoiceOptions(candidate).includes("Yes")
            ? "No"
            : "Not included",
    }));
    advance(candidate);
    onAnswerBoolean?.(candidate, presentation);
  };
  const wrapValue: ClarifyPanelProps["onAnswerValue"] = (candidate, value) => {
    setLocalValues((prev) => ({ ...prev, [candidate.id]: value }));
    if (candidate.inputType === "multi_select") {
      setHeldMulti(candidate);
      setRewind(null);
      onAnswerValue?.(candidate, value);
      return;
    }
    advance(candidate);
    onAnswerValue?.(candidate, value);
  };

  if (
    !heldMulti &&
    !rewind &&
    view.enoughToEstimate &&
    view.remainingRequiredCount === 0 &&
    !current
  ) {
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

  const shownValue =
    showing != null
      ? (localValues[showing.id] ?? showing.currentValue ?? null)
      : null;

  if (!showing && view.remainingRequiredCount === 0) {
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
        {countCopy}
      </p>
      <ClarifyQuestion
        candidate={showing ?? current}
        value={shownValue}
        persistError={persistError}
        onAnswerBoolean={wrapBoolean}
        onAnswerValue={wrapValue}
        onContinueMulti={() => {
          if (!showing) return;
          const value = localValues[showing.id] ?? showing.currentValue;
          if (Array.isArray(value)) {
            void Promise.resolve(onAnswerValue?.(showing, value)).finally(() => {
              advance(showing);
            });
            return;
          }
          advance(showing);
        }}
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
                  setHeldMulti(null);
                  return rows;
                }
                const last = rows[rows.length - 1]!;
                setRewind(last);
                setHeldMulti(null);
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
