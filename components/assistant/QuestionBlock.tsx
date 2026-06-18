"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Question } from "@/components/assistant/types";

export type QuestionAnswers = Record<string, string | number | boolean | null>;

type QuestionBlockProps = {
  questions: Question[];
  answers: QuestionAnswers;
  submitted?: boolean;
  isSaving?: boolean;
  submitLabel?: string;
  onAnswerChange?: (questionId: string, value: string | number | boolean) => void;
  onSubmit?: () => void;
};

function formatAnswer(question: Question, value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (question.unit && typeof value === "number") {
    return `${value} ${question.unit}`;
  }
  return String(value);
}

function BooleanChips({
  question,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  value: string | number | boolean | null | undefined;
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  const options = question.options ?? ["Yes", "No", "Not sure"];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-2xl border px-3 py-1.5 text-sm transition-colors",
            value === option
              ? "border-primary/30 bg-primary/5 font-medium text-primary ring-1 ring-primary/20"
              : "border-border hover:bg-muted/50",
            disabled && "pointer-events-none opacity-70"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function SelectChips({
  question,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  value: string | number | boolean | null | undefined;
  disabled?: boolean;
  onChange: (val: string) => void;
}) {
  const options = question.options ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-2xl border px-3 py-1.5 text-sm transition-colors",
            value === option
              ? "border-primary/30 bg-primary/5 font-medium text-primary ring-1 ring-primary/20"
              : "border-border hover:bg-muted/50",
            disabled && "pointer-events-none opacity-70"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function QuestionField({
  question,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  value: string | number | boolean | null | undefined;
  disabled?: boolean;
  onChange: (val: string | number | boolean) => void;
}) {
  switch (question.inputType) {
    case "number":
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step="any"
            value={value === null || value === undefined ? "" : String(value)}
            disabled={disabled}
            onChange={(e) =>
              onChange(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="max-w-[140px]"
          />
          {question.unit ? (
            <span className="text-sm text-muted-foreground">{question.unit}</span>
          ) : null}
        </div>
      );
    case "select":
      return (
        <SelectChips
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case "boolean":
      return (
        <BooleanChips
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case "text":
    default:
      return (
        <Input
          value={value === null || value === undefined ? "" : String(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export function QuestionBlock({
  questions,
  answers,
  submitted,
  isSaving,
  submitLabel = "Submit answers",
  onAnswerChange,
  onSubmit,
}: QuestionBlockProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    const missing = questions.filter(
      (q) =>
        q.required &&
        (answers[q.id] === null ||
          answers[q.id] === undefined ||
          answers[q.id] === "")
    );

    if (missing.length > 0) {
      setValidationError("Please answer all required questions before submitting.");
      return;
    }

    setValidationError(null);
    onSubmit?.();
  };

  if (submitted) {
    return (
      <dl className="space-y-3">
        {questions.map((question) => (
          <div key={question.id} className="grid gap-1 sm:grid-cols-[1fr_1.2fr]">
            <dt className="text-sm text-muted-foreground">{question.label}</dt>
            <dd className="text-sm font-medium">
              {formatAnswer(question, answers[question.id])}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((question) => (
        <div key={question.id} className="space-y-2">
          <Label className="text-sm font-medium">{question.questionText}</Label>
          <QuestionField
            question={question}
            value={answers[question.id]}
            onChange={(val) => onAnswerChange?.(question.id, val)}
          />
        </div>
      ))}
      {validationError ? (
        <p className="text-sm text-destructive">{validationError}</p>
      ) : null}
      <Button type="button" onClick={handleSubmit} disabled={isSaving}>
        {isSaving ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}
