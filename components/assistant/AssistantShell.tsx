"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AssistantProgress } from "@/components/assistant/AssistantProgress";
import { CollapsibleStageCard } from "@/components/assistant/CollapsibleStageCard";
import { StepperNav } from "@/components/assistant/StepperNav";
import { ProjectCaptureBlock } from "@/components/assistant/ProjectCaptureBlock";
import type { ProjectDocumentCentreModel } from "@/lib/projects/document-model";
import { ConstraintBlock } from "@/components/assistant/ConstraintBlock";
import { ProjectConditionsBlock } from "@/components/assistant/ProjectConditionsBlock";
import { CompletedSetupDisclosure } from "@/components/assistant/CompletedSetupDisclosure";
import { BuilderReviewSurface } from "@/components/assistant/builder-review/BuilderReviewSurface";
import { BillingAccessDenied } from "@/components/billing/BillingAccessDenied";
import { EstimateOverview } from "@/components/assistant/mode/EstimateOverview";
import {
  EstimateViewControl,
  WorkAreaBreakdown,
  type EstimatePresentationView,
} from "@/components/assistant/mode/WorkAreaBreakdown";
import {
  ESTIMATE_SECTION_PARAM,
  estimateSectionQuery,
  parseEstimateSection,
} from "@/lib/assistant/presentation/estimate-section";
import {
  ESTIMATE_BASIS_DESKTOP_QUERY,
  estimateBasisBrief,
  estimateBasisStartsExpanded,
  estimateBasisWorkAreas,
  estimateReadySidebarPolicy,
} from "@/lib/assistant/presentation/estimate-ready-layout";
import {
  AssumptionsChecks,
  LabourTakeoff,
  MaterialsTakeoff,
} from "@/components/assistant/mode/EstimateTakeoffViews";
import { EstimateBreakdownModal } from "@/components/assistant/EstimateBreakdownModal";
import { EstimatePanel } from "@/components/assistant/EstimatePanel";
import { MarginEditControl } from "@/components/assistant/MarginEditControl";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";
import { PlanningSurface } from "@/components/assistant/mode/PlanningSurface";
import { EstimateReadySurface } from "@/components/assistant/mode/EstimateReadySurface";
import { EditJobSurface } from "@/components/assistant/mode/EditJobSurface";

