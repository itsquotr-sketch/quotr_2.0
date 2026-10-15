"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import type { ClarifyCandidate, ClarifyView } from "@/lib/assistant/clarify/types";
import type { EstimateReadinessView } from "@/lib/assistant/readiness/types";
import type { RefineView } from "@/lib/assistant/refine/types";
import { ClarifyReadinessCard } from "@/components/assistant/clarify/ClarifyReadiness";
import { NestedItemsPanel } from "@/components/assistant/clarify/NestedItemsPanel";
import { ClarifyAnswerControl } from "@/components/assistant/clarify/ClarifyAnswerControl";
import { GenerateEstimateStatus } from "@/components/assistant/clarify/GenerateEstimateStatus";
import { DeckPostHolesSection } from "@/components/assistant/job-plan/DeckPostHolesSection";
import type { EstimateFact } from "@/lib/estimate/types";
import { ASSISTANT_ACTION_LABELS, ASSISTANT_LOADING_COPY } from "@/lib/assistant/presentation/action-labels";
import { Loader2 } from "lucide-react";
import { PREMIUM } from "@/lib/ui/premium";
import {
  mobileActionDockClass,
  mobileActionInnerClass,
} from "@/components/layout/mobile-nav-metrics";
import { cn } from "@/lib/utils";
import { shouldShowWhyThisMatters, whyThisMattersForKey } from "@/lib/assistant/presentation/why-this-matters";
import {
  booleanChoiceOptions,
  clarifyControlType,
} from "@/lib/assistant/clarify/question-contract";
import {
  canShowGenerateCta,
  clarifyGenerateIntentAction,
  clarifyPersistResultFailed,
  clarifyQueuedGenerateAction,
  detailsReadyCardVisible,
  effectiveRemainingRequiredCount,
  localAnswersCompleteForGenerate,
  shouldHoldClarifyQuestionUntilPersist,
  shouldIgnoreDuplicateClarifyActivation,
} from "@/lib/assistant/clarify/interaction";
import type { GenerateEstimateStage } from "@/lib/assistant/clarify/generate-sync";

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
  /** Keep Create estimate visible while the final answer save is still in flight. */
  holdCreateEstimate?: boolean;
  onAnswerBoolean?: (
    candidate: ClarifyCandidate,
    presentation: "INCLUDED" | "NOT_INCLUDED"
  ) => void | Promise<unknown>;
  onAnswerValue?: (
    candidate: ClarifyCandidate,
    value: string | number | boolean | string[]
  ) => void | Promise<unknown>;
  onEstimateNow?: () => boolean | void;
  /** Required answers from the one settled readiness result, including post holes. */
  settledRemaining?: number;
  readySummary?: string | null;
  deckAreas?: readonly {
    workAreaId: string;
    name: string;
    facts: readonly EstimateFact[];
    onSpecFact?: (input: {
      workAreaId: string;
      key: string;
      label: string;
      value: string | number;
      valueType: "number" | "select" | "text";
    }) => void;
    onSpecFacts?: (input: {
      workAreaId: string;
      facts: readonly {
        key: string;
        label: string;
        value: string | number;
        valueType: "number" | "select" | "text";
      }[];
    }) => Promise<{ error?: string } | void> | void;
    focusGapId?: string | null;
    focusNonce?: number;
    accessSuitable?: boolean;
    postHolesSettled?: boolean;
    onBooleanFact?: (input: {
      workAreaId: string;
      key: string;
      label: string;
      value: boolean;
    }) => void;
  }[];
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
      <p
        className="break-words text-sm font-medium leading-snug md:text-[0.95rem]"
        aria-label={candidate.label}
      >
        {candidate.question}
      </p>
      {showWhy && whyText ? (
        <p className="text-xs text-muted-foreground" data-why-this-matters>
          {whyText}
        </p>
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

function PersistError({
  error,
  errorRef,
}: {
  error?: string | null;
  errorRef?: RefObject<HTMLParagraphElement | null>;
}) {
  if (!error) return null;
  return (
    <p ref={errorRef} className="text-sm text-destructive" role="alert" tabIndex={-1}>
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
  holdCreateEstimate = false,
  onAnswerBoolean,
  onAnswerValue,
  onEstimateNow,
  settledRemaining,
  readySummary = null,
  onNestedItemAction,
  deckAreas = [],
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
  const persistErrorRef = useRef<HTMLParagraphElement>(null);
  const detailsSavingRef = useRef(false);
  const pendingLockRef = useRef<Set<string>>(new Set());
  const generateIntentRef = useRef(false);
  const lastFailedAnswerRef = useRef<
    | {
        mode: "boolean";
        candidate: ClarifyCandidate;
        presentation: "INCLUDED" | "NOT_INCLUDED";
      }
    | {
        mode: "value";
        candidate: ClarifyCandidate;
        value: string | number | boolean | string[];
      }
    | null
  >(null);
  const queueFailedRef = useRef(false);
  const mountedRef = useRef(true);
  const [finishingAnswers, setFinishingAnswers] = useState(false);

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

  const settleQueuedGenerate = (failed: boolean) => {
    if (failed) queueFailedRef.current = true;
    if (!generateIntentRef.current) {
      queueFailedRef.current = false;
      return;
    }
    if (
      pendingLockRef.current.size > 0 ||
      continueLockRef.current ||
      detailsSavingRef.current
    ) {
      return;
    }
    const failedAny = queueFailedRef.current;
    queueFailedRef.current = false;
    const action = clarifyQueuedGenerateAction({
      intentQueued: true,
      savesPending: false,
      persistError: failedAny,
      localAnswersComplete: !failedAny,
    });
    if (action === "wait") return;
    if (action !== "generate" || !mountedRef.current) {
      generateIntentRef.current = false;
      setFinishingAnswers(false);
      return;
    }
    if (onEstimateNow?.() === false) return;
    generateIntentRef.current = false;
    setFinishingAnswers(false);
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
    let failed = false;
    void Promise.resolve(onAnswerBoolean?.(candidate, presentation))
      .then((result) => {
        failed = clarifyPersistResultFailed(result);
        if (failed) {
          lastFailedAnswerRef.current = {
            mode: "boolean",
            candidate,
            presentation,
          };
          rollbackFailedClarifyPersist(candidate);
        } else if (hold) {
          lastFailedAnswerRef.current = null;
          advance(candidate);
        } else {
          lastFailedAnswerRef.current = null;
        }
      })
      .catch(() => {
        failed = true;
        lastFailedAnswerRef.current = {
          mode: "boolean",
          candidate,
          presentation,
        };
        rollbackFailedClarifyPersist(candidate);
      })
      .finally(() => {
        endPending(candidate.id);
        settleQueuedGenerate(failed);
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
    let failed = false;
    void Promise.resolve(onAnswerValue?.(candidate, value))
      .then((result) => {
        failed = clarifyPersistResultFailed(result);
        if (failed) {
          lastFailedAnswerRef.current = { mode: "value", candidate, value };
          rollbackFailedClarifyPersist(candidate);
        } else if (hold) {
          lastFailedAnswerRef.current = null;
          advance(candidate);
        } else {
          lastFailedAnswerRef.current = null;
        }
      })
      .catch(() => {
        failed = true;
        lastFailedAnswerRef.current = { mode: "value", candidate, value };
        rollbackFailedClarifyPersist(candidate);
      })
      .finally(() => {
        endPending(candidate.id);
        settleQueuedGenerate(failed);
      });
  };

  const showReady = detailsReadyCardVisible({
    visibleGroupCount: visibleGroups.length,
    remaining,
    viewEnoughToEstimate: view.enoughToEstimate === true,
    readinessEnoughToEstimate: readiness.enoughToEstimate === true,
    persistError,
  });
  const savesPending =
    pendingIds.length > 0 || continuePending || Boolean(isSaving);
  const localAnswersComplete = localAnswersCompleteForGenerate({
    remainingRequiredCount: view.remainingRequiredCount ?? view.visibleCount,
    candidates: view.candidates,
    resolvedIds: locallyResolvedIds,
    heldPendingId,
    heldValue: heldPendingId ? localValues[heldPendingId] : null,
    blocksEstimate: readiness.blocksEstimate === true,
    persistError,
  });
  const authoritativeGenerate = canShowGenerateCta({
    persistError,
    canInitiateGenerate: readiness.canInitiateGenerate === true,
    enoughToEstimate: readiness.enoughToEstimate === true,
  });
  const showCreateEstimate =
    Boolean(onEstimateNow) &&
    (localAnswersComplete || authoritativeGenerate || holdCreateEstimate);

  const requestCreateEstimate = () => {
    const failedAnswer = lastFailedAnswerRef.current;
    if (persistError && failedAnswer && !isGenerating) {
      generateIntentRef.current = true;
      setFinishingAnswers(true);
      if (failedAnswer.mode === "boolean") {
        wrapBoolean(failedAnswer.candidate, failedAnswer.presentation);
      } else {
        wrapValue(failedAnswer.candidate, failedAnswer.value);
      }
      return;
    }
    const clarifySavesPending =
      pendingIds.length > 0 || continuePending || Boolean(isSaving);
    detailsSavingRef.current = Boolean(isSaving);
    const action = clarifyGenerateIntentAction({
      savesPending: clarifySavesPending,
      alreadyQueued: generateIntentRef.current || finishingAnswers,
      alreadyGenerating: Boolean(isGenerating),
      persistError: Boolean(persistError),
    });
    if (action === "ignore") return;
    if (action === "queue") {
      generateIntentRef.current = true;
      setFinishingAnswers(true);
      return;
    }
    if (onEstimateNow?.() === false) {
      generateIntentRef.current = true;
      setFinishingAnswers(true);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!persistError) return;
    persistErrorRef.current?.focus();
  }, [persistError]);

  useEffect(() => {
    detailsSavingRef.current = Boolean(isSaving);
    if (isSaving || pendingIds.length > 0 || continuePending) return;
    if (!generateIntentRef.current) return;
    const failedAny = queueFailedRef.current || Boolean(persistError);
    queueFailedRef.current = false;
    const action = clarifyQueuedGenerateAction({
      intentQueued: true,
      savesPending: false,
      persistError: failedAny,
      localAnswersComplete: !failedAny,
    });
    if (action === "wait") return;
    if (action !== "generate") {
      generateIntentRef.current = false;
      setFinishingAnswers(false);
      return;
    }
    if (onEstimateNow?.() === false) return;
    generateIntentRef.current = false;
    setFinishingAnswers(false);
  }, [continuePending, isSaving, onEstimateNow, pendingIds.length, persistError]);

  useEffect(() => {
    if (!returnFocusId || isGenerating) return;
    const node =
      document.querySelector(
        `[data-clarify-id="${CSS.escape(returnFocusId)}"]`
      ) ?? document.getElementById(returnFocusId);
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isGenerating, returnFocusId]);

  if (showReady && !finishingAnswers && !savesPending) {
    return (
      <div className="space-y-3">
        <PersistError error={persistError} errorRef={persistErrorRef} />
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
          onEstimateNow={requestCreateEstimate}
          readySummary={readySummary}
        />
      </div>
    );
  }

  const countedRemaining = settledRemaining ?? remaining;
  const countCopy =
    countedRemaining <= 0
      ? "Confirm anything still open, or estimate with assumptions."
      : countedRemaining === 1
        ? "1 important detail remaining"
        : `${countedRemaining} important details remaining`;

  const workAreaGroups = visibleGroups.filter((group) => group.workAreaId);
  const nestedPanels = view.nestedItemPanels ?? [];
  const projectGroup = visibleGroups.find((group) => group.workAreaId == null);

  return (
    <div
      className="max-w-[880px] space-y-4 overflow-x-hidden pb-2 max-md:pb-24 md:space-y-5"
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
      <PersistError error={persistError} errorRef={persistErrorRef} />
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
            {deckAreas
              .filter(
                (area) =>
                  area.workAreaId === group.workAreaId &&
                  area.postHolesSettled !== false
              )
              .map((area) => (
                <div key={`holes:${area.workAreaId}`} className="mt-3">
                  <DeckPostHolesSection
                    workAreaId={area.workAreaId}
                    facts={area.facts}
                    onSpecFact={area.onSpecFact}
                    onSpecFacts={area.onSpecFacts}
                    onBooleanFact={area.onBooleanFact}
                    focusGapId={area.focusGapId}
                    focusNonce={area.focusNonce}
                    accessSuitable={area.accessSuitable}
                  />
                </div>
              ))}
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
                        persistError={
                          persistError &&
                          (pendingIds.includes(candidate.id) ||
                            heldPendingId === candidate.id)
                            ? persistError
                            : null
                        }
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
                                let failed = false;
                                void Promise.resolve(
                                  onAnswerValue?.(candidate, set)
                                ).then((result) => {
                                  failed = clarifyPersistResultFailed(result);
                                  if (failed) {
                                    rollbackFailedClarifyPersist(candidate);
                                  }
                                }).catch(() => {
                                  failed = true;
                                  rollbackFailedClarifyPersist(candidate);
                                }).finally(() => {
                                  continueLockRef.current = false;
                                  setContinuePending(false);
                                  settleQueuedGenerate(failed);
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
                  persistError={
                    persistError &&
                    (pendingIds.includes(candidate.id) ||
                      heldPendingId === candidate.id)
                      ? persistError
                      : null
                  }
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

      {visibleGroups.length === 0 && !showCreateEstimate && !savesPending ? (
        <p className="text-sm text-muted-foreground" data-clarify-waiting>
          A few more details are still needed before this estimate can be built.
        </p>
      ) : null}

      {showCreateEstimate ||
      (view.canEstimateNow && onEstimateNow && !savesPending) ||
      (savesPending && !showCreateEstimate && !finishingAnswers && !isGenerating && !continuePending) ? (
      <div
        className={cn(
          "sticky z-30 border-t border-border bg-background px-3",
          mobileActionDockClass,
          mobileActionInnerClass,
          "md:bottom-0"
        )}
        data-clarify-cta-bar=""
      >
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          {showCreateEstimate ? (
            <Button
              type="button"
              className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-clarify-primary-cta
              data-clarify-generate-queued={finishingAnswers ? "true" : undefined}
              disabled={finishingAnswers || isGenerating}
              aria-busy={finishingAnswers || isGenerating || savesPending ? true : undefined}
              onClick={requestCreateEstimate}
            >
              {finishingAnswers || isGenerating || savesPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
              ) : null}
              {isGenerating
                ? generateStage === "saving"
                  ? ASSISTANT_LOADING_COPY.questionSave
                  : ASSISTANT_LOADING_COPY.creatingEstimate
                : finishingAnswers || savesPending
                  ? ASSISTANT_LOADING_COPY.questionSave
                  : ASSISTANT_ACTION_LABELS.estimateNow}
            </Button>
          ) : view.canEstimateNow && onEstimateNow && !savesPending ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-clarify-estimate-assumptions
              disabled={isSaving || isGenerating || finishingAnswers}
              onClick={onEstimateNow}
            >
              {ASSISTANT_ACTION_LABELS.estimateNowUsingAssumptions}
            </Button>
          ) : null}
          {savesPending && !showCreateEstimate && !finishingAnswers && !isGenerating && !continuePending ? (
            <p
              className="text-sm text-muted-foreground sm:ml-auto"
              role="status"
              data-clarify-save-status
            >
              {ASSISTANT_ACTION_LABELS.savingAnswer}
            </p>
          ) : null}
        </div>
      </div>
      ) : null}
    </div>
  );
}
