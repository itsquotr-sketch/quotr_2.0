"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DerivedFactDisplay } from "@/lib/assistant/types";
import type { Question } from "@/components/assistant/types";
import { normalizeBooleanForUi } from "@/lib/scopes/fact-values";

export type QuestionAnswers = Record<string, string | number | boolean | null>;

type QuestionBlockProps = {
  questions: Question[];
  answers: QuestionAnswers;
  derivedFactDisplays?: DerivedFactDisplay[];
  submitted?: boolean;
  isSaving?: boolean;
  submitLabel?: string;
  onAnswerChange?: (questionId: string, value: string | number | boolean) => void;
  onSubmit?: () => void;
};

type QuestionGroup = {
  workAreaId?: string;
  workAreaName: string;
  questions: Question[];
};

function groupQuestionsByWorkArea(questions: Question[]): QuestionGroup[] {
  const groups: QuestionGroup[] = [];
  const groupIndex = new Map<string, number>();

  for (const question of questions) {
    const name = question.workAreaName ?? "General";
    const existingIndex = groupIndex.get(name);

    if (existingIndex === undefined) {
      groupIndex.set(name, groups.length);
      groups.push({
        workAreaId: question.workAreaId,
        workAreaName: name,
        questions: [question],
      });
    } else {
      groups[existingIndex].questions.push(question);
    }
  }

  return groups;
}

function formatAnswer(question: Question, value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (question.inputType === "boolean") {
    return normalizeBooleanForUi(value) ?? String(value);
  }
  if (question.unit && typeof value === "number") {
    return `${value} ${question.unit}`;
  }
  return String(value);
}

function chipValueMatches(
  option: string,
  value: string | number | boolean | null | undefined
): boolean {
  if (value === option) return true;
  if (option === "Yes") return value === true || value === "true";
  if (option === "No") return value === false || value === "false";
  if (option === "Not sure") {
    return (
      value === "Not sure" ||
      value === "not sure" ||
      value === "not_sure"
    );
  }
  return false;
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
            chipValueMatches(option, value)
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
            chipValueMatches(option, value)
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

function WorkAreaSection({
  group,
  derivedLines,
  answers,
  submitted,
  onAnswerChange,
}: {
  group: QuestionGroup;
  derivedLines: DerivedFactDisplay[];
  answers: QuestionAnswers;
  submitted?: boolean;
  onAnswerChange?: (questionId: string, value: string | number | boolean) => void;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-foreground">
          {group.workAreaName}
        </h4>
      </div>

      {derivedLines.length > 0 ? (
        <div className="mb-4 space-y-1.5">
          {derivedLines.map((line) => (
            <p
              key={`${line.workAreaId}-${line.label}`}
              className="text-sm text-muted-foreground"
            >
              <span className="font-medium text-foreground">{line.label}:</span>{" "}
              {line.text}
            </p>
          ))}
        </div>
      ) : null}

      {submitted ? (
        <dl className="space-y-3">
          {group.questions.map((question) => (
            <div
              key={question.id}
              className="grid gap-1 sm:grid-cols-[1fr_1.2fr]"
            >
              <dt className="text-sm text-muted-foreground">{question.label}</dt>
              <dd className="text-sm font-medium">
                {formatAnswer(question, answers[question.id])}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="space-y-5">
          {group.questions.map((question) => (
            <div key={question.id} className="space-y-2">
              <Label className="text-sm font-medium leading-snug">
                {question.questionText}
              </Label>
              <QuestionField
                question={question}
                value={answers[question.id]}
                onChange={(val) => onAnswerChange?.(question.id, val)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function QuestionBlock({
  questions,
  answers,
  derivedFactDisplays = [],
  submitted,
  isSaving,
  submitLabel = "Submit answers",
  onAnswerChange,
  onSubmit,
}: QuestionBlockProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const groups = useMemo(() => groupQuestionsByWorkArea(questions), [questions]);

  const derivedByWorkAreaId = useMemo(() => {
    const map = new Map<string, DerivedFactDisplay[]>();
    for (const display of derivedFactDisplays) {
      const existing = map.get(display.workAreaId) ?? [];
      existing.push(display);
      map.set(display.workAreaId, existing);
    }
    return map;
  }, [derivedFactDisplays]);

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

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <WorkAreaSection
          key={group.workAreaName}
          group={group}
          derivedLines={
            group.workAreaId
              ? (derivedByWorkAreaId.get(group.workAreaId) ?? [])
              : []
          }
          answers={answers}
          submitted={submitted}
          onAnswerChange={onAnswerChange}
        />
      ))}
      {validationError ? (
        <p className="text-sm text-destructive">{validationError}</p>
      ) : null}
      {!submitted ? (
        <Button type="button" onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "Saving…" : submitLabel}
        </Button>
      ) : null}
    </div>
  );
}
