"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssistantProgress } from "@/components/assistant/AssistantProgress";
import { CollapsibleStageCard } from "@/components/assistant/CollapsibleStageCard";
import { StepperNav } from "@/components/assistant/StepperNav";
import { ProjectCaptureBlock } from "@/components/assistant/ProjectCaptureBlock";
import { ConstraintBlock } from "@/components/assistant/ConstraintBlock";
import { ProjectConditionsBlock } from "@/components/assistant/ProjectConditionsBlock";
import { CompletedSetupDisclosure } from "@/components/assistant/CompletedSetupDisclosure";
import { EstimateReadyCard } from "@/components/assistant/EstimateReadyCard";
import { EstimateBreakdownModal } from "@/components/assistant/EstimateBreakdownModal";
import { EstimatePanel } from "@/components/assistant/EstimatePanel";
import { PlanningSurface } from "@/components/assistant/mode/PlanningSurface";
import { EstimateReadySurface } from "@/components/assistant/mode/EstimateReadySurface";
import { EditJobSurface } from "@/components/assistant/mode/EditJobSurface";
import { QualityBlock, QUALITY_OPTIONS } from "@/components/assistant/QualityBlock";
import {
  QuestionBlock,
  type QuestionAnswers,
} from "@/components/assistant/QuestionBlock";
import { buildProjectUnderstandingSummaries } from "@/lib/assistant/presentation/assistant-understanding-summary";
import { AssistantUnderstandingSummaryCard } from "@/components/assistant/AssistantUnderstandingSummaryCard";
import { ScopeSummaryBlock } from "@/components/assistant/ScopeSummaryBlock";
import type {
  QualityLevel,
  WorkArea,
  WorkAreaActiveQuestion,
} from "@/components/assistant/types";
import type { MissingQuestionAnswers } from "@/components/assistant/ScopeReviewMissingSection";
import { JobPlanPanel } from "@/components/assistant/job-plan/JobPlanPanel";
import { ClarifyPanel } from "@/components/assistant/clarify/ClarifyPanel";
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
  buildPendingMarginTotals,
  marginTotalsMatchEstimate,
  type MarginTotalsOverlay,
} from "@/lib/assistant/margin-optimistic";
import type { Estimate } from "@/components/assistant/types";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  addWorkAreaToProject,
  excludeWorkAreaFromProject,
} from "@/lib/assistant/work-area-actions";
import { composeJobPlan } from "@/lib/assistant/job-plan/compose";
import { applyJobPlanScopeWrite } from "@/lib/assistant/job-plan/apply-write";
import { writeJobPlanScopeDecision } from "@/lib/assistant/job-plan/actions";
import { overlayFact } from "@/lib/assistant/job-plan/facts";
import { JOB_PLAN_IS_PRIMARY } from "@/lib/assistant/job-plan/flags";
import {
  jobPlanFactsFromAssistantState,
  jobPlanWorkAreasFromUi,
} from "@/lib/assistant/job-plan/from-assistant-state";
import type { JobPlanScopeItem } from "@/lib/assistant/job-plan/types";
import { composeClarifyView } from "@/lib/assistant/clarify/compose";
import {
  answerClarifyConstraint,
  answerClarifyFact,
  answerClarifySelectFact,
  completeClarifyPlanning,
} from "@/lib/assistant/clarify/actions";
import { CLARIFY_IS_PRIMARY } from "@/lib/assistant/clarify/flags";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import {
  ASSISTANT_MODES_PRIMARY,
  deriveAssistantUiMode,
  formatWorkAreaSummaryDetail,
  formatWorkAreaSummaryLine,
  resolveAttentionNavigation,
  type EditJobSection,
} from "@/lib/assistant/mode";
import type { EstimateFact } from "@/lib/estimate/types";
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
import type { AssistantState, ConstraintRow } from "@/lib/assistant/types";
import { buildLiveProjectConditionsSnapshot } from "@/lib/assistant/builder-interview-live";
import {
  buildQuickEstimateAttentionItems,
  type QuickEstimateAttentionItem,
} from "@/lib/assistant/presentation/quick-estimate-view-model";
import { applyLevel1AttentionPresentation } from "@/lib/assistant/presentation/attention-severity";
import {
  deriveQuickEstimateConfidencePresentation,
  rankQuickEstimateAssumptions,
} from "@/lib/assistant/presentation/quick-estimate-confidence";
import { MAX_QUICK_ESTIMATE_TOP_ASSUMPTIONS } from "@/lib/scopes/estimate-priority";
import { composeCurrentWorkAreaScopeState } from "@/lib/assistant/current-work-area-scope-state";
import { listManualScopeItemsForProject } from "@/lib/work-areas/scope-items/actions";
import type { ManualScopeItemView } from "@/lib/work-areas/scope-items/types";
import { NoteProposalReviewPanel } from "@/components/project-notes/NoteProposalReviewPanel";
import type { ProjectNote } from "@/lib/project-notes/types";
import type { NoteProposal } from "@/lib/project-notes/proposals/types";
import type { SafeResultsRead } from "@/lib/scope-discovery/application/types";
import type { PricingSummary } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  | "clarify"
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

  const [workAreas] = useState<WorkArea[]>(() =>
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
  const [marginSaveLabel, setMarginSaveLabel] = useState<string | null>(null);
  const [marginOverlay, setMarginOverlay] = useState<MarginTotalsOverlay | null>(
    null
  );
  const [editJobOpen, setEditJobOpen] = useState(false);
  const [editJobSection, setEditJobSection] = useState<EditJobSection | null>(
    null
  );
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [estimateReviewDetailsOpen, setEstimateReviewDetailsOpen] =
    useState(false);
  const marginSaveLockRef = useRef(false);
  const [savingFactKey, setSavingFactKey] = useState<string | null>(null);
  const [savingConstraintKey, setSavingConstraintKey] = useState<string | null>(
    null
  );
  const [factError, setFactError] = useState<string | null>(null);
  const [constraintError, setConstraintError] = useState<string | null>(null);
  const [addWorkAreaError, setAddWorkAreaError] = useState<string | null>(null);
  const [isAddingWorkArea, setIsAddingWorkArea] = useState(false);
  const [isExcludingWorkArea, setIsExcludingWorkArea] = useState(false);
  const [jobPlanFactOverlay, setJobPlanFactOverlay] = useState<EstimateFact[]>(
    []
  );
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
  const estimatePanelAnchorRef = useRef<HTMLDivElement | null>(null);
  const constraintsCardRef = useRef<HTMLDivElement | null>(null);
  const projectConditionsCardRef = useRef<HTMLDivElement | null>(null);
  const [liveConstraints, setLiveConstraints] = useState<ConstraintRow[]>(
    () => initialState.submittedConstraints
  );
  const [projectConditionsFocusKey, setProjectConditionsFocusKey] = useState<
    string | null
  >(null);
  const [forceExpandProjectConditions, setForceExpandProjectConditions] =
    useState(false);
  const [savedQualityLevel, setSavedQualityLevel] = useState<QualityLevel | null>(
    project.qualityLevel
  );
  const [scopeReviewComplete] = useState(() => {
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
  const [unresolvedScopeImpactCount] =
    useState(0);
  const [manualScopeItems, setManualScopeItems] = useState<
    readonly ManualScopeItemView[]
  >([]);
  const [liveScopeCounts] = useState<{
    includedCount: number;
    needsDetailCount: number;
    pendingDetailTitles: readonly string[];
    scopeReviewAttention?: readonly {
      label: string;
      workAreaName?: string;
      workAreaId?: string | null;
      suggestionId: string;
    }[];
  } | null>(null);
  const [forceExpandQuestions, setForceExpandQuestions] = useState(false);
  const [reviewFocusQuestionId, setReviewFocusQuestionId] = useState<
    string | null
  >(null);
  const [reviewFocusQuestionKey, setReviewFocusQuestionKey] = useState<
    string | null
  >(null);
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

  const projectConditionsSnapshot = useMemo(() => {
    try {
      const scopeQuestionCount =
        questionsSubmitted && questionBlock
          ? questionBlock.questions.length
          : 0;
      return buildLiveProjectConditionsSnapshot({
        projectId: project.id,
        qualityLevel: project.qualityLevel,
        workAreas,
        facts: initialState.interviewFacts,
        constraints: liveConstraints,
        scopeQuestionCount,
      });
    } catch {
      return null;
    }
  }, [
    project.id,
    project.qualityLevel,
    workAreas,
    initialState.interviewFacts,
    liveConstraints,
    questionsSubmitted,
    questionBlock,
  ]);

  useEffect(() => {
    if (!projectConditionsSnapshot) {
      recordPreviewPerf("builder_interview_candidate_build", 0, { ok: false });
      return;
    }
    // Pure engine is sub-ms; mark build completion after commit (observational).
    recordPreviewPerf("builder_interview_candidate_build", 0, {
      candidateCount: projectConditionsSnapshot.remainingCount,
      ok: true,
    });
    recordPreviewPerf("builder_interview_load", 0, {
      candidateCount: projectConditionsSnapshot.remainingCount,
      ok: true,
    });
  }, [projectConditionsSnapshot]);
  const projectConditionsUsable = projectConditionsSnapshot !== null;
  const preferProjectConditionsAsk =
    questionsSubmitted && projectConditionsUsable;

  // FOUNDATION-R1-R1: only unlock Generate when required Project Conditions
  // are resolved. Empty saveConstraints([]) must not skip the PC stage.
  const estimateStageUnlockRef = useRef(false);
  useEffect(() => {
    if (CLARIFY_IS_PRIMARY) {
      return;
    }
    if (
      !preferProjectConditionsAsk ||
      constraintsSubmitted ||
      estimateStageUnlockRef.current
    ) {
      return;
    }
    if (!projectConditionsSnapshot?.readiness.canGenerateQuickEstimate) {
      return;
    }
    estimateStageUnlockRef.current = true;
    void (async () => {
      const result = await saveConstraints(project.id, []);
      if (result.error) {
        estimateStageUnlockRef.current = false;
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    })();
  }, [
    preferProjectConditionsAsk,
    constraintsSubmitted,
    project.id,
    router,
    projectConditionsSnapshot?.readiness.canGenerateQuickEstimate,
  ]);

  const submittedConstraintAnswers = useMemo(() => {
    if (liveConstraints.length === 0 && initialState.submittedConstraints.length === 0) {
      return constraintAnswers;
    }
    const rows =
      liveConstraints.length > 0
        ? liveConstraints
        : initialState.submittedConstraints;
    // Map by constraint question id when present, else by key-as-id.
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return Object.fromEntries(
      initialState.constraintQuestions.map((q) => [
        q.id,
        byKey.get(q.key) ?? q.value ?? null,
      ])
    );
  }, [
    constraintAnswers,
    initialState.constraintQuestions,
    initialState.submittedConstraints,
    liveConstraints,
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
    if (scopeDiscoveryEnabled && !scopeReviewComplete && !JOB_PLAN_IS_PRIMARY) {
      setActionError(
        "Confirm the scope items above before selecting the specification level."
      );
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
    if (scopeDiscoveryEnabled && !scopeReviewComplete && !JOB_PLAN_IS_PRIMARY) {
      setActionError(
        "Confirm the scope items above before changing the specification level."
      );
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

  const openEditJob = useCallback((section: EditJobSection | null = "job_plan") => {
    setEditJobOpen(true);
    setEditJobSection(section);
  }, []);

  const closeEditJob = useCallback(() => {
    setQualityLevel(savedQualityLevel);
    setIsEditingQuality(false);
    setEditJobOpen(false);
    setEditJobSection(null);
    setForceExpandQuestions(false);
    setForceExpandProjectConditions(false);
    setReviewFocusQuestionId(null);
    setReviewFocusQuestionKey(null);
    setProjectConditionsFocusKey(null);
  }, [savedQualityLevel]);

  const handleReviewAttention = useCallback(
    (item: {
      reviewTarget?: string;
      workAreaId?: string;
      factKey?: string;
      questionId?: string;
      suggestionId?: string;
      scopeItemId?: string;
    }) => {
      const nav = resolveAttentionNavigation(item);
      if (nav.kind === "builder_review") {
        setBreakdownOpen(true);
        return;
      }

      setForceExpandQuestions(false);
      setForceExpandProjectConditions(false);
      setIsEditingQuality(false);
      setEstimateReviewDetailsOpen(false);

      openEditJob(nav.section);

      if (nav.section === "details") {
        beginQualitySpecEdit({
          setEditing: setIsEditingQuality,
          scrollTarget: qualityCardRef,
        });
      }
      if (nav.section === "project_conditions") {
        setForceExpandProjectConditions(true);
        setProjectConditionsFocusKey(item.questionId ?? item.factKey ?? null);
      }
      if (nav.section === "advanced") {
        setForceExpandQuestions(true);
        setReviewFocusQuestionId(item.questionId ?? null);
        setReviewFocusQuestionKey(item.factKey ?? null);
      } else {
        setReviewFocusQuestionId(null);
        setReviewFocusQuestionKey(item.factKey ?? null);
      }

      window.requestAnimationFrame(() => {
        const sectionEl = document.querySelector<HTMLElement>(
          `[data-edit-job-section="${nav.section}"]`
        );
        const precise =
          (item.questionId
            ? document.querySelector<HTMLElement>(
                `[data-question-id="${item.questionId}"]`
              )
            : null) ??
          (item.factKey
            ? document.querySelector<HTMLElement>(
                `[data-question-key="${item.factKey}"], [data-project-condition-key="${item.factKey}"]`
              )
            : null) ??
          (item.workAreaId
            ? document.querySelector<HTMLElement>(
                `[data-work-area-id="${item.workAreaId}"]`
              )
            : null);
        const el = precise ?? sectionEl;
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        if (precise) {
          const focusable = precise.querySelector<HTMLElement>(
            "input, select, textarea, button"
          );
          focusable?.focus({ preventScroll: true });
        }
      });
    },
    [openEditJob]
  );

  const qualityUnlocked =
    JOB_PLAN_IS_PRIMARY ||
    !scopeDiscoveryEnabled ||
    scopeReviewComplete ||
    qualitySubmitted;

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
        if (CLARIFY_IS_PRIMARY && !constraintsSubmitted) {
          const advanced = await completeClarifyPlanning({
            projectId: project.id,
            qualityLevel: qualityLevel ?? "standard",
            generate: true,
          });
          return advanced;
        }
        return await generateStaticEstimate(project.id);
      } finally {
        endPerf();
      }
    });
  }, [
    isGenerating,
    pendingAction,
    project.id,
    runAction,
    constraintsSubmitted,
    qualityLevel,
  ]);

  const handleRegenerateEstimate = useCallback(() => {
    if (isRegenerating || pendingAction != null || actionLockRef.current) {
      return;
    }
    if (
      preferProjectConditionsAsk &&
      !projectConditionsSnapshot?.readiness.canGenerateQuickEstimate
    ) {
      setActionError(
        "Complete the remaining project information before generating the estimate."
      );
      return;
    }
    setIsRegenerating(true);
    recordPreviewPerf("estimate_generate_ack", 0);
    const endPerf = startPreviewPerf("estimate_generate_complete");
    void runAction("regenerate", async () => {
      try {
        const result = await regenerateStaticEstimate(project.id);
        if (!("error" in result && result.error)) {
          setEditJobOpen(false);
          setEditJobSection(null);
        }
        return result;
      } finally {
        endPerf();
      }
    });
  }, [
    isRegenerating,
    pendingAction,
    project.id,
    runAction,
    preferProjectConditionsAsk,
    projectConditionsSnapshot?.readiness.canGenerateQuickEstimate,
  ]);

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

      setLiveConstraints((prev) => {
        const next = prev.filter((r) => r.key !== input.key);
        next.push({
          id: prev.find((r) => r.key === input.key)?.id ?? input.key,
          key: input.key,
          label: input.label,
          value: input.value,
          source: "user",
        });
        return next;
      });
      setSavingConstraintKey(null);
      startTransition(() => {
        router.refresh();
      });
    },
    [project.id, router]
  );

  const handleMarginSave = useCallback(
    async (targetMarginPercent: number | null) => {
      if (marginSaveLockRef.current) return;
      const baseEstimate = initialState.estimate;
      if (!baseEstimate || baseEstimate.isStale) return;

      marginSaveLockRef.current = true;
      setIsSavingMargin(true);
      setActionError(null);
      setMarginSaveLabel(null);

      const effectiveMargin =
        targetMarginPercent ??
        initialState.defaultMarginPercent ??
        DEFAULT_MARGIN_PERCENT;

      const pending = buildPendingMarginTotals({
        recommendedCost: baseEstimate.recommendedCost,
        marginPercent: effectiveMargin,
        previousSell: baseEstimate.recommendedSell,
        previousSellLow: baseEstimate.sellLow,
        previousSellHigh: baseEstimate.sellHigh,
        targetMarginPercent,
      });
      setMarginOverlay(pending);

      const endAck = startPreviewPerf("margin_save_ack");
      const endComplete = startPreviewPerf("margin_save_complete");

      try {
        const result = await updateEstimateMargin({
          projectId: project.id,
          targetMarginPercent,
        });
        endAck();

        if (result.error || !result.success) {
          setMarginOverlay(null);
          setActionError(result.error ?? "Could not update margin.");
          setMarginSaveLabel(null);
          setIsSavingMargin(false);
          marginSaveLockRef.current = false;
          endComplete();
          return;
        }

        if (result.marginTotals) {
          setMarginOverlay(result.marginTotals);
        }
        setMarginSaveLabel("Saved");
        setIsSavingMargin(false);
        endComplete();

        startTransition(() => {
          router.refresh();
        });
        marginSaveLockRef.current = false;
      } catch {
        endAck();
        endComplete();
        setMarginOverlay(null);
        setActionError("Could not update margin.");
        setMarginSaveLabel(null);
        setIsSavingMargin(false);
        marginSaveLockRef.current = false;
      }
    },
    [
      initialState.defaultMarginPercent,
      initialState.estimate,
      project.id,
      router,
    ]
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

  const handleJobPlanToggleScope = useCallback(
    async (
      item: JobPlanScopeItem,
      presentation: "INCLUDED" | "NOT_INCLUDED"
    ) => {
      if (!item.write) return;
      setJobPlanFactOverlay((prev) =>
        applyJobPlanScopeWrite({
          facts: prev,
          workAreaId: item.workAreaId,
          write: item.write!,
          presentation,
        }) as EstimateFact[]
      );
      const result = await writeJobPlanScopeDecision({
        projectId: project.id,
        workAreaId: item.workAreaId,
        write: item.write,
        presentation,
      });
      if (result.error) {
        setActionError(result.error);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    },
    [project.id, router]
  );

  const handleClarifyBoolean = useCallback(
    async (
      candidate: ClarifyCandidate,
      presentation: "INCLUDED" | "NOT_INCLUDED"
    ) => {
      if (candidate.write && candidate.workAreaId) {
        setJobPlanFactOverlay((prev) =>
          applyJobPlanScopeWrite({
            facts: prev,
            workAreaId: candidate.workAreaId!,
            write: candidate.write!,
            presentation,
          }) as EstimateFact[]
        );
        const result = await answerClarifyFact({
          projectId: project.id,
          workAreaId: candidate.workAreaId,
          write: candidate.write,
          presentation,
        });
        if (result.error) {
          setActionError(result.error);
          return;
        }
      } else if (candidate.factKey) {
        const value = presentation === "INCLUDED";
        setJobPlanFactOverlay((prev) =>
          overlayFact(prev, {
            key: candidate.factKey!,
            work_area_id: candidate.workAreaId,
            value,
          })
        );
        const result = await answerClarifySelectFact({
          projectId: project.id,
          workAreaId: candidate.workAreaId,
          key: candidate.factKey,
          label: candidate.label,
          value,
          valueType: "boolean",
        });
        if (result.error) {
          setActionError(result.error);
          return;
        }
      }
      startTransition(() => {
        router.refresh();
      });
    },
    [project.id, router]
  );

  const handleClarifyValue = useCallback(
    async (candidate: ClarifyCandidate, value: string | number | boolean) => {
      if (candidate.writeTarget === "CONSTRAINT" && candidate.questionKey) {
        const constraintKey = candidate.constraintKey ?? candidate.questionKey;
        setLiveConstraints((prev) => [
          ...prev.filter((row) => row.key !== constraintKey),
          {
            id: constraintKey,
            key: constraintKey,
            label: candidate.label,
            value,
            source: "user",
          },
        ]);
        const result = await answerClarifyConstraint({
          projectId: project.id,
          questionKey: candidate.questionKey,
          value,
        });
        if (result.error) {
          setActionError(result.error);
          return;
        }
        startTransition(() => {
          router.refresh();
        });
        return;
      }
      if (!candidate.factKey) return;
      setJobPlanFactOverlay((prev) =>
        overlayFact(prev, {
          key: candidate.factKey!,
          work_area_id: candidate.workAreaId,
          value,
        })
      );
      const result = await answerClarifySelectFact({
        projectId: project.id,
        workAreaId: candidate.workAreaId,
        key: candidate.factKey,
        label: candidate.label,
        value,
        valueType:
          candidate.inputType === "number"
            ? "number"
            : candidate.inputType === "boolean"
              ? "boolean"
              : "select",
      });
      if (result.error) {
        setActionError(result.error);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    },
    [project.id, router]
  );

  const handleJobPlanSpecFact = useCallback(
    async (input: {
      workAreaId: string;
      key: string;
      label: string;
      value: string | number;
      valueType: "number" | "select";
    }) => {
      setJobPlanFactOverlay((prev) =>
        overlayFact(prev, {
          key: input.key,
          work_area_id: input.workAreaId,
          value: input.value,
        })
      );
      const result = await updateProjectFact({
        projectId: project.id,
        workAreaId: input.workAreaId,
        key: input.key,
        label: input.label,
        value: input.value,
        valueType: input.valueType,
      });
      if (result.error) {
        setActionError(result.error);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
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

  const estimateBase = estimateReady ? initialState.estimate : null;
  if (
    marginOverlay &&
    estimateBase &&
    marginTotalsMatchEstimate(estimateBase, marginOverlay)
  ) {
    setMarginOverlay(null);
  }
  const estimate: Estimate | null = useMemo(() => {
    if (!estimateBase) return null;
    if (!marginOverlay) return estimateBase;
    if (marginTotalsMatchEstimate(estimateBase, marginOverlay)) {
      return estimateBase;
    }
    return {
      ...estimateBase,
      recommendedSell: marginOverlay.recommendedSell,
      sellLow: marginOverlay.sellLow,
      sellHigh: marginOverlay.sellHigh,
      grossProfit: marginOverlay.grossProfit,
      marginPercent: marginOverlay.marginPercent,
      targetMarginPercent: marginOverlay.targetMarginPercent,
    };
  }, [estimateBase, marginOverlay]);

  const displayWorkAreas =
    workAreas.length > 0 ? workAreas : initialState.workAreas;

  const jobPlanBaseFacts = useMemo(
    () => jobPlanFactsFromAssistantState(initialState),
    [initialState]
  );
  const jobPlanFacts = useMemo(() => {
    let facts = jobPlanBaseFacts;
    for (const row of jobPlanFactOverlay) {
      facts = overlayFact(facts, row);
    }
    return facts;
  }, [jobPlanBaseFacts, jobPlanFactOverlay]);
  const jobPlan = useMemo(
    () =>
      composeJobPlan({
        workAreas: jobPlanWorkAreasFromUi(displayWorkAreas),
        facts: jobPlanFacts,
        constraints: liveConstraints.map((row) => ({
          key: row.key,
          value: row.value,
        })),
        qualityLevel: qualityLevel ?? project.qualityLevel,
        briefText: briefText || project.briefText,
      }),
    [
      briefText,
      displayWorkAreas,
      jobPlanFacts,
      liveConstraints,
      project.briefText,
      project.qualityLevel,
      qualityLevel,
    ]
  );

  const clarifyView = useMemo(
    () =>
      composeClarifyView({
        stage,
        briefText: briefText || project.briefText,
        qualityLevel: qualityLevel ?? project.qualityLevel,
        workAreas: displayWorkAreas,
        facts: jobPlanFacts,
        constraints: liveConstraints.map((row) => ({
          key: row.key,
          value: row.value,
        })),
        jobPlan,
      }),
    [
      briefText,
      displayWorkAreas,
      jobPlan,
      jobPlanFacts,
      liveConstraints,
      project.briefText,
      project.qualityLevel,
      qualityLevel,
      stage,
    ]
  );

  // Stage 3.1A-R1: do not remount Scope Review on answer value changes —
  // remounting wiped optimistic local answers and caused temporary reversion.

  const understandingSummaries = useMemo(
    () =>
      buildProjectUnderstandingSummaries({
        workAreas: displayWorkAreas.filter((wa) => wa.status === "confirmed"),
        facts: initialState.scopeReview.workAreas.flatMap((wa) =>
          wa.facts.map((fact) => ({
            key: fact.key,
            work_area_id: wa.workAreaId,
            value: fact.rawValue ?? fact.value,
          }))
        ),
      }),
    [displayWorkAreas, initialState.scopeReview.workAreas]
  );
  const captureIsCurrent = !briefSubmitted;
  const workAreasIsCurrent = briefSubmitted && !workAreasConfirmed;
  const qualityIsCurrent =
    workAreasConfirmed && qualityUnlocked && !qualitySubmitted;
  const questionsIsCurrent =
    qualitySubmitted && questionBlock !== null && !questionsSubmitted;
  const constraintsIsCurrent = questionsSubmitted && !constraintsSubmitted;
  const projectConditionsReadyToGenerate = Boolean(
    projectConditionsSnapshot?.readiness.canGenerateQuickEstimate
  );
  const canGenerateEstimate = CLARIFY_IS_PRIMARY
    ? workAreasConfirmed && !estimateReady && clarifyView.canEstimateNow
    : constraintsSubmitted &&
      !estimateReady &&
      (!preferProjectConditionsAsk || projectConditionsReadyToGenerate);

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
  const scopeReviewAttentionItems =
    liveScopeCounts?.scopeReviewAttention ??
    composedScopeState.scopeReviewAttention.map((s) => ({
      label: s.title,
      workAreaName: s.workAreaName,
      workAreaId: s.workAreaId,
      suggestionId: s.suggestionId,
    }));
  const estimateReviewSummaryModel = buildEstimateReviewSummaryModel({
    scopeReview: initialState.scopeReview,
    estimateReady,
    estimateStale: Boolean(estimate?.isStale),
    constraintCount: liveConstraints.length,
    includedScopeItemCount:
      includedScopeItemCount || initialState.scopeReview.workAreas.length,
  });
  const constraintChips = buildConstraintChipLabels({
    questions: initialState.constraintQuestions,
    answers: submittedConstraintAnswers,
    submittedRows: liveConstraints,
  });
  const projectInformationLabel = CLARIFY_IS_PRIMARY
    ? workAreasConfirmed && !estimateReady
      ? clarifyView.enoughToEstimate
        ? "Job plan confirmed · Estimate ready"
        : `Job plan confirmed · ${clarifyView.visibleCount} thing${
            clarifyView.visibleCount === 1 ? "" : "s"
          } to clarify`
      : null
    : preferProjectConditionsAsk
    ? projectConditionsSnapshot?.complete
      ? projectConditionsSnapshot.readiness.state === "READY_WITH_ASSUMPTIONS"
        ? "Ready with assumptions"
        : "Ready"
      : `${projectConditionsSnapshot?.remainingCount ?? 0} important question${
          (projectConditionsSnapshot?.remainingCount ?? 0) === 1 ? "" : "s"
        } remaining`
    : null;
  const projectConditionsAttention =
    CLARIFY_IS_PRIMARY && !estimateReady
      ? []
      : preferProjectConditionsAsk &&
        projectConditionsSnapshot &&
        !projectConditionsSnapshot.complete
      ? projectConditionsSnapshot.candidates
          .filter((c) => c.priority === "P0" || c.priority === "P1")
          .slice(0, 3)
          .map((c) => ({
            label: c.question,
            questionKey: c.questionKey,
            factKey: c.targetKey,
          }))
      : [];
  const assumptionCountForReview =
    initialState.scopeReview.generalAssumptions.length +
    initialState.scopeReview.workAreas.reduce(
      (n, wa) => n + wa.assumptions.length,
      0
    );
  // 7F-R5: do not map needs-detail into "open clarification".
  // Named Scope Details pending titles drive attention via EstimatePanel.
  const quickEstimatePresentation = buildQuickEstimatePresentationModel({
    workAreaNames: workAreaLists.included,
    includedScopeItemCount:
      includedScopeItemCount || workAreaLists.included.length,
    outstandingClarificationCount: 0,
    assumptionCount: assumptionCountForReview,
    missingCount: Math.max(
      initialState.scopeReview.workAreas.reduce(
        (n, wa) => n + wa.missingItems.length,
        0
      ),
      pendingScopeDetailTitles.length
    ),
    constraintCount: liveConstraints.length,
    specificationSelected: qualitySubmitted && Boolean(qualityLevel),
    questionsSubmitted,
    constraintsSubmitted:
      constraintsSubmitted &&
      (!preferProjectConditionsAsk || projectConditionsReadyToGenerate),
  });
  const stepperSummaries = buildStepperStepSummaries({
    answeredQuestionCount,
    estimateReady,
    estimateStale: Boolean(estimate?.isStale),
    constraintCount: liveConstraints.length,
    includedScopeItemCount:
      includedScopeItemCount || workAreaLists.included.length,
    needsDetailCount: needsDetailScopeCount,
    includedWorkAreaCount: workAreaLists.included.length,
    qualityTitle: qualityLevel
      ? QUALITY_OPTIONS.find((o) => o.value === qualityLevel)?.title ?? null
      : null,
    briefSubmitted,
    projectConditionsRemaining: preferProjectConditionsAsk
      ? projectConditionsSnapshot?.remainingCount ?? null
      : null,
    projectConditionsComplete: preferProjectConditionsAsk
      ? Boolean(projectConditionsSnapshot?.complete)
      : undefined,
  });

  const hasEstimate = Boolean(estimate);
  const assistantMode = deriveAssistantUiMode({
    hasEstimate,
    editJobOpen,
  });

  const completedEstimateAttentionItems: readonly QuickEstimateAttentionItem[] =
    hasEstimate
      ? applyLevel1AttentionPresentation(
          buildQuickEstimateAttentionItems({
            pendingProposalCount: pendingNoteProposal ? 1 : 0,
            unresolvedScopeImpactLabels:
              unresolvedScopeImpactCount > 0
                ? Array.from(
                    { length: unresolvedScopeImpactCount },
                    () => "Suggested scope change"
                  )
                : [],
            scopeReviewAttention: scopeReviewAttentionItems,
            projectConditionsAttention,
            missingByWorkArea: initialState.scopeReview.workAreas.flatMap(
              (wa) =>
                wa.missingItems.map((label) => ({
                  workAreaName: wa.workAreaName,
                  workAreaId: wa.workAreaId,
                  label,
                  reviewTarget: "estimateReview" as const,
                  actionable: false,
                }))
            ),
            clarificationLabels: pendingScopeDetailTitles,
          })
        )
      : [];

  const estimateReviewActionable =
    Boolean(estimate?.isStale) ||
    (!estimateReady && questionsSubmitted) ||
    completedEstimateAttentionItems.length > 0 ||
    initialState.scopeReview.workAreas.some(
      (workArea) => workArea.missingItems.length > 0
    );
  const projectConditionsNeedsAsk =
    preferProjectConditionsAsk && !projectConditionsSnapshot?.complete;
  const showCompletedDetailCards = assistantMode === "planning" && !CLARIFY_IS_PRIMARY;
  const qualityTitleLabel =
    qualityLevel
      ? QUALITY_OPTIONS.find((o) => o.value === qualityLevel)?.title ?? null
      : null;
  const setupSummaryLine = [
    formatWorkAreaSummaryLine(workAreaLists.included),
    formatWorkAreaSummaryDetail(workAreaLists.included),
    qualityTitleLabel,
    liveConstraints.length > 0
      ? `${liveConstraints.length} condition${liveConstraints.length === 1 ? "" : "s"}`
      : preferProjectConditionsAsk
        ? projectConditionsSnapshot?.complete
          ? "Conditions complete"
          : `${projectConditionsSnapshot?.remainingCount ?? 0} conditions remaining`
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const setupChips = [
    workAreaLists.included.length > 1
      ? `${workAreaLists.included.length} work areas`
      : null,
  ].filter((v): v is string => Boolean(v));

  const showEstimateReviewFullCard =
    assistantMode === "planning" &&
    !CLARIFY_IS_PRIMARY &&
    questionsSubmitted &&
    (estimateReviewActionable || estimateReviewDetailsOpen);

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
      <AssistantProgress
        currentStage={stage}
        preferProjectConditionsLabel={preferProjectConditionsAsk}
        deemphasised={assistantMode !== "planning"}
      />

      {actionError ? (
        <p className="mt-3 text-sm text-destructive lg:mt-4" role="alert">
          {actionError}
        </p>
      ) : null}

      <div
        className={cn(
          "mt-3 grid min-w-0 gap-5 lg:mt-4 lg:items-start",
          assistantMode === "planning" &&
            "lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[220px_minmax(0,1fr)_340px]",
          assistantMode === "estimate_ready" &&
            "lg:grid-cols-[minmax(0,1fr)_340px]",
          assistantMode === "edit_job" && "grid-cols-1"
        )}
        data-assistant-main-grid
        data-assistant-mode={assistantMode}
        data-assistant-modes-primary={ASSISTANT_MODES_PRIMARY ? "true" : "false"}
      >
        {assistantMode === "planning" ? (
          <aside className="hidden xl:block">
            <div className="sticky top-6">
              <StepperNav
                currentStage={stage}
                needsAttention={stepperAttention}
                stepSummaries={stepperSummaries}
                preferProjectConditionsLabel={preferProjectConditionsAsk}
              />
            </div>
          </aside>
        ) : null}

        <div className="order-2 min-w-0 space-y-3 lg:order-none lg:space-y-2.5">
          {assistantMode === "estimate_ready" && estimate ? (
            <EstimateReadySurface
              projectId={project.id}
              isStale={Boolean(estimate.isStale)}
              isRegenerating={isRegenerating}
              pricingCtaEnabled={!pricingSummary}
            >
              <EstimateReadyCard
                workAreaSummaryLine={formatWorkAreaSummaryLine(
                  workAreaLists.included
                )}
                workAreaSummaryDetail={formatWorkAreaSummaryDetail(
                  workAreaLists.included
                )}
                recommendedSell={estimate.recommendedSell}
                isStale={Boolean(estimate.isStale)}
                isRegenerating={isRegenerating}
                confidenceBand={
                  deriveQuickEstimateConfidencePresentation({
                    confidencePercent: estimate.confidence,
                    assumptionSeverity:
                      estimate.assumptionMetadata?.assumptionSeverity,
                    missingInfoCount: estimate.missingInfo.length,
                    attentionCount: completedEstimateAttentionItems.length,
                  }).band
                }
                assumptions={rankQuickEstimateAssumptions(
                  estimate.assumptions,
                  MAX_QUICK_ESTIMATE_TOP_ASSUMPTIONS
                )}
                attentionItems={completedEstimateAttentionItems}
                onReviewEstimate={() => setBreakdownOpen(true)}
                onEditJob={() => openEditJob("job_plan")}
                onUpdateEstimate={
                  estimate.isStale ? handleRegenerateEstimate : undefined
                }
                onReviewAttention={handleReviewAttention}
              />
              <CompletedSetupDisclosure
                summaryLine={setupSummaryLine}
                chips={setupChips}
                expanded={jobDetailsOpen}
                onExpandedChange={setJobDetailsOpen}
              />
            </EstimateReadySurface>
          ) : null}

          {assistantMode === "edit_job" ? (
            <EditJobSurface
              focusSection={editJobSection}
              isStale={Boolean(estimate?.isStale)}
              isRegenerating={isRegenerating}
              onDone={closeEditJob}
              onUpdateEstimate={
                estimate?.isStale ? handleRegenerateEstimate : undefined
              }
              jobPlan={
                <JobPlanPanel
                  plan={jobPlan}
                  workAreas={displayWorkAreas}
                  facts={jobPlanFacts}
                  submitted={workAreasConfirmed}
                  workspaceEditing
                  isSaving={pendingAction === "work_areas"}
                  isAddingWorkArea={isAddingWorkArea}
                  isRemovingWorkArea={isExcludingWorkArea}
                  addWorkAreaError={addWorkAreaError}
                  onAddWorkArea={handleAddWorkArea}
                  onRemoveWorkArea={handleExcludeWorkArea}
                  onToggleScope={handleJobPlanToggleScope}
                  onSpecFact={handleJobPlanSpecFact}
                />
              }
              projectConditions={
                preferProjectConditionsAsk && projectConditionsSnapshot ? (
                  <div ref={projectConditionsCardRef}>
                    <ProjectConditionsBlock
                      projectId={project.id}
                      candidates={projectConditionsSnapshot.candidates ?? []}
                      remainingCount={
                        projectConditionsSnapshot.remainingCount ?? 0
                      }
                      complete={Boolean(projectConditionsSnapshot.complete)}
                      knownConstraints={liveConstraints}
                      onConstraintSave={handleConstraintSave}
                      savingConstraintKey={savingConstraintKey}
                      constraintError={constraintError}
                      readiness={
                        projectConditionsSnapshot.readiness ?? {
                          state: "READY",
                          reasons: [],
                          blockingCandidateKeys: [],
                          assumptionCandidateKeys: [],
                          openP0Keys: [],
                          openP1Keys: [],
                          canGenerateQuickEstimate: true,
                          softBlockQuickEstimate: false,
                        }
                      }
                      focusQuestionKey={projectConditionsFocusKey}
                      onSnapshotUpdate={(next) => {
                        setLiveConstraints(next.constraints);
                        setProjectConditionsFocusKey(null);
                      }}
                    />
                  </div>
                ) : (
                  <div ref={constraintsCardRef}>
                    <ConstraintBlock
                      questions={initialState.constraintQuestions}
                      answers={
                        constraintsSubmitted
                          ? submittedConstraintAnswers
                          : constraintAnswers
                      }
                      submitted={constraintsSubmitted}
                      editable
                      presentation="questionnaire"
                      suppressFallbackQuestionnaire={false}
                      isSaving={pendingAction === "constraints"}
                      savingConstraintKey={savingConstraintKey}
                      constraintError={constraintError}
                      workAreaTypes={workAreas
                        .filter((wa) => wa.status !== "excluded")
                        .map((wa) => wa.type)}
                      onAnswerChange={
                        constraintsSubmitted
                          ? undefined
                          : handleConstraintAnswer
                      }
                      onSubmit={
                        constraintsSubmitted
                          ? undefined
                          : handleConstraintsSubmit
                      }
                      onConstraintSave={handleConstraintSave}
                    />
                  </div>
                )
              }
              details={
                <div ref={qualityCardRef}>
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
                  {qualitySubmitted && !isEditingQuality ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 h-11 min-h-11"
                      onClick={handleQualityEdit}
                    >
                      Change spec
                    </Button>
                  ) : null}
                </div>
              }
              advanced={
                <div className="space-y-4" ref={questionsCardRef}>
                  {pendingNoteProposal ? (
                    <NoteProposalReviewPanel
                      projectId={project.id}
                      proposal={pendingNoteProposal}
                    />
                  ) : null}
                  <ScopeSummaryBlock
                    projectId={project.id}
                    scopeReview={initialState.scopeReview}
                    workAreas={initialState.workAreas}
                    editable
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
                    onFactSave={handleFactSave}
                    onSaveWorkAreaQuestions={handleSaveWorkAreaQuestions}
                    onAddWorkArea={handleAddWorkArea}
                    onExcludeWorkArea={handleExcludeWorkArea}
                  />
                  {questionBlock ? (
                    <QuestionBlock
                      questions={questionBlock.questions}
                      derivedFactDisplays={initialState.derivedFactDisplays}
                      answers={questionAnswers}
                      submitted
                      isSaving={false}
                      focusQuestionId={reviewFocusQuestionId}
                      focusQuestionKey={reviewFocusQuestionKey}
                    />
                  ) : null}
                </div>
              }
            />
          ) : null}

          {assistantMode === "planning" ? (
          <PlanningSurface>
          {/* 1. Project Capture */}
          {(captureIsCurrent || !briefSubmitted || briefSubmitted) && (
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
          )}

          {/* 2. Job Plan — primary Work Area + user-facing scope confirmation */}
          {briefSubmitted ? (
            <CollapsibleStageCard
              title="Job Plan"
              subtitle="Quotr proposed this from your brief — scan, correct, continue"
              statusLabel={
                workAreasIsCurrent
                  ? "Current"
                  : workAreasConfirmed
                    ? `${workAreaLists.included.length} included`
                    : jobPlan.confirmCount > 0
                      ? `${jobPlan.confirmCount} to confirm`
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
              actionLabel={workAreasConfirmed ? "View plan" : undefined}
            >
              <JobPlanPanel
                plan={jobPlan}
                workAreas={displayWorkAreas}
                facts={jobPlanFacts}
                submitted={workAreasConfirmed}
                isSaving={pendingAction === "work_areas"}
                isAddingWorkArea={isAddingWorkArea}
                isRemovingWorkArea={isExcludingWorkArea}
                addWorkAreaError={addWorkAreaError}
                onContinue={
                  workAreasConfirmed
                    ? undefined
                    : () => handleWorkAreasConfirm(displayWorkAreas)
                }
                onAddWorkArea={
                  workAreasConfirmed ? undefined : handleAddWorkArea
                }
                onRemoveWorkArea={
                  workAreasConfirmed ? undefined : handleExcludeWorkArea
                }
                onToggleScope={
                  workAreasConfirmed ? undefined : handleJobPlanToggleScope
                }
                onSpecFact={
                  workAreasConfirmed ? undefined : handleJobPlanSpecFact
                }
              />
            </CollapsibleStageCard>
          ) : null}

          {CLARIFY_IS_PRIMARY && workAreasConfirmed ? (
            <CollapsibleStageCard
              title="Clarify"
              subtitle={
                clarifyView.enoughToEstimate
                  ? "Ready to estimate"
                  : "A few things could improve this estimate"
              }
              statusLabel={
                clarifyView.enoughToEstimate
                  ? "Ready"
                  : `${clarifyView.visibleCount} to clarify`
              }
              statusVariant="current"
              preferredExpanded={stagePrefersExpanded(
                "clarify",
                activeDisclosureStage
              )}
              canCollapse={false}
              isActive={activeDisclosureStage === "clarify"}
            >
              <ClarifyPanel
                view={clarifyView}
                isSaving={
                  pendingAction === "clarify" || pendingAction === "estimate"
                }
                onAnswerBoolean={handleClarifyBoolean}
                onAnswerValue={handleClarifyValue}
                onEstimateNow={handleGenerateEstimate}
              />
            </CollapsibleStageCard>
          ) : null}

          {/* 3. Specification — legacy primary flow / post-estimate finish edit */}
          {(!CLARIFY_IS_PRIMARY || isEditingQuality) &&
          !CLARIFY_IS_PRIMARY &&
          workAreasConfirmed ? (
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

          {/* 4. Scope Details — legacy primary flow only */}
          {!CLARIFY_IS_PRIMARY && questionsIsCurrent && questionBlock ? (
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
              <div className="space-y-4">
                <AssistantUnderstandingSummaryCard
                  summaries={understandingSummaries}
                />
                <QuestionBlock
                  questions={questionBlock.questions}
                  derivedFactDisplays={initialState.derivedFactDisplays}
                  answers={questionAnswers}
                  isSaving={pendingAction === "questions"}
                  focusQuestionId={reviewFocusQuestionId}
                  focusQuestionKey={reviewFocusQuestionKey}
                  onAnswerChange={handleQuestionAnswer}
                  onSubmit={handleQuestionsSubmit}
                />
              </div>
            </CollapsibleStageCard>
          ) : null}

          {/* 4b. Completed Scope Details summary — legacy primary flow only */}
          {!CLARIFY_IS_PRIMARY &&
          questionsSubmitted &&
          questionBlock &&
          showCompletedDetailCards ? (
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

          {/* 6. Estimate Review — full card only when needed (R3) */}
          {showEstimateReviewFullCard ? (
            <CollapsibleStageCard
              title="Estimate Review"
              subtitle="What Quotr understood and will use for this estimate."
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
              preferredExpanded={
                estimateReviewDetailsOpen ||
                (estimateReviewActionable
                  ? stagePrefersExpanded(
                      "estimateReview",
                      activeDisclosureStage
                    )
                  : false)
              }
              canCollapse={questionsSubmitted && !Boolean(estimate?.isStale)}
              forceExpanded={Boolean(estimate?.isStale)}
              onExpandedChange={(expanded) => {
                if (!expanded) {
                  setEstimateReviewDetailsOpen(false);
                } else {
                  setEstimateReviewDetailsOpen(true);
                }
              }}
              isActive={
                estimateReviewActionable &&
                activeDisclosureStage === "estimateReview"
              }
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

          {/* 7. Project Conditions — legacy primary flow only */}
          {!CLARIFY_IS_PRIMARY &&
          questionsSubmitted &&
          preferProjectConditionsAsk &&
          Boolean(projectConditionsSnapshot?.shouldShowStage) ? (
            <CollapsibleStageCard
              title="Project Conditions"
              subtitle={
                projectConditionsSnapshot?.complete
                  ? "Site and project conditions for this estimate"
                  : "Known conditions and a few remaining questions"
              }
              statusLabel={
                projectConditionsSnapshot?.complete
                  ? "Complete"
                  : `${projectConditionsSnapshot?.remainingCount ?? 0} remaining`
              }
              statusVariant={
                projectConditionsSnapshot?.complete ? "complete" : "current"
              }
              preferredExpanded={projectConditionsNeedsAsk}
              forceExpanded={forceExpandProjectConditions}
              canCollapse
              isActive={projectConditionsNeedsAsk}
              cardRef={projectConditionsCardRef}
              summaryContent={
                <p className="text-sm text-muted-foreground">
                  {projectConditionsSnapshot?.complete
                    ? liveConstraints.length > 0
                      ? `✓ Complete · ${liveConstraints.length} condition${liveConstraints.length === 1 ? "" : "s"}`
                      : "✓ Complete"
                    : `${projectConditionsSnapshot?.remainingCount ?? 0} questions remaining`}
                </p>
              }
              actionLabel={
                projectConditionsSnapshot?.complete ? "View" : undefined
              }
            >
              <ProjectConditionsBlock
                projectId={project.id}
                candidates={projectConditionsSnapshot?.candidates ?? []}
                remainingCount={projectConditionsSnapshot?.remainingCount ?? 0}
                complete={Boolean(projectConditionsSnapshot?.complete)}
                knownConstraints={liveConstraints}
                onConstraintSave={handleConstraintSave}
                savingConstraintKey={savingConstraintKey}
                constraintError={constraintError}
                readiness={
                  projectConditionsSnapshot?.readiness ?? {
                    state: "READY",
                    reasons: [],
                    blockingCandidateKeys: [],
                    assumptionCandidateKeys: [],
                    openP0Keys: [],
                    openP1Keys: [],
                    canGenerateQuickEstimate: true,
                    softBlockQuickEstimate: false,
                  }
                }
                focusQuestionKey={projectConditionsFocusKey}
                onSnapshotUpdate={(next) => {
                  setLiveConstraints(next.constraints);
                  setProjectConditionsFocusKey(null);
                }}
              />
            </CollapsibleStageCard>
          ) : null}

          {/* 8. Site Constraints — legacy path only when Project Conditions unavailable */}
          {!CLARIFY_IS_PRIMARY &&
          questionsSubmitted &&
          !preferProjectConditionsAsk &&
          (constraintsIsCurrent || showCompletedDetailCards) ? (
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
                presentation="questionnaire"
                suppressFallbackQuestionnaire={false}
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
          </PlanningSurface>
          ) : null}
        </div>

        {assistantMode !== "edit_job" ? (
        <div
          ref={estimatePanelAnchorRef}
          className={cn(
            "min-w-0 lg:self-start",
            assistantMode === "planning" && "order-1 lg:order-none",
            assistantMode === "estimate_ready" && "hidden lg:block"
          )}
          data-quick-estimate-anchor
        >
          <EstimatePanel
            projectId={initialState.project.id}
            estimate={estimate}
            qualityLevel={qualitySubmitted ? qualityLevel : null}
            pricingSummary={pricingSummary}
            quoteSummary={quoteSummary}
            isGenerating={isGenerating}
            isRegenerating={isRegenerating}
            isSavingMargin={isSavingMargin}
            marginSaveLabel={marginSaveLabel}
            defaultMarginPercent={initialState.defaultMarginPercent}
            panelScopeSummaries={initialState.panelScopeSummaries}
            scopeReview={initialState.scopeReview}
            questionsSubmitted={questionsSubmitted}
            constraintsSubmitted={
              constraintsSubmitted &&
              (!preferProjectConditionsAsk || projectConditionsReadyToGenerate)
            }
            canGenerateEstimate={
              CLARIFY_IS_PRIMARY && !estimateReady ? false : canGenerateEstimate
            }
            pendingProposalCount={pendingNoteProposal ? 1 : 0}
            unresolvedScopeImpactCount={unresolvedScopeImpactCount}
            constraintCount={liveConstraints.length}
            isActiveStage={
              estimateReady ||
              (activeDisclosureStage === null && canGenerateEstimate)
            }
            quickEstimatePresentation={
              qualitySubmitted ? quickEstimatePresentation : null
            }
            understandingSummaries={understandingSummaries}
            pendingScopeDetailTitles={pendingScopeDetailTitles}
            scopeReviewAttention={scopeReviewAttentionItems}
            projectInformationLabel={projectInformationLabel}
            projectConditionsAttention={projectConditionsAttention}
            compactCommercialSidebar={assistantMode === "estimate_ready"}
            onViewBreakdown={() => setBreakdownOpen(true)}
            onGenerate={handleGenerateEstimate}
            onRegenerate={handleRegenerateEstimate}
            onMarginSave={
              assistantMode === "estimate_ready" && !estimate?.isStale
                ? handleMarginSave
                : undefined
            }
            onEditQuality={undefined}
            onReviewAttention={handleReviewAttention}
          />
        </div>
        ) : null}
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
