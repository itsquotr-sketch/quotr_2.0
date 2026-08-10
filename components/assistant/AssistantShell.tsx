"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssistantProgress } from "@/components/assistant/AssistantProgress";
import { CollapsibleStageCard } from "@/components/assistant/CollapsibleStageCard";
import { StepperNav } from "@/components/assistant/StepperNav";
import { ProjectCaptureBlock } from "@/components/assistant/ProjectCaptureBlock";
import { ConstraintBlock } from "@/components/assistant/ConstraintBlock";
import { EstimateBreakdownModal } from "@/components/assistant/EstimateBreakdownModal";
import { EstimatePanel } from "@/components/assistant/EstimatePanel";
import { QualityBlock, QUALITY_OPTIONS } from "@/components/assistant/QualityBlock";
import {
  QuestionBlock,
  type QuestionAnswers,
} from "@/components/assistant/QuestionBlock";
import { ScopeSummaryBlock } from "@/components/assistant/ScopeSummaryBlock";
import type {
  QualityLevel,
  WorkArea,
  WorkAreaActiveQuestion,
} from "@/components/assistant/types";
import type { MissingQuestionAnswers } from "@/components/assistant/ScopeReviewMissingSection";
import { WorkAreaConfirmationBlock } from "@/components/assistant/WorkAreaConfirmationBlock";
import { ScopeDiscoveryReviewBlock } from "@/components/assistant/ScopeDiscoveryReviewBlock";
import {
  ProjectCaptureCollapsedSummary,
  WorkAreasCollapsedSummary,
  QualityCollapsedSummary,
  QuestionsCollapsedSummary,
  EstimateReviewCollapsedSummary,
  ConstraintsCollapsedSummary,
} from "@/components/assistant/StageCollapsedSummaries";
import {
  confirmWorkAreas,
  generateStaticEstimate,
  regenerateStaticEstimate,
  saveBriefAndSeedWorkAreas,
  saveConstraints,
  saveQuality,
  saveQuestionBlockAnswers,
  updateProjectQualityLevel,
} from "@/lib/assistant/actions";
import {
  createLatestWriteGuard,
  filterPersistableAnswers,
  resolveAnswerSaveStatus,
} from "@/lib/assistant/answer-persistence";
import { updateProjectConstraint } from "@/lib/assistant/constraint-actions";
import { updateProjectFact } from "@/lib/assistant/fact-actions";
import { beginQualitySpecEdit } from "@/lib/assistant/quality-edit";
import { updateEstimateMargin } from "@/lib/assistant/margin-actions";
import {
  addWorkAreaToProject,
  excludeWorkAreaFromProject,
} from "@/lib/assistant/work-area-actions";
import { isStageAtOrBeyond } from "@/lib/assistant/stage";
import { startPreviewPerf, recordPreviewPerf } from "@/lib/assistant/preview-performance";
import {
  resolveActiveDisclosureStage,
  stagePrefersExpanded,
} from "@/lib/assistant/progressive-disclosure";
import {
  buildConstraintChipLabels,
  buildEstimateReviewSummaryModel,
  buildProjectCaptureSummaryModel,
  buildQualitySummaryModel,
  buildQuestionGroupSummaries,
  buildQuickEstimatePresentationModel,
  buildStepperStepSummaries,
  buildWorkAreaFactHighlights,
  buildWorkAreaSummaryLists,
  countAnsweredQuestions,
} from "@/lib/assistant/stage-completion-summaries";
import type { AssistantState } from "@/lib/assistant/types";
import { composeCurrentWorkAreaScopeState } from "@/lib/assistant/current-work-area-scope-state";
import { listManualScopeItemsForProject } from "@/lib/work-areas/scope-items/actions";
import type { ManualScopeItemView } from "@/lib/work-areas/scope-items/types";
import { NoteProposalReviewPanel } from "@/components/project-notes/NoteProposalReviewPanel";
import type { ProjectNote } from "@/lib/project-notes/types";
import type { NoteProposal } from "@/lib/project-notes/proposals/types";
import type { SafeResultsRead } from "@/lib/scope-discovery/application/types";
import type { PricingSummary } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";

type AssistantShellProps = {
  initialState: AssistantState;
  initialNotes?: ProjectNote[];
  totalNoteCount?: number;
  pendingAnalysisCount?: number;
  pendingNoteProposal?: NoteProposal | null;
  pricingSummary?: PricingSummary | null;
  quoteSummary?: QuoteSummary | null;
  /** Server-authoritative Scope Discovery flag — never from client env. */
  scopeDiscoveryEnabled?: boolean;
  scopeDiscoveryInitialResults?: SafeResultsRead | null;
};

type PendingAction =
  | "brief"
  | "work_areas"
  | "quality"
  | "questions"
  | "constraints"
  | "estimate"
  | "regenerate"
  | "add_work_area"
  | "exclude_work_area"
  | null;

function initAnswersFromQuestions(
  questions: { id: string; value?: string | number | boolean | string[] | null }[]
): QuestionAnswers {
  return Object.fromEntries(
    questions.map((q) => [q.id, q.value ?? null])
  );
}

