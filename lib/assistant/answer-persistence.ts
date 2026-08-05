/**
 * Pure helpers for Stage 3.1A answer persistence reliability.
 * No database or React imports — safe for verification scripts.
 */

export type PersistableAnswerValue = string | number | boolean | string[];

export type AnswerSaveStatus = "idle" | "saving" | "saved" | "error";

export type QuestionAnswerPayload = {
  question_id: string;
  value: PersistableAnswerValue;
};

/** True when a value is empty / not yet answered for persistence purposes. */
export function isEmptyAnswerValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Filter answers to values Zod / DB can persist.
 * Omits null/empty so partial work-area saves succeed.
 */
export function filterPersistableAnswers(
  answers: Array<{ question_id: string; value: unknown }>
): QuestionAnswerPayload[] {
  const out: QuestionAnswerPayload[] = [];
  for (const answer of answers) {
    if (isEmptyAnswerValue(answer.value)) continue;
    if (
      typeof answer.value === "string" ||
      typeof answer.value === "number" ||
      typeof answer.value === "boolean" ||
      Array.isArray(answer.value)
    ) {
      out.push({
        question_id: answer.question_id,
        value: answer.value as PersistableAnswerValue,
      });
    }
  }
  return out;
}

/**
 * Latest-write-wins sequencer for overlapping saves.
 * Call next() before each request; only apply results whose token matches current.
 */
export function createLatestWriteGuard() {
  let current = 0;
  return {
    next(): number {
      current += 1;
      return current;
    },
    isCurrent(token: number): boolean {
      return token === current;
    },
    get current(): number {
      return current;
    },
  };
}

/**
 * Resolve visible save status after a mutation attempt.
 * Failed saves never report "saved".
 */
export function resolveAnswerSaveStatus(input: {
  success: boolean;
  error?: string | null;
}): { status: AnswerSaveStatus; error: string | null } {
  if (input.success && !input.error) {
    return { status: "saved", error: null };
  }
  return {
    status: "error",
    error: input.error?.trim() || "Could not save answers. Please try again.",
  };
}

/**
 * Whether autosave should fire for the current answer map.
 * Requires at least one non-empty value and no empty required answers.
 */
export function shouldAutosaveAnswers(input: {
  questions: Array<{ id: string; required: boolean }>;
  answers: Record<string, unknown>;
}): boolean {
  let hasPersistable = false;
  for (const question of input.questions) {
    const value = input.answers[question.id];
    if (question.required && isEmptyAnswerValue(value)) {
      return false;
    }
    if (!isEmptyAnswerValue(value)) {
      hasPersistable = true;
    }
  }
  return hasPersistable;
}
