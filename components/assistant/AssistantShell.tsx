"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { AssistantMessage } from "@/components/assistant/AssistantMessage";
import { AssistantProgress } from "@/components/assistant/AssistantProgress";
import { ProjectCaptureBlock } from "@/components/assistant/ProjectCaptureBlock";
import { BriefInput } from "@/components/assistant/BriefInput";
import { ConstraintBlock } from "@/components/assistant/ConstraintBlock";
import { EstimateBreakdownModal } from "@/components/assistant/EstimateBreakdownModal";
import { EstimatePanel } from "@/components/assistant/EstimatePanel";
import { QualityBlock } from "@/components/assistant/QualityBlock";
import {
  QuestionBlock,
  type QuestionAnswers,
} from "@/components/assistant/QuestionBlock";
import { ScopeSummaryBlock } from "@/components/assistant/ScopeSummaryBlock";
import type { QualityLevel, WorkArea, WorkAreaActiveQuestion } from "@/components/assistant/types";
import type { MissingQuestionAnswers } from "@/components/assistant/ScopeReviewMissingSection";
import { WorkAreaConfirmationBlock } from "@/components/assistant/WorkAreaConfirmationBlock";
import {
  confirmWorkAreas,
  generateStaticEstimate,
  regenerateStaticEstimate,
  saveBriefAndSeedWorkAreas,
  saveConstraints,
  saveQuality,
  saveQuestionBlockAnswers,
} from "@/lib/assistant/actions";
import { updateProjectConstraint } from "@/lib/assistant/constraint-actions";
import { updateProjectFact } from "@/lib/assistant/fact-actions";
import { updateEstimateMargin } from "@/lib/assistant/margin-actions";
import {
  addWorkAreaToProject,
  excludeWorkAreaFromProject,
} from "@/lib/assistant/work-area-actions";
import { isStageAtOrBeyond } from "@/lib/assistant/stage";
import type { AssistantState } from "@/lib/assistant/types";
import { SiteNotesPanel } from "@/components/project-notes/SiteNotesPanel";
import { NoteProposalReviewPanel } from "@/components/project-notes/NoteProposalReviewPanel";
import type { ProjectNote } from "@/lib/project-notes/types";
import type { NoteProposal } from "@/lib/project-notes/proposals/types";
import { Button } from "@/components/ui/button";

type AssistantShellProps = {
  initialState: AssistantState;
  initialNotes?: ProjectNote[];
  pendingNoteProposal?: NoteProposal | null;
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
  questions: { id: string; value?: string | number | boolean | null }[]
): QuestionAnswers {
  return Object.fromEntries(
    questions.map((q) => [q.id, q.value ?? null])
  );
}

