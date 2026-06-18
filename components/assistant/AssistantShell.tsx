"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { AssistantMessage } from "@/components/assistant/AssistantMessage";
import { AssistantProgress } from "@/components/assistant/AssistantProgress";
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
import type { QualityLevel, WorkArea } from "@/components/assistant/types";
import { WorkAreaConfirmationBlock } from "@/components/assistant/WorkAreaConfirmationBlock";
import {
  confirmWorkAreas,
  generateStaticEstimate,
  saveBriefAndSeedWorkAreas,
  saveConstraints,
  saveQuality,
  saveQuestionBlockAnswers,
} from "@/lib/assistant/actions";
import { isStageAtOrBeyond } from "@/lib/assistant/stage";
import type { AssistantState } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";

type AssistantShellProps = {
  initialState: AssistantState;
};

type PendingAction =
  | "brief"
  | "work_areas"
  | "quality"
  | "questions"
  | "constraints"
  | "estimate"
  | null;

function initAnswersFromQuestions(
  questions: { id: string; value?: string | number | boolean | null }[]
): QuestionAnswers {
  return Object.fromEntries(
    questions.map((q) => [q.id, q.value ?? null])
  );
}

export function AssistantShell({ initialState }: AssistantShellProps) {
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
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const briefSubmitted = isStageAtOrBeyond(stage, "confirm_work_areas");
  const workAreasConfirmed = isStageAtOrBeyond(stage, "quality");
  const qualitySubmitted = isStageAtOrBeyond(stage, "work_area_questions");
  const questionsSubmitted = isStageAtOrBeyond(stage, "constraints");
  const constraintsSubmitted = isStageAtOrBeyond(stage, "ready_to_estimate");
  const estimateReady = stage === "estimate_ready";

  const submittedQuestionAnswers = useMemo(() => {
    if (!questionBlock) return questionAnswers;
    return initAnswersFromQuestions(questionBlock.questions);
  }, [questionBlock, questionAnswers]);

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
        return;
      }

      router.refresh();
      setPendingAction(null);
      if (action === "estimate") {
        setIsGenerating(false);
      }
    },
    [router]
  );

  const handleBriefSubmit = useCallback(
    (text: string) => {
      setBriefText(text);
      void runAction("brief", () =>
        saveBriefAndSeedWorkAreas(project.id, text)
      );
    },
    [project.id, runAction]
  );

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

  const estimate = estimateReady ? initialState.estimate : null;
  const displayWorkAreas =
    workAreas.length > 0 ? workAreas : initialState.workAreas;

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
            title="Project brief"
            subtitle="Describe the job in your own words"
            status={briefSubmitted ? "submitted" : "active"}
            badge={briefSubmitted ? "Complete" : "Current"}
          >
            <BriefInput
              value={briefText}
              readOnly={briefSubmitted}
              onSubmit={handleBriefSubmit}
              disabled={briefSubmitted || pendingAction === "brief"}
              isSaving={pendingAction === "brief"}
            />
          </AssistantMessage>

          {briefSubmitted ? (
            <AssistantMessage
              title="Confirm work areas"
              subtitle="Review what we detected from your brief"
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

          {qualitySubmitted && questionBlock ? (
            <AssistantMessage
              title={questionBlock.title}
              subtitle={questionBlock.description}
              status={
                questionsSubmitted
                  ? "submitted"
                  : stage === "work_area_questions"
                    ? "active"
                    : "submitted"
              }
              badge={questionsSubmitted ? "Complete" : undefined}
            >
              <QuestionBlock
                questions={questionBlock.questions}
                answers={
                  questionsSubmitted
                    ? submittedQuestionAnswers
                    : questionAnswers
                }
                submitted={questionsSubmitted}
                isSaving={pendingAction === "questions"}
                onAnswerChange={
                  questionsSubmitted ? undefined : handleQuestionAnswer
                }
                onSubmit={
                  questionsSubmitted ? undefined : handleQuestionsSubmit
                }
              />
            </AssistantMessage>
          ) : null}

          {questionsSubmitted ? (
            <AssistantMessage
              title="Scope understood so far"
              subtitle="What Quotr will use for this estimate"
              status="submitted"
              badge="Review"
            >
              <ScopeSummaryBlock
                includedWorkAreas={initialState.scopeSummary.includedWorkAreas}
                scopeAssumptions={initialState.scopeSummary.scopeAssumptions}
                scopeExclusions={initialState.scopeSummary.scopeExclusions}
              />
            </AssistantMessage>
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
                isSaving={pendingAction === "constraints"}
                onAnswerChange={
                  constraintsSubmitted ? undefined : handleConstraintAnswer
                }
                onSubmit={
                  constraintsSubmitted ? undefined : handleConstraintsSubmit
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
            panelScopeSummaries={initialState.panelScopeSummaries}
            onViewBreakdown={() => setBreakdownOpen(true)}
          />
        </div>
      </div>

      <EstimateBreakdownModal
        estimate={estimate}
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
      />
    </div>
  );
}
