"use client";

import { useEffect, useRef, useState } from "react";
import { QuestionField } from "@/components/assistant/QuestionBlock";
import type { WorkAreaActiveQuestion } from "@/components/assistant/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  isEmptyAnswerValue,
  shouldAutosaveAnswers,
} from "@/lib/assistant/answer-persistence";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { saveFailureMessage } from "@/lib/assistant/presentation/error-messages";
import type { SaveStatus } from "@/lib/assistant/presentation/save-status";

export type MissingQuestionAnswers = Record<
  string,
  string | number | boolean | string[] | null
>;

type ScopeReviewMissingSectionProps = {
  workAreaName: string;
  questions: WorkAreaActiveQuestion[];
  answers: MissingQuestionAnswers;
  isSaving?: boolean;
  saveStatus?: SaveStatus;
  error?: string | null;
  autoSave?: boolean;
  onAnswerChange: (
    questionId: string,
    value: string | number | boolean | string[]
  ) => void;
  onSave: () => void;
};

export function ScopeReviewMissingSection({
  workAreaName,
  questions,
  answers,
  isSaving,
  saveStatus = "idle",
  error,
  autoSave = true,
  onAnswerChange,
  onSave,
}: ScopeReviewMissingSectionProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSuccessfulSaveRef = useRef<string>("");
  const pendingSaveKeyRef = useRef<string | null>(null);

  const answersKey = questions
    .map((question) => `${question.id}:${String(answers[question.id] ?? "")}`)
    .join("|");

  useEffect(() => {
    if (saveStatus === "saved") {
      lastSuccessfulSaveRef.current =
        pendingSaveKeyRef.current ?? answersKey;
      pendingSaveKeyRef.current = null;
    }
    if (saveStatus === "error") {
      pendingSaveKeyRef.current = null;
    }
  }, [saveStatus, answersKey]);

  useEffect(() => {
    if (!autoSave || isSaving) return;

    if (
      !shouldAutosaveAnswers({
        questions,
        answers,
      })
    ) {
      return;
    }
    if (answersKey === lastSuccessfulSaveRef.current) return;
    if (answersKey === pendingSaveKeyRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      pendingSaveKeyRef.current = answersKey;
      onSave();
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [answersKey, autoSave, isSaving, onSave, questions, answers]);

  const handleSave = () => {
    const missingRequired = questions.filter(
      (question) =>
        question.required && isEmptyAnswerValue(answers[question.id])
    );

    if (missingRequired.length > 0) {
      setValidationError("Please answer all required fields.");
      return;
    }

    setValidationError(null);
    pendingSaveKeyRef.current = answersKey;
    onSave();
  };

  return (
    <div className="mt-3 rounded-lg border border-border/50 bg-background/60 px-3 py-3">
      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Details needed
      </h5>
      <div className="mt-3 space-y-4">
        {questions.map((question) => (
          <div key={question.id} className="space-y-1.5">
            <Label className="text-sm font-medium leading-snug text-foreground">
              {question.label}
              {question.required ? (
                <span className="ml-0.5 text-destructive">*</span>
              ) : null}
            </Label>
            <QuestionField
              question={question}
              value={answers[question.id]}
              disabled={false}
              onChange={(value) => onAnswerChange(question.id, value)}
            />
          </div>
        ))}
      </div>
      {validationError || error || saveStatus === "error" ? (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {validationError ??
            (error ? saveFailureMessage(error) : null) ??
            ASSISTANT_ACTION_LABELS.couldNotSave}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving
            ? ASSISTANT_ACTION_LABELS.saving
            : `${ASSISTANT_ACTION_LABELS.save} ${workAreaName.toLowerCase()} details`}
        </Button>
        <SaveStatusIndicator
          status={saveStatus}
          isSaving={isSaving}
          hasError={saveStatus === "error" || Boolean(error)}
          onRetry={saveStatus === "error" ? handleSave : undefined}
        />
      </div>
    </div>
  );
}
