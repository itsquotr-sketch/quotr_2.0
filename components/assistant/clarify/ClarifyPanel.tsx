"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ActionFooter } from "@/components/ui/action-footer";
import { Button } from "@/components/ui/button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import type { ClarifyCandidate, ClarifyView } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineView } from "@/lib/assistant/refine/types";
import { ClarifyReadinessCard } from "@/components/assistant/clarify/ClarifyReadiness";
import { NestedItemsPanel } from "@/components/assistant/clarify/NestedItemsPanel";
import { ClarifyAnswerControl } from "@/components/assistant/clarify/ClarifyAnswerControl";
import { GenerateEstimateStatus } from "@/components/assistant/clarify/GenerateEstimateStatus";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { PREMIUM } from "@/lib/ui/premium";
import { cn } from "@/lib/utils";
import { shouldShowWhyThisMatters, whyThisMattersForKey } from "@/lib/assistant/presentation/why-this-matters";
import {
  booleanChoiceOptions,
  clarifyControlType,
} from "@/lib/assistant/clarify/question-contract";
import {
  canShowGenerateCta,
  clarifyPersistResultFailed,
  detailsReadyCardVisible,
  effectiveRemainingRequiredCount,
  shouldHoldClarifyQuestionUntilPersist,
  shouldIgnoreDuplicateClarifyActivation,
} from "@/lib/assistant/clarify/interaction";
import type { GenerateEstimateStage } from "@/lib/assistant/clarify/generate-sync";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";

type ClarifyPanelProps = {
  view: ClarifyView;
  readiness: EstimateReadinessView;
  refineView: RefineView;
  isSaving?: boolean;
  isGenerating?: boolean;
  generateStage?: GenerateEstimateStage;
  generateStartedAt?: number;
  persistError?: string | null;
  generateNotice?: string | null;
  returnFocusId?: string | null;
  onAnswerBoolean?: (
    candidate: ClarifyCandidate,
    presentation: "INCLUDED" | "NOT_INCLUDED"
  ) => void | Promise<unknown>;
  onAnswerValue?: (
    candidate: ClarifyCandidate,
    value: string | number | boolean | string[]
  ) => void | Promise<unknown>;
  onEstimateNow?: () => void;
  onNestedItemAction?: (
    workAreaId: string,
    key: string,
    value: string | boolean,
    nestedItemId?: string | null
  ) => void | Promise<unknown>;
};

