"use client";

import { useState } from "react";
import { QuestionField } from "@/components/assistant/QuestionBlock";
import type { WorkAreaActiveQuestion } from "@/components/assistant/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type MissingQuestionAnswers = Record<
  string,
  string | number | boolean | null
>;

type ScopeReviewMissingSectionProps = {
  workAreaName: string;
  questions: WorkAreaActiveQuestion[];
  answers: MissingQuestionAnswers;
  isSaving?: boolean;
  error?: string | null;
  onAnswerChange: (
    questionId: string,
    value: string | number | boolean
  ) => void;
  onSave: () => void;
};

export function ScopeReviewMissingSection({
  workAreaName,
  questions,
  answers,
  isSaving,
  error,
  onAnswerChange,
  onSave,
}: ScopeReviewMissingSectionProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

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
              disabled={isSaving}
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
      <Button
        type="button"
        size="sm"
        className="mt-3 h-8"
        disabled={isSaving}
        onClick={handleSave}
      >
        {isSaving ? "Saving…" : `Save ${workAreaName.toLowerCase()} details`}
      </Button>
    </div>
  );
}