function subscribeEstimateBasisDesktop(onStoreChange: () => void): () => void {
  const media = window.matchMedia(ESTIMATE_BASIS_DESKTOP_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function readEstimateBasisDesktop(): boolean {
  return estimateBasisStartsExpanded(
    window.matchMedia(ESTIMATE_BASIS_DESKTOP_QUERY).matches
  );
}
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
import { GenerateEstimateStatus } from "@/components/assistant/clarify/GenerateEstimateStatus";
import { QuotrLoader } from "@/components/brand/QuotrLoader";
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
import { projectWorkAreaConfirmation } from "@/lib/assistant/project-work-area-confirmation";
import {
  createLatestWriteGuard,
  filterPersistableAnswers,
  resolveAnswerSaveStatus,
} from "@/lib/assistant/answer-persistence";
import { updateProjectConstraint } from "@/lib/assistant/constraint-actions";
import { updateProjectFact, updateProjectFacts } from "@/lib/assistant/fact-actions";
import { beginQualitySpecEdit } from "@/lib/assistant/quality-edit";
import { updateEstimateMargin } from "@/lib/assistant/margin-actions";
import { saveJobDescription } from "@/lib/projects/actions";
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
import {
  mergeConstraintSnapshotWithLaterOverlay,
  persistClarifyValueType,
  shouldRefreshAfterStaleMutation,
} from "@/lib/assistant/clarify/interaction";
import { useEstimateGenerationProjection } from "@/components/projects/estimate-generation-projection";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  addWorkAreaToProject,
  excludeWorkAreaFromProject,
} from "@/lib/assistant/work-area-actions";
import { continueManualWorkToPricing } from "@/lib/pricing/actions";
import {
  LAST_ACTIVE_WORK_AREA_MESSAGE,
  canRemoveCanonicalWorkArea,
  projectActiveCanonicalWorkAreas,
} from "@/lib/assistant/work-area-active";
import { composeJobPlan } from "@/lib/assistant/job-plan/compose";
import { applyJobPlanScopeWrite } from "@/lib/assistant/job-plan/apply-write";
import { writeJobPlanScopeDecision } from "@/lib/assistant/job-plan/actions";
import { appendJobPlanFactOverlay, overlayFact } from "@/lib/assistant/job-plan/facts";
import { overlayFactSemanticKey } from "@/lib/assistant/question-identity";
import { JOB_PLAN_IS_PRIMARY } from "@/lib/assistant/job-plan/flags";
import { UNKNOWN_ANALYSIS_ERROR } from "@/lib/ai/analyse-job-contract";
import { presentAssistantError } from "@/lib/assistant/presentation/error-messages";
import { isTechnicalErrorText } from "@/lib/errors/user-message";
import {
  jobPlanFactsFromAssistantState,
  jobPlanFactsFromReviewAndInterview,
  jobPlanWorkAreasFromUi,
} from "@/lib/assistant/job-plan/from-assistant-state";
import type { JobPlanScopeItem } from "@/lib/assistant/job-plan/types";
import { composeClarifyView } from "@/lib/assistant/clarify/compose";
import { composeBuilderReview } from "@/lib/assistant/builder-review";
import { composeEstimateReadiness } from "@/lib/assistant/readiness/compose";
import {
  deckDetailGapCopy,
  deckDetailGapsForAreas,
  deckPostHoleControlId,
  firstDeckDetailTarget,
  quantityConflictStageStatus,
  settledPostHoleAnswerCount,
} from "@/lib/estimate/deck-detail-completeness";
import { spoilAccessAllowsAllowance } from "@/lib/estimate/deck-hole-excavation";
import {
  detailsReadinessPhase,
  detailsStageStatusLabel,
  detailsStageSubtitle,
} from "@/lib/assistant/readiness/details-status";
import { settleDetailsJourney } from "@/lib/assistant/readiness/details-journey";
import { compactDeckReadySummary } from "@/lib/estimate/deck-ready-summary";
import {
  restoreDeckProductivityDecisions,
  saveDeckProductivityDecisions,
} from "@/lib/assistant/deck-productivity-actions";
import {
  productivityApplyProgressCopy,
  productivityEstimateVisible,
} from "@/lib/estimate/deck-productivity-apply";
import type { DeckProductivitySelection } from "@/components/assistant/DeckProductivityReviewDialog";
import {
  composeClarifyInputFromEstimateContext,
  evaluateGenerateEstimatePermission,
} from "@/lib/assistant/readiness/clarify-estimate";
import { evaluatePackageQuickEstimateReadiness } from "@/lib/assistant/readiness/package-quick-estimate";
import type { SaveStatus } from "@/lib/assistant/presentation/save-status";
import { composeRefineView } from "@/lib/assistant/refine/compose";
import {
  answerClarifyConstraint,
  answerClarifyFact,
  answerClarifySelectFact,
  completeClarifyPlanning,
} from "@/lib/assistant/clarify/actions";
import { CLARIFY_IS_PRIMARY } from "@/lib/assistant/clarify/flags";
import {
  createGenerateOnceLock,
  createPendingWriteTracker,
  decideGenerateAfterSync,
  delayMs,
  PRODUCTIVITY_APPLY_TIMEOUT_MS,
  remainingGenerateMinDisplayMs,
  settleSaveRequest,
  settledFactsForGenerate,
  type GenerateEstimateStage,
} from "@/lib/assistant/clarify/generate-sync";
import type { ClarifyCandidate, ComposeClarifyInput } from "@/lib/assistant/clarify/types";
import { getConstraintTemplateSeeds } from "@/lib/assistant/constraint-templates";
import {
  ASSISTANT_MODES_PRIMARY,
  deriveAssistantUiMode,
  formatWorkAreaSummaryDetail,
  formatWorkAreaSummaryLine,
  resolveAttentionNavigation,
  type EditJobSection,
} from "@/lib/assistant/mode";
import type { EstimateFact } from "@/lib/estimate/types";
import { isInternalWallsWallTypeWriteKey } from "@/lib/estimate/internal-walls-wall-types";
import { isCeilingsPortionWriteKey } from "@/lib/estimate/ceilings-portions";
import { disclosedAssumptionForNotSure } from "@/lib/estimate/disclosed-assumptions";
import { disclosedProjectConditionForNotSure } from "@/lib/project-conditions/consumed-authority";
import { isStageAtOrBeyond } from "@/lib/assistant/stage";
import { startPreviewPerf, recordPreviewPerf, previewPerfNow } from "@/lib/assistant/preview-performance";
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
import { projectCommercialOverviewBreakdown } from "@/lib/assistant/presentation/commercial-overview-projection";
import { projectEstimateOverview } from "@/lib/assistant/presentation/estimate-overview";
import {
  DECK_CONCRETE_CALIBRATION_REASON,
  DECK_CONCRETE_CALIBRATION_TASK,
  DECK_CONCRETE_PLACE_BENCHMARK_HOURS,
  DECK_CONCRETE_PLACE_CONFIRM_FACT,
  DECK_POST_SET_HOURS,
  DECK_POST_SET_SCOPE,
  DECK_POSTS_CALIBRATION_REASON,
  DECK_POSTS_CALIBRATION_TASK,
  DECK_POSTS_INSTALL_CONFIRM_FACT,
  deckProductivityPhrase,
  parseScopeReview,
  productivityScopeReviewBlock,
} from "@/lib/estimate/deck-productivity-scope";
import { formatLabourHours, formatQuantity } from "@/lib/estimate/builder-presentation-format";
import { DeckProductivityReviewDialog } from "@/components/assistant/DeckProductivityReviewDialog";
import { deckStatedCountConflict } from "@/lib/estimate/deck-stated-count-guard";
import { applyLevel1AttentionPresentation } from "@/lib/assistant/presentation/attention-severity";
import { deriveQuickEstimateConfidencePresentation } from "@/lib/assistant/presentation/quick-estimate-confidence";
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
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
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
  documents?: ProjectDocumentCentreModel | null;
  canUploadFiles?: boolean;
  canRunEstimates?: boolean;
  initialEstimateSection?: EstimatePresentationView;
  initialReviewProductivity?: boolean;
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

type SpecFactInput = {
  workAreaId: string;
  key: string;
  label: string;
  value: string | number;
  valueType: "number" | "select" | "text";
};

type SpecFactsInput = {
  workAreaId: string;
  facts: readonly {
    key: string;
    label: string;
    value: string | number;
    valueType: "number" | "select" | "text";
  }[];
};

type FailedSpecReplay =
  | { kind: "fact"; seq: number; input: SpecFactInput }
  | { kind: "facts"; seq: number; input: SpecFactsInput };

function specFactIdentity(workAreaId: string, key: string): string {
  return overlayFactSemanticKey({ key, work_area_id: workAreaId });
}

function saveErrorCopy(raw?: string | null): string {
  if (!raw || /failed to fetch|network|abort|timed out|timeout/i.test(raw)) {
    return presentAssistantError("save");
  }
  return presentAssistantError("save", raw);
}

function constraintKeyForQuestion(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  return (
    getConstraintTemplateSeeds().find((row) => row.question_text === trimmed)?.key ??
    null
  );
}

/** Persisted answers win per key. A partial save must not drop the other answers. */
function overlayGenerateFacts(
  snapshot: readonly EstimateFact[],
  settled: readonly EstimateFact[]
): EstimateFact[] {
  return settled.reduce<EstimateFact[]>(
    (next, row) => overlayFact(next, row),
    [...snapshot]
  );
}

function factsForGenerate(
  snapshot: readonly EstimateFact[],
  mutationFacts: readonly EstimateFact[]
): EstimateFact[] {
  return overlayGenerateFacts(
    snapshot,
    settledFactsForGenerate([] as EstimateFact[], mutationFacts)
  );
}

function sameSavedFactValue(canonical: unknown, overlay: unknown): boolean {
  if (canonical === overlay) return true;
  if (canonical == null || overlay == null) return false;
  if (typeof canonical === "number" || typeof overlay === "number") {
    const left = Number(canonical);
    const right = Number(overlay);
    return Number.isFinite(left) && left === right;
  }
  return String(canonical) === String(overlay);
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
  documents = null,
  canUploadFiles = false,
  canRunEstimates = true,
  initialEstimateSection = "overview",
  initialReviewProductivity = false,
}: AssistantShellProps) {
  const router = useRouter();
  const actionLockRef = useRef(false);
  const manualPricingInFlightRef = useRef<Promise<{
    success: boolean;
    error?: string;
  }> | null>(null);
  const generationRequestSeqRef = useRef(0);
  const appliedGenerationRef = useRef<AppliedEstimateGeneration | null>(null);
  const factMutationSeqRef = useRef(0);
  const appliedMutationRef = useRef<AppliedAssistantMutation | null>(null);
  const factMutationGateRef = useRef(Promise.resolve());
  const overlaySeqByFactRef = useRef(new Map<string, number>());
  const overlaySeqByConstraintRef = useRef(new Map<string, number>());
  const estimateNavProjection = useEstimateGenerationProjection();
  const { project } = initialState;

  const pendingWriteTrackerRef = useRef(createPendingWriteTracker());
  const generateLockRef = useRef(createGenerateOnceLock());
  const generateFailureStickyRef = useRef(false);
  const sawEstimateRef = useRef(false);
  const failedSpecSavesRef = useRef(new Map<string, FailedSpecReplay>());
  const replayFailedSpecSavesRef = useRef<() => void>(() => {});
  const generateUiStartedAtRef = useRef(0);
  const generateAuthorityRef = useRef<{
    stage: string;
    briefText: string | null;
    qualityLevel: string | null;
    workAreas: readonly {
      id: string;
      type: string;
      name: string;
      status: string;
    }[];
    facts: EstimateFact[];
    constraints: { key: string; value: unknown }[];
  } | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [clarifyWritePending, setClarifyWritePending] = useState(false);
  // Unified authority for "does a persisted Clarify answer of ANY input type
  // (select/boolean/number/text/Project Condition) still have an in-flight
  // write to the DB". Readiness/Create-Estimate gating reads this counter,
  // not `clarifyWritePending` (which only covers number/text and intentionally
  // does not disable select/chip UI while saving).
  const [pendingReadinessWrites, setPendingReadinessWrites] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [failedSpecSaveCount, setFailedSpecSaveCount] = useState(0);
  const [actionDenial, setActionDenial] = useState<{
    reasonCode?: string;
    upgradeTarget?: "builder" | "business" | "builder_or_business" | null;
  } | null>(null);

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
  const [generateStage, setGenerateStage] =
    useState<GenerateEstimateStage>("building");
  const [generateStartedAt, setGenerateStartedAt] = useState(0);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [revealConstraintKey, setRevealConstraintKey] = useState<string | null>(
    null
  );
  const [generateReturnFocusId, setGenerateReturnFocusId] = useState<
    string | null
  >(null);
  const publishGenerateFailure = useCallback(
    (message: string, focusId?: string | null) => {
      const key =
        (focusId?.startsWith("pc:") ? focusId.slice(3) : null) ??
        constraintKeyForQuestion(message);
      generateFailureStickyRef.current = true;
      setGenerateNotice(message);
      setRevealConstraintKey(key);
      setGenerateReturnFocusId(focusId ?? (key ? `pc:${key}` : null));
    },
    []
  );
  const releaseGenerateFeedback = useCallback(() => {
    if (generateFailureStickyRef.current || generateLockRef.current.locked) {
      return;
    }
    setGenerateNotice(null);
  }, []);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateStartedAt, setRegenerateStartedAt] = useState(0);
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
  const estimateBasisDesktop = useSyncExternalStore(
    subscribeEstimateBasisDesktop,
    readEstimateBasisDesktop,
    () => false
  );
  const [estimateBasisOverride, setEstimateBasisOverride] = useState<boolean | null>(
    null
  );
  const jobDetailsOpen = estimateBasisOverride ?? estimateBasisDesktop;
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
  const [productivityReviewOpen, setProductivityReviewOpen] = useState(
    initialReviewProductivity
  );
  const productivityApplyLockRef = useRef(false);
  const [productivityProgress, setProductivityProgress] = useState<
    "saving" | "updating" | null
  >(null);
  const [productivityCoverId, setProductivityCoverId] = useState<string | null>(
    null
  );
  const savingSpecCountsRef = useRef(new Map<string, number>());
  const [savingSpecKeys, setSavingSpecKeys] = useState<string[]>([]);
  const trackSavingSpecKey = useCallback((key: string, delta: number) => {
    const counts = savingSpecCountsRef.current;
    const next = (counts.get(key) ?? 0) + delta;
    if (next <= 0) counts.delete(key);
    else counts.set(key, next);
    setSavingSpecKeys([...counts.keys()]);
  }, []);
  const [estimateView, setEstimateViewState] = useState<EstimatePresentationView>(
    initialEstimateSection
  );
  const [focusWorkAreaId, setFocusWorkAreaId] = useState<string | null>(null);
  const setEstimateView = useCallback((view: EstimatePresentationView) => {
    setEstimateViewState(view);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const next = estimateSectionQuery(view);
    if (next) url.searchParams.set(ESTIMATE_SECTION_PARAM, next);
    else url.searchParams.delete(ESTIMATE_SECTION_PARAM);
    const nextHref = `${url.pathname}${url.search}${url.hash}`;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextHref !== currentHref) {
      window.history.pushState({ estimateSection: view }, "", nextHref);
    }
  }, [setEstimateViewState]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(ESTIMATE_SECTION_PARAM);
    const view = parseEstimateSection(raw);
    const canonical = estimateSectionQuery(view);
    if ((raw ?? null) !== canonical) {
      const url = new URL(window.location.href);
      if (canonical) url.searchParams.set(ESTIMATE_SECTION_PARAM, canonical);
      else url.searchParams.delete(ESTIMATE_SECTION_PARAM);
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    }
    function onPop() {
      setEstimateViewState(
        parseEstimateSection(
          new URLSearchParams(window.location.search).get(ESTIMATE_SECTION_PARAM)
        )
      );
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setEstimateViewState]);
  const openWorkArea = useCallback((workAreaId: string) => {
    if (!workAreaId) return;
    setFocusWorkAreaId(workAreaId);
    setEstimateView("work_areas");
  }, [setEstimateView]);
  const [builderReviewCompleted, setBuilderReviewCompleted] = useState(false);
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
    // This read is a server action. Next runs those one at a time, so starting
    // it while Work confirmation is still the open step holds the Continue POST.
    if (!isStageAtOrBeyond(stage, "quality")) return;
    let cancelled = false;
    void listManualScopeItemsForProject(project.id).then((outcome) => {
      if (cancelled || !outcome.ok) return;
      setManualScopeItems(outcome.items);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id, initialState.scopeReview, stage]);

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
    overlaySeqByFactRef.current.set(overlayFactSemanticKey(row), seq);
  }, []);

  const settleCanonicalMutation = useCallback(
    (result: AssistantActionState, requestSeq: number): boolean => {
      if (result.recoveryRefresh) return false;
      const mutation = result.assistantMutation;
      if (!mutation) {
        return Boolean(result.success);
      }
      const incoming: AppliedAssistantMutation = {
        projectId: mutation.projectId,
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
      setAssistantMutationProjection(mutation);
      setLiveConstraints((prev) =>
        mergeConstraintSnapshotWithLaterOverlay({
          incoming: mutation.submittedConstraints,
          previous: prev,
          overlaySeqByKey: overlaySeqByConstraintRef.current,
          requestSeq,
        })
      );
      setJobPlanFactOverlay((prev) =>
        prev.filter((row) => {
          const key = overlayFactSemanticKey(row);
          const seq = overlaySeqByFactRef.current.get(key);
          if (seq == null || seq > requestSeq) return true;
          const canonical = mutation.interviewFacts.find(
            (fact) => fact.key === row.key && fact.workAreaId === row.work_area_id
          );
          if (!canonical || !sameSavedFactValue(canonical.value, row.value)) return true;
          return false;
        })
      );
      if (mutation.hasEstimate && mutation.estimateStale) {
        setLocalEstimateStale(true);
        estimateNavProjection?.markEstimateStale();
      }
      return true;
    },
    [estimateNavProjection, project.id]
  );

  const onRejectedCanonicalMutation = useCallback(
    (requestSeq: number) => {
      bridgeEstimateStaleAfterCanonicalWrite();
      if (
        !shouldRefreshAfterStaleMutation({
          factSeqByKey: overlaySeqByFactRef.current,
          constraintSeqByKey: overlaySeqByConstraintRef.current,
          requestSeq,
        })
      ) {
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    },
    [bridgeEstimateStaleAfterCanonicalWrite, router]
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
        if (action === "estimate") {
          publishGenerateFailure("The estimate is already updating.");
          setIsGenerating(false);
        }
        return { error: "The estimate is already updating." };
      }

      actionLockRef.current = true;
      setPendingAction(action);
      setActionError(null);
      setActionDenial(null);

      try {
        const result = await fn();
        const settleGeneratingUi = async () => {
          if (action !== "estimate") return;
          const wait = remainingGenerateMinDisplayMs(
            previewPerfNow() - generateUiStartedAtRef.current
          );
          if (wait > 0) await delayMs(wait);
          setIsGenerating(false);
        };

        if (result.error) {
          if (action === "estimate") {
            publishGenerateFailure(
              presentAssistantError("estimate_generate", result.error)
            );
          } else {
            setActionError(
              isTechnicalErrorText(result.error)
                ? presentAssistantError(
                    action === "brief" ? "analyse_job" : "generic"
                  )
                : presentAssistantError(
                    action === "brief" ? "analyse_job" : "generic",
                    result.error
                  )
            );
          }
          if (result.reasonCode) {
            setActionDenial({
              reasonCode: result.reasonCode,
              upgradeTarget: result.upgradeTarget ?? null,
            });
          }
          setPendingAction(null);
          if (action === "estimate") {
            await settleGeneratingUi();
          }
          if (action === "regenerate") {
            setIsRegenerating(false);
          }
          return { error: result.error };
        }

        const isEstimateMutation =
          action === "estimate" || action === "regenerate";
        const generation = result.estimateGeneration;
        let shouldRefresh = action !== "work_areas";
        let estimateApplied = false;

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
            estimateApplied = true;
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

        if (action === "estimate" && !estimateApplied) {
          publishGenerateFailure(
            result.recoveryRefresh || generation
              ? "The estimate was saved but did not open. Try again."
              : "The estimate was not created. Try again."
          );
          if (!result.recoveryRefresh && !generation) shouldRefresh = false;
        }

        if (shouldRefresh) {
          router.refresh();
        } else if (action === "work_areas") {
          startTransition(() => {
            router.refresh();
          });
        }

        setPendingAction(null);
        if (action === "estimate") {
          await settleGeneratingUi();
        }
        if (action === "regenerate") {
          setIsRegenerating(false);
        }
        return {};
      } catch {
        const message =
          action === "brief"
            ? UNKNOWN_ANALYSIS_ERROR
            : "Something went wrong. Please try again.";
        if (action !== "estimate") setActionError(message);
        setPendingAction(null);
        if (action === "estimate") {
          publishGenerateFailure(
            presentAssistantError("estimate_generate")
          );
          const wait = remainingGenerateMinDisplayMs(
            previewPerfNow() - generateUiStartedAtRef.current
          );
          if (wait > 0) await delayMs(wait);
          setIsGenerating(false);
        }
        if (action === "regenerate") {
          setIsRegenerating(false);
        }
        return { error: message };
      } finally {
        actionLockRef.current = false;
      }
    },
    [estimateNavProjection, project.id, publishGenerateFailure, router, settleCanonicalMutation]
  );

  const persistJobDescription = useCallback((value: string) => {
    const next = value.trim();
    const current = project.briefText?.trim() ?? "";
    if (next === current || pendingAction != null) return;
    void saveJobDescription(project.id, value);
  }, [pendingAction, project.briefText, project.id]);

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

      void runAction("work_areas", async () => {
        const result = await confirmWorkAreas(project.id, selections);
        if (!result.error && !result.recoveryRefresh) {
          setAssistantMutationProjection(
            projectWorkAreaConfirmation(displayedAssistant, selections)
          );
          if (displayedAssistant.estimate) {
            setLocalEstimateStale(true);
            estimateNavProjection?.markEstimateStale();
          }
        }
        return result;
      });
    },
    [displayedAssistant, estimateNavProjection, project.id, runAction]
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
      const quoted = refineAfterEstimateFocusKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const selectors = [
        `[data-refine-semantic="${quoted}"] input, [data-refine-semantic="${quoted}"] select, [data-refine-semantic="${quoted}"] button`,
        `[data-refine-row="${quoted}"] input, [data-refine-row="${quoted}"] select, [data-refine-row="${quoted}"] button`,
        `[data-refine-field="${quoted}"] input, [data-refine-field="${quoted}"] select, [data-refine-field="${quoted}"] button`,
      ];
      let el: HTMLElement | null = null;
      for (const selector of selectors) {
        el = document.querySelector<HTMLElement>(selector);
        if (el) break;
      }
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
        setBuilderReviewCompleted(true);
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

  const handleGenerateEstimate = useCallback((): boolean => {
    if (isGenerating || generateLockRef.current.locked) {
      return true;
    }
    if (
      pendingAction === "estimate" ||
      pendingAction === "regenerate" ||
      actionLockRef.current
    ) {
      return true;
    }
    if (pendingAction != null) {
      return false;
    }
    if (!generateLockRef.current.tryAcquire()) {
      return true;
    }
    generateUiStartedAtRef.current = previewPerfNow();
    setGenerateStage(
      pendingReadinessWrites > 0 || pendingWriteTrackerRef.current.size > 0
        ? "saving"
        : "readiness"
    );
    setGenerateStartedAt(Date.now());
    setIsGenerating(true);
    generateFailureStickyRef.current = false;
    setGenerateNotice(null);
    setRevealConstraintKey(null);
    setGenerateReturnFocusId(null);
    recordPreviewPerf("estimate_generate_ack", 0);

    void (async () => {
      const abortGenerating = async () => {
        const wait = remainingGenerateMinDisplayMs(
          previewPerfNow() - generateUiStartedAtRef.current
        );
        if (wait > 0) await delayMs(wait);
        setIsGenerating(false);
      };
      try {
        if (failedSpecSavesRef.current.size > 0) {
          setActionError(null);
          setGenerateStage("saving");
          replayFailedSpecSavesRef.current();
        }
        let lastMutation: AssistantMutationResult | undefined;
        let lastMutationSeq = -1;
        let authoritativeSeq = -1;
        if (
          pendingReadinessWrites > 0 ||
          pendingWriteTrackerRef.current.size > 0
        ) {
          setGenerateStage("saving");
        }
        {
          const syncEnd = startPreviewPerf("estimate_generate_sync");
          const tracker = pendingWriteTrackerRef.current;
          let settled = await tracker.waitAll();
          while (pendingWriteTrackerRef.current.size > 0 && !settled.failed) {
            settled = await tracker.waitAll();
          }
          syncEnd();
          lastMutation = settled.lastMutation;
          lastMutationSeq = settled.lastMutationSeq;
          authoritativeSeq = settled.authoritativeSeq;
          const decision = decideGenerateAfterSync({
            writeFailed: Boolean(settled.failed),
            pendingWritesRemaining: settled.pendingRemaining,
            permissionReady: true,
          });
          if (decision.reason === "write_failed" || settled.failed) {
            publishGenerateFailure(
              presentAssistantError("save", settled.failed?.error)
            );
            await abortGenerating();
            return;
          }
        }

        setGenerateStage("readiness");
        const snap = generateAuthorityRef.current;
        const latestMutation =
          lastMutation != null &&
          lastMutationSeq >= authoritativeSeq &&
          authoritativeSeq >= 0
            ? lastMutation
            : undefined;
        const mutationFacts = latestMutation
          ? jobPlanFactsFromReviewAndInterview(
              latestMutation.scopeReview,
              latestMutation.interviewFacts
            )
          : [];
        const snapshotFacts =
          generateAuthorityRef.current?.facts ?? snap?.facts ?? [];
        const facts = factsForGenerate(snapshotFacts, mutationFacts);
        const snapshotConstraints =
          generateAuthorityRef.current?.constraints ?? snap?.constraints ?? [];
        const mutationConstraints = latestMutation
          ? latestMutation.submittedConstraints.map((row) => ({
              key: row.key,
              value: row.value,
            }))
          : null;
        const constraints = mutationConstraints
          ? [
              ...snapshotConstraints.filter(
                (row) => !mutationConstraints.some((next) => next.key === row.key)
              ),
              ...mutationConstraints,
            ]
          : snapshotConstraints;
        const workAreas =
          latestMutation && latestMutation.workAreas.length > 0
            ? latestMutation.workAreas
            : generateAuthorityRef.current?.workAreas ?? snap?.workAreas ?? [];
        const compose = composeClarifyInputFromEstimateContext({
          stage: (latestMutation?.stage ??
            snap?.stage ??
            "work_area_questions") as ComposeClarifyInput["stage"],
          briefText: snap?.briefText ?? project.briefText,
          qualityLevel: snap?.qualityLevel ?? qualityLevel,
          workAreas,
          facts,
          constraints,
        });
        const permission = evaluateGenerateEstimatePermission({
          compose,
          workAreas,
          facts,
          unresolvedRequiredProjectConditionKeys:
            projectConditionsSnapshot?.unresolvedRequiredKeys ?? [],
          pendingWrites: 0,
        });
        const readyDecision = decideGenerateAfterSync({
          writeFailed: false,
          pendingWritesRemaining: 0,
          permissionReady: permission.ready,
        });
        if (!readyDecision.generate) {
          const deckTarget = firstDeckDetailTarget(
            facts as never,
            workAreas.map((area) => ({ id: area.id, type: area.type }))
          );
          publishGenerateFailure(
            permission.builderCopy ??
              "One more detail is needed before the estimate can be built.",
            permission.diagnostics.unresolved[0]?.id ??
              (deckTarget
                ? deckPostHoleControlId(deckTarget.workAreaId, deckTarget.gapId)
                : null)
          );
          await abortGenerating();
          return;
        }

        if (pendingWriteTrackerRef.current.size > 0) {
          let newer = await pendingWriteTrackerRef.current.waitAll();
          while (pendingWriteTrackerRef.current.size > 0 && !newer.failed) {
            newer = await pendingWriteTrackerRef.current.waitAll();
          }
          if (newer.failed) {
            publishGenerateFailure(
              presentAssistantError("save", newer.failed.error)
            );
            await abortGenerating();
            return;
          }
          if (newer.lastMutation && newer.lastMutationSeq >= lastMutationSeq) {
            lastMutation = newer.lastMutation;
            lastMutationSeq = newer.lastMutationSeq;
          }
          if (newer.authoritativeSeq > authoritativeSeq) {
            authoritativeSeq = newer.authoritativeSeq;
          }
          const latestNewerMutation =
            lastMutation != null &&
            lastMutationSeq >= authoritativeSeq &&
            authoritativeSeq >= 0
              ? lastMutation
              : undefined;
          const liveFacts = generateAuthorityRef.current?.facts ?? snap?.facts ?? facts;
          const newerMutationFacts = latestNewerMutation
            ? jobPlanFactsFromReviewAndInterview(
                latestNewerMutation.scopeReview,
                latestNewerMutation.interviewFacts
              )
            : [];
          const readyFacts = factsForGenerate(liveFacts, newerMutationFacts);
          const newerPermission = evaluateGenerateEstimatePermission({
            compose: composeClarifyInputFromEstimateContext({
              stage: (lastMutation?.stage ?? snap?.stage ?? "work_area_questions") as ComposeClarifyInput["stage"],
              briefText: snap?.briefText ?? project.briefText,
              qualityLevel: snap?.qualityLevel ?? qualityLevel,
              workAreas,
              facts: readyFacts,
              constraints,
            }),
            workAreas,
            facts: readyFacts,
            unresolvedRequiredProjectConditionKeys:
              projectConditionsSnapshot?.unresolvedRequiredKeys ?? [],
            pendingWrites: 0,
          });
          if (!newerPermission.ready) {
            const deckTarget = firstDeckDetailTarget(
              readyFacts as never,
              workAreas.map((area) => ({ id: area.id, type: area.type }))
            );
            publishGenerateFailure(
              newerPermission.builderCopy ??
                "One more detail is needed before the estimate can be built.",
              newerPermission.diagnostics.unresolved[0]?.id ??
                (deckTarget
                  ? deckPostHoleControlId(deckTarget.workAreaId, deckTarget.gapId)
                  : null)
            );
            await abortGenerating();
            return;
          }
        }

        setGenerateStage("building");
        generationRequestSeqRef.current += 1;
        const endPerf = startPreviewPerf("estimate_generate_complete");
        await runAction("estimate", async () => {
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
      } finally {
        generateLockRef.current.release();
      }
    })();
    return true;
  }, [
    isGenerating,
    pendingAction,
    pendingReadinessWrites,
    project.id,
    project.briefText,
    runAction,
    constraintsSubmitted,
    projectConditionsSnapshot?.unresolvedRequiredKeys,
    publishGenerateFailure,
    qualityLevel,
  ]);

  const handleRegenerateEstimate = useCallback(async () => {
    if (
      isRegenerating ||
      pendingAction != null ||
      actionLockRef.current
    ) {
      return { error: "The estimate is already updating." };
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
        const message =
          packageReadiness.builderCopy ??
          "Complete the remaining project information before generating the estimate.";
        setActionError(message);
        return { error: message };
      }
    }
    setRegenerateStartedAt(Date.now());
    setIsRegenerating(true);
    recordPreviewPerf("estimate_generate_ack", 0);
    const endPerf = startPreviewPerf("estimate_generate_complete");
    generationRequestSeqRef.current += 1;
    return runAction("regenerate", async () => {
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
    (input: {
      workAreaId: string;
      key: string;
      label: string;
      value: string | number | boolean | string[];
      unit?: string;
      inputType?: "number" | "select" | "boolean" | "text" | "multi_select";
      wallTypeId?: string | null;
      openingId?: string | null;
      nestedItemId?: string | null;
      componentId?: string | null;
    }) => {
      const work = (async () => {
      const factKey = `${input.workAreaId}:${input.key}`;
      recordPreviewPerf("question_save_ack", 0);
      const endSavePerf = startPreviewPerf("question_save_complete");
      setSavingFactKey(factKey);
      setFactError(null);
      setPendingReadinessWrites((count) => count + 1);
      setClarifyWritePending(true);
      const requestSeq = ++factMutationSeqRef.current;
      const overlayRow: EstimateFact = {
        key: input.key,
        work_area_id: input.workAreaId,
        value: input.value,
        source: "user",
        wallTypeId: input.wallTypeId ?? undefined,
        openingId: input.openingId ?? undefined,
        nestedItemId: input.nestedItemId ?? undefined,
        componentId: input.componentId ?? undefined,
      };
      tagOverlayFactSeq(overlayRow, requestSeq);
      setJobPlanFactOverlay((prev) => appendJobPlanFactOverlay(prev, overlayRow));

      try {
      const result = await runSerializedFactMutation(() =>
        updateProjectFact({
          projectId: project.id,
          workAreaId: input.workAreaId,
          key: input.key,
          label: input.label,
          value: input.value,
          unit: input.unit,
          valueType: input.inputType,
          wallTypeId: input.wallTypeId ?? undefined,
          openingId: input.openingId ?? undefined,
          nestedItemId: input.nestedItemId ?? undefined,
          componentId: input.componentId ?? undefined,
        })
      );

      if (result.error) {
        setFactError(result.error);
        setActionError(result.error);
        releaseGenerateFeedback();
        return result;
      }

      if (!generateFailureStickyRef.current && !generateLockRef.current.locked) {
        setActionError(null);
      }
      releaseGenerateFeedback();
      if (!settleCanonicalMutation(result, requestSeq)) {
        onRejectedCanonicalMutation(requestSeq);
      }
      return result;
      } finally {
        setSavingFactKey(null);
        endSavePerf();
        setClarifyWritePending(false);
        setPendingReadinessWrites((count) => Math.max(0, count - 1));
      }
      })();
      pendingWriteTrackerRef.current.trackAction(work);
      return work.then(() => undefined);
    },
    [
      onRejectedCanonicalMutation,
      project.id,
      runSerializedFactMutation,
      settleCanonicalMutation,
      releaseGenerateFeedback,
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
      setPendingReadinessWrites((count) => count + 1);
      const requestSeq = ++factMutationSeqRef.current;
      overlaySeqByConstraintRef.current.set(input.key, requestSeq);
      const work = (async () => {
        try {
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
            return result;
          }
          setLiveConstraints((prev) => {
            const next = prev.filter((row) => row.key !== input.key);
            next.push({
              id: prev.find((row) => row.key === input.key)?.id ?? input.key,
              key: input.key,
              label: input.label,
              value: input.value,
              source: "user",
            });
            return next;
          });
          if (!settleCanonicalMutation(result, requestSeq)) {
            onRejectedCanonicalMutation(requestSeq);
          }
          return result;
        } finally {
          setSavingConstraintKey(null);
          setPendingReadinessWrites((count) => Math.max(0, count - 1));
        }
      })();
      pendingWriteTrackerRef.current.trackAction(work, {
        requestSeq,
        keys: [`constraint:${input.key}`],
      });
      await work;
    },
    [
      onRejectedCanonicalMutation,
      project.id,
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

  const handleContinueManualPricing = useCallback(
    async (input?: { name: string; scopeDescription: string }) => {
      if (manualPricingInFlightRef.current) {
        return manualPricingInFlightRef.current;
      }
      const run = (async () => {
        setIsAddingWorkArea(true);
        setAddWorkAreaError(null);
        const result = await continueManualWorkToPricing({
          projectId: project.id,
          name: input?.name,
          scopeDescription: input?.scopeDescription,
        });
        if (result && "error" in result) {
          setAddWorkAreaError(result.error);
          setIsAddingWorkArea(false);
          return { success: false as const, error: result.error };
        }
        setIsAddingWorkArea(false);
        startTransition(() => {
          router.refresh();
        });
        return { success: true as const };
      })();
      manualPricingInFlightRef.current = run;
      try {
        return await run;
      } finally {
        manualPricingInFlightRef.current = null;
      }
    },
    [project.id, router]
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
      bridgeEstimateStaleAfterCanonicalWrite();
      if (!settleCanonicalMutation(result, requestSeq)) {
        onRejectedCanonicalMutation(requestSeq);
      }
    },
    [
      bridgeEstimateStaleAfterCanonicalWrite,
      onRejectedCanonicalMutation,
      project.id,
      router,
      runSerializedFactMutation,
      settleCanonicalMutation,
      tagOverlayFactSeq,
    ]
  );

  const handleClarifyBoolean = useCallback(
    (
      candidate: ClarifyCandidate,
      presentation: "INCLUDED" | "NOT_INCLUDED"
    ) => {
      const work = (async () => {
      const requestSeq = ++factMutationSeqRef.current;
      setClarifyWritePending(true);
      setPendingReadinessWrites((n) => n + 1);
      let result: AssistantActionState = { success: true };
      try {
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
          const factIdentity = overlayFactSemanticKey({
            work_area_id: candidate.workAreaId,
            key: candidate.write.factKey,
          });
          if (overlaySeqByFactRef.current.get(factIdentity) === requestSeq) {
            setJobPlanFactOverlay((prev) =>
              prev.filter((row) => overlayFactSemanticKey(row) !== factIdentity)
            );
          }
          return result;
        }
      } else if (candidate.factKey) {
        const value = presentation === "INCLUDED";
        const overlayRow = {
          key: candidate.factKey,
          work_area_id: candidate.workAreaId,
          value,
          source: "user" as const,
          wallTypeId: candidate.wallTypeId ?? undefined,
          openingId: candidate.openingId ?? undefined,
          nestedItemId:
            candidate.nestedItemId ?? candidate.wallTypeId ?? undefined,
          componentId:
            candidate.componentId ?? candidate.openingId ?? undefined,
        };
        tagOverlayFactSeq(overlayRow, requestSeq);
        const nestedWrite = Boolean(
          candidate.factKey &&
            candidate.workAreaId &&
            (isInternalWallsWallTypeWriteKey(candidate.factKey) ||
              isCeilingsPortionWriteKey(candidate.factKey))
        );
        setJobPlanFactOverlay((prev) =>
          nestedWrite
            ? appendJobPlanFactOverlay(prev, overlayRow)
            : overlayFact(prev, overlayRow)
        );
        result = await runSerializedFactMutation(() =>
          answerClarifySelectFact({
            projectId: project.id,
            workAreaId: candidate.workAreaId,
            key: candidate.factKey!,
            label: candidate.label,
            value,
            valueType: "boolean",
            wallTypeId: candidate.wallTypeId ?? undefined,
            openingId: candidate.openingId ?? undefined,
            nestedItemId: candidate.nestedItemId ?? candidate.wallTypeId ?? undefined,
            componentId: candidate.componentId ?? candidate.openingId ?? undefined,
          })
        );
        if (result.error) {
          setActionError(result.error);
          const factIdentity = overlayFactSemanticKey({
            work_area_id: candidate.workAreaId,
            key: candidate.factKey!,
            wallTypeId: candidate.wallTypeId,
            openingId: candidate.openingId,
            nestedItemId: candidate.nestedItemId,
            componentId: candidate.componentId,
          });
          if (overlaySeqByFactRef.current.get(factIdentity) === requestSeq) {
            setJobPlanFactOverlay((prev) =>
              prev.filter((row) => overlayFactSemanticKey(row) !== factIdentity)
            );
          }
          return result;
        }
      } else if (candidate.writeTarget === "CONSTRAINT" && candidate.questionKey) {
        const constraintKey = candidate.constraintKey ?? candidate.questionKey;
        const options = candidate.options ?? [];
        const yesNo = options.some((option) => /^yes$/i.test(option.trim()));
        const value =
          presentation === "INCLUDED"
            ? yesNo
              ? "Yes"
              : "Include"
            : yesNo
              ? "No"
              : "Not included";
        overlaySeqByConstraintRef.current.set(constraintKey, requestSeq);
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
        result = await runSerializedFactMutation(() =>
          answerClarifyConstraint({
            projectId: project.id,
            questionKey: candidate.questionKey,
            value,
          })
        );
        if (result.error) {
          setActionError(result.error);
          if (overlaySeqByConstraintRef.current.get(constraintKey) === requestSeq) {
            setLiveConstraints((prev) =>
              prev.filter((row) => row.key !== constraintKey)
            );
          }
          return result;
        }
      }
      if (!settleCanonicalMutation(result, requestSeq)) {
        onRejectedCanonicalMutation(requestSeq);
      }
      setActionError(null);
      return result;
      } finally {
        setClarifyWritePending(false);
        setPendingReadinessWrites((n) => Math.max(0, n - 1));
      }
      })();
      pendingWriteTrackerRef.current.trackAction(work);
      return work;
    },
    [
      onRejectedCanonicalMutation,
      project.id,
      runSerializedFactMutation,
      settleCanonicalMutation,
      tagOverlayFactSeq,
    ]
  );

  const handleClarifyValue = useCallback(
    (
      candidate: ClarifyCandidate,
      value: string | number | boolean | string[]
    ) => {
      const work = (async () => {
      const requestSeq = ++factMutationSeqRef.current;
      const isNumericOrText =
        candidate.inputType === "number" || candidate.inputType === "text";
      if (isNumericOrText) setClarifyWritePending(true);
      setPendingReadinessWrites((n) => n + 1);
      const valueType = persistClarifyValueType(candidate, value);
      try {
        if (candidate.writeTarget === "CONSTRAINT" && candidate.questionKey) {
          if (Array.isArray(value)) return { error: "Invalid fact update." };
          const constraintKey = candidate.constraintKey ?? candidate.questionKey;
          const disclosed = disclosedProjectConditionForNotSure(
            constraintKey,
            value
          );
          overlaySeqByConstraintRef.current.set(constraintKey, requestSeq);
          setLiveConstraints((prev) => [
            ...prev.filter((row) => row.key !== constraintKey),
            {
              id: constraintKey,
              key: constraintKey,
              label: candidate.label,
              value: disclosed ? disclosed.value : value,
              source: disclosed ? disclosed.source : "user",
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
            if (overlaySeqByConstraintRef.current.get(constraintKey) === requestSeq) {
              setLiveConstraints((prev) =>
                prev.filter((row) => row.key !== constraintKey)
              );
            }
            return result;
          }
          if (!settleCanonicalMutation(result, requestSeq)) {
            onRejectedCanonicalMutation(requestSeq);
          }
          setActionError(null);
          return result;
        }
        if (!candidate.factKey) return { error: "Invalid fact update." };
        const disclosed = disclosedAssumptionForNotSure(candidate.factKey, value);
        const overlayRow = {
          key: candidate.factKey,
          work_area_id: candidate.workAreaId,
          value: disclosed ? disclosed.value : value,
          source: (disclosed ? disclosed.source : "user") as "user" | "assumption",
          wallTypeId: candidate.wallTypeId ?? undefined,
          openingId: candidate.openingId ?? undefined,
          nestedItemId: candidate.nestedItemId ?? candidate.wallTypeId ?? undefined,
          componentId: candidate.componentId ?? candidate.openingId ?? undefined,
        };
        tagOverlayFactSeq(overlayRow, requestSeq);
        const nestedWrite = Boolean(
          candidate.factKey &&
            candidate.workAreaId &&
            (isInternalWallsWallTypeWriteKey(candidate.factKey) ||
              isCeilingsPortionWriteKey(candidate.factKey))
        );
        if (!isNumericOrText) {
          setJobPlanFactOverlay((prev) =>
            nestedWrite
              ? appendJobPlanFactOverlay(prev, overlayRow)
              : overlayFact(prev, overlayRow)
          );
        }
        if (nestedWrite && isNumericOrText) {
          setJobPlanFactOverlay((prev) =>
            appendJobPlanFactOverlay(prev, overlayRow)
          );
        }
        const result = await runSerializedFactMutation(() =>
          answerClarifySelectFact({
            projectId: project.id,
            workAreaId: candidate.workAreaId,
            key: candidate.factKey!,
            label: candidate.label,
            value,
            valueType,
            wallTypeId: candidate.wallTypeId ?? undefined,
            openingId: candidate.openingId ?? undefined,
            nestedItemId: candidate.nestedItemId ?? candidate.wallTypeId ?? undefined,
            componentId: candidate.componentId ?? candidate.openingId ?? undefined,
          })
        );
        if (result.error) {
          setActionError(result.error);
          const factIdentity = overlayFactSemanticKey({
            work_area_id: candidate.workAreaId,
            key: candidate.factKey!,
            wallTypeId: candidate.wallTypeId,
            openingId: candidate.openingId,
          });
          if (overlaySeqByFactRef.current.get(factIdentity) === requestSeq) {
            setJobPlanFactOverlay((prev) =>
              prev.filter((row) => overlayFactSemanticKey(row) !== factIdentity)
            );
          }
          return result;
        }
        if (isNumericOrText && !nestedWrite) {
          setJobPlanFactOverlay((prev) => overlayFact(prev, overlayRow));
        }
        if (!settleCanonicalMutation(result, requestSeq)) {
          onRejectedCanonicalMutation(requestSeq);
        }
        setActionError(null);
        return result;
      } finally {
        setClarifyWritePending(false);
        setPendingReadinessWrites((n) => Math.max(0, n - 1));
      }
      })();
      pendingWriteTrackerRef.current.trackAction(work);
      return work;
    },
    [
      onRejectedCanonicalMutation,
      project.id,
      runSerializedFactMutation,
      settleCanonicalMutation,
      tagOverlayFactSeq,
    ]
  );

  const handleJobPlanSpecFact = useCallback(
    (input: {
      workAreaId: string;
      key: string;
      label: string;
      value: string | number;
      valueType: "number" | "select" | "text";
    }) => {
      const requestSeq = ++factMutationSeqRef.current;
      const identity = specFactIdentity(input.workAreaId, input.key);
      const work = (async () => {
      setPendingReadinessWrites((count) => count + 1);
      setClarifyWritePending(true);
      trackSavingSpecKey(input.key, 1);
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
      const replay: FailedSpecReplay = { kind: "fact", seq: requestSeq, input };
      try {
        const result = await runSerializedFactMutation(() =>
          settleSaveRequest(
            updateProjectFact({
              projectId: project.id,
              workAreaId: input.workAreaId,
              key: input.key,
              label: input.label,
              value: input.value,
              valueType: input.valueType,
            })
          )
        );
        if (!result || result.error) {
          const message = saveErrorCopy(result?.error);
          const overlaySeq = overlaySeqByFactRef.current.get(identity) ?? requestSeq;
          if (requestSeq >= overlaySeq) {
            failedSpecSavesRef.current.set(identity, replay);
            setFailedSpecSaveCount(failedSpecSavesRef.current.size);
            setActionError(message);
            releaseGenerateFeedback();
          }
          return { error: message };
        }
        const overlaySeq = overlaySeqByFactRef.current.get(identity) ?? requestSeq;
        if (requestSeq < overlaySeq) return result;
        const failed = failedSpecSavesRef.current.get(identity);
        if (failed && requestSeq >= failed.seq) {
          failedSpecSavesRef.current.delete(identity);
          setFailedSpecSaveCount(failedSpecSavesRef.current.size);
          if (
            failedSpecSavesRef.current.size === 0 &&
            !generateFailureStickyRef.current &&
            !generateLockRef.current.locked
          ) {
            setActionError(null);
          }
        }
        releaseGenerateFeedback();
        if (!settleCanonicalMutation(result, requestSeq)) {
          onRejectedCanonicalMutation(requestSeq);
        }
        return result;
      } catch (error) {
        const message = saveErrorCopy(error instanceof Error ? error.message : null);
        const overlaySeq = overlaySeqByFactRef.current.get(identity) ?? requestSeq;
        if (requestSeq >= overlaySeq) {
          failedSpecSavesRef.current.set(identity, replay);
          setFailedSpecSaveCount(failedSpecSavesRef.current.size);
          setActionError(message);
          releaseGenerateFeedback();
        }
        return { error: message };
      } finally {
        setClarifyWritePending(false);
        setPendingReadinessWrites((count) => Math.max(0, count - 1));
        trackSavingSpecKey(input.key, -1);
      }
      })();
      pendingWriteTrackerRef.current.trackAction(work, {
        requestSeq,
        keys: [identity],
      });
      return work;
    },
    [
      onRejectedCanonicalMutation,
      project.id,
      runSerializedFactMutation,
      releaseGenerateFeedback,
      settleCanonicalMutation,
      tagOverlayFactSeq,
      trackSavingSpecKey,
    ]
  );

  const handleJobPlanSpecFacts = useCallback(
    (input: {
      workAreaId: string;
      facts: readonly {
        key: string;
        label: string;
        value: string | number;
        valueType: "number" | "select" | "text";
      }[];
    }) => {
      const requestSeq = ++factMutationSeqRef.current;
      const identities = input.facts.map((fact) =>
        specFactIdentity(input.workAreaId, fact.key)
      );
      const replay: FailedSpecReplay = { kind: "facts", seq: requestSeq, input };
      const work = (async () => {
        setPendingReadinessWrites((count) => count + 1);
        setClarifyWritePending(true);
        for (const fact of input.facts) trackSavingSpecKey(fact.key, 1);
        const rows = input.facts.map((fact) => ({
          key: fact.key,
          work_area_id: input.workAreaId,
          value: fact.value,
          source: "user" as const,
        }));
        for (const row of rows) tagOverlayFactSeq(row, requestSeq);
        setJobPlanFactOverlay((prev) => rows.reduce((next, row) => overlayFact(next, row), prev));
        try {
          const result = await runSerializedFactMutation(() =>
            settleSaveRequest(
              updateProjectFacts({
                projectId: project.id,
                workAreaId: input.workAreaId,
                facts: input.facts.map((fact) => ({
                  key: fact.key,
                  label: fact.label,
                  value: fact.value,
                  valueType: fact.valueType,
                })),
              })
            )
          );
          if (!result || result.error) {
            const message = saveErrorCopy(result?.error);
            for (const identity of identities) {
              const overlaySeq = overlaySeqByFactRef.current.get(identity) ?? requestSeq;
              if (requestSeq >= overlaySeq) {
                failedSpecSavesRef.current.set(identity, replay);
              }
            }
            if ([...failedSpecSavesRef.current.values()].includes(replay)) {
              setFailedSpecSaveCount(failedSpecSavesRef.current.size);
              setActionError(message);
              releaseGenerateFeedback();
            }
            return { error: message };
          }
          const stale = identities.some((identity) => {
            const overlaySeq = overlaySeqByFactRef.current.get(identity) ?? requestSeq;
            return requestSeq < overlaySeq;
          });
          if (stale) return result;
          for (const identity of identities) {
            const failed = failedSpecSavesRef.current.get(identity);
            if (failed && requestSeq >= failed.seq) {
              failedSpecSavesRef.current.delete(identity);
            }
          }
          setFailedSpecSaveCount(failedSpecSavesRef.current.size);
          if (
            failedSpecSavesRef.current.size === 0 &&
            !generateFailureStickyRef.current &&
            !generateLockRef.current.locked
          ) {
            setActionError(null);
          }
          releaseGenerateFeedback();
          if (!settleCanonicalMutation(result, requestSeq)) {
            onRejectedCanonicalMutation(requestSeq);
          }
          return result;
        } catch (error) {
          const message = saveErrorCopy(error instanceof Error ? error.message : null);
          for (const identity of identities) {
            const overlaySeq = overlaySeqByFactRef.current.get(identity) ?? requestSeq;
            if (requestSeq >= overlaySeq) {
              failedSpecSavesRef.current.set(identity, replay);
            }
          }
          if ([...failedSpecSavesRef.current.values()].includes(replay)) {
            setFailedSpecSaveCount(failedSpecSavesRef.current.size);
            setActionError(message);
            releaseGenerateFeedback();
          }
          return { error: message };
        } finally {
          setClarifyWritePending(false);
          setPendingReadinessWrites((count) => Math.max(0, count - 1));
          for (const fact of input.facts) trackSavingSpecKey(fact.key, -1);
        }
      })();
      pendingWriteTrackerRef.current.trackAction(work, {
        requestSeq,
        keys: identities,
      });
      return work;
    },
    [
      onRejectedCanonicalMutation,
      project.id,
      runSerializedFactMutation,
      releaseGenerateFeedback,
      settleCanonicalMutation,
      tagOverlayFactSeq,
      trackSavingSpecKey,
    ]
  );

  useEffect(() => {
    replayFailedSpecSavesRef.current = () => {
      const seen = new Set<FailedSpecReplay>();
      for (const row of failedSpecSavesRef.current.values()) {
        if (seen.has(row)) continue;
        seen.add(row);
        if (row.kind === "fact") handleJobPlanSpecFact(row.input);
        else void handleJobPlanSpecFacts(row.input);
      }
    };
  }, [handleJobPlanSpecFact, handleJobPlanSpecFacts]);

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
        onRejectedCanonicalMutation(requestSeq);
      }
    },
    [
      onRejectedCanonicalMutation,
      project.id,
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

  useEffect(() => {
    const hasEstimateNow = Boolean(estimate);
    if (
      hasEstimateNow &&
      !sawEstimateRef.current &&
      generateFailureStickyRef.current
    ) {
      generateFailureStickyRef.current = false;
      setGenerateNotice(null);
      setRevealConstraintKey(null);
      setGenerateReturnFocusId(null);
      setIsGenerating(false);
    }
    sawEstimateRef.current = hasEstimateNow;
  }, [estimate]);

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
          source: row.source,
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
        constraints: liveConstraints
          .filter((row) => row.key !== revealConstraintKey)
          .map((row) => ({
            key: row.key,
            value: row.value,
            source: row.source,
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
      revealConstraintKey,
      stage,
    ]
  );

  const deckDetailGaps = useMemo(
    () =>
      deckDetailGapsForAreas(
        jobPlanFacts,
        displayWorkAreas.map((area) => ({ id: area.id, type: area.type }))
      ),
    [displayWorkAreas, jobPlanFacts]
  );
  const estimateReadiness = useMemo(() => {
    const base = composeEstimateReadiness({
      clarify: clarifyView,
      jobPlan,
      qualityLevel: qualityLevel ?? project.qualityLevel,
      constraints: liveConstraints.map((row) => ({
        key: row.key,
        value: row.value,
        source: row.source,
      })),
      pendingWrites: pendingReadinessWrites,
    });
    const postHoleCount = settledPostHoleAnswerCount({
      workConfirmed: isStageAtOrBeyond(stage, "quality"),
      workSavePending: pendingAction === "work_areas",
      gaps: estimate ? [] : deckDetailGaps,
    });
    if (postHoleCount === 0 || estimate) return base;
    return {
      ...base,
      canInitiateGenerate: false,
      enoughToEstimate: false,
      blockerCopy: deckDetailGapCopy(deckDetailGaps),
      checks: [...deckDetailGaps.map((gap) => gap.label), ...base.checks],
    };
  }, [
    clarifyView,
    deckDetailGaps,
    estimate,
    pendingAction,
    pendingReadinessWrites,
    stage,
    jobPlan,
    liveConstraints,
    project.qualityLevel,
    qualityLevel,
  ]);

  // Keep the generate snapshot current for the click handler. This assignment
  // predates this presentation change.
  // eslint-disable-next-line react-hooks/refs -- event-handler snapshot, not render output
  generateAuthorityRef.current = {
    stage,
    briefText: briefText || project.briefText,
    qualityLevel: qualityLevel ?? project.qualityLevel,
    workAreas: displayWorkAreas,
    facts: jobPlanFacts,
    constraints: liveConstraints.map((row) => ({
      key: row.key,
      value: row.value,
    })),
  };

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
          source: row.source,
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
    ? workAreasConfirmed && !estimateReady && estimateReadiness.enoughToEstimate
    : constraintsSubmitted &&
      !estimateReady &&
      (!preferProjectConditionsAsk || projectConditionsReadyToGenerate);
  const postHoleCount = settledPostHoleAnswerCount({
    workConfirmed: workAreasConfirmed,
    workSavePending: pendingAction === "work_areas",
    gaps: estimate ? [] : deckDetailGaps,
  });
  const postHolesSettled =
    workAreasConfirmed && pendingAction !== "work_areas";
  const deckStillOpening =
    !estimate && deckDetailGaps.length > 0 && !postHolesSettled;
  const savingDetails =
    pendingReadinessWrites > 0 || pendingAction === "work_areas";
  const detailsJourney = settleDetailsJourney({
    workConfirmed: workAreasConfirmed && !deckStillOpening,
    pendingWrites: savingDetails ? 1 : 0,
    requiredClarifyCount: clarifyView.remainingRequiredCount,
    postHoleCount,
    postHoleGaps: estimate ? [] : deckDetailGaps,
    optionalRefineCount: refineView.highValue.length,
  });
  const detailsPhase = detailsReadinessPhase({
    pendingWrites: detailsJourney.phase === "saving" ? 1 : 0,
    enoughToEstimate: detailsJourney.phase === "ready",
  });
  const generateBlockedReady =
    Boolean(generateNotice) && detailsJourney.phase === "ready";
  const detailsStatusLabel = generateBlockedReady
    ? "Try again"
    : detailsStageStatusLabel(detailsPhase, detailsJourney.requiredRemaining);
  const deckReadySummary = compactDeckReadySummary({
    facts: jobPlanFacts,
    workAreaId: displayWorkAreas.find((area) => area.type === "deck")?.id ?? "",
  });
  const holdCreateEstimate =
    postHolesSettled &&
    !estimateReady &&
    postHoleCount === 0 &&
    clarifyView.remainingRequiredCount === 0 &&
    (estimateReadiness.canInitiateGenerate || savingDetails);
  const [detailsPostHoleFocus, setDetailsPostHoleFocus] = useState<{
    gapId: string;
    nonce: number;
  } | null>(null);
  const openDeckDetails = useCallback(() => {
    const target = firstDeckDetailTarget(
      jobPlanFacts,
      displayWorkAreas.map((area) => ({ id: area.id, type: area.type }))
    );
    if (!target) {
      openEditJob("job_plan");
      return;
    }
    if (CLARIFY_IS_PRIMARY) {
      setDetailsPostHoleFocus({ gapId: target.gapId, nonce: Date.now() });
      return;
    }
    openEditJob("job_plan", {
      kind: "POST_HOLES",
      section: "job_plan",
      workAreaId: target.workAreaId,
      gapId: target.gapId,
    });
  }, [displayWorkAreas, jobPlanFacts, openEditJob]);

  // Derived stale: canonical server isStale OR local latency bridge.
  // Do not treat a fresh server render as clearing the bridge — that is the
  // router.refresh() race. Successful regenerate clears localEstimateStale.
  const displayEstimateStale =
    Boolean(estimate) &&
    (Boolean(estimate?.isStale) || localEstimateStale);
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
      ? `Work confirmed · ${detailsStatusLabel}`
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
    qualityTitle:
      CLARIFY_IS_PRIMARY && workAreasConfirmed
        ? detailsStatusLabel
        : qualityLevel
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
      facts: jobPlanFacts,
      briefText: briefText || project.briefText,
    });
  }, [
    completedEstimateAttentionItems,
    displayEstimateStale,
    displayWorkAreas,
    estimate,
    generationProjection?.requirementSnapshotRequirements,
    initialState.requirementSnapshotRequirements,
    jobPlanFacts,
    briefText,
    project.briefText,
  ]);

  const commercialBreakdown = useMemo(
    () => projectCommercialOverviewBreakdown(builderReviewView),
    [builderReviewView]
  );

  const deckCountConflict = useMemo(
    () =>
      estimate
        ? deckStatedCountConflict({
            facts: jobPlanFacts,
            lines: estimate.lineItems,
          })
        : null,
    [estimate, jobPlanFacts]
  );
  const deckCountSummary = deckCountConflict?.summary ?? null;
  const productivityReviewDetail = productivityScopeReviewBlock(
    (estimate?.lineItems ?? []).map((item) => item.notes)
  );
  const stageReviewDetail = deckCountSummary ?? productivityReviewDetail;
  if (
    estimateNavProjection &&
    estimateNavProjection.quantityConflictDetail !== stageReviewDetail
  ) {
    estimateNavProjection.setQuantityConflictDetail(stageReviewDetail);
  }
  useEffect(() => {
    if (!canRunEstimates) {
      estimateNavProjection?.setEstimateUpdate(null);
      return;
    }
    estimateNavProjection?.setEstimateUpdate(() => {
      handleRegenerateEstimate();
    });
    return () => estimateNavProjection?.setEstimateUpdate(null);
  }, [canRunEstimates, estimateNavProjection, handleRegenerateEstimate]);

  const productivityDecisions = useMemo(() => {
    const seen = new Set<string>();
    return (estimate?.lineItems ?? []).flatMap((item) => {
      const parsed = parseScopeReview(item.notes);
      if (!parsed) return [];
      const posts = parsed.factKey === DECK_POSTS_INSTALL_CONFIRM_FACT;
      const concrete = parsed.factKey === DECK_CONCRETE_PLACE_CONFIRM_FACT;
      if (!posts && !concrete) return [];
      const workAreaId =
        item.workAreaId ??
        displayWorkAreas.find((area) => area.name === item.workAreaName)?.id;
      if (!workAreaId) return [];
      const decisionKey = `${workAreaId}:${parsed.factKey}`;
      if (seen.has(decisionKey)) return [];
      seen.add(decisionKey);
      const hours = item.productivityRate ?? 0;
      const quantity = item.quantity ?? 0;
      const beforeAccess = Math.round(hours * quantity * 100) / 100;
      const afterAccess =
        item.labourHours != null && item.labourHours > 0
          ? item.labourHours
          : beforeAccess;
      const accessFactor = beforeAccess > 0 ? afterAccess / beforeAccess : 1;
      const storedHours = deckProductivityPhrase(
        hours,
        item.componentKey,
        item.productivityUnit ?? item.unit
      );
      const alternativeHours = posts
        ? DECK_POST_SET_HOURS
        : DECK_CONCRETE_PLACE_BENCHMARK_HOURS;
      const alternativeBefore = Math.round(alternativeHours * quantity * 100) / 100;
      const alternativeAfter = Math.round(alternativeBefore * accessFactor * 100) / 100;
      const alternativePhrase = posts ? "0.5 h/post" : "4 min/bag";
      const quantityLabel = posts
        ? `${formatQuantity(quantity)} posts`
        : `${formatQuantity(quantity)} bags`;
      return [
        {
          id: item.id,
          workAreaId,
          title: posts ? "Pile and post setting" : "Concrete placement",
          rateUnit: posts ? "h/post" : "h/bag",
          source: "Company calibration",
          storedHours,
          alternativePhrase,
          alternativeScope: posts
            ? DECK_POST_SET_SCOPE
            : "Approved Quotr placement is 4 person-minutes per 20 kg bag.",
          task: posts ? DECK_POSTS_CALIBRATION_TASK : DECK_CONCRETE_CALIBRATION_TASK,
          quantityLabel,
          projectedHours: `${formatLabourHours(beforeAccess)} h before access`,
          alternativeHours: `${formatLabourHours(alternativeBefore)} h before access`,
          calculation: `Stored ${storedHours} versus Quotr ${alternativePhrase}. ${quantityLabel} → ${formatLabourHours(beforeAccess)} h versus ${formatLabourHours(alternativeBefore)} h before access.`,
          reason: posts ? DECK_POSTS_CALIBRATION_REASON : DECK_CONCRETE_CALIBRATION_REASON,
          factKey: parsed.factKey,
          value: parsed.value,
          jobFactKey: parsed.jobFactKey,
          benchmarkLabel: "Use Quotr rate",
          benchmarkValue: "quotr-benchmark",
          itemKey: item.itemKey ?? (posts
            ? "deck.posts.install.hours_per_ea"
            : "deck.post_hole_concrete.place.hours_per_bag"),
          beforeAccessLabel: `${formatLabourHours(beforeAccess)} h`,
          afterAccessLabel: `${formatLabourHours(afterAccess)} h`,
          alternativeBeforeLabel: `${formatLabourHours(alternativeBefore)} h`,
          alternativeAfterLabel: `${formatLabourHours(alternativeAfter)} h`,
        },
      ];
    });
  }, [displayWorkAreas, estimate]);

  const openedProductivityKey = useRef("");
  useEffect(() => {
    const key = productivityDecisions.map((row) => `${row.id}:${row.value}`).join("|");
    if (!productivityReviewDetail || !key) return;
    if (openedProductivityKey.current === key) return;
    openedProductivityKey.current = key;
    setProductivityReviewOpen(true);
  }, [productivityDecisions, productivityReviewDetail]);

  const applyProductivityDecisions = useCallback(
    async (selections: readonly DeckProductivitySelection[]) => {
      if (productivityApplyLockRef.current) {
        return { error: "This update is already running." };
      }
      const workAreaId = selections[0]?.decision.workAreaId;
      if (!workAreaId) {
        return { error: "The productivity review could not be loaded." };
      }
      productivityApplyLockRef.current = true;
      setProductivityCoverId(null);
      setProductivityProgress("saving");
      setIsRegenerating(true);
      const decisions = selections.map((selection) => ({
        factKey: selection.decision.factKey,
        jobFactKey: selection.decision.jobFactKey,
        expectedToken: selection.decision.value,
        itemKey: selection.decision.itemKey,
        choice: selection.choice,
        jobHours: selection.jobHours,
      }));
      let saved:
        | { priors: Parameters<typeof restoreDeckProductivityDecisions>[0]["priors"]; wasStale: boolean }
        | null = null;
      let holdCover = false;
      try {
        const result = await settleSaveRequest(
          saveDeckProductivityDecisions({
            projectId: project.id,
            workAreaId,
            estimateId: generationProjection?.estimateId,
            decisions,
          }),
          PRODUCTIVITY_APPLY_TIMEOUT_MS
        );
        if (!result || "error" in result) {
          return {
            error: result && "error" in result ? result.error : "The productivity choice was not saved.",
          };
        }
        saved = { priors: result.priors, wasStale: result.wasStale };
        setProductivityProgress("updating");
        setLocalEstimateStale(true);
        const regenerated = await settleSaveRequest(
          regenerateStaticEstimate(project.id),
          PRODUCTIVITY_APPLY_TIMEOUT_MS
        );
        if (regenerated.error && !regenerated.estimateGeneration) {
          await restoreDeckProductivityDecisions({
            projectId: project.id,
            workAreaId,
            priors: result.priors,
            wasStale: result.wasStale,
          });
          setLocalEstimateStale(result.wasStale);
          return { error: regenerated.error };
        }
        const actionResult = await runAction("regenerate", async () => regenerated);
        if (actionResult?.error) return { error: actionResult.error };
        const generation = regenerated.estimateGeneration;
        const appliedId = appliedGenerationRef.current?.generationId;
        if (
          !generation ||
          generation.generationId !== appliedId ||
          generation.stale ||
          !productivityEstimateVisible(generation.estimate)
        ) {
          return { error: "The estimate was saved but did not open. Try again." };
        }
        holdCover = true;
        setProductivityReviewOpen(false);
        setProductivityCoverId(generation.generationId);
        return {};
      } catch (error) {
        if (saved) setLocalEstimateStale(true);
        return {
          error: error instanceof Error ? error.message : "The productivity choice was not saved.",
        };
      } finally {
        if (!holdCover) {
          productivityApplyLockRef.current = false;
          setProductivityCoverId(null);
          setProductivityProgress(null);
          setIsRegenerating(false);
        }
      }
    },
    [generationProjection?.estimateId, project.id, runAction]
  );

  useEffect(() => {
    if (!productivityCoverId) return;
    if (generationProjection?.generationId !== productivityCoverId) return;
    if (displayEstimateStale || !commercialBreakdown) return;
    if (!productivityEstimateVisible(estimate)) return;
    productivityApplyLockRef.current = false;
    setProductivityCoverId(null);
    setProductivityProgress(null);
    setIsRegenerating(false);
  }, [
    commercialBreakdown,
    displayEstimateStale,
    estimate,
    generationProjection,
    productivityCoverId,
  ]);

  const estimateOverview = projectEstimateOverview({
        hasEstimate: Boolean(estimate),
        isStale: displayEstimateStale,
        detailsOutstanding:
          !estimate &&
          (estimateReadiness.blocksEstimate || !estimateReadiness.enoughToEstimate),
        estimate: estimate
          ? {
              recommendedSell: estimate.recommendedSell,
              recommendedCost: estimate.recommendedCost,
              grossProfit: estimate.grossProfit,
              marginPercent: estimate.marginPercent,
              markupPercent: estimate.markupPercent,
            }
          : null,
        gstRate: initialState.defaultGstRate,
        breakdown: commercialBreakdown,
        review: builderReviewView,
        readinessBlockers: estimate
          ? []
          : [estimateReadiness.blockerCopy, ...estimateReadiness.checks].filter(
              (row): row is string => Boolean(row && row.trim())
            ),
        rateSourceSummary: estimate?.rateSourceSummary ?? null,
        pricingDocumentExists: Boolean(pricingSummary),
        specialistPricingNotice:
          estimate && estimateReadiness.specialistPricingRequired
            ? estimateReadiness.heading
            : null,
        workAreaNames: workAreaLists.included,
        statedCountConflictDetail: deckCountConflict?.summary ?? null,
        productivityReviewDetail,
      });

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

  const estimateScope = jobPlan.cards.map((card) => ({
    workAreaId: card.workAreaId,
    name: card.name,
    included: card.included.map((item) => item.label),
    excluded: card.notIncluded.map((item) => item.label),
  }));
  const estimateRegenerate =
    canRunEstimates && displayEstimateStale ? handleRegenerateEstimate : undefined;
  const estimateRegenerateLabel =
    estimateOverview.primary === "regenerate" ? estimateOverview.primaryLabel : undefined;
  const estimatePricing =
    canRunEstimates &&
    estimateOverview.primary === "continue_pricing" &&
    !estimateOverview.pricingCreationBlocked &&
    estimateOverview.pricingEntry !== "blocked"
      ? {
          projectId: project.id,
          estimateId: generationProjection?.estimateId,
          pricingDocumentId: pricingSummary?.id ?? null,
          entry: estimateOverview.pricingEntry,
          label: estimateOverview.primaryLabel,
        }
      : null;

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
      {productivityProgress ? (
        <QuotrLoader
          status={productivityApplyProgressCopy(productivityProgress)}
          generateStage={productivityProgress}
          className="z-[60]"
        />
      ) : isRegenerating ? (
        <GenerateEstimateStatus stage="building" startedAt={regenerateStartedAt} />
      ) : null}
      <AssistantProgress
        currentStage={stage}
        preferProjectConditionsLabel={preferProjectConditionsAsk}
        deemphasised={assistantMode !== "planning"}
      />

      {actionError && (briefSubmitted || actionDenial) ? (
        actionDenial ? (
          <BillingAccessDenied
            error={actionError}
            reasonCode={actionDenial.reasonCode}
            upgradeTarget={actionDenial.upgradeTarget}
            className="mt-3 lg:mt-4"
          />
        ) : (
          <p className="mt-3 text-sm text-destructive lg:mt-4" role="alert">
            {actionError}
          </p>
        )
      ) : null}

      <div
        className={cn(
          assistantMode === "estimate_ready"
            ? "grid min-w-0 gap-3 lg:items-start"
            : "mt-2 grid min-w-0 gap-3 lg:mt-3 lg:items-start",
          assistantMode === "planning" &&
            briefSubmitted &&
            "lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[200px_minmax(0,1fr)_380px]",
          assistantMode === "planning" &&
            !briefSubmitted &&
            "xl:grid-cols-[200px_minmax(0,1fr)]",
          estimateReadySidebarPolicy(assistantMode).singleColumn && "grid-cols-1",
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
            <div className="sticky top-0">
              <StepperNav
                currentStage={stage}
                needsAttention={stepperAttention}
                stepSummaries={stepperSummaries}
                preferProjectConditionsLabel={preferProjectConditionsAsk}
              />
            </div>
          </aside>
        ) : null}

        <div
          className="order-2 min-w-0 space-y-3 lg:order-none lg:space-y-2.5 overflow-x-hidden"
          data-active-task={
            assistantMode === "planning" && !estimate && !briefSubmitted
              ? "job-details"
              : undefined
          }
        >
          {assistantMode === "estimate_ready" && estimate ? (
            <EstimateReadySurface
              projectId={project.id}
              estimateId={generationProjection?.estimateId}
              isStale={displayEstimateStale}
              isRegenerating={updatingEstimate}
              pricingCtaEnabled={
                canRunEstimates &&
                !pricingSummary &&
                !deckCountConflict &&
                (refineAfterEstimateOpen || builderReviewOpen)
              }
              pricingCtaPrimary={builderReviewCompleted}
              reviewOpen={builderReviewOpen}
            >
              {refineAfterEstimateOpen && refineView.hasCandidates ? (
                <RefineEstimatePanel
                  view={refineView}
                  isSaving={Boolean(savingFactKey) || clarifyWritePending}
                  persistError={actionError}
                  canEstimateNow={false}
                  focusKey={refineAfterEstimateFocusKey}
                  isStale={displayEstimateStale}
                  isRegenerating={updatingEstimate}
                  updateError={actionError}
                  onUpdateEstimate={
                    canRunEstimates && displayEstimateStale
                      ? handleRegenerateEstimate
                      : undefined
                  }
                  onDone={closeRefineAfterEstimate}
                  onAnswerBoolean={handleClarifyBoolean}
                  onAnswerValue={handleClarifyValue}
                  onWallTypeAction={(workAreaId, key, value, label, wallTypeId, openingId) =>
                    handleFactSave({
                      workAreaId,
                      key,
                      label,
                      value,
                      inputType: typeof value === "boolean" ? "boolean" : "text",
                      wallTypeId,
                      openingId,
                    })
                  }
                />
              ) : builderReviewOpen && builderReviewView ? (
                <BuilderReviewSurface
                  view={builderReviewView}
                  isRegenerating={updatingEstimate}
                  projectId={project.id}
                  estimateId={generationProjection?.estimateId}
                  pricingDocumentId={pricingSummary?.id ?? null}
                  gstRate={initialState.defaultGstRate}
                  showContinueToPricing={
                    canRunEstimates &&
                    !pricingSummary &&
                    !displayEstimateStale &&
                    !deckCountConflict
                  }
                  onBack={() => setBuilderReviewOpen(false)}
                  onEditJob={canRunEstimates ? () => openEditJob(null) : undefined}
                  onRefine={canRunEstimates && refineView.hasCandidates ? () => {
                    openRefineAfterEstimate(null);
                  } : undefined}
                  onImprove={canRunEstimates ? (improvement) => {
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
                    openRefineAfterEstimate(
                      match?.semanticKey ??
                        match?.id ??
                        match?.factKey ??
                        match?.constraintKey ??
                        null
                    );
                  } : undefined}
                  onUpdateEstimate={
                    canRunEstimates && displayEstimateStale
                      ? handleRegenerateEstimate
                      : undefined
                  }
                  onChangeMaterial={canRunEstimates ? (workAreaId) => {
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
                  } : undefined}
                />
              ) : (
                <div data-estimate-view={estimateView} data-estimate-content-gap="12-16" className={cn("min-w-0 space-y-4 overflow-x-hidden", estimateView === "overview" && "max-md:has-[[data-estimate-overview-docked]]:pb-16")}>
                  {productivityProgress && estimateView !== "overview" ? (
                    <p
                      className="text-sm font-medium text-foreground"
                      role="status"
                      aria-live="polite"
                      data-productivity-progress={productivityProgress}
                    >
                      {productivityApplyProgressCopy(productivityProgress)}
                    </p>
                  ) : null}
                  <EstimateViewControl
                    view={estimateView}
                    onChange={setEstimateView}
                  />
                  {estimateView === "work_areas" && builderReviewView ? (
                    <WorkAreaBreakdown
                      view={builderReviewView}
                      scope={estimateScope}
                      focusWorkAreaId={focusWorkAreaId}
                      onFocusApplied={() => setFocusWorkAreaId(null)}
                      isRegenerating={updatingEstimate}
                      onEditJob={canRunEstimates ? () => openEditJob(null) : undefined}
                      onReviewWorkArea={
                        canRunEstimates ? () => openEditJob("job_plan") : undefined
                      }
                      onRegenerate={estimateRegenerate}
                      regenerateLabel={estimateRegenerateLabel}
                      pricing={estimatePricing}
                      onConfirmProductivity={
                        canRunEstimates
                          ? (workAreaId, key, value) =>
                              handleJobPlanSpecFact({
                                workAreaId,
                                key,
                                label:
                                  key === "deck.posts_install_hours_per_ea" ||
                                  key === "deck.concrete_place_hours_per_bag"
                                    ? "Revised productivity"
                                    : "Productivity scope",
                                value,
                                valueType: "text",
                              })
                          : undefined
                      }
                    />
                  ) : estimateView === "materials" && builderReviewView ? (
                    <MaterialsTakeoff
                      view={builderReviewView}
                      onViewWorkArea={openWorkArea}
                      isRegenerating={updatingEstimate}
                      onEditJob={canRunEstimates ? () => openEditJob(null) : undefined}
                      onReviewWorkArea={
                        canRunEstimates ? () => openEditJob("job_plan") : undefined
                      }
                      onRegenerate={estimateRegenerate}
                      regenerateLabel={estimateRegenerateLabel}
                      pricing={estimatePricing}
                    />
                  ) : estimateView === "labour" && builderReviewView ? (
                    <LabourTakeoff
                      view={builderReviewView}
                      onViewWorkArea={openWorkArea}
                      isRegenerating={updatingEstimate}
                      onEditJob={canRunEstimates ? () => openEditJob(null) : undefined}
                      onReviewWorkArea={
                        canRunEstimates ? () => openEditJob("job_plan") : undefined
                      }
                      onRegenerate={estimateRegenerate}
                      regenerateLabel={estimateRegenerateLabel}
                      pricing={estimatePricing}
                    />
                  ) : estimateView === "checks" && builderReviewView ? (
                    <AssumptionsChecks
                      view={builderReviewView}
                      isRegenerating={updatingEstimate}
                      onEditJob={canRunEstimates ? () => openEditJob(null) : undefined}
                      onReviewWorkArea={
                        canRunEstimates ? () => openEditJob("job_plan") : undefined
                      }
                      onRegenerate={estimateRegenerate}
                      regenerateLabel={estimateRegenerateLabel}
                      pricing={estimatePricing}
                    />
                  ) : (
                <>
                  <EstimateOverview
                    model={estimateOverview}
                    projectId={canRunEstimates ? project.id : undefined}
                    estimateId={generationProjection?.estimateId}
                    pricingDocumentId={pricingSummary?.id ?? null}
                    isRegenerating={updatingEstimate}
                    productivityProgress={productivityProgress}
                    onCompleteDetails={
                      canRunEstimates && estimateOverview.primary === "complete_details"
                        ? openDeckDetails
                        : undefined
                    }
                    onRegenerate={
                      canRunEstimates &&
                      (displayEstimateStale || estimateOverview.primary === "regenerate")
                        ? handleRegenerateEstimate
                        : undefined
                    }
                    onReviewProductivity={
                      canRunEstimates && estimateOverview.primary === "review_productivity"
                        ? () => setProductivityReviewOpen(true)
                        : undefined
                    }
                    onReviewEstimate={() => {
                      setEstimateView("work_areas");
                    }}
                    onViewWorkArea={openWorkArea}
                    onEditJob={canRunEstimates ? () => openEditJob(null) : undefined}
                    marginControl={
                      canRunEstimates && !displayEstimateStale ? (
                        <span data-mobile-margin-edit="true">
                          <MarginEditControl
                            marginPercent={estimate.marginPercent}
                            targetMarginPercent={estimate.targetMarginPercent}
                            defaultMarginPercent={initialState.defaultMarginPercent}
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
                        <p className="text-xs text-foreground/75" data-margin-save-label>
                          {marginSaveLabel}
                        </p>
                      ) : null
                    }
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <CompletedSetupDisclosure
                    className="min-w-0 flex-1"
                    summaryLine={setupSummaryLine}
                    chips={setupChips}
                    expanded={jobDetailsOpen}
                    onExpandedChange={setEstimateBasisOverride}
                  >
                    <div className="space-y-5 text-sm">
                      {estimateBasisBrief(briefText, project.briefText) ? (
                        <section>
                          <h3 className="text-sm font-semibold text-foreground">
                            Project brief
                          </h3>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
                            {estimateBasisBrief(briefText, project.briefText)}
                          </p>
                        </section>
                      ) : null}
                      <section>
                        <h3 className="text-sm font-semibold text-foreground">
                          Work areas
                        </h3>
                        <ul className="mt-2 space-y-1 text-sm leading-6 text-foreground">
                          {estimateBasisWorkAreas(workAreaLists.included).map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                        {jobPlan.cards.length > 0 && jobPlan.cards.some((c) => c.included.length > 0) ? (
                          <>
                            <h4 className="mt-3 text-sm font-semibold text-foreground">Scope</h4>
                            <ul className="mt-1 space-y-1 text-sm leading-6 text-foreground">
                              {jobPlan.cards.flatMap((c) =>
                                c.included.map((item) => (
                                  <li key={`${c.workAreaId}-${item.id}`}>
                                    {jobPlan.cards.length > 1 ? `${c.name}: ` : ""}
                                    {item.label}
                                  </li>
                                ))
                              )}
                            </ul>
                          </>
                        ) : null}
                      </section>
                      {qualityTitleLabel ? (
                        <section>
                          <h3 className="text-sm font-semibold text-foreground">
                            Finish level
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-foreground">{qualityTitleLabel}</p>
                        </section>
                      ) : null}
                      {liveConstraints.length > 0 ? (
                        <section>
                          <h3 className="text-sm font-semibold text-foreground">
                            Project conditions
                          </h3>
                          <dl className="mt-2 divide-y divide-border/70">
                            {liveConstraints.map((row) => (
                              <div
                                key={row.id}
                                className="grid gap-1 py-2 sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)] sm:gap-4"
                              >
                                <dt className="text-sm font-medium text-foreground/80">{row.label}</dt>
                                <dd className="whitespace-pre-wrap text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
                                  {String(row.value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </section>
                      ) : null}
                    </div>
                  </CompletedSetupDisclosure>
                  {canRunEstimates ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 min-h-11 shrink-0"
                      onClick={() => openEditJob(null)}
                    >
                      {ASSISTANT_ACTION_LABELS.editJobDetails}
                    </Button>
                  ) : null}
                  </div>
                </>
                  )}
                </div>
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
                canRunEstimates && displayEstimateStale
                  ? handleRegenerateEstimate
                  : undefined
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
                  onAddWorkArea={canUploadFiles ? handleAddWorkArea : undefined}
                  onAddManualWork={
                    canUploadFiles ? handleContinueManualPricing : undefined
                  }
                  manualScopeDefault={briefText}
                  onRemoveWorkArea={handleExcludeWorkArea}
                  focusWorkAreaId={jobPlanEditFocus?.workAreaId ?? null}
                  specFocusKey={jobPlanEditFocus?.specFocusKey ?? null}
                  scopeFocusItemId={jobPlanEditFocus?.scopeFocusItemId ?? null}
                  postHoleFocusId={jobPlanEditFocus?.postHoleFocusId ?? null}
                  onBooleanFact={(input) =>
                    handleFactSave({
                      workAreaId: input.workAreaId,
                      key: input.key,
                      label: input.label,
                      value: input.value,
                      inputType: "boolean",
                    })
                  }
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
            title="Job details"
            subtitle={
              briefSubmitted
                ? "What you told Quotr about the job."
                : "Add what you know. Quotr uses the description and site notes to identify the work."
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
              onBriefPersist={briefSubmitted ? undefined : persistJobDescription}
              projectId={project.id}
              initialNotes={initialNotes}
              totalNoteCount={totalNoteCount}
              pendingAnalysisCount={pendingAnalysisCount}
              onAnalyse={briefSubmitted ? undefined : handleAnalyseJob}
              disabled={pendingAction != null}
              isAnalysing={pendingAction === "brief"}
              submitted={briefSubmitted}
              analyseError={
                !briefSubmitted && actionError && !actionDenial
                  ? actionError
                  : null
              }
              onRetryAnalyse={handleAnalyseJob}
              documents={documents}
              canUploadFiles={canUploadFiles}
              workAreas={displayWorkAreas}
              onAddWorkArea={canUploadFiles ? handleAddWorkArea : undefined}
              isAddingWorkArea={isAddingWorkArea}
              addWorkAreaError={addWorkAreaError}
              canEditProject={canUploadFiles}
              onContinueManual={
                canUploadFiles ? handleContinueManualPricing : undefined
              }
            />
          </CollapsibleStageCard>
          )}

          {/* 2. Job Plan — primary Work Area + user-facing scope confirmation */}
          {briefSubmitted ? (
            <CollapsibleStageCard
              title="Here's the work I found"
              foundHeading
              subtitle={undefined}
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
                confirmError={workAreasIsCurrent ? actionError : null}
                onContinue={
                  workAreasConfirmed
                    ? undefined
                    : () => handleWorkAreasConfirm(displayWorkAreas)
                }
                onContinueManual={
                  workAreasConfirmed || !canUploadFiles
                    ? undefined
                    : () => {
                        void handleContinueManualPricing();
                      }
                }
                onAddManualWork={
                  workAreasConfirmed || !canUploadFiles
                    ? undefined
                    : handleContinueManualPricing
                }
                manualScopeDefault={briefText}
                onAddWorkArea={
                  workAreasConfirmed || !canUploadFiles
                    ? undefined
                    : handleAddWorkArea
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
              title="Details"
              subtitle={
                generateBlockedReady
                  ? generateNotice ?? undefined
                  : detailsJourney.phase === "needs_details"
                    ? detailsJourney.remainingCopy ??
                      detailsStageSubtitle(detailsJourney.phase)
                    : detailsStatusLabel
              }
              statusLabel={detailsStatusLabel}
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
                  pendingAction === "clarify" ||
                  pendingAction === "estimate" ||
                  clarifyWritePending ||
                  pendingReadinessWrites > 0
                }
                isGenerating={
                  pendingAction === "estimate" || isGenerating
                }
                generateStage={generateStage}
                generateStartedAt={generateStartedAt}
                persistError={actionError}
                detailsSaveFailed={failedSpecSaveCount > 0}
                generateNotice={generateNotice}
                returnFocusId={generateReturnFocusId}
                holdCreateEstimate={holdCreateEstimate}
                settledRemaining={detailsJourney.requiredRemaining}
                postHolesComplete={
                  !estimate &&
                  postHoleCount === 0 &&
                  clarifyView.remainingRequiredCount === 0
                }
                savingFactKeys={savingSpecKeys}
                allowCreateEstimate={detailsJourney.showCreateEstimate}
                readySummary={detailsJourney.phase === "ready" ? deckReadySummary : null}
                onAnswerBoolean={handleClarifyBoolean}
                onAnswerValue={handleClarifyValue}
                onEstimateNow={canRunEstimates ? handleGenerateEstimate : undefined}
                deckAreas={
                  estimate
                    ? []
                    : displayWorkAreas
                        .filter((area) => area.type === "deck")
                        .map((area) => ({
                          workAreaId: area.id,
                          name: area.name,
                          facts: jobPlanFacts,
                          onSpecFact: handleJobPlanSpecFact,
                          onSpecFacts: handleJobPlanSpecFacts,
                          focusGapId: detailsPostHoleFocus?.gapId ?? null,
                          focusNonce: detailsPostHoleFocus?.nonce ?? 0,
                          accessSuitable: spoilAccessAllowsAllowance(liveConstraints),
                          postHolesSettled:
                            workAreasConfirmed && pendingAction !== "work_areas",
                          onBooleanFact: (input: {
                            workAreaId: string;
                            key: string;
                            label: string;
                            value: boolean;
                          }) =>
                            handleFactSave({
                              workAreaId: input.workAreaId,
                              key: input.key,
                              label: input.label,
                              value: input.value,
                              inputType: "boolean",
                            }),
                        }))
                }
                onNestedItemAction={(workAreaId, key, value, nestedItemId) =>
                  handleFactSave({
                    workAreaId,
                    key,
                    label:
                      key.includes("duplicate")
                        ? "Duplicate ceiling portion"
                        : key.includes("delete")
                          ? "Remove ceiling portion"
                          : "Add ceiling portion",
                    value,
                    inputType: typeof value === "boolean" ? "boolean" : "text",
                    nestedItemId,
                  })
                }
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

        {estimateReadySidebarPolicy(assistantMode).mountsCommercialSidebar &&
        briefSubmitted ? (
        <div
          ref={estimatePanelAnchorRef}
          className="order-3 min-w-0 lg:order-none lg:self-start"
          data-quick-estimate-anchor
          data-estimate-guidance="after-active-task"
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
            isGenerating={
              isGenerating && !(CLARIFY_IS_PRIMARY && !estimateReady)
            }
            isRegenerating={updatingEstimate}
            isSavingMargin={isSavingMargin}
            marginSaveLabel={marginSaveLabel}
            defaultMarginPercent={initialState.defaultMarginPercent}
            defaultGstRate={initialState.defaultGstRate}
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
            detailsPhase={detailsPhase}
            detailsBlocker={estimateReadiness.blockerCopy}
            postHoleAnswerCount={detailsJourney.requiredRemaining}
            detailsActionLabel={detailsJourney.actionLabel}
            detailsOwnsCreate={CLARIFY_IS_PRIMARY && !estimate}
            readySummary={generateNotice}
            holdCreateEstimate={holdCreateEstimate}
            detailsSaving={savingDetails && holdCreateEstimate}
            onFinishPostHoles={openDeckDetails}
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
            compactCommercialSidebar={false}
            workAreasConfirmed={workAreasConfirmed}
            pricingProgressionPrimary={builderReviewCompleted}
            hidePricingProgression={builderReviewOpen}
            pricingBlockedDetail={
              quantityConflictStageStatus(deckCountConflict?.summary) ?? null
            }
            commercialBreakdown={commercialBreakdown}
            onViewBreakdown={() => {
              setBuilderReviewOpen(false);
              setBreakdownOpen(true);
            }}
            onGenerate={canRunEstimates ? handleGenerateEstimate : undefined}
            onRegenerate={canRunEstimates ? handleRegenerateEstimate : undefined}
            onMarginSave={undefined}
            onEditQuality={undefined}
            onReviewAttention={handleReviewAttention}
          />
        </div>
        ) : null}
      </div>

      <DeckProductivityReviewDialog
        open={productivityReviewOpen}
        decisions={productivityDecisions}
        pending={
          productivityProgress != null ||
          updatingEstimate ||
          pendingAction === "regenerate"
        }
        loadError={
          productivityReviewOpen &&
          productivityDecisions.length === 0 &&
          productivityReviewDetail
            ? "The productivity review could not be loaded."
            : null
        }
        onRetry={() => router.refresh()}
        onOpenChange={setProductivityReviewOpen}
        onApply={applyProductivityDecisions}
      />
      <EstimateBreakdownModal
        estimate={estimate}
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        onRegenerate={canRunEstimates ? handleRegenerateEstimate : undefined}
        isRegenerating={updatingEstimate}
        projectId={project.id}
      />
    </div>
  );
}
