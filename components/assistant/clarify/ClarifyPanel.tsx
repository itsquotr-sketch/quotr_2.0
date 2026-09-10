"use client";

import { useMemo, useRef, useState } from "react";
import { ActionFooter } from "@/components/ui/action-footer";
import { Button } from "@/components/ui/button";
import type { ClarifyCandidate, ClarifyView } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineView } from "@/lib/assistant/refine/types";
import { ClarifyReadinessCard } from "@/components/assistant/clarify/ClarifyReadiness";
import { ClarifyAnswerControl } from "@/components/assistant/clarify/ClarifyAnswerControl";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { shouldShowWhyThisMatters, whyThisMattersForKey } from "@/lib/assistant/presentation/why-this-matters";
import {
  booleanChoiceOptions,
  clarifyControlType,
} from "@/lib/assistant/clarify/question-contract";
import {
  currentClarifyCandidate,
  effectiveRemainingRequiredCount,
} from "@/lib/assistant/clarify/interaction";

type ClarifyPanelProps = {
  view: ClarifyView;
  readiness: EstimateReadinessView;
  refineView: RefineView;
  isSaving?: boolean;
  isGenerating?: boolean;
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
  const control = clarifyControlType(candidate);

  return (
    <div
      className="space-y-3"
      data-clarify-question
      data-clarify-id={candidate.id}
      data-clarify-fact-key={candidate.factKey ?? undefined}
      data-clarify-input-type={candidate.inputType}
      data-clarify-control-type={control}
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
      <ClarifyAnswerControl
        candidate={candidate}
        value={value}
        persistError={persistError}
        onAnswerBoolean={onAnswerBoolean}
        onAnswerValue={onAnswerValue}
        onContinueMulti={onContinueMulti}
      />
    </div>
  );
}

function PersistError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {error}
    </p>
  );
}

export function ClarifyPanel({
  view,
  readiness,
  isSaving,
  isGenerating,
  persistError,
  onAnswerBoolean,
  onAnswerValue,
  onEstimateNow,
}: ClarifyPanelProps) {
  const [past, setPast] = useState<ClarifyCandidate[]>([]);
  const [rewind, setRewind] = useState<ClarifyCandidate | null>(null);
  const [heldMulti, setHeldMulti] = useState<ClarifyCandidate | null>(null);
  const [localValues, setLocalValues] = useState<
    Record<string, string | number | boolean | string[]>
  >({});
  const continueLockRef = useRef(false);

  const locallyResolvedIds = useMemo(
    () => new Set(past.map((row) => row.id)),
    [past]
  );
  const showing = currentClarifyCandidate({
    candidates: view.candidates,
    locallyResolvedIds,
    rewind,
    heldMulti,
  });
  const remaining = effectiveRemainingRequiredCount({
    remainingRequiredCount: view.remainingRequiredCount ?? view.visibleCount,
    candidates: view.candidates,
    locallyResolvedIds,
  });

  const advance = (candidate: ClarifyCandidate) => {
    setPast((rows) =>
      rows.some((row) => row.id === candidate.id) ? rows : [...rows, candidate]
    );
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
    const control = clarifyControlType(candidate);
    if (control === "MULTI_SELECT") {
      setHeldMulti(candidate);
      setRewind(null);
      return;
    }
    advance(candidate);
    onAnswerValue?.(candidate, value);
  };

  const showReady =
    !heldMulti &&
    !rewind &&
    showing == null &&
    remaining === 0 &&
    view.enoughToEstimate === true &&
    readiness.enoughToEstimate === true;

  if (showReady) {
    return (
      <div className="space-y-3">
        <PersistError error={persistError} />
        <ClarifyReadinessCard
          readiness={readiness}
          isSaving={isSaving}
          isGenerating={isGenerating}
          onEstimateNow={onEstimateNow}
        />
      </div>
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

  if (!showing) {
    return (
      <div className="space-y-3" data-clarify-waiting>
        <PersistError error={persistError} />
        <p className="text-sm text-muted-foreground">
          {readiness.enoughToEstimate
            ? "Saving the last answer…"
            : view.enoughToEstimate
              ? "Saving the last answer…"
              : "A few more details are still needed before this estimate can be built."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-3 overflow-x-hidden md:space-y-5"
      data-clarify-panel
      data-clarify-count={view.visibleCount}
    >
      <p className="text-sm text-muted-foreground" data-clarify-progress>
        {countCopy}
      </p>
      <PersistError error={persistError} />
      <ClarifyQuestion
        candidate={showing}
        value={shownValue}
        persistError={persistError}
        onAnswerBoolean={wrapBoolean}
        onAnswerValue={wrapValue}
        onContinueMulti={() => {
          if (continueLockRef.current || clarifyControlType(showing) !== "MULTI_SELECT") {
            return;
          }
          const value = localValues[showing.id] ?? showing.currentValue;
          const set = Array.isArray(value)
            ? value
            : value == null || value === ""
              ? []
              : [String(value)];
          if (showing.blocksEstimate && set.length === 0) return;
          continueLockRef.current = true;
          advance(showing);
          void Promise.resolve(onAnswerValue?.(showing, set)).finally(() => {
            continueLockRef.current = false;
          });
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
