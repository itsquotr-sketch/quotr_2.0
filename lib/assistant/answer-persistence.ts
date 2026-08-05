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

export type LocalAnswerEdit = {
  value: unknown;
  revision: number;
  confirmedRevision: number;
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

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, index) => item === b[index]);
  }
  return a === b;
}

/**
 * Stage 3.1A-R1 answer reconciliation contract:
 * - Local optimistic value is authoritative while a newer local revision is
 *   pending or not yet confirmed against matching server props.
 * - Only the latest request may confirm or roll back.
 * - Incoming server props must not overwrite a newer local revision.
 */
export function resolveVisibleAnswerValue(input: {
  localValue: unknown;
  serverValue: unknown;
  localRevision: number;
  confirmedRevision: number;
  hasLocalEdit: boolean;
}): unknown {
  if (!input.hasLocalEdit) {
    return input.serverValue;
  }
  if (input.localRevision > input.confirmedRevision) {
    return input.localValue;
  }
  if (valuesEqual(input.localValue, input.serverValue)) {
    return input.serverValue;
  }
  // Confirmed locally but server still lagging — keep local until props catch up.
  return input.localValue;
}

/**
 * Whether server props may clear a local optimistic edit for a question.
 * Only when the latest local revision is confirmed and server matches it.
 */
export function shouldClearLocalAnswerEdit(input: {
  localValue: unknown;
  serverValue: unknown;
  localRevision: number;
  confirmedRevision: number;
}): boolean {
  if (input.localRevision > input.confirmedRevision) {
    return false;
  }
  return valuesEqual(input.localValue, input.serverValue);
}

/**
 * Merge server baseline with local optimistic edits using revision metadata.
 */
export function mergeAnswersWithRevisions(input: {
  serverAnswers: Record<string, unknown>;
  localEdits: Record<string, LocalAnswerEdit>;
}): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...input.serverAnswers };
  for (const [questionId, edit] of Object.entries(input.localEdits)) {
    merged[questionId] = resolveVisibleAnswerValue({
      localValue: edit.value,
      serverValue: input.serverAnswers[questionId],
      localRevision: edit.revision,
      confirmedRevision: edit.confirmedRevision,
      hasLocalEdit: true,
    });
  }
  return merged;
}

/**
 * Apply an out-of-order response sequence: only the latest token may commit.
 * Returns the visible value after processing responses in arrival order.
 */
export function foldRapidAnswerResponses(input: {
  selections: Array<{ token: number; value: unknown }>;
  responses: Array<{ token: number; ok: boolean }>;
}): { visibleValue: unknown; status: AnswerSaveStatus } {
  const latestSelection = input.selections[input.selections.length - 1];
  if (!latestSelection) {
    return { visibleValue: null, status: "idle" };
  }

  let latestToken = 0;
  for (const selection of input.selections) {
    latestToken = Math.max(latestToken, selection.token);
  }

  let latestResponse: { token: number; ok: boolean } | null = null;
  for (const response of input.responses) {
    if (response.token === latestToken) {
      latestResponse = response;
    }
  }

  if (!latestResponse) {
    return { visibleValue: latestSelection.value, status: "saving" };
  }

  if (!latestResponse.ok) {
    const previousOk = [...input.selections]
      .reverse()
      .find((selection) =>
        input.responses.some(
          (response) => response.token === selection.token && response.ok
        )
      );
    return {
      visibleValue: previousOk?.value ?? latestSelection.value,
      status: "error",
    };
  }

  return { visibleValue: latestSelection.value, status: "saved" };
}
