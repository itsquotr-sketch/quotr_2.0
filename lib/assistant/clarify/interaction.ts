/**
 * Clarify question-engine interaction: current question, remaining count,
 * multi-select Continue, and latest-intent overlay merge.
 *
 * Visual selection is optimistic. Persistence is canonical. A stale
 * recompose must not reopen a locally accepted question.
 */

import {
  clarifyControlType,
  isInitialCaptureQuestion,
  type ClarifyControlType,
} from "@/lib/assistant/clarify/question-contract";
import type { ClarifyCandidate } from "@/lib/assistant/clarify/types";
import { isNotSureValue } from "@/lib/estimate/facts";

export function shouldPersistOnOptionToggle(control: ClarifyControlType): boolean {
  return control !== "MULTI_SELECT";
}

export function shouldAdvanceOnSelect(control: ClarifyControlType): boolean {
  return control === "SINGLE_SELECT" || control === "BOOLEAN";
}

/** Same Details control already saving — do not queue another write. */
export function shouldIgnoreDuplicateClarifyActivation(params: {
  readonly pendingCandidateId: string | null | undefined;
  readonly candidateId: string;
}): boolean {
  return params.pendingCandidateId === params.candidateId;
}

/**
 * Keep the last visible / last required answer on screen with Saving…
 * until persist settles. Mid-flow questions still advance immediately.
 */
export function shouldHoldClarifyQuestionUntilPersist(params: {
  readonly remainingRequiredBeforeAnswer: number;
  readonly visibleCandidateCount: number;
}): boolean {
  return (
    params.remainingRequiredBeforeAnswer <= 1 ||
    params.visibleCandidateCount <= 1
  );
}

export function persistClarifyValueType(
  candidate: {
    readonly inputType: ClarifyCandidate["inputType"];
  },
  value: string | number | boolean | string[]
): "multi_select" | "select" | "number" | "boolean" {
  if (Array.isArray(value) || candidate.inputType === "multi_select") {
    return "multi_select";
  }
  if (typeof value === "boolean") return "boolean";
  if (isNotSureValue(value)) return "select";
  if (typeof value === "number" || candidate.inputType === "number") {
    return "number";
  }
  return "select";
}

/** True when a Clarify persist result should rewind the optimistic advance. */
export function clarifyPersistResultFailed(result: unknown): boolean {
  return Boolean(
    result &&
      typeof result === "object" &&
      "error" in result &&
      typeof (result as { error?: unknown }).error === "string" &&
      (result as { error: string }).error.length > 0
  );
}

/**
 * Ready card must not appear while the current answer failed to persist,
 * even if the candidate was already hidden locally.
 */
export function detailsReadyCardVisible(params: {
  visibleGroupCount: number;
  remaining: number;
  viewEnoughToEstimate: boolean;
  readinessEnoughToEstimate: boolean;
  persistError?: string | null;
}): boolean {
  return (
    params.visibleGroupCount === 0 &&
    params.remaining === 0 &&
    params.viewEnoughToEstimate === true &&
    params.readinessEnoughToEstimate === true &&
    !params.persistError
  );
}

export function currentClarifyCandidate(params: {
  readonly candidates: readonly ClarifyCandidate[];
  readonly locallyResolvedIds: ReadonlySet<string>;
  readonly rewind: ClarifyCandidate | null;
  readonly heldMulti: ClarifyCandidate | null;
}): ClarifyCandidate | null {
  if (params.rewind) return params.rewind;
  if (params.heldMulti) return params.heldMulti;
  return (
    params.candidates.find((row) => !params.locallyResolvedIds.has(row.id)) ??
    null
  );
}

export function effectiveRemainingRequiredCount(params: {
  readonly remainingRequiredCount: number;
  readonly candidates: readonly ClarifyCandidate[];
  readonly locallyResolvedIds: ReadonlySet<string>;
}): number {
  const ghosts = params.candidates.filter(
    (row) =>
      params.locallyResolvedIds.has(row.id) && isInitialCaptureQuestion(row)
  ).length;
  return Math.max(0, params.remainingRequiredCount - ghosts);
}

export function mergeConstraintSnapshotWithLaterOverlay<
  T extends { readonly key: string },
>(params: {
  readonly incoming: readonly T[];
  readonly previous: readonly T[];
  readonly overlaySeqByKey: ReadonlyMap<string, number>;
  readonly requestSeq: number;
}): T[] {
  const later = params.previous.filter((row) => {
    const seq = params.overlaySeqByKey.get(row.key);
    return seq != null && seq > params.requestSeq;
  });
  const laterKeys = new Set(later.map((row) => row.key));
  return [
    ...params.incoming.filter((row) => !laterKeys.has(row.key)),
    ...later,
  ];
}

export function shouldRefreshAfterStaleMutation(params: {
  readonly factSeqByKey: ReadonlyMap<string, number>;
  readonly constraintSeqByKey: ReadonlyMap<string, number>;
  readonly requestSeq: number;
}): boolean {
  for (const seq of params.factSeqByKey.values()) {
    if (seq > params.requestSeq) return false;
  }
  for (const seq of params.constraintSeqByKey.values()) {
    if (seq > params.requestSeq) return false;
  }
  return true;
}

export function exclusiveOptionSelectValue(
  value: string | number | boolean | string[] | null | undefined
): string | number | boolean | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first == null ? null : first;
  }
  return value ?? null;
}

export function controlTypeForCandidate(
  candidate: ClarifyCandidate
): ClarifyControlType {
  return clarifyControlType(candidate);
}
