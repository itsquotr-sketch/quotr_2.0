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
import { BuilderReviewSurface } from "@/components/assistant/builder-review/BuilderReviewSurface";
import { CommercialOverviewMetrics } from "@/components/assistant/CommercialOverviewMetrics";
import { EstimateReadyCard } from "@/components/assistant/EstimateReadyCard";
import { EstimateBreakdownModal } from "@/components/assistant/EstimateBreakdownModal";
import { EstimatePanel } from "@/components/assistant/EstimatePanel";
import { MarginEditControl } from "@/components/assistant/MarginEditControl";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";
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
import { RefineEstimatePanel } from "@/components/assistant/clarify/ClarifyReadiness";
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
import type {
  AssistantActionState,
  AssistantMutationResult,
  EstimateGenerationResult,
} from "@/lib/assistant/types";
import {
  shouldApplyEstimateGeneration,
  type AppliedEstimateGeneration,
} from "@/lib/assistant/estimate-generation-apply";
import {
  shouldApplyAssistantMutation,
  type AppliedAssistantMutation,
} from "@/lib/assistant/assistant-mutation-result";
import { useEstimateGenerationProjection } from "@/components/projects/estimate-generation-projection";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  addWorkAreaToProject,
  excludeWorkAreaFromProject,
} from "@/lib/assistant/work-area-actions";
import {
  LAST_ACTIVE_WORK_AREA_MESSAGE,
  canRemoveCanonicalWorkArea,
  projectActiveCanonicalWorkAreas,
} from "@/lib/assistant/work-area-active";
import { composeJobPlan } from "@/lib/assistant/job-plan/compose";
import { applyJobPlanScopeWrite } from "@/lib/assistant/job-plan/apply-write";
import { writeJobPlanScopeDecision } from "@/lib/assistant/job-plan/actions";
import { overlayFact } from "@/lib/assistant/job-plan/facts";
import { JOB_PLAN_IS_PRIMARY } from "@/lib/assistant/job-plan/flags";
import { ANALYSE_JOB_TIMEOUT_USER_MESSAGE } from "@/lib/ai/analyse-job-contract";
import {
  jobPlanFactsFromAssistantState,
  jobPlanWorkAreasFromUi,
} from "@/lib/assistant/job-plan/from-assistant-state";
import type { JobPlanScopeItem } from "@/lib/assistant/job-plan/types";
import { composeClarifyView } from "@/lib/assistant/clarify/compose";
import { composeBuilderReview } from "@/lib/assistant/builder-review";
import { composeEstimateReadiness } from "@/lib/assistant/readiness/compose";
import { evaluatePackageQuickEstimateReadiness } from "@/lib/assistant/readiness/package-quick-estimate";
import type { SaveStatus } from "@/lib/assistant/presentation/save-status";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { composeRefineView } from "@/lib/assistant/refine/compose";
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
  buildQuickEstimateStatusPresentation,
  type QuickEstimateAttentionItem,
} from "@/lib/assistant/presentation/quick-estimate-view-model";
import { projectCommercialOverviewBreakdown } from "@/lib/assistant/presentation/commercial-overview-projection";
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
import type {
  EstimateEditTarget,
  JobPlanEditFocus,
} from "@/lib/assistant/mode/estimate-edit-target";
import { jobPlanEditFocusFromTarget } from "@/lib/assistant/mode/estimate-edit-target";

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
  const generationRequestSeqRef = useRef(0);
  const appliedGenerationRef = useRef<AppliedEstimateGeneration | null>(null);
  const factMutationSeqRef = useRef(0);
  const appliedMutationRef = useRef<AppliedAssistantMutation | null>(null);
  const factMutationGateRef = useRef(Promise.resolve());
  const overlaySeqByFactRef = useRef(new Map<string, number>());
  const estimateNavProjection = useEstimateGenerationProjection();
  const { project } = initialState;

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [briefText, setBriefText] = useState(project.briefText?.trim() ?? "");

  const [addedWorkAreas, setAddedWorkAreas] = useState<WorkArea[]>([]);
  const [excludedWorkAreaIds, setExcludedWorkAreaIds] = useState<
    readonly string[]
  >([]);
  const [assistantMutationProjection, setAssistantMutationProjection] =
    useState<AssistantMutationResult | undefined>(undefined);

  const displayedAssistant = useMemo(() => {
    const mutation = assistantMutationProjection;
    if (!mutation || mutation.projectId !== initialState.project.id) {
      return initialState;
    }
    return {
      ...initialState,
      project: {
        ...initialState.project,
        stage: mutation.stage,
      },
      workAreas: mutation.workAreas,
      questionBlock: mutation.questionBlock,
      additionalQuestionBlocks: mutation.additionalQuestionBlocks,
      constraintQuestions: mutation.constraintQuestions,
      submittedConstraints: mutation.submittedConstraints,
      interviewFacts: mutation.interviewFacts,
      scopeSummary: mutation.scopeSummary,
      scopeReview: mutation.scopeReview,
      panelScopeSummaries: mutation.panelScopeSummaries,
      derivedFactDisplays: mutation.derivedFactDisplays,
    };
  }, [assistantMutationProjection, initialState]);

  const displayWorkAreas = useMemo(() => {
    const reconciledExcluded = excludedWorkAreaIds.filter((id) => {
      const row = displayedAssistant.workAreas.find((wa) => wa.id === id);
      return row != null && row.status !== "excluded";
    });
    const reconciledAdded = addedWorkAreas.filter((wa) => {
      const row = displayedAssistant.workAreas.find((server) => server.id === wa.id);
      return !(row && row.status !== "excluded");
    });
    return projectActiveCanonicalWorkAreas(displayedAssistant.workAreas, {
      optimisticExcludedIds: reconciledExcluded,
      pendingAdded: reconciledAdded,
    });
  }, [addedWorkAreas, excludedWorkAreaIds, displayedAssistant.workAreas]);

  const [qualityLevel, setQualityLevel] = useState<QualityLevel | null>(
    project.qualityLevel
  );

  const questionBlock = displayedAssistant.questionBlock;
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswers>(() =>
    questionBlock
      ? initAnswersFromQuestions(questionBlock.questions)
      : {}
  );

  const [constraintAnswers, setConstraintAnswers] = useState<QuestionAnswers>(
    () => initAnswersFromQuestions(displayedAssistant.constraintQuestions)
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
  const [jobPlanEditFocus, setJobPlanEditFocus] = useState<JobPlanEditFocus | null>(
    null
  );
  // Estimate Basis: expanded by default on desktop (lg), collapsed on mobile.
  // Estimate Basis: expanded by default on desktop (lg ≥ 1024px), collapsed on mobile.
  const [jobDetailsOpen, setJobDetailsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
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
  const [builderReviewOpen, setBuilderReviewOpen] = useState(false);
  const [refineAfterEstimateOpen, setRefineAfterEstimateOpen] = useState(false);
  const [refineAfterEstimateFocusKey, setRefineAfterEstimateFocusKey] = useState<
    string | null
  >(null);
  const [jobPlanScopeSaveStatus, setJobPlanScopeSaveStatus] =
    useState<SaveStatus>("idle");
  const [jobPlanScopeSaveError, setJobPlanScopeSaveError] = useState<
    string | null
  >(null);
  // Local stale projection — set true immediately after a successful canonical write
  // so the UI reflects staleness without waiting for router.refresh().
  // Canonical estimate.isStale remains authority. Local state only bridges latency.
  // Never clear this from a fresh (isStale=false) server render — that older RSC
  // payload can arrive after a newer write. Clear only after successful regenerate.
  const [localEstimateStale, setLocalEstimateStale] = useState(false);
  const [generationProjection, setGenerationProjection] = useState<
    EstimateGenerationResult | undefined
  >(undefined);
  const stage =
    generationProjection?.stage ??
    assistantMutationProjection?.stage ??
    project.stage;
  const [commercialOverviewOpen, setCommercialOverviewOpen] = useState(false);
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

  const bridgeEstimateStaleAfterCanonicalWrite = useCallback(() => {
    if (!estimateReady) return;
    setLocalEstimateStale(true);
    estimateNavProjection?.markEstimateStale();
    recordPreviewPerf("canonical_write_stale_projection", 0, { ok: true });
  }, [estimateNavProjection, estimateReady]);

  const runSerializedFactMutation = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      const previous = factMutationGateRef.current;
      let release: () => void = () => {};
      factMutationGateRef.current = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await fn();
      } finally {
        release();
      }
    },
    []
  );

  const tagOverlayFactSeq = useCallback((row: EstimateFact, seq: number) => {
    overlaySeqByFactRef.current.set(`${row.work_area_id ?? ""}:${row.key}`, seq);
  }, []);

  const settleCanonicalMutation = useCallback(
    (result: AssistantActionState, requestSeq: number): boolean => {
      if (result.recoveryRefresh) return false;
      if (!result.assistantMutation) {
        return Boolean(result.success);
      }
      const incoming: AppliedAssistantMutation = {
        projectId: result.assistantMutation.projectId,
        requestSeq,
      };
      if (
        !shouldApplyAssistantMutation({
          currentProjectId: project.id,
          applied: appliedMutationRef.current,
          incoming,
        })
      ) {
        return true;
      }
      appliedMutationRef.current = incoming;
      setAssistantMutationProjection(result.assistantMutation);
      setLiveConstraints(result.assistantMutation.submittedConstraints);
      setJobPlanFactOverlay((prev) =>
        prev.filter((row) => {
          const key = `${row.work_area_id ?? ""}:${row.key}`;
          const seq = overlaySeqByFactRef.current.get(key);
          return seq != null && seq > requestSeq;
        })
      );
      if (result.assistantMutation.estimateStale) {
        setLocalEstimateStale(true);
        estimateNavProjection?.markEstimateStale();
      }
      return true;
    },
    [estimateNavProjection, project.id]
  );

  const applyProjectConditionsSnapshot = useCallback(
    (next: {
      constraints: ConstraintRow[];
      assistantMutation?: AssistantMutationResult;
      recoveryRefresh?: boolean;
    }) => {
      setLiveConstraints(next.constraints);
      setProjectConditionsFocusKey(null);
      if (next.assistantMutation || next.recoveryRefresh) {
        settleCanonicalMutation(
          {
            success: true,
            assistantMutation: next.assistantMutation,
            recoveryRefresh: next.recoveryRefresh,
          },
          ++factMutationSeqRef.current
        );
      }
    },
    [settleCanonicalMutation]
  );

  const projectConditionsSnapshot = useMemo(() => {
    try {
      const scopeQuestionCount =
        questionsSubmitted && questionBlock
          ? questionBlock.questions.length
          : 0;
      return buildLiveProjectConditionsSnapshot({
        projectId: project.id,
        qualityLevel: project.qualityLevel,
        workAreas: displayWorkAreas,
        facts: displayedAssistant.interviewFacts,
        constraints: liveConstraints,
        scopeQuestionCount,
      });
    } catch {
      return null;
    }
  }, [
    project.id,
    project.qualityLevel,
    displayWorkAreas,
    displayedAssistant.interviewFacts,
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
    if (
      liveConstraints.length === 0 &&
      displayedAssistant.submittedConstraints.length === 0
    ) {
      return constraintAnswers;
    }
    const rows =
      liveConstraints.length > 0
        ? liveConstraints
        : displayedAssistant.submittedConstraints;
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return Object.fromEntries(
      displayedAssistant.constraintQuestions.map((q) => [
        q.id,
        byKey.get(q.key) ?? q.value ?? null,
      ])
    );
  }, [
    constraintAnswers,
    displayedAssistant.constraintQuestions,
    displayedAssistant.submittedConstraints,
    liveConstraints,
  ]);

  const runAction = useCallback(
    async (action: PendingAction, fn: () => Promise<AssistantActionState>) => {
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

        const isEstimateMutation =
          action === "estimate" || action === "regenerate";
        const generation = result.estimateGeneration;
        let shouldRefresh = true;

        if (isEstimateMutation && !result.recoveryRefresh && generation) {
          const incoming: AppliedEstimateGeneration = {
            projectId: generation.projectId,
            generationId: generation.generationId,
            requestSeq: generationRequestSeqRef.current,
          };
          if (
            shouldApplyEstimateGeneration({
              currentProjectId: project.id,
              applied: appliedGenerationRef.current,
              incoming,
            })
          ) {
            appliedGenerationRef.current = incoming;
            setGenerationProjection(generation);
            setLocalEstimateStale(false);
            estimateNavProjection?.applyEstimateGeneration(generation);
            if (action === "regenerate") {
              setEditJobOpen(false);
              setEditJobSection(null);
              setJobPlanEditFocus(null);
            }
            shouldRefresh = false;
          }
        } else if (
          !isEstimateMutation &&
          !result.recoveryRefresh &&
          result.assistantMutation
        ) {
          const incomingSeq = ++factMutationSeqRef.current;
          if (settleCanonicalMutation(result, incomingSeq)) {
            shouldRefresh = false;
          }
        }

        if (shouldRefresh) {
          router.refresh();
        }

        setPendingAction(null);
        if (action === "estimate") {
          setIsGenerating(false);
        }
        if (action === "regenerate") {
          setIsRegenerating(false);
        }
      } catch {
        setActionError(
          action === "brief"
            ? ANALYSE_JOB_TIMEOUT_USER_MESSAGE
            : "Something went wrong. Please try again."
        );
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
    [estimateNavProjection, project.id, router, settleCanonicalMutation]
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

  const openEditJob = useCallback(
    (
      section: EditJobSection | null = null,
      target?: EstimateEditTarget | null
    ) => {
      setEditJobOpen(true);
      setEditJobSection(section);
      setJobPlanEditFocus(jobPlanEditFocusFromTarget(target ?? null));
    },
    []
  );

  const closeEditJob = useCallback(() => {
    setQualityLevel(savedQualityLevel);
    setIsEditingQuality(false);
    setEditJobOpen(false);
    setEditJobSection(null);
    setJobPlanEditFocus(null);
    setForceExpandQuestions(false);
    setForceExpandProjectConditions(false);
    setReviewFocusQuestionId(null);
    setReviewFocusQuestionKey(null);
    setProjectConditionsFocusKey(null);
  }, [savedQualityLevel]);

  const openRefineAfterEstimate = useCallback(
    (focusKey?: string | null) => {
      setRefineAfterEstimateFocusKey(focusKey ?? null);
      setRefineAfterEstimateOpen(true);
    },
    []
  );

  const closeRefineAfterEstimate = useCallback(() => {
    setRefineAfterEstimateOpen(false);
    setRefineAfterEstimateFocusKey(null);
  }, []);

  useEffect(() => {
    if (!refineAfterEstimateOpen) return;
    if (!refineAfterEstimateFocusKey) return;

    window.requestAnimationFrame(() => {
      const selector = `[data-refine-field="${refineAfterEstimateFocusKey}"] input, [data-refine-field="${refineAfterEstimateFocusKey}"] select, [data-refine-field="${refineAfterEstimateFocusKey}"] button`;
      const el = document.querySelector<HTMLElement>(selector);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus?.({ preventScroll: true });
    });
  }, [refineAfterEstimateOpen, refineAfterEstimateFocusKey]);


  // localEstimateStale is a latency bridge only. It is never synced from a
  // fresh server estimate (that would let an older router.refresh() overwrite
  // a newer local stale projection). Successful regenerate clears it.

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
        setBuilderReviewOpen(true);
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
    const constraints = displayedAssistant.constraintQuestions.map((q) => ({
      key: q.key,
      label: q.label,
      value: constraintAnswers[q.id] as string | number | boolean,
    }));

    void runAction("constraints", () =>
      saveConstraints(project.id, constraints)
    );
  }, [
    constraintAnswers,
    displayedAssistant.constraintQuestions,
    project.id,
    runAction,
  ]);

  const handleGenerateEstimate = useCallback(() => {
    if (isGenerating || pendingAction != null || actionLockRef.current) {
      return;
    }
    generationRequestSeqRef.current += 1;
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
    if (
      isRegenerating ||
      pendingAction != null ||
      actionLockRef.current
    ) {
      return;
    }
    if (
      preferProjectConditionsAsk &&
      !projectConditionsSnapshot?.readiness.canGenerateQuickEstimate
    ) {
      const packageReadiness = evaluatePackageQuickEstimateReadiness({
        workAreas: displayWorkAreas.map((wa) => ({
          id: wa.id,
          type: wa.type,
          status: wa.status,
        })),
        facts: (() => {
          let facts = jobPlanFactsFromAssistantState(displayedAssistant);
          for (const row of jobPlanFactOverlay) {
            facts = overlayFact(facts, row);
          }
          return facts;
        })(),
        unresolvedRequiredProjectConditionKeys:
          projectConditionsSnapshot.unresolvedRequiredKeys ?? [],
      });
      if (!(CLARIFY_IS_PRIMARY && packageReadiness.ready)) {
        setActionError(
          packageReadiness.builderCopy ??
            "Complete the remaining project information before generating the estimate."
        );
        return;
      }
    }
    setIsRegenerating(true);
    recordPreviewPerf("estimate_generate_ack", 0);
    const endPerf = startPreviewPerf("estimate_generate_complete");
    generationRequestSeqRef.current += 1;
    void runAction("regenerate", async () => {
      try {
        return await regenerateStaticEstimate(project.id);
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
    projectConditionsSnapshot,
    displayWorkAreas,
    displayedAssistant,
    jobPlanFactOverlay,
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
      const requestSeq = ++factMutationSeqRef.current;
      tagOverlayFactSeq(
        {
          key: input.key,
          work_area_id: input.workAreaId,
          value: input.value,
          source: "user",
        },
        requestSeq
      );

      const result = await runSerializedFactMutation(() =>
        updateProjectFact({
          projectId: project.id,
          workAreaId: input.workAreaId,
          key: input.key,
          label: input.label,
          value: input.value,
          unit: input.unit,
          valueType: input.inputType,
        })
      );

      if (result.error) {
        setFactError(result.error);
        setSavingFactKey(null);
        endSavePerf();
        return;
      }

      setSavingFactKey(null);
      endSavePerf();
      if (!settleCanonicalMutation(result, requestSeq)) {
        bridgeEstimateStaleAfterCanonicalWrite();
        startTransition(() => {
          router.refresh();
        });
      }
    },
    [
      bridgeEstimateStaleAfterCanonicalWrite,
      project.id,
      router,
      runSerializedFactMutation,
      settleCanonicalMutation,
      tagOverlayFactSeq,
    ]
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
      const requestSeq = ++factMutationSeqRef.current;

      const result = await runSerializedFactMutation(() =>
        updateProjectConstraint({
          projectId: project.id,
          key: input.key,
          label: input.label,
          value: input.value,
          inputType: input.inputType,
        })
      );

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
      if (!settleCanonicalMutation(result, requestSeq)) {
        bridgeEstimateStaleAfterCanonicalWrite();
        startTransition(() => {
          router.refresh();
        });
      }
    },
    [
      bridgeEstimateStaleAfterCanonicalWrite,
      project.id,
      router,
      runSerializedFactMutation,
      settleCanonicalMutation,
    ]
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
        return { success: false as const, error: result.error };
      }

      if (result.workArea) {
        setExcludedWorkAreaIds((prev) =>
          prev.filter((id) => id !== result.workArea!.id)
        );
        setAddedWorkAreas((prev) => {
          if (prev.some((wa) => wa.id === result.workArea!.id)) return prev;
          const serverActive = initialState.workAreas.some(
            (wa) =>
              wa.id === result.workArea!.id && wa.status !== "excluded"
          );
          if (serverActive) return prev;
          return [...prev, result.workArea!];
        });
      }

      setIsAddingWorkArea(false);
      bridgeEstimateStaleAfterCanonicalWrite();
      startTransition(() => {
        router.refresh();
      });
      return { success: true as const };
    },
    [bridgeEstimateStaleAfterCanonicalWrite, initialState.workAreas, project.id, router]
  );

  const handleExcludeWorkArea = useCallback(
    async (workAreaId: string) => {
      setIsExcludingWorkArea(true);
      setActionError(null);
      const endRemovePerf = startPreviewPerf("work_area_remove_complete");

      if (!canRemoveCanonicalWorkArea(displayWorkAreas, workAreaId)) {
        const error = LAST_ACTIVE_WORK_AREA_MESSAGE;
        setActionError(error);
        setIsExcludingWorkArea(false);
        endRemovePerf();
        return { success: false as const, error };
      }

      // Optimistic: remove from projection immediately; rollback on server failure.
      setExcludedWorkAreaIds((prev) =>
        prev.includes(workAreaId) ? prev : [...prev, workAreaId]
      );

      const result = await excludeWorkAreaFromProject({
        projectId: project.id,
        workAreaId,
      });

      if (result.error) {
        setActionError(result.error);
        setExcludedWorkAreaIds((prev) =>
          prev.filter((id) => id !== workAreaId)
        );
        setIsExcludingWorkArea(false);
        endRemovePerf();
        return { success: false as const, error: result.error };
      }

      bridgeEstimateStaleAfterCanonicalWrite();
      startTransition(() => {
        router.refresh();
      });
      setIsExcludingWorkArea(false);
      endRemovePerf();
      return { success: true as const };
    },
    [bridgeEstimateStaleAfterCanonicalWrite, project.id, router, displayWorkAreas]
  );

  const handleJobPlanToggleScope = useCallback(
    async (
      item: JobPlanScopeItem,
      presentation: "INCLUDED" | "NOT_INCLUDED"
    ) => {
      if (!item.write) return;
      setJobPlanScopeSaveStatus("saving");
      setJobPlanScopeSaveError(null);
      const requestSeq = ++factMutationSeqRef.current;
      tagOverlayFactSeq(
        {
          key: item.write.factKey,
          work_area_id: item.workAreaId,
          value:
            presentation === "INCLUDED"
              ? item.write.includeValue
              : item.write.excludeValue,
          source: "user",
        },
        requestSeq
      );
      setJobPlanFactOverlay((prev) =>
        applyJobPlanScopeWrite({
          facts: prev,
          workAreaId: item.workAreaId,
          write: item.write!,
          presentation,
        }) as EstimateFact[]
      );
      const result = await runSerializedFactMutation(() =>
        writeJobPlanScopeDecision({
          projectId: project.id,
          workAreaId: item.workAreaId,
          write: item.write!,
          presentation,
        })
      );
      if (result.error) {
        setActionError(result.error);
        setJobPlanScopeSaveStatus("error");
        setJobPlanScopeSaveError(result.error);
        setJobPlanFactOverlay([]);
        router.refresh();
        return;
      }
      setJobPlanScopeSaveStatus("saved");
      window.setTimeout(() => {
        setJobPlanScopeSaveStatus("idle");
      }, 2000);
      if (!settleCanonicalMutation(result, requestSeq)) {
        bridgeEstimateStaleAfterCanonicalWrite();
        startTransition(() => {
          router.refresh();
        });
      }
    },
    [
      bridgeEstimateStaleAfterCanonicalWrite,
      project.id,
      router,
      runSerializedFactMutation,
      settleCanonicalMutation,
      tagOverlayFactSeq,
    ]
  );

  const handleClarifyBoolean = useCallback(
    async (
      candidate: ClarifyCandidate,
      presentation: "INCLUDED" | "NOT_INCLUDED"
    ) => {
      const requestSeq = ++factMutationSeqRef.current;
      let result: AssistantActionState = { success: true };
      if (candidate.write && candidate.workAreaId) {
        tagOverlayFactSeq(
          {
            key: candidate.write.factKey,
            work_area_id: candidate.workAreaId,
            value:
              presentation === "INCLUDED"
                ? candidate.write.includeValue
                : candidate.write.excludeValue,
            source: "user",
          },
          requestSeq
        );
        setJobPlanFactOverlay((prev) =>
          applyJobPlanScopeWrite({
            facts: prev,
            workAreaId: candidate.workAreaId!,
            write: candidate.write!,
            presentation,
          }) as EstimateFact[]
        );
        result = await runSerializedFactMutation(() =>
          answerClarifyFact({
            projectId: project.id,
            workAreaId: candidate.workAreaId!,
            write: candidate.write!,
            presentation,
          })
        );
        if (result.error) {
          setActionError(result.error);
          return;
        }
      } else if (candidate.factKey) {
        const value = presentation === "INCLUDED";
        tagOverlayFactSeq(
          {
            key: candidate.factKey,
            work_area_id: candidate.workAreaId,
            value,
            source: "user",
          },
          requestSeq
        );
        setJobPlanFactOverlay((prev) =>
          overlayFact(prev, {
            key: candidate.factKey!,
            work_area_id: candidate.workAreaId,
            value,
            source: "user",
          })
        );
        result = await runSerializedFactMutation(() =>
          answerClarifySelectFact({
            projectId: project.id,
            workAreaId: candidate.workAreaId,
            key: candidate.factKey!,
            label: candidate.label,
            value,
            valueType: "boolean",
          })
        );
        if (result.error) {
          setActionError(result.error);
          return;
        }
      }
      if (!settleCanonicalMutation(result, requestSeq)) {
        bridgeEstimateStaleAfterCanonicalWrite();
        startTransition(() => {
          router.refresh();
        });
      }
    },
    [
      bridgeEstimateStaleAfterCanonicalWrite,
      project.id,
      router,
      runSerializedFactMutation,
      settleCanonicalMutation,
      tagOverlayFactSeq,
    ]
  );

  const handleClarifyValue = useCallback(
    async (candidate: ClarifyCandidate, value: string | number | boolean) => {
      const requestSeq = ++factMutationSeqRef.current;
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
        const result = await runSerializedFactMutation(() =>
          answerClarifyConstraint({
            projectId: project.id,
            questionKey: candidate.questionKey!,
            value,
          })
        );
        if (result.error) {
          setActionError(result.error);
          return;
        }
        if (!settleCanonicalMutation(result, requestSeq)) {
          bridgeEstimateStaleAfterCanonicalWrite();
          startTransition(() => {
            router.refresh();
          });
        }
        return;
      }
      if (!candidate.factKey) return;
      tagOverlayFactSeq(
        {
          key: candidate.factKey,
          work_area_id: candidate.workAreaId,
          value,
          source: "user",
        },
        requestSeq
      );
      setJobPlanFactOverlay((prev) =>
        overlayFact(prev, {
          key: candidate.factKey!,
          work_area_id: candidate.workAreaId,
          value,
          source: "user",
        })
      );
      const result = await runSerializedFactMutation(() =>
        answerClarifySelectFact({
          projectId: project.id,
          workAreaId: candidate.workAreaId,
          key: candidate.factKey!,
          label: candidate.label,
          value,
          valueType:
            candidate.inputType === "number"
              ? "number"
              : candidate.inputType === "boolean"
                ? "boolean"
                : "select",
        })
      );
      if (result.error) {
        setActionError(result.error);
        return;
      }
      if (!settleCanonicalMutation(result, requestSeq)) {
        bridgeEstimateStaleAfterCanonicalWrite();
        startTransition(() => {
          router.refresh();
        });
      }
    },
    [
      bridgeEstimateStaleAfterCanonicalWrite,
      project.id,
      router,
      runSerializedFactMutation,
      settleCanonicalMutation,
      tagOverlayFactSeq,
    ]
  );

  const handleJobPlanSpecFact = useCallback(
    async (input: {
      workAreaId: string;
      key: string;
      label: string;
      value: string | number;
      valueType: "number" | "select";
    }) => {
      const requestSeq = ++factMutationSeqRef.current;
      tagOverlayFactSeq(
        {
          key: input.key,
          work_area_id: input.workAreaId,
          value: input.value,
          source: "user",
        },
        requestSeq
      );
      setJobPlanFactOverlay((prev) =>
        overlayFact(prev, {
          key: input.key,
          work_area_id: input.workAreaId,
          value: input.value,
          source: "user",
        })
      );
      const result = await runSerializedFactMutation(() =>
        updateProjectFact({
          projectId: project.id,
          workAreaId: input.workAreaId,
          key: input.key,
          label: input.label,
          value: input.value,
          valueType: input.valueType,
        })
      );
      if (result.error) {
        setActionError(result.error);
        return;
      }
      if (!settleCanonicalMutation(result, requestSeq)) {
        bridgeEstimateStaleAfterCanonicalWrite();
        startTransition(() => {
          router.refresh();
        });
      }
    },
    [
      bridgeEstimateStaleAfterCanonicalWrite,
      project.id,
      router,
      runSerializedFactMutation,
      settleCanonicalMutation,
      tagOverlayFactSeq,
    ]
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
      const requestSeq = ++factMutationSeqRef.current;
      let lastResult: AssistantActionState | null = null;

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

        const result = await runSerializedFactMutation(() =>
          saveQuestionBlockAnswers(project.id, blockId, payload)
        );
        lastResult = result;

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
      if (
        lastResult &&
        !settleCanonicalMutation(lastResult, requestSeq)
      ) {
        bridgeEstimateStaleAfterCanonicalWrite();
        startTransition(() => {
          router.refresh();
        });
      }
    },
    [
      bridgeEstimateStaleAfterCanonicalWrite,
      project.id,
      router,
      runSerializedFactMutation,
      settleCanonicalMutation,
    ]
  );

  const estimateBase = estimateReady
    ? (generationProjection?.estimate ?? initialState.estimate)
    : null;
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

  const jobPlanBaseFacts = useMemo(
    () => jobPlanFactsFromAssistantState(displayedAssistant),
    [displayedAssistant]
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

  const estimateReadiness = useMemo(
    () =>
      composeEstimateReadiness({
        clarify: clarifyView,
        jobPlan,
        qualityLevel: qualityLevel ?? project.qualityLevel,
        constraints: liveConstraints.map((row) => ({
          key: row.key,
          value: row.value,
        })),
      }),
    [clarifyView, jobPlan, liveConstraints, project.qualityLevel, qualityLevel]
  );

  const refineView = useMemo(
    () =>
      composeRefineView({
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
    ]
  );

  // Stage 3.1A-R1: do not remount Scope Review on answer value changes —
  // remounting wiped optimistic local answers and caused temporary reversion.

  const understandingSummaries = useMemo(
    () =>
      buildProjectUnderstandingSummaries({
        workAreas: displayWorkAreas.filter((wa) => wa.status === "confirmed"),
        facts: displayedAssistant.scopeReview.workAreas.flatMap((wa) =>
          wa.facts.map((fact) => ({
            key: fact.key,
            work_area_id: wa.workAreaId,
            value: fact.rawValue ?? fact.value,
          }))
        ),
      }),
    [displayWorkAreas, displayedAssistant.scopeReview.workAreas]
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

  // Derived stale: canonical server isStale OR local latency bridge.
  // Do not treat a fresh server render as clearing the bridge — that is the
  // router.refresh() race. Successful regenerate clears localEstimateStale.
  const displayEstimateStale =
    Boolean(estimate?.isStale) || localEstimateStale;
  const updatingEstimate = isRegenerating;

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
    estimateStale: displayEstimateStale,
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
    scopeReview: displayedAssistant.scopeReview,
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
        scopeReview: displayedAssistant.scopeReview,
      }),
    [scopeDiscoveryInitialResults, manualScopeItems, displayedAssistant.scopeReview]
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
    scopeReview: displayedAssistant.scopeReview,
    estimateReady,
    estimateStale: displayEstimateStale,
    constraintCount: liveConstraints.length,
    includedScopeItemCount:
      includedScopeItemCount || displayedAssistant.scopeReview.workAreas.length,
  });
  const constraintChips = buildConstraintChipLabels({
    questions: displayedAssistant.constraintQuestions,
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
  const projectConditionsAttention = useMemo(
    () =>
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
          : [],
    [
      estimateReady,
      preferProjectConditionsAsk,
      projectConditionsSnapshot,
    ]
  );
  const assumptionCountForReview =
    displayedAssistant.scopeReview.generalAssumptions.length +
    displayedAssistant.scopeReview.workAreas.reduce(
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
      displayedAssistant.scopeReview.workAreas.reduce(
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
    estimateStale: displayEstimateStale,
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

  const completedEstimateAttentionItems = useMemo((): readonly QuickEstimateAttentionItem[] => {
    if (!hasEstimate) return [];
    return applyLevel1AttentionPresentation(
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
        missingByWorkArea: displayedAssistant.scopeReview.workAreas.flatMap(
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
    );
  }, [
    hasEstimate,
    pendingNoteProposal,
    unresolvedScopeImpactCount,
    scopeReviewAttentionItems,
    projectConditionsAttention,
    displayedAssistant.scopeReview.workAreas,
    pendingScopeDetailTitles,
  ]);

  const builderReviewView = useMemo(() => {
    if (!estimate) return null;
    const confidenceBand = deriveQuickEstimateConfidencePresentation({
      confidencePercent: estimate.confidence,
      assumptionSeverity: estimate.assumptionMetadata?.assumptionSeverity,
      missingInfoCount: estimate.missingInfo.length,
      attentionCount: completedEstimateAttentionItems.length,
    }).band;
    return composeBuilderReview({
      estimate: {
        recommendedCost: estimate.recommendedCost,
        recommendedSell: estimate.recommendedSell,
        marginPercent: estimate.marginPercent,
        confidence: estimate.confidence,
        isStale: displayEstimateStale,
        assumptions: estimate.assumptions,
        missingInfo: estimate.missingInfo,
        lineItems: estimate.lineItems,
      },
      workAreas: displayWorkAreas,
      requirements:
        generationProjection?.requirementSnapshotRequirements ??
        initialState.requirementSnapshotRequirements,
      attentionItems: completedEstimateAttentionItems,
      confidenceBand,
    });
  }, [
    completedEstimateAttentionItems,
    displayEstimateStale,
    displayWorkAreas,
    estimate,
    generationProjection?.requirementSnapshotRequirements,
    initialState.requirementSnapshotRequirements,
  ]);

  const commercialBreakdown = useMemo(
    () => projectCommercialOverviewBreakdown(builderReviewView),
    [builderReviewView]
  );

  const mobileCommercialStatus = useMemo(
    () =>
      estimate
        ? buildQuickEstimateStatusPresentation({
            hasEstimate: true,
            isStale: displayEstimateStale,
            attentionItems: completedEstimateAttentionItems,
            assumptionCritical:
              estimate.assumptionMetadata?.assumptionSeverity === "critical",
          })
        : null,
    [
      completedEstimateAttentionItems,
      displayEstimateStale,
      estimate,
    ]
  );

  const estimateReviewActionable =
    displayEstimateStale ||
    (!estimateReady && questionsSubmitted) ||
    completedEstimateAttentionItems.length > 0 ||
    displayedAssistant.scopeReview.workAreas.some(
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
      displayedAssistant.scopeReview.workAreas.some(
        (workArea) => workArea.missingItems.length > 0
      ),
    estimate_ready: displayEstimateStale,
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
          assistantMode === "estimate_ready"
            ? "mt-1 grid min-w-0 gap-5 lg:mt-4 lg:items-start"
            : "mt-3 grid min-w-0 gap-5 lg:mt-4 lg:items-start",
          assistantMode === "planning" &&
            "lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[200px_minmax(0,1fr)_380px]",
          assistantMode === "estimate_ready" &&
            "lg:grid-cols-[minmax(0,1fr)_380px]",
          assistantMode === "edit_job" && "grid-cols-1"
        )}
        data-assistant-main-grid
        data-estimate-ready-mobile-gap={
          assistantMode === "estimate_ready" ? "tight" : undefined
        }
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
              isStale={displayEstimateStale}
              isRegenerating={updatingEstimate}
              pricingCtaEnabled={!pricingSummary}
            >
              {refineAfterEstimateOpen && refineView.hasCandidates ? (
                <RefineEstimatePanel
                  view={refineView}
                  isSaving={false}
                  canEstimateNow={false}
                  focusKey={refineAfterEstimateFocusKey}
                  isStale={displayEstimateStale}
                  isRegenerating={updatingEstimate}
                  updateError={actionError}
                  onUpdateEstimate={
                    displayEstimateStale ? handleRegenerateEstimate : undefined
                  }
                  onDone={closeRefineAfterEstimate}
                  onAnswerBoolean={handleClarifyBoolean}
                  onAnswerValue={handleClarifyValue}
                />
              ) : builderReviewOpen && builderReviewView ? (
                <BuilderReviewSurface
                  view={builderReviewView}
                  isRegenerating={updatingEstimate}
                  onBack={() => setBuilderReviewOpen(false)}
                  onEditJob={() => {
                    openEditJob(null);
                  }}
                  onRefine={refineView.hasCandidates ? () => {
                    openRefineAfterEstimate(null);
                  } : undefined}
                  onImprove={(improvement) => {
                    const candidates = [
                      ...refineView.highValue,
                      ...refineView.advanced,
                    ];
                    const query = improvement.label.trim().toLowerCase();
                    const match = candidates.find(
                      (c) =>
                        c.label.trim().toLowerCase() === query ||
                        c.question.trim().toLowerCase() === query ||
                        c.label.trim().toLowerCase().includes(query) ||
                        query.includes(c.label.trim().toLowerCase())
                    );
                    openRefineAfterEstimate(match?.factKey ?? match?.constraintKey ?? null);
                  }}
                  onUpdateEstimate={
                    displayEstimateStale ? handleRegenerateEstimate : undefined
                  }
                  onChangeMaterial={(workAreaId) => {
                    if (!workAreaId) return;
                    const workArea = displayWorkAreas.find((row) => row.id === workAreaId);
                    if (workArea?.type === "retaining_wall") {
                      openEditJob("job_plan", {
                        kind: "MATERIAL_SPEC",
                        section: "job_plan",
                        workAreaId,
                        specFactKey: "retaining_wall.face_board_section",
                      });
                      return;
                    }
                    openEditJob("job_plan", {
                      kind: "MATERIAL_SPEC",
                      section: "job_plan",
                      workAreaId,
                      specFactKey: "deck.board_material",
                    });
                  }}
                />
              ) : (
                <>
                  <EstimateReadyCard
                    workAreaSummaryLine={formatWorkAreaSummaryLine(
                      workAreaLists.included
                    )}
                    workAreaSummaryDetail={formatWorkAreaSummaryDetail(
                      workAreaLists.included
                    )}
                    recommendedSell={estimate.recommendedSell}
                    isStale={displayEstimateStale}
                    isRegenerating={updatingEstimate}
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
                    compactResult
                    onReviewEstimate={() => setBuilderReviewOpen(true)}
                    onEditJob={() => openEditJob(null)}
                    onUpdateEstimate={
                      displayEstimateStale ? handleRegenerateEstimate : undefined
                    }
                    onReviewAttention={handleReviewAttention}
                  />
                  <CompletedSetupDisclosure
                    summaryLine={setupSummaryLine}
                    chips={setupChips}
                    expanded={jobDetailsOpen}
                    onExpandedChange={setJobDetailsOpen}
                  >
                    <div className="space-y-4 text-sm">
                      {(briefText || project.briefText) ? (
                        <dl>
                          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Project Brief
                          </dt>
                          <dd className="mt-1 text-xs leading-relaxed text-foreground/90">
                            {briefText || project.briefText}
                          </dd>
                        </dl>
                      ) : null}
                      <dl>
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Work Areas
                        </dt>
                        <dd className="mt-1">{workAreaLists.included.join(" · ")}</dd>
                      </dl>
                      {jobPlan.cards.length > 0 && jobPlan.cards.some((c) => c.included.length > 0) ? (
                        <dl>
                          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Scope
                          </dt>
                          <dd>
                          <ul className="mt-1 space-y-0.5 text-xs text-foreground/90">
                            {jobPlan.cards.flatMap((c) =>
                              c.included.map((item) => (
                                <li key={`${c.workAreaId}-${item.id}`}>
                                  {c.name !== workAreaLists.included[0] || jobPlan.cards.length > 1
                                    ? `${c.name}: ` : ""}{item.label}
                                </li>
                              ))
                            ).slice(0, 8)}
                          </ul>
                          </dd>
                        </dl>
                      ) : null}
                      {qualityTitleLabel ? (
                        <dl>
                          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Finish level
                          </dt>
                          <dd className="mt-1">{qualityTitleLabel}</dd>
                        </dl>
                      ) : null}
                      {liveConstraints.length > 0 ? (
                        <dl>
                          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Project conditions
                          </dt>
                          <dd>
                          <ul className="mt-1 space-y-1 text-xs text-foreground/90">
                            {liveConstraints.slice(0, 4).map((row) => (
                              <li key={row.id}>
                                {row.label}: {String(row.value)}
                              </li>
                            ))}
                          </ul>
                          </dd>
                        </dl>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 min-h-11 w-full sm:w-auto"
                        data-estimate-ready-edit-job
                        onClick={() => openEditJob(null)}
                      >
                        {ASSISTANT_ACTION_LABELS.editJob}
                      </Button>
                    </div>
                  </CompletedSetupDisclosure>
                  <div
                    className="lg:hidden"
                    data-mobile-commercial-overview="true"
                    data-mobile-commercial-open={
                      commercialOverviewOpen ? "true" : "false"
                    }
                  >
                    <CompletedSetupDisclosure
                      title="Commercial Overview"
                      summaryLine="Direct cost, margin, and composition"
                      expanded={commercialOverviewOpen}
                      onExpandedChange={setCommercialOverviewOpen}
                    >
                      <CommercialOverviewMetrics
                        estimate={estimate}
                        breakdown={commercialBreakdown}
                        isStale={displayEstimateStale}
                        statusLabel={mobileCommercialStatus?.statusLabel ?? null}
                        statusKind={mobileCommercialStatus?.kind}
                        compositionHeading="Composition"
                        otherLabel="Other Direct"
                        marginTrailing={
                          !displayEstimateStale && estimate ? (
                            <span data-mobile-margin-edit="true">
                              <MarginEditControl
                                marginPercent={estimate.marginPercent}
                                targetMarginPercent={estimate.targetMarginPercent}
                                defaultMarginPercent={
                                  initialState.defaultMarginPercent
                                }
                                disabled={updatingEstimate || isGenerating}
                                isSaving={isSavingMargin}
                                onSave={handleMarginSave}
                                presentation="inline"
                              />
                            </span>
                          ) : null
                        }
                        marginSaveIndicator={
                          !displayEstimateStale && isSavingMargin ? (
                            <SaveStatusIndicator status="saving" isSaving />
                          ) : !displayEstimateStale && marginSaveLabel ? (
                            <p
                              className="text-xs text-muted-foreground"
                              data-margin-save-label
                            >
                              {marginSaveLabel}
                            </p>
                          ) : null
                        }
                      />
                      <button
                        type="button"
                        className="mt-2 text-left text-[11px] text-muted-foreground underline-offset-4 hover:underline"
                        onClick={() => {
                          setBuilderReviewOpen(false);
                          setBreakdownOpen(true);
                        }}
                        data-mobile-detailed-breakdown="true"
                        data-detailed-breakdown-tertiary="true"
                      >
                        {ASSISTANT_ACTION_LABELS.viewFullBreakdown}
                      </button>
                    </CompletedSetupDisclosure>
                  </div>
                </>
              )}
            </EstimateReadySurface>
          ) : null}

          {assistantMode === "edit_job" ? (
            <EditJobSurface
              focusSection={editJobSection}
              isStale={displayEstimateStale}
              isRegenerating={updatingEstimate}
              onDone={closeEditJob}
              onUpdateEstimate={
                displayEstimateStale ? handleRegenerateEstimate : undefined
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
                  scopeSaveStatus={jobPlanScopeSaveStatus}
                  scopeSaveError={jobPlanScopeSaveError}
                  onAddWorkArea={handleAddWorkArea}
                  onRemoveWorkArea={handleExcludeWorkArea}
                  focusWorkAreaId={jobPlanEditFocus?.workAreaId ?? null}
                  specFocusKey={jobPlanEditFocus?.specFocusKey ?? null}
                  scopeFocusItemId={jobPlanEditFocus?.scopeFocusItemId ?? null}
                  onToggleScope={handleJobPlanToggleScope}
                  onSpecFact={handleJobPlanSpecFact}
                  constraints={liveConstraints}
                  onConstraint={handleConstraintSave}
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
                      onSnapshotUpdate={applyProjectConditionsSnapshot}
                    />
                  </div>
                ) : (
                  <div ref={constraintsCardRef}>
                    <ConstraintBlock
                      questions={displayedAssistant.constraintQuestions}
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
                      workAreaTypes={displayWorkAreas
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
                pendingNoteProposal ? (
                  <div className="space-y-4" ref={questionsCardRef}>
                    <NoteProposalReviewPanel
                      projectId={project.id}
                      proposal={pendingNoteProposal}
                    />
                  </div>
                ) : null
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
                scopeSaveStatus={jobPlanScopeSaveStatus}
                scopeSaveError={jobPlanScopeSaveError}
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
                constraints={liveConstraints}
                onConstraint={
                  workAreasConfirmed ? undefined : handleConstraintSave
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
                readiness={estimateReadiness}
                refineView={refineView}
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
                displayEstimateStale
                  ? "Needs refresh"
                  : estimateReady
                    ? estimateReviewSummaryModel.outcomeLabel
                    : "Review"
              }
              statusVariant={
                displayEstimateStale
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
              canCollapse={questionsSubmitted && !displayEstimateStale}
              forceExpanded={displayEstimateStale}
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
                scopeReview={displayedAssistant.scopeReview}
                workAreas={displayWorkAreas}
                editable={questionsSubmitted}
                manageWorkAreas={workAreasConfirmed}
                estimateIsStale={displayEstimateStale}
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
                onSnapshotUpdate={applyProjectConditionsSnapshot}
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
                questions={displayedAssistant.constraintQuestions}
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
                workAreaTypes={displayWorkAreas
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
            estimate={
              estimate
                ? { ...estimate, isStale: displayEstimateStale }
                : null
            }
            qualityLevel={qualitySubmitted ? qualityLevel : null}
            pricingSummary={
              generationProjection
                ? generationProjection.pricingSummary
                : pricingSummary
            }
            quoteSummary={quoteSummary}
            isGenerating={isGenerating}
            isRegenerating={updatingEstimate}
            isSavingMargin={isSavingMargin}
            marginSaveLabel={marginSaveLabel}
            defaultMarginPercent={initialState.defaultMarginPercent}
            panelScopeSummaries={initialState.panelScopeSummaries}
            scopeReview={displayedAssistant.scopeReview}
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
            commercialBreakdown={commercialBreakdown}
            onViewBreakdown={() => {
              setBuilderReviewOpen(false);
              setBreakdownOpen(true);
            }}
            onGenerate={handleGenerateEstimate}
            onRegenerate={handleRegenerateEstimate}
            onMarginSave={
              assistantMode === "estimate_ready" && !displayEstimateStale
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
        isRegenerating={updatingEstimate}
        projectId={project.id}
      />
    </div>
  );
}