export function AssistantShell({
  initialState,
  initialNotes = [],
  pendingNoteProposal = null,
}: AssistantShellProps) {
  const router = useRouter();
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
  const [workAreaQuestionError, setWorkAreaQuestionError] = useState<string | null>(
    null
  );
  const [breakdownOpen, setBreakdownOpen] = useState(false);

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
      setPendingAction(action);
      setActionError(null);

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
    },
    [router]
  );

  const handleAnalyseJob = useCallback(() => {
    void runAction("brief", () =>
      saveBriefAndSeedWorkAreas(project.id, briefText)
    );
  }, [briefText, project.id, runAction]);

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

    void runAction("quality", () =>
      saveQuality(project.id, qualityLevel)
    );
  }, [project.id, qualityLevel, runAction]);

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
    setIsGenerating(true);
    void runAction("estimate", () => generateStaticEstimate(project.id));
  }, [project.id, runAction]);

  const handleRegenerateEstimate = useCallback(() => {
    setIsRegenerating(true);
    void runAction("regenerate", () => regenerateStaticEstimate(project.id));
  }, [project.id, runAction]);

  const handleQuestionAnswer = useCallback(
    (questionId: string, value: string | number | boolean) => {
      setQuestionAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    []
  );

  const handleConstraintAnswer = useCallback(
    (questionId: string, value: string | number | boolean) => {
      setConstraintAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    []
  );

  const handleFactSave = useCallback(
    async (input: {
      workAreaId: string;
      key: string;
      label: string;
      value: string | number | boolean;
      unit?: string;
      inputType?: "number" | "select" | "boolean" | "text";
    }) => {
      const factKey = `${input.workAreaId}:${input.key}`;
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
        return;
      }

      router.refresh();
      setSavingFactKey(null);
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
      setSavingWorkAreaId(input.workAreaId);
      setWorkAreaQuestionError(null);
      setPendingAction("questions");

      const questionsByBlock = new Map<string, WorkAreaActiveQuestion[]>();
      for (const question of input.questions) {
        const existing = questionsByBlock.get(question.questionBlockId) ?? [];
        existing.push(question);
        questionsByBlock.set(question.questionBlockId, existing);
      }

      for (const [blockId, blockQuestions] of questionsByBlock) {
        const payload = blockQuestions.map((question) => ({
          question_id: question.id,
          value: input.answers[question.id] as string | number | boolean,
        }));

        const result = await saveQuestionBlockAnswers(
          project.id,
          blockId,
          payload
        );

        if (result.error) {
          setWorkAreaQuestionError(result.error);
          setSavingWorkAreaId(null);
          setPendingAction(null);
          return;
        }
      }

      router.refresh();
      setSavingWorkAreaId(null);
      setPendingAction(null);
    },
    [project.id, router]
  );

  const estimate = estimateReady ? initialState.estimate : null;
  const displayWorkAreas =
    workAreas.length > 0 ? workAreas : initialState.workAreas;

  const scopeReviewQuestionKey = useMemo(
    () =>
      initialState.scopeReview.workAreas
        .flatMap((workArea) => workArea.activeQuestions)
        .map((question) => `${question.id}:${question.value ?? ""}`)
        .join("|"),
    [initialState.scopeReview.workAreas]
  );

  return (
    <div data-project-id={project.id} className="w-full">
      <AssistantProgress currentStage={stage} />

      {actionError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <AssistantMessage
            title={briefSubmitted ? "Project brief" : "Project capture"}
            subtitle={
              briefSubmitted
                ? "Your job description and site notes used for analysis"
                : "Add a quick brief, site notes, measurements or client requests. Quotr will use this information to identify the work areas."
            }
            status={briefSubmitted ? "submitted" : "active"}
            badge={briefSubmitted ? "Complete" : "Current"}
          >
            {briefSubmitted ? (
              <div className="space-y-3">
                <BriefInput value={briefText} readOnly onSubmit={() => {}} />
                {initialNotes.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {initialNotes.length} site note
                    {initialNotes.length === 1 ? "" : "s"} included in analysis.
                  </p>
                ) : null}
              </div>
            ) : (
              <ProjectCaptureBlock
                briefText={briefText}
                onBriefChange={setBriefText}
                projectId={project.id}
                initialNotes={initialNotes}
                onAnalyse={handleAnalyseJob}
                disabled={pendingAction === "brief"}
                isAnalysing={pendingAction === "brief"}
              />
            )}
          </AssistantMessage>

          {briefSubmitted ? (
            <AssistantMessage
              title="Confirm work areas"
              subtitle="Review what we detected from your brief and site notes"
              status={
                workAreasConfirmed
                  ? "submitted"
                  : stage === "confirm_work_areas"
                    ? "active"
                    : "submitted"
              }
              badge={workAreasConfirmed ? "Complete" : undefined}
            >
              <WorkAreaConfirmationBlock
                workAreas={displayWorkAreas}
                submitted={workAreasConfirmed}
                isSaving={pendingAction === "work_areas"}
                onToggle={
                  workAreasConfirmed ? undefined : handleWorkAreaToggle
                }
                onConfirm={
                  workAreasConfirmed ? undefined : handleWorkAreasConfirm
                }
              />
            </AssistantMessage>
          ) : null}

          {workAreasConfirmed ? (
            <AssistantMessage
              title="Quality & spec level"
              subtitle="Set the finish level for this estimate"
              status={
                qualitySubmitted
                  ? "submitted"
                  : stage === "quality"
                    ? "active"
                    : "submitted"
              }
              badge={qualitySubmitted ? "Complete" : undefined}
            >
              <QualityBlock
                selected={qualityLevel}
                submitted={qualitySubmitted}
                isSaving={pendingAction === "quality"}
                onSelect={qualitySubmitted ? undefined : setQualityLevel}
                onContinue={
                  qualitySubmitted ? undefined : handleQualityContinue
                }
              />
            </AssistantMessage>
          ) : null}

          {qualitySubmitted && questionBlock && !questionsSubmitted ? (
            <AssistantMessage
              title={questionBlock.title}
              subtitle={questionBlock.description}
              status={
                stage === "work_area_questions" ? "active" : "submitted"
              }
            >
              <QuestionBlock
                questions={questionBlock.questions}
                derivedFactDisplays={initialState.derivedFactDisplays}
                answers={questionAnswers}
                isSaving={pendingAction === "questions"}
                onAnswerChange={handleQuestionAnswer}
                onSubmit={handleQuestionsSubmit}
              />
            </AssistantMessage>
          ) : null}

          {questionsSubmitted ? (
            <AssistantMessage
              title="Scope review"
              subtitle="Review what Quotr will use for this estimate."
              status="submitted"
              badge="Review"
            >
              <ScopeSummaryBlock
                key={scopeReviewQuestionKey}
                scopeReview={initialState.scopeReview}
                workAreas={initialState.workAreas}
                editable={questionsSubmitted}
                manageWorkAreas={workAreasConfirmed}
                estimateIsStale={estimate?.isStale}
                savingFactKey={savingFactKey}
                savingWorkAreaId={savingWorkAreaId}
                workAreaQuestionError={workAreaQuestionError}
                factError={factError}
                isAddingWorkArea={isAddingWorkArea}
                isExcludingWorkArea={isExcludingWorkArea}
                addWorkAreaError={addWorkAreaError}
                onFactSave={questionsSubmitted ? handleFactSave : undefined}
                onSaveWorkAreaQuestions={
                  questionsSubmitted ? handleSaveWorkAreaQuestions : undefined
                }
                onAddWorkArea={workAreasConfirmed ? handleAddWorkArea : undefined}
                onExcludeWorkArea={
                  workAreasConfirmed ? handleExcludeWorkArea : undefined
                }
              />
            </AssistantMessage>
          ) : null}

          {briefSubmitted ? (
            <>
              {pendingNoteProposal ? (
                <NoteProposalReviewPanel
                  projectId={project.id}
                  proposal={pendingNoteProposal}
                />
              ) : null}
              <SiteNotesPanel
                projectId={project.id}
                initialNotes={initialNotes}
                showAnalyseNotes
              />
            </>
          ) : null}

          {questionsSubmitted ? (
            <AssistantMessage
              title="Site constraints"
              subtitle="Access, slope, and site conditions"
              status={
                constraintsSubmitted
                  ? "submitted"
                  : stage === "constraints"
                    ? "active"
                    : "submitted"
              }
              badge={constraintsSubmitted ? "Complete" : undefined}
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
            </AssistantMessage>
          ) : null}

          {constraintsSubmitted ? (
            <AssistantMessage
              title="Ready to prepare a quick estimate"
              subtitle={
                estimateReady
                  ? "Your draft estimate is ready to review"
                  : "Generate when you're happy with the inputs"
              }
              status={
                estimateReady
                  ? "submitted"
                  : stage === "ready_to_estimate" || isGenerating
                    ? "active"
                    : "submitted"
              }
              badge={estimateReady ? "Complete" : undefined}
            >
              {estimateReady ? (
                <p className="text-sm text-muted-foreground">
                  Review the estimate panel for your draft range and breakdown.
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    I have enough information to prepare a draft quick estimate.
                    You can refine it after reviewing the assumptions.
                  </p>
                  <Button
                    type="button"
                    onClick={handleGenerateEstimate}
                    disabled={isGenerating || pendingAction === "estimate"}
                  >
                    {isGenerating
                      ? "Generating quick estimate…"
                      : "Generate quick estimate"}
                  </Button>
                </div>
              )}
            </AssistantMessage>
          ) : null}
        </div>

        <div className="min-w-0">
          <EstimatePanel
            estimate={estimate}
            isGenerating={isGenerating}
            isRegenerating={isRegenerating}
            isSavingMargin={isSavingMargin}
            defaultMarginPercent={initialState.defaultMarginPercent}
            panelScopeSummaries={initialState.panelScopeSummaries}
            scopeReview={initialState.scopeReview}
            questionsSubmitted={questionsSubmitted}
            onViewBreakdown={() => setBreakdownOpen(true)}
            onRegenerate={handleRegenerateEstimate}
            onMarginSave={estimateReady ? handleMarginSave : undefined}
          />
        </div>
      </div>

      <EstimateBreakdownModal
        estimate={estimate}
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        onRegenerate={handleRegenerateEstimate}
        isRegenerating={isRegenerating}
      />
    </div>
  );
}