function ClarifyQuestion({
  candidate,
  value,
  persistError,
  pending,
  continuePending,
  disabled,
  focused,
  onAnswerBoolean,
  onAnswerValue,
  onContinueMulti,
}: {
  candidate: ClarifyCandidate;
  value: string | number | boolean | string[] | null | undefined;
  persistError?: string | null;
  pending?: boolean;
  continuePending?: boolean;
  disabled?: boolean;
  focused?: boolean;
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
      className={cn(
        "space-y-2 py-3 first:pt-0",
        focused && "rounded-lg ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
      )}
      data-clarify-question
      data-clarify-id={candidate.id}
      data-clarify-return-focus={focused ? "true" : undefined}
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
        pending={pending}
        continuePending={continuePending}
        disabled={disabled}
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
  generateStage = "building",
  generateStartedAt = 0,
  persistError,
  generateNotice,
  returnFocusId,
  onAnswerBoolean,
  onAnswerValue,
  onEstimateNow,
  onNestedItemAction,
}: ClarifyPanelProps) {
  const [resolvedIds, setLocallyResolved] = useState<string[]>([]);
  const [heldMultiId, setHeldMultiId] = useState<string | null>(null);
  const [heldPendingId, setHeldPendingId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [continuePending, setContinuePending] = useState(false);
  const [localValues, setLocalValues] = useState<
    Record<string, string | number | boolean | string[]>
  >({});
  const continueLockRef = useRef(false);
  const pendingLockRef = useRef<Set<string>>(new Set());

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
              if (heldPendingId && row.id === heldPendingId) return true;
              return !locallyResolvedIds.has(row.id);
            }),
          }))
          .filter((section) => section.candidates.length > 0),
      }))
      .filter((group) => group.sections.length > 0);
  }, [heldMultiId, heldPendingId, locallyResolvedIds, view.groups]);

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

  const visibleCandidateCount = visibleGroups.reduce(
    (count, group) =>
      count +
      group.sections.reduce(
        (sectionCount, section) => sectionCount + section.candidates.length,
        0
      ),
    0
  );

  const beginPending = (candidateId: string): boolean => {
    if (
      shouldIgnoreDuplicateClarifyActivation({
        pendingCandidateId: pendingLockRef.current.has(candidateId)
          ? candidateId
          : null,
        candidateId,
      })
    ) {
      return false;
    }
    pendingLockRef.current.add(candidateId);
    setPendingIds((ids) =>
      ids.includes(candidateId) ? ids : [...ids, candidateId]
    );
    return true;
  };

  const endPending = (candidateId: string) => {
    pendingLockRef.current.delete(candidateId);
    setPendingIds((ids) => ids.filter((id) => id !== candidateId));
    setHeldPendingId((current) => (current === candidateId ? null : current));
  };

  const wrapBoolean: ClarifyPanelProps["onAnswerBoolean"] = (
    candidate,
    presentation
  ) => {
    if (isGenerating) return;
    if (!beginPending(candidate.id)) return;
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
    const hold = shouldHoldClarifyQuestionUntilPersist({
      remainingRequiredBeforeAnswer: remaining,
      visibleCandidateCount,
    });
    if (hold) {
      setHeldPendingId(candidate.id);
    } else {
      advance(candidate);
    }
    void Promise.resolve(onAnswerBoolean?.(candidate, presentation))
      .then((result) => {
        if (clarifyPersistResultFailed(result)) {
          rollbackFailedClarifyPersist(candidate);
        } else if (hold) {
          advance(candidate);
        }
      })
      .finally(() => {
        endPending(candidate.id);
      });
  };
  const wrapValue: ClarifyPanelProps["onAnswerValue"] = (candidate, value) => {
    if (isGenerating) return;
    const control = clarifyControlType(candidate);
    if (control === "MULTI_SELECT") {
      setLocalValues((prev) => ({ ...prev, [candidate.id]: value }));
      setHeldMultiId(candidate.id);
      return;
    }
    if (!beginPending(candidate.id)) return;
    setLocalValues((prev) => ({ ...prev, [candidate.id]: value }));
    const hold = shouldHoldClarifyQuestionUntilPersist({
      remainingRequiredBeforeAnswer: remaining,
      visibleCandidateCount,
    });
    if (hold) {
      setHeldPendingId(candidate.id);
    } else {
      advance(candidate);
    }
    void Promise.resolve(onAnswerValue?.(candidate, value))
      .then((result) => {
        if (clarifyPersistResultFailed(result)) {
          rollbackFailedClarifyPersist(candidate);
        } else if (hold) {
          advance(candidate);
        }
      })
      .finally(() => {
        endPending(candidate.id);
      });
  };

  const showReady = detailsReadyCardVisible({
    visibleGroupCount: visibleGroups.length,
    remaining,
    viewEnoughToEstimate: view.enoughToEstimate === true,
    readinessEnoughToEstimate: readiness.enoughToEstimate === true,
    persistError,
  });
  const showGenerate = canShowGenerateCta({
    persistError,
    canInitiateGenerate: readiness.canInitiateGenerate === true,
    enoughToEstimate: readiness.enoughToEstimate === true,
  });

  useEffect(() => {
    if (!returnFocusId || isGenerating) return;
    const node = document.querySelector(
      `[data-clarify-id="${CSS.escape(returnFocusId)}"]`
    );
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isGenerating, returnFocusId]);

  if (showReady) {
    return (
      <div className="space-y-3">
        <PersistError error={persistError} />
        {generateNotice && !persistError ? (
          <p className="text-sm font-medium" role="alert">
            {generateNotice}
          </p>
        ) : null}
        <ClarifyReadinessCard
          readiness={readiness}
          isSaving={isSaving && !isGenerating}
          isGenerating={isGenerating}
          generateStage={generateStage}
          generateStartedAt={generateStartedAt}
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
  const nestedPanels = view.nestedItemPanels ?? [];
  const projectGroup = visibleGroups.find((group) => group.workAreaId == null);

  return (
    <div
      className="space-y-4 overflow-x-hidden pb-2 md:space-y-6"
      data-clarify-panel
      data-details-complete-capture="true"
      data-clarify-count={view.visibleCount}
      aria-busy={isGenerating ? "true" : undefined}
    >
      {isGenerating ? (
        <GenerateEstimateStatus
          stage={generateStage}
          startedAt={generateStartedAt}
        />
      ) : null}
      <p className="text-sm text-muted-foreground" data-clarify-progress>
        {countCopy}
      </p>
      <PersistError error={persistError} />
      {generateNotice && !persistError ? (
        <p className="text-sm font-medium" role="status">
          {generateNotice}
        </p>
      ) : null}

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
            {nestedPanels
              .filter((panel) => panel.workAreaId === group.workAreaId)
              .map((panel) => (
                <div key={`nested:${panel.workAreaId}`} className="mt-3">
                  <NestedItemsPanel
                    panel={panel}
                    isSaving={isSaving}
                    onAdd={(workAreaId, key) =>
                      onNestedItemAction?.(workAreaId, key, true)
                    }
                    onDuplicate={(workAreaId, key, itemId) =>
                      onNestedItemAction?.(workAreaId, key, itemId, itemId)
                    }
                    onDelete={(workAreaId, key, itemId) =>
                      onNestedItemAction?.(workAreaId, key, itemId, itemId)
                    }
                  />
                </div>
              ))}
            <div className="mt-3 space-y-4">
              {group.sections.map((section) => (
                <div
                  key={`${section.id}:${section.nestedItemId ?? section.wallTypeId ?? ""}`}
                  data-details-section={section.id}
                  data-details-wall-type={section.wallTypeId ?? undefined}
                  data-details-nested-item={section.nestedItemId ?? undefined}
                >
                  <SectionEyebrow>
                    {section.nestedItemLabel
                      ? `${section.nestedItemLabel} · ${section.label}`
                      : section.wallTypeLabel
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
                        pending={pendingIds.includes(candidate.id)}
                        continuePending={
                          continuePending && candidate.id === heldMultiId
                        }
                        disabled={isGenerating}
                        focused={returnFocusId === candidate.id}
                        onAnswerBoolean={wrapBoolean}
                        onAnswerValue={wrapValue}
                        onContinueMulti={
                          candidate.id === heldMultiId
                            ? () => {
                                if (
                                  isGenerating ||
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
                                setContinuePending(true);
                                advance(candidate);
                                void Promise.resolve(
                                  onAnswerValue?.(candidate, set)
                                ).then((result) => {
                                  if (clarifyPersistResultFailed(result)) {
                                    rollbackFailedClarifyPersist(candidate);
                                  }
                                }).finally(() => {
                                  continueLockRef.current = false;
                                  setContinuePending(false);
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
                  pending={pendingIds.includes(candidate.id)}
                  disabled={isGenerating}
                  focused={returnFocusId === candidate.id}
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
          {!isGenerating && (pendingIds.length > 0 || isSaving) ? (
            <div data-clarify-save-status>
              <SaveStatusIndicator status="saving" isSaving />
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {isGenerating
              ? "Quotr is generating your estimate."
              : readiness.enoughToEstimate || view.enoughToEstimate || pendingIds.length > 0
              ? "Saving the last answer…"
              : "A few more details are still needed before this estimate can be built."}
          </p>
        </div>
      ) : !isGenerating && pendingIds.length > 0 ? (
        <div className="min-h-5" data-clarify-save-status>
          <SaveStatusIndicator status="saving" isSaving />
        </div>
      ) : null}

      <ActionFooter
        className="-mx-1 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0"
        data-clarify-cta-bar=""
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {showGenerate ? (
            <Button
              type="button"
              className="min-h-11 w-full"
              data-clarify-primary-cta
              disabled={isGenerating}
              aria-disabled={isGenerating ? true : undefined}
              onClick={onEstimateNow}
            >
              {isGenerating ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  {ASSISTANT_ACTION_LABELS.generateEstimate}
                </span>
              ) : (
                ASSISTANT_ACTION_LABELS.estimateNow
              )}
            </Button>
          ) : view.canEstimateNow ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              data-clarify-estimate-assumptions
              disabled={isSaving || isGenerating}
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