export function AssistantShell({
  initialState,
  initialNotes = [],
  totalNoteCount,
  pendingAnalysisCount = 0,
  pendingNoteProposal = null,
  pricingSummary = null,
  quoteSummary = null,
  scopeDiscoveryEnabled = false,
  scopeDiscoveryInitialResults = null,
}: AssistantShellProps) {
  const router = useRouter();
  const actionLockRef = useRef(false);
  const { project } = initialState;
  const stage = project.stage;

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [briefText, setBriefText] = useState(project.briefText?.trim() ?? "");

  const [workAreas, setWorkAreas] = useState<WorkArea[]>(() =>
    initialState.workAreas.map((wa) => ({ ...wa }))
  );

  const [qualityLevel, setQualityLevel] = useState<QualityLevel | null>(
    project.qualityLevel
  );

  const questionBlock = initialState.questionBlock;
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswers>(() =>
    questionBlock
      ? initAnswersFromQuestions(questionBlock.questions)
      : {}
  );

  const [constraintAnswers, setConstraintAnswers] = useState<QuestionAnswers>(
    () => initAnswersFromQuestions(initialState.constraintQuestions)
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSavingMargin, setIsSavingMargin] = useState(false);
  const [savingFactKey, setSavingFactKey] = useState<string | null>(null);
  const [savingConstraintKey, setSavingConstraintKey] = useState<string | null>(
    null
  );
  const [factError, setFactError] = useState<string | null>(null);
  const [constraintError, setConstraintError] = useState<string | null>(null);
  const [addWorkAreaError, setAddWorkAreaError] = useState<string | null>(null);
  const [isAddingWorkArea, setIsAddingWorkArea] = useState(false);
  const [isExcludingWorkArea, setIsExcludingWorkArea] = useState(false);
  const [savingWorkAreaId, setSavingWorkAreaId] = useState<string | null>(null);
  const [workAreaSaveStatus, setWorkAreaSaveStatus] = useState<
    Record<string, "idle" | "saving" | "saved" | "error">
  >({});
  const [workAreaQuestionError, setWorkAreaQuestionError] = useState<string | null>(
    null
  );
  const workAreaSaveGuardRef = useRef(createLatestWriteGuard());
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [isEditingQuality, setIsEditingQuality] = useState(false);
  const qualityCardRef = useRef<HTMLDivElement | null>(null);
  const questionsCardRef = useRef<HTMLDivElement | null>(null);
  const estimateReviewCardRef = useRef<HTMLDivElement | null>(null);
  const constraintsCardRef = useRef<HTMLDivElement | null>(null);
  const [savedQualityLevel, setSavedQualityLevel] = useState<QualityLevel | null>(
    project.qualityLevel
  );
  const [scopeReviewComplete, setScopeReviewComplete] = useState(() => {
    if (!scopeDiscoveryEnabled) return true;
    const suggestions = scopeDiscoveryInitialResults?.allSuggestions ?? [];
    const hasRun = Boolean(scopeDiscoveryInitialResults?.runId);
    // Inline light check — full helper imported below via effect from child
    if (!hasRun) return false;
    return suggestions
      .filter(
        (s) =>
          s.proposalClass === "SCOPE_ITEM" ||
          s.proposalClass === "CLARIFICATION" ||
          s.proposalClass === "EXCLUSION"
      )
      .filter((s) => {
        const band = String(s.confidenceBand ?? "").toUpperCase();
        const kind = String(s.suggestionKind ?? "").toUpperCase();
        if (band === "LOW" && kind !== "CLARIFICATION_REQUIRED") return false;
        return true;
      })
      .every((s) => s.decisionState !== "PROPOSED");
  });
  const [unresolvedScopeImpactCount, setUnresolvedScopeImpactCount] =
    useState(0);
  const [manualScopeItems, setManualScopeItems] = useState<
    readonly ManualScopeItemView[]
  >([]);
  const [liveScopeCounts, setLiveScopeCounts] = useState<{
    includedCount: number;
    needsDetailCount: number;
    pendingDetailTitles: readonly string[];
  } | null>(null);
  const [forceExpandQuestions, setForceExpandQuestions] = useState(false);
  const scopeReviewCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listManualScopeItemsForProject(project.id).then((outcome) => {
      if (cancelled || !outcome.ok) return;
      setManualScopeItems(outcome.items);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id, initialState.scopeReview]);

  const briefSubmitted = isStageAtOrBeyond(stage, "confirm_work_areas");
  const workAreasConfirmed = isStageAtOrBeyond(stage, "quality");
  const qualitySubmitted = isStageAtOrBeyond(stage, "work_area_questions");
  const questionsSubmitted = isStageAtOrBeyond(stage, "constraints");
  const constraintsSubmitted = isStageAtOrBeyond(stage, "ready_to_estimate");
  const estimateReady = stage === "estimate_ready";

  const submittedConstraintAnswers = useMemo(() => {
    if (initialState.submittedConstraints.length === 0) {
      return constraintAnswers;
    }
    return Object.fromEntries(
      initialState.constraintQuestions.map((q) => [
        q.id,
        q.value ?? null,
      ])
    );
  }, [
    constraintAnswers,
    initialState.constraintQuestions,
    initialState.submittedConstraints.length,
  ]);

  const runAction = useCallback(
    async (action: PendingAction, fn: () => Promise<{ error?: string }>) => {
      if (actionLockRef.current) {
        return;
      }

      actionLockRef.current = true;
      setPendingAction(action);
      setActionError(null);

      try {
        const result = await fn();

        if (result.error) {
          setActionError(result.error);
          setPendingAction(null);
          if (action === "estimate") {
            setIsGenerating(false);
          }
          if (action === "regenerate") {
            setIsRegenerating(false);
          }
          return;
        }

        router.refresh();
        setPendingAction(null);
        if (action === "estimate") {
          setIsGenerating(false);
        }
        if (action === "regenerate") {
          setIsRegenerating(false);
        }
      } finally {
        actionLockRef.current = false;
      }
    },
    [router]
  );

  const handleAnalyseJob = useCallback(() => {
    if (pendingAction != null || actionLockRef.current) {
      return;
    }
    void runAction("brief", () =>
      saveBriefAndSeedWorkAreas(project.id, briefText)
    );
  }, [briefText, pendingAction, project.id, runAction]);

  const handleWorkAreaToggle = useCallback((id: string) => {
    setWorkAreas((prev) =>
      prev.map((wa) =>
        wa.id === id
          ? {
              ...wa,
              status: wa.status === "excluded" ? "suggested" : "excluded",
            }
          : wa
      )
    );
  }, []);

  const handleWorkAreasConfirm = useCallback(
    (areas: WorkArea[]) => {
      const selections = areas.map((wa) => ({
        work_area_id: wa.id,
        status:
          wa.status === "excluded"
            ? ("excluded" as const)
            : ("confirmed" as const),
      }));

      void runAction("work_areas", () =>
        confirmWorkAreas(project.id, selections)
      );
    },
    [project.id, runAction]
  );

  const handleQualityContinue = useCallback(() => {
    if (!qualityLevel) return;
    if (scopeDiscoveryEnabled && !scopeReviewComplete) {
      scopeReviewCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    void runAction("quality", () =>
      saveQuality(project.id, qualityLevel)
    );
  }, [
    project.id,
    qualityLevel,
    runAction,
    scopeDiscoveryEnabled,
    scopeReviewComplete,
  ]);

  const handleQualitySave = useCallback(() => {
    if (!qualityLevel) return;

    void runAction("quality", async () => {
      const result = await updateProjectQualityLevel(project.id, qualityLevel);
      if (!result.error) {
        setSavedQualityLevel(qualityLevel);
        setIsEditingQuality(false);
      }
      return result;
    });
  }, [project.id, qualityLevel, runAction]);

  const handleQualityCancelEdit = useCallback(() => {
    setQualityLevel(savedQualityLevel);
    setIsEditingQuality(false);
  }, [savedQualityLevel]);

  const handleQualityEdit = useCallback(() => {
    if (scopeDiscoveryEnabled && !scopeReviewComplete) {
      scopeReviewCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    beginQualitySpecEdit({
      setEditing: setIsEditingQuality,
      scrollTarget: qualityCardRef,
    });
  }, [scopeDiscoveryEnabled, scopeReviewComplete]);

  const handleReviewAttention = useCallback(
    (item: { reviewTarget?: string }) => {
      const target = item.reviewTarget;
      if (target === "questions" || !target) {
        setForceExpandQuestions(true);
      }
      // Expand + scroll after paint so collapsed cards have layout height.
      window.requestAnimationFrame(() => {
        const el =
          target === "scopeReview"
            ? scopeReviewCardRef.current
            : target === "quality"
              ? qualityCardRef.current
              : target === "constraints"
                ? constraintsCardRef.current
                : target === "estimateReview"
                  ? estimateReviewCardRef.current
                  : questionsCardRef.current ?? estimateReviewCardRef.current;
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    []
  );

  const qualityUnlocked =
    !scopeDiscoveryEnabled || scopeReviewComplete || qualitySubmitted;

  const handleQuestionsSubmit = useCallback(() => {
    if (!questionBlock) return;

    const answers = questionBlock.questions.map((q) => ({
      question_id: q.id,
      value: questionAnswers[q.id] as string | number | boolean,
    }));

    void runAction("questions", () =>
      saveQuestionBlockAnswers(project.id, questionBlock.id, answers)
    );
  }, [project.id, questionAnswers, questionBlock, runAction]);

  const handleConstraintsSubmit = useCallback(() => {
    const constraints = initialState.constraintQuestions.map((q) => ({
      key: q.key,
      label: q.label,
      value: constraintAnswers[q.id] as string | number | boolean,
    }));

    void runAction("constraints", () =>
      saveConstraints(project.id, constraints)
    );
  }, [
    constraintAnswers,
    initialState.constraintQuestions,
    project.id,
    runAction,
  ]);

  const handleGenerateEstimate = useCallback(() => {
    if (isGenerating || pendingAction != null || actionLockRef.current) {
      return;
    }
    setIsGenerating(true);
    recordPreviewPerf("estimate_generate_ack", 0);
    const endPerf = startPreviewPerf("estimate_generate_complete");
    void runAction("estimate", async () => {
      try {
        return await generateStaticEstimate(project.id);
      } finally {
        endPerf();
      }
    });
  }, [isGenerating, pendingAction, project.id, runAction]);

  const handleRegenerateEstimate = useCallback(() => {
    if (isRegenerating || pendingAction != null || actionLockRef.current) {
      return;
    }
    setIsRegenerating(true);
    recordPreviewPerf("estimate_generate_ack", 0);
    const endPerf = startPreviewPerf("estimate_generate_complete");
    void runAction("regenerate", async () => {
      try {
        return await regenerateStaticEstimate(project.id);
      } finally {
        endPerf();
      }
    });
  }, [isRegenerating, pendingAction, project.id, runAction]);

  const handleQuestionAnswer = useCallback(
    (questionId: string, value: string | number | boolean | string[]) => {
      setQuestionAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    []
  );

  const handleConstraintAnswer = useCallback(
    (questionId: string, value: string | number | boolean | string[]) => {
      setConstraintAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    []
  );

  const handleFactSave = useCallback(
    async (input: {
      workAreaId: string;
      key: string;
      label: string;
      value: string | number | boolean | string[];
      unit?: string;
      inputType?: "number" | "select" | "boolean" | "text" | "multi_select";
    }) => {
      const factKey = `${input.workAreaId}:${input.key}`;
      recordPreviewPerf("question_save_ack", 0);
      const endSavePerf = startPreviewPerf("question_save_complete");
      setSavingFactKey(factKey);
      setFactError(null);

      const result = await updateProjectFact({
        projectId: project.id,
        workAreaId: input.workAreaId,
        key: input.key,
        label: input.label,
        value: input.value,
        unit: input.unit,
        valueType: input.inputType,
      });

      if (result.error) {
        setFactError(result.error);
        setSavingFactKey(null);
        endSavePerf();
        return;
      }

      setSavingFactKey(null);
      endSavePerf();
      startTransition(() => {
        router.refresh();
      });
    },
    [project.id, router]
  );

  const handleConstraintSave = useCallback(
    async (input: {
      key: string;
      label: string;
      value: string | number | boolean;
      inputType?: "select" | "boolean";
    }) => {
      setSavingConstraintKey(input.key);
      setConstraintError(null);

      const result = await updateProjectConstraint({
        projectId: project.id,
        key: input.key,
        label: input.label,
        value: input.value,
        inputType: input.inputType,
      });

      if (result.error) {
        setConstraintError(result.error);
        setSavingConstraintKey(null);
        return;
      }

      router.refresh();
      setSavingConstraintKey(null);
    },
    [project.id, router]
  );

  const handleMarginSave = useCallback(
    async (targetMarginPercent: number | null) => {
      setIsSavingMargin(true);
      setActionError(null);

      const result = await updateEstimateMargin({
        projectId: project.id,
        targetMarginPercent,
      });

      if (result.error) {
        setActionError(result.error);
        setIsSavingMargin(false);
        return;
      }

      router.refresh();
      setIsSavingMargin(false);
    },
    [project.id, router]
  );

  const handleAddWorkArea = useCallback(
    async (workAreaType: string) => {
      setIsAddingWorkArea(true);
      setAddWorkAreaError(null);

      const result = await addWorkAreaToProject({
        projectId: project.id,
        workAreaType,
      });

      if (result.error) {
        setAddWorkAreaError(result.error);
        setIsAddingWorkArea(false);
        return;
      }

      router.refresh();
      setIsAddingWorkArea(false);
    },
    [project.id, router]
  );

  const handleExcludeWorkArea = useCallback(
    async (workAreaId: string) => {
      setIsExcludingWorkArea(true);
      setActionError(null);

      const result = await excludeWorkAreaFromProject({
        projectId: project.id,
        workAreaId,
      });

      if (result.error) {
        setActionError(result.error);
        setIsExcludingWorkArea(false);
        return;
      }

      router.refresh();
      setIsExcludingWorkArea(false);
    },
    [project.id, router]
  );

  const handleSaveWorkAreaQuestions = useCallback(
    async (input: {
      workAreaId: string;
      workAreaName: string;
      questions: WorkAreaActiveQuestion[];
      answers: MissingQuestionAnswers;
    }) => {
      const saveToken = workAreaSaveGuardRef.current.next();
      recordPreviewPerf("question_save_ack", 0);
      const endSavePerf = startPreviewPerf("question_save_complete");
      setSavingWorkAreaId(input.workAreaId);
      setWorkAreaSaveStatus((prev) => ({
        ...prev,
        [input.workAreaId]: "saving",
      }));
      setWorkAreaQuestionError(null);

      const questionsByBlock = new Map<string, WorkAreaActiveQuestion[]>();
      for (const question of input.questions) {
        const existing = questionsByBlock.get(question.questionBlockId) ?? [];
        existing.push(question);
        questionsByBlock.set(question.questionBlockId, existing);
      }

      for (const [blockId, blockQuestions] of questionsByBlock) {
        const payload = filterPersistableAnswers(
          blockQuestions.map((question) => ({
            question_id: question.id,
            value: input.answers[question.id],
          }))
        );

        if (payload.length === 0) {
          continue;
        }

        const result = await saveQuestionBlockAnswers(
          project.id,
          blockId,
          payload
        );

        if (!workAreaSaveGuardRef.current.isCurrent(saveToken)) {
          endSavePerf();
          return;
        }

        if (result.error) {
          const resolved = resolveAnswerSaveStatus({
            success: false,
            error: result.error,
          });
          setWorkAreaQuestionError(resolved.error);
          setSavingWorkAreaId(null);
          setWorkAreaSaveStatus((prev) => ({
            ...prev,
            [input.workAreaId]: resolved.status,
          }));
          endSavePerf();
          return;
        }
      }

      if (!workAreaSaveGuardRef.current.isCurrent(saveToken)) {
        endSavePerf();
        return;
      }

      setWorkAreaSaveStatus((prev) => ({
        ...prev,
        [input.workAreaId]: "saved",
      }));
      setSavingWorkAreaId(null);
      endSavePerf();
      // Optimistic local answers already show Saved — refresh in background.
      startTransition(() => {
        router.refresh();
      });
    },
    [project.id, router]
  );

  const estimate = estimateReady ? initialState.estimate : null;
  const displayWorkAreas =
    workAreas.length > 0 ? workAreas : initialState.workAreas;

  // Stage 3.1A-R1: do not remount Scope Review on answer value changes —
  // remounting wiped optimistic local answers and caused temporary reversion.

  const captureIsCurrent = !briefSubmitted;
  const workAreasIsCurrent = briefSubmitted && !workAreasConfirmed;
  const qualityIsCurrent =
    workAreasConfirmed && qualityUnlocked && !qualitySubmitted;
  const questionsIsCurrent =
    qualitySubmitted && questionBlock !== null && !questionsSubmitted;
  const constraintsIsCurrent = questionsSubmitted && !constraintsSubmitted;
  const canGenerateEstimate = constraintsSubmitted && !estimateReady;

  const activeDisclosureStage = resolveActiveDisclosureStage({
    briefSubmitted,
    workAreasConfirmed,
    scopeDiscoveryEnabled,
    scopeReviewComplete,
    qualityUnlocked,
    qualitySubmitted,
    questionsSubmitted,
    constraintsSubmitted,
    estimateReady,
    estimateStale: Boolean(estimate?.isStale),
  });

  const captureSummaryModel = buildProjectCaptureSummaryModel({
    briefText,
    noteCount: totalNoteCount ?? initialNotes.length,
    lastUpdatedAt:
      initialNotes.length > 0
        ? [...initialNotes].sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt)
          )[0]?.updatedAt ?? null
        : null,
  });
  const workAreaLists = buildWorkAreaSummaryLists(displayWorkAreas);
  const workAreaHighlights = buildWorkAreaFactHighlights({
    workAreas: displayWorkAreas,
    scopeReview: initialState.scopeReview,
    qualityLevel: qualitySubmitted ? qualityLevel : null,
  });
  const qualitySummaryModel = buildQualitySummaryModel(qualityLevel);
  const questionGroups = questionBlock
    ? buildQuestionGroupSummaries({
        questions: questionBlock.questions,
        answers: questionAnswers,
      })
    : [];
  const answeredQuestionCount = questionBlock
    ? countAnsweredQuestions({
        questions: questionBlock.questions,
        answers: questionAnswers,
      })
    : 0;
  const composedScopeState = useMemo(
    () =>
      composeCurrentWorkAreaScopeState({
        suggestions: scopeDiscoveryInitialResults?.allSuggestions ?? [],
        manualItems: manualScopeItems,
        scopeReview: initialState.scopeReview,
      }),
    [scopeDiscoveryInitialResults, manualScopeItems, initialState.scopeReview]
  );
  const includedScopeItemCount =
    liveScopeCounts?.includedCount ?? composedScopeState.includedCount;
  const needsDetailScopeCount =
    liveScopeCounts?.needsDetailCount ?? composedScopeState.needsDetailCount;
  const pendingScopeDetailTitles =
    liveScopeCounts?.pendingDetailTitles ??
    composedScopeState.summaryLists.pendingScopeDetails.map((p) => p.title);
  const estimateReviewSummaryModel = buildEstimateReviewSummaryModel({
    scopeReview: initialState.scopeReview,
    estimateReady,
    estimateStale: Boolean(estimate?.isStale),
    constraintCount: initialState.submittedConstraints.length,
    includedScopeItemCount:
      includedScopeItemCount || initialState.scopeReview.workAreas.length,
  });
  const constraintChips = buildConstraintChipLabels({
    questions: initialState.constraintQuestions,
    answers: constraintsSubmitted
      ? submittedConstraintAnswers
      : constraintAnswers,
    submittedRows: constraintsSubmitted
      ? initialState.submittedConstraints
      : undefined,
  });
  // 7F-R5: do not map needs-detail into "open clarification".
  // Named Scope Details pending titles drive attention via EstimatePanel.
  const quickEstimatePresentation = buildQuickEstimatePresentationModel({
    workAreaNames: workAreaLists.included,
    includedScopeItemCount:
      includedScopeItemCount || workAreaLists.included.length,
    outstandingClarificationCount: 0,
    assumptionCount:
      initialState.scopeReview.generalAssumptions.length +
      initialState.scopeReview.workAreas.reduce(
        (n, wa) => n + wa.assumptions.length,
        0
      ),
    missingCount: Math.max(
      initialState.scopeReview.workAreas.reduce(
        (n, wa) => n + wa.missingItems.length,
        0
      ),
      pendingScopeDetailTitles.length
    ),
    constraintCount: initialState.submittedConstraints.length,
    specificationSelected: qualitySubmitted && Boolean(qualityLevel),
    questionsSubmitted,
    constraintsSubmitted,
  });
  const stepperSummaries = buildStepperStepSummaries({
    answeredQuestionCount,
    estimateReady,
    estimateStale: Boolean(estimate?.isStale),
    constraintCount: initialState.submittedConstraints.length,
    includedScopeItemCount:
      includedScopeItemCount || workAreaLists.included.length,
    needsDetailCount: needsDetailScopeCount,
    includedWorkAreaCount: workAreaLists.included.length,
    qualityTitle: qualityLevel
      ? QUALITY_OPTIONS.find((o) => o.value === qualityLevel)?.title ?? null
      : null,
    briefSubmitted,
  });

  const stepperAttention = {
    constraints:
      questionsSubmitted &&
      !constraintsSubmitted &&
      initialState.scopeReview.workAreas.some(
        (workArea) => workArea.missingItems.length > 0
      ),
    estimate_ready: estimate?.isStale,
  };

  return (
    <div data-project-id={project.id} className="w-full min-w-0">
      <AssistantProgress currentStage={stage} />

      {actionError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className="hidden xl:block">
          <div className="sticky top-6">
            <StepperNav
              currentStage={stage}
              needsAttention={stepperAttention}
              stepSummaries={stepperSummaries}
            />
          </div>
        </aside>

        <div className="min-w-0 order-2 space-y-2.5 lg:order-none">
          {/* 1. Project Capture */}
          <CollapsibleStageCard
            title="Project Capture"
            subtitle={
              briefSubmitted
                ? "Brief and site notes are source material. Later notes can be analysed into proposed updates."
                : "Start with a brief, site notes or rough scope. Quotr will help identify work areas and questions."
            }
            statusLabel={
              captureIsCurrent
                ? "Current"
                : briefSubmitted
                  ? captureSummaryModel.outcomeLabel
                  : undefined
            }
            statusVariant={captureIsCurrent ? "current" : "complete"}
            preferredExpanded={stagePrefersExpanded(
              "capture",
              activeDisclosureStage
            )}
            canCollapse={briefSubmitted}
            isActive={activeDisclosureStage === "capture"}
            summaryContent={
              <ProjectCaptureCollapsedSummary model={captureSummaryModel} />
            }
            actionLabel={briefSubmitted ? "View" : undefined}
          >
            <ProjectCaptureBlock
              briefText={briefText}
              onBriefChange={setBriefText}
              projectId={project.id}
              initialNotes={initialNotes}
              totalNoteCount={totalNoteCount}
              pendingAnalysisCount={pendingAnalysisCount}
              onAnalyse={briefSubmitted ? undefined : handleAnalyseJob}
              disabled={pendingAction != null}
              isAnalysing={pendingAction === "brief"}
              submitted={briefSubmitted}
            />
          </CollapsibleStageCard>

          {/* 2. Work Area Confirmation */}
          {briefSubmitted ? (
            <CollapsibleStageCard
              title="Work Areas"
              subtitle="Review what we detected from your brief and site notes"
              statusLabel={
                workAreasIsCurrent
                  ? "Current"
                  : workAreasConfirmed
                    ? `${workAreaLists.included.length} included`
                    : undefined
              }
              statusVariant={workAreasIsCurrent ? "current" : "complete"}
              preferredExpanded={stagePrefersExpanded(
                "workAreas",
                activeDisclosureStage
              )}
              canCollapse={workAreasConfirmed}
              isActive={activeDisclosureStage === "workAreas"}
              summaryContent={
                <WorkAreasCollapsedSummary
                  lists={workAreaLists}
                  highlights={workAreaHighlights}
                />
              }
              actionLabel={workAreasConfirmed ? "Change areas" : undefined}
            >
              <WorkAreaConfirmationBlock
                workAreas={displayWorkAreas}
                submitted={workAreasConfirmed}
                isSaving={pendingAction === "work_areas"}
                isAddingWorkArea={isAddingWorkArea}
                addWorkAreaError={addWorkAreaError}
                onToggle={
                  workAreasConfirmed ? undefined : handleWorkAreaToggle
                }
                onConfirm={
                  workAreasConfirmed ? undefined : handleWorkAreasConfirm
                }
                onAddWorkArea={
                  workAreasConfirmed ? undefined : handleAddWorkArea
                }
              />
            </CollapsibleStageCard>
          ) : null}

          {/* 2b. Intelligent Scope Discovery — Preview flag only */}
          {scopeDiscoveryEnabled && workAreasConfirmed ? (
            <div ref={scopeReviewCardRef}>
              <ScopeDiscoveryReviewBlock
                projectId={project.id}
                enabled={scopeDiscoveryEnabled}
                initialResults={scopeDiscoveryInitialResults}
                scopeReview={initialState.scopeReview}
                workAreaLabels={Object.fromEntries(
                  displayWorkAreas
                    .filter((wa) => wa.status !== "excluded")
                    .map((wa) => [wa.id, wa.name])
                )}
                onCompletionChange={setScopeReviewComplete}
                onUnresolvedRecommendationsChange={
                  setUnresolvedScopeImpactCount
                }
                onScopeStateChange={setLiveScopeCounts}
                onReviewScopeDetails={() => {
                  questionsCardRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                preferredExpanded={stagePrefersExpanded(
                  "scopeReview",
                  activeDisclosureStage
                )}
                isActiveStage={activeDisclosureStage === "scopeReview"}
              />
            </div>
          ) : null}

          {/* 3. Specification (Quality level — UX label only) */}
          {workAreasConfirmed ? (
            <CollapsibleStageCard
              title="Specification"
              subtitle="Set the finish level for this estimate"
              statusLabel={
                !qualityUnlocked && !qualitySubmitted
                  ? "Locked"
                  : qualityIsCurrent
                    ? "Current"
                    : qualitySubmitted
                      ? qualitySummaryModel.outcomeLabel
                      : undefined
              }
              statusVariant={
                !qualityUnlocked && !qualitySubmitted
                  ? "stale"
                  : qualityIsCurrent
                    ? "current"
                    : "complete"
              }
              preferredExpanded={stagePrefersExpanded(
                "quality",
                activeDisclosureStage
              )}
              forceExpanded={isEditingQuality}
              canCollapse={qualitySubmitted && !isEditingQuality}
              isActive={activeDisclosureStage === "quality"}
              summaryContent={
                !qualityUnlocked && !qualitySubmitted ? (
                  <p className="text-xs text-muted-foreground">
                    Confirm scope first
                  </p>
                ) : (
                  <QualityCollapsedSummary model={qualitySummaryModel} />
                )
              }
              actionLabel={qualitySubmitted ? "Change spec" : undefined}
              onAction={qualitySubmitted ? handleQualityEdit : undefined}
              cardRef={qualityCardRef}
            >
              {!qualityUnlocked && !qualitySubmitted ? (
                <p className="text-sm text-muted-foreground" role="status">
                  Confirm the scope items above before selecting the
                  specification level.
                </p>
              ) : (
                <QualityBlock
                  selected={qualityLevel}
                  submitted={qualitySubmitted}
                  editing={isEditingQuality}
                  isSaving={pendingAction === "quality"}
                  onSelect={setQualityLevel}
                  onContinue={
                    qualitySubmitted ? undefined : handleQualityContinue
                  }
                  onSave={qualitySubmitted ? handleQualitySave : undefined}
                  onCancelEdit={
                    qualitySubmitted ? handleQualityCancelEdit : undefined
                  }
                />
              )}
            </CollapsibleStageCard>
          ) : null}

          {/* 4. Scope Details */}
          {questionsIsCurrent && questionBlock ? (
            <CollapsibleStageCard
              title="Scope Details"
              subtitle={questionBlock.description}
              statusLabel="Current"
              statusVariant="current"
              preferredExpanded={stagePrefersExpanded(
                "questions",
                activeDisclosureStage
              )}
              forceExpanded={forceExpandQuestions}
              canCollapse={false}
              isActive={activeDisclosureStage === "questions"}
              cardRef={questionsCardRef}
            >
              <QuestionBlock
                questions={questionBlock.questions}
                derivedFactDisplays={initialState.derivedFactDisplays}
                answers={questionAnswers}
                isSaving={pendingAction === "questions"}
                onAnswerChange={handleQuestionAnswer}
                onSubmit={handleQuestionsSubmit}
              />
            </CollapsibleStageCard>
          ) : null}

          {/* 4b. Completed Scope Details summary */}
          {questionsSubmitted && questionBlock ? (
            <CollapsibleStageCard
              title="Scope Details"
              subtitle={questionBlock.description}
              statusLabel={
                answeredQuestionCount === 1
                  ? "1 answered · complete"
                  : `${answeredQuestionCount} answered · complete`
              }
              statusVariant="complete"
              preferredExpanded={false}
              forceExpanded={forceExpandQuestions}
              canCollapse
              isActive={false}
              cardRef={questionsCardRef}
              summaryContent={
                <QuestionsCollapsedSummary
                  groups={questionGroups}
                  answeredCount={answeredQuestionCount}
                />
              }
              actionLabel="View answers"
            >
              <QuestionBlock
                questions={questionBlock.questions}
                derivedFactDisplays={initialState.derivedFactDisplays}
                answers={questionAnswers}
                submitted
                isSaving={false}
              />
            </CollapsibleStageCard>
          ) : null}

          {/* 5. Pending Proposal Review — always above Scope Review */}
          {pendingNoteProposal ? (
            <NoteProposalReviewPanel
              projectId={project.id}
              proposal={pendingNoteProposal}
            />
          ) : null}

          {/* 6. Estimate Review */}
          {questionsSubmitted ? (
            <CollapsibleStageCard
              title="Estimate Review"
              subtitle="Review what Quotr will use for this estimate."
              statusLabel={
                estimate?.isStale
                  ? "Needs refresh"
                  : estimateReady
                    ? estimateReviewSummaryModel.outcomeLabel
                    : "Review"
              }
              statusVariant={
                estimate?.isStale
                  ? "stale"
                  : estimateReady
                    ? "complete"
                    : "review"
              }
              preferredExpanded={stagePrefersExpanded(
                "estimateReview",
                activeDisclosureStage
              )}
              canCollapse={questionsSubmitted}
              forceExpanded={Boolean(estimate?.isStale)}
              isActive={activeDisclosureStage === "estimateReview"}
              cardRef={estimateReviewCardRef}
              summaryContent={
                <EstimateReviewCollapsedSummary
                  model={estimateReviewSummaryModel}
                />
              }
              actionLabel={
                estimateReady || questionsSubmitted ? "View" : undefined
              }
            >
              <ScopeSummaryBlock
                projectId={project.id}
                scopeReview={initialState.scopeReview}
                workAreas={initialState.workAreas}
                editable={questionsSubmitted}
                manageWorkAreas={workAreasConfirmed}
                estimateIsStale={estimate?.isStale}
                savingFactKey={savingFactKey}
                savingWorkAreaId={savingWorkAreaId}
                workAreaSaveStatus={workAreaSaveStatus}
                workAreaQuestionError={workAreaQuestionError}
                factError={factError}
                isAddingWorkArea={isAddingWorkArea}
                isExcludingWorkArea={isExcludingWorkArea}
                addWorkAreaError={addWorkAreaError}
                constraintPreview={
                  constraintChips.length === 0
                    ? "None captured"
                    : constraintChips.slice(0, 2).join(" · ")
                }
                onFactSave={questionsSubmitted ? handleFactSave : undefined}
                onSaveWorkAreaQuestions={
                  questionsSubmitted ? handleSaveWorkAreaQuestions : undefined
                }
                onAddWorkArea={workAreasConfirmed ? handleAddWorkArea : undefined}
                onExcludeWorkArea={
                  workAreasConfirmed ? handleExcludeWorkArea : undefined
                }
              />
            </CollapsibleStageCard>
          ) : null}

          {/* 7. Site Constraints */}
          {questionsSubmitted ? (
            <CollapsibleStageCard
              title="Site Constraints"
              subtitle="Access, slope, and site conditions"
              statusLabel={
                constraintsIsCurrent
                  ? "Current"
                  : constraintsSubmitted
                    ? constraintChips.length === 0
                      ? "No additional constraints"
                      : `${constraintChips.length} applied`
                    : undefined
              }
              statusVariant={constraintsIsCurrent ? "current" : "complete"}
              preferredExpanded={stagePrefersExpanded(
                "constraints",
                activeDisclosureStage
              )}
              canCollapse={constraintsSubmitted}
              isActive={activeDisclosureStage === "constraints"}
              cardRef={constraintsCardRef}
              summaryContent={
                <ConstraintsCollapsedSummary chips={constraintChips} />
              }
              actionLabel={constraintsSubmitted ? "View" : undefined}
            >
              <ConstraintBlock
                questions={initialState.constraintQuestions}
                answers={
                  constraintsSubmitted
                    ? submittedConstraintAnswers
                    : constraintAnswers
                }
                submitted={constraintsSubmitted}
                editable={constraintsSubmitted}
                isSaving={pendingAction === "constraints"}
                savingConstraintKey={savingConstraintKey}
                constraintError={constraintError}
                workAreaTypes={workAreas
                  .filter((wa) => wa.status !== "excluded")
                  .map((wa) => wa.type)}
                onAnswerChange={
                  constraintsSubmitted ? undefined : handleConstraintAnswer
                }
                onSubmit={
                  constraintsSubmitted ? undefined : handleConstraintsSubmit
                }
                onConstraintSave={
                  constraintsSubmitted ? handleConstraintSave : undefined
                }
              />
            </CollapsibleStageCard>
          ) : null}
        </div>

        <div className="min-w-0 order-1 lg:order-none lg:self-start">
          <EstimatePanel
            projectId={initialState.project.id}
            estimate={estimate}
            qualityLevel={qualitySubmitted ? qualityLevel : null}
            pricingSummary={pricingSummary}
            quoteSummary={quoteSummary}
            isGenerating={isGenerating}
            isRegenerating={isRegenerating}
            isSavingMargin={isSavingMargin}
            defaultMarginPercent={initialState.defaultMarginPercent}
            panelScopeSummaries={initialState.panelScopeSummaries}
            scopeReview={initialState.scopeReview}
            questionsSubmitted={questionsSubmitted}
            constraintsSubmitted={constraintsSubmitted}
            canGenerateEstimate={canGenerateEstimate}
            pendingProposalCount={pendingNoteProposal ? 1 : 0}
            unresolvedScopeImpactCount={unresolvedScopeImpactCount}
            constraintCount={initialState.submittedConstraints.length}
            isActiveStage={
              activeDisclosureStage === null && canGenerateEstimate
            }
            quickEstimatePresentation={
              questionsSubmitted ? quickEstimatePresentation : null
            }
            pendingScopeDetailTitles={pendingScopeDetailTitles}
            onViewBreakdown={() => setBreakdownOpen(true)}
            onGenerate={handleGenerateEstimate}
            onRegenerate={handleRegenerateEstimate}
            onMarginSave={estimateReady ? handleMarginSave : undefined}
            onEditQuality={qualitySubmitted ? handleQualityEdit : undefined}
            onReviewAttention={handleReviewAttention}
          />
        </div>
      </div>

      <EstimateBreakdownModal
        estimate={estimate}
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        onRegenerate={handleRegenerateEstimate}
        isRegenerating={isRegenerating}
        projectId={project.id}
      />
    </div>
  );
}
