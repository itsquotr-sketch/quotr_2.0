"use client";

import { useEffect, useRef, useState } from "react";
import { QuestionField } from "@/components/assistant/QuestionBlock";
import type { WorkAreaActiveQuestion } from "@/components/assistant/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type MissingQuestionAnswers = Record<
  string,
  string | number | boolean | string[] | null
>;

type ScopeReviewMissingSectionProps = {
  workAreaName: string;
  questions: WorkAreaActiveQuestion[];
  answers: MissingQuestionAnswers;
  isSaving?: boolean;
  saveStatus?: "idle" | "saving" | "saved" | "error";
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
  const lastSavedRef = useRef<string>("");

  const answersKey = questions
    .map((question) => `${question.id}:${String(answers[question.id] ?? "")}`)
    .join("|");

  useEffect(() => {
    if (!autoSave || isSaving) return;

    const missingRequired = questions.filter(
      (question) =>
        question.required &&
        (answers[question.id] === null ||
          answers[question.id] === undefined ||
          answers[question.id] === "")
    );
    if (missingRequired.length > 0) return;
    if (answersKey === lastSavedRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      lastSavedRef.current = answersKey;
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
        question.required &&
        (answers[question.id] === null ||
          answers[question.id] === undefined ||
          answers[question.id] === "")
    );

    if (missingRequired.length > 0) {
      setValidationError("Please answer all required fields.");
      return;
    }

    setValidationError(null);
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
      {validationError || error ? (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {validationError ?? error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? "Saving…" : `Save ${workAreaName.toLowerCase()} details`}
        </Button>
        {saveStatus === "saving" || isSaving ? (
          <span className="text-xs text-muted-foreground">Saving…</span>
        ) : saveStatus === "saved" ? (
          <span className="text-xs text-muted-foreground">Saved</span>
        ) : null}
      </div>
    </div>
  );
}
