"use client";

import { useMemo, useRef, useState } from "react";
import { ActionFooter } from "@/components/ui/action-footer";
import { Button } from "@/components/ui/button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import type { ClarifyCandidate, ClarifyView } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineView } from "@/lib/assistant/refine/types";
import { ClarifyReadinessCard } from "@/components/assistant/clarify/ClarifyReadiness";
import { ClarifyAnswerControl } from "@/components/assistant/clarify/ClarifyAnswerControl";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { PREMIUM } from "@/lib/ui/premium";
import { cn } from "@/lib/utils";
import { shouldShowWhyThisMatters, whyThisMattersForKey } from "@/lib/assistant/presentation/why-this-matters";
import {
  booleanChoiceOptions,
  clarifyControlType,
} from "@/lib/assistant/clarify/question-contract";
import {
  clarifyPersistResultFailed,
  detailsReadyCardVisible,
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
  ) => void | Promise<unknown>;
  onAnswerValue?: (
    candidate: ClarifyCandidate,
    value: string | number | boolean | string[]
  ) => void | Promise<unknown>;
  onEstimateNow?: () => void;
};

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
      className="space-y-2 py-3 first:pt-0"
      data-clarify-question
      data-clarify-id={candidate.id}
      data-clarify-fact-key={candidate.factKey ?? undefined}
      data-clarify-constraint-key={candidate.constraintKey ?? undefined}
      data-clarify-input-type={candidate.inputType}
      data-clarify-control-type={control}
    >
      <p className="break-words text-sm font-medium leading-snug md:text-[0.95rem]">
        {candidate.question}
      </p>
      {showWhy ? (
        <div data-why-this-matters>
          <button
            type="button"
            className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
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
        compact
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
  const [resolvedIds, setLocallyResolved] = useState<string[]>([]);
  const [heldMultiId, setHeldMultiId] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<
    Record<string, string | number | boolean | string[]>
  >({});
  const continueLockRef = useRef(false);

  const locallyResolvedIds = useMemo(() => new Set(resolvedIds), [resolvedIds]);
  const remaining = effectiveRemainingRequiredCount({
    remainingRequiredCount: view.remainingRequiredCount ?? view.visibleCount,
    candidates: view.candidates,
    locallyResolvedIds,
  });

  const visibleGroups = useMemo(() => {
    return view.groups
      .map((group) => ({
        ...group,
        sections: group.sections
          .map((section) => ({
            ...section,
            candidates: section.candidates.filter((row) => {
              if (heldMultiId && row.id === heldMultiId) return true;
              return !locallyResolvedIds.has(row.id);
            }),
          }))
          .filter((section) => section.candidates.length > 0),
      }))
      .filter((group) => group.sections.length > 0);
  }, [heldMultiId, locallyResolvedIds, view.groups]);

  const advance = (candidate: ClarifyCandidate) => {
    setLocallyResolved((ids) =>
      ids.includes(candidate.id) ? ids : [...ids, candidate.id]
    );
    setHeldMultiId(null);
  };

  const rollbackFailedClarifyPersist = (candidate: ClarifyCandidate) => {
    setLocallyResolved((ids) => ids.filter((id) => id !== candidate.id));
    setLocalValues((prev) => {
      const next = { ...prev };
      delete next[candidate.id];
      return next;
    });
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
    void Promise.resolve(onAnswerBoolean?.(candidate, presentation)).then(
      (result) => {
        if (clarifyPersistResultFailed(result)) {
          rollbackFailedClarifyPersist(candidate);
        }
      }
    );
  };
  const wrapValue: ClarifyPanelProps["onAnswerValue"] = (candidate, value) => {
    setLocalValues((prev) => ({ ...prev, [candidate.id]: value }));
    const control = clarifyControlType(candidate);
    if (control === "MULTI_SELECT") {
      setHeldMultiId(candidate.id);
      return;
    }
    advance(candidate);
    void Promise.resolve(onAnswerValue?.(candidate, value)).then((result) => {
      if (clarifyPersistResultFailed(result)) {
        rollbackFailedClarifyPersist(candidate);
      }
    });
  };

  const showReady = detailsReadyCardVisible({
    visibleGroupCount: visibleGroups.length,
    remaining,
    viewEnoughToEstimate: view.enoughToEstimate === true,
    readinessEnoughToEstimate: readiness.enoughToEstimate === true,
    persistError,
  });

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
      ? "Confirm anything still open, or estimate with assumptions."
      : remaining === 1
        ? "1 important detail remaining"
        : `${remaining} important details remaining`;

  const workAreaGroups = visibleGroups.filter((group) => group.workAreaId);
  const projectGroup = visibleGroups.find((group) => group.workAreaId == null);

  return (
    <div
      className="space-y-4 overflow-x-hidden pb-2 md:space-y-6"
      data-clarify-panel
      data-details-complete-capture="true"
      data-clarify-count={view.visibleCount}
    >
      <p className="text-sm text-muted-foreground" data-clarify-progress>
        {countCopy}
      </p>
      <PersistError error={persistError} />

      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2 lg:gap-6">
        {workAreaGroups.map((group) => (
          <section
            key={group.workAreaId}
            className={cn(
              PREMIUM.card,
              PREMIUM.cardPad,
              "min-w-0",
              workAreaGroups.length === 1 && "lg:col-span-2"
            )}
            data-details-group={group.workAreaId ?? undefined}
            data-details-work-area-type={group.workAreaType ?? undefined}
          >
            <h2 className={PREMIUM.sectionTitle}>{group.workAreaName}</h2>
            <div className="mt-3 space-y-4">
              {group.sections.map((section) => (
                <div
                  key={`${section.id}:${section.wallTypeId ?? ""}`}
                  data-details-section={section.id}
                  data-details-wall-type={section.wallTypeId ?? undefined}
                >
                  <SectionEyebrow>
                    {section.wallTypeLabel
                      ? `${section.label} · ${section.wallTypeLabel}`
                      : section.label}
                  </SectionEyebrow>
                  <div className="mt-1 divide-y divide-border/70">
                    {section.candidates.map((candidate) => (
                      <ClarifyQuestion
                        key={candidate.id}
                        candidate={candidate}
                        value={localValues[candidate.id] ?? candidate.currentValue ?? null}
                        persistError={persistError}
                        onAnswerBoolean={wrapBoolean}
                        onAnswerValue={wrapValue}
                        onContinueMulti={
                          candidate.id === heldMultiId
                            ? () => {
                                if (
                                  continueLockRef.current ||
                                  clarifyControlType(candidate) !== "MULTI_SELECT"
                                ) {
                                  return;
                                }
                                const value =
                                  localValues[candidate.id] ?? candidate.currentValue;
                                const set = Array.isArray(value)
                                  ? value
                                  : value == null || value === ""
                                    ? []
                                    : [String(value)];
                                if (candidate.blocksEstimate && set.length === 0) {
                                  return;
                                }
                                continueLockRef.current = true;
                                advance(candidate);
                                void Promise.resolve(
                                  onAnswerValue?.(candidate, set)
                                ).then((result) => {
                                  if (clarifyPersistResultFailed(result)) {
                                    rollbackFailedClarifyPersist(candidate);
                                  }
                                }).finally(() => {
                                  continueLockRef.current = false;
                                });
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {projectGroup ? (
        <section
          className={cn(PREMIUM.card, PREMIUM.cardPad, "min-w-0")}
          data-details-group="project"
          data-details-section="project_conditions"
        >
          <h2 className={PREMIUM.sectionTitle}>{projectGroup.workAreaName}</h2>
          <div className="mt-2 divide-y divide-border/70">
            {projectGroup.sections.flatMap((section) =>
              section.candidates.map((candidate) => (
                <ClarifyQuestion
                  key={candidate.id}
                  candidate={candidate}
                  value={localValues[candidate.id] ?? candidate.currentValue ?? null}
                  persistError={persistError}
                  onAnswerBoolean={wrapBoolean}
                  onAnswerValue={wrapValue}
                />
              ))
            )}
          </div>
        </section>
      ) : null}

      {visibleGroups.length === 0 ? (
        <div className="space-y-3" data-clarify-waiting>
          <p className="text-sm text-muted-foreground">
            {readiness.enoughToEstimate || view.enoughToEstimate
              ? "Saving the last answer…"
              : "A few more details are still needed before this estimate can be built."}
          </p>
        </div>
      ) : null}

      <ActionFooter
        className="-mx-1 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0"
        data-clarify-cta-bar=""
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {readiness.enoughToEstimate ? (
            <Button
              type="button"
              className="min-h-11 w-full"
              data-clarify-primary-cta
              disabled={isSaving || isGenerating}
              onClick={onEstimateNow}
            >
              {isSaving || isGenerating
                ? ASSISTANT_ACTION_LABELS.saving
                : ASSISTANT_ACTION_LABELS.estimateNow}
            </Button>
          ) : view.canEstimateNow ? (
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
