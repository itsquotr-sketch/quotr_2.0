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

export function shouldPersistOnOptionToggle(control: ClarifyControlType): boolean {
  return control !== "MULTI_SELECT";
}

export function shouldAdvanceOnSelect(control: ClarifyControlType): boolean {
  return control === "SINGLE_SELECT" || control === "BOOLEAN";
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
  if (typeof value === "number" || candidate.inputType === "number") {
    return "number";
  }
  return "select";
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
