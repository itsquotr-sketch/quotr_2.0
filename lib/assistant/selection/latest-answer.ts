/**
 * WA-BATHROOM-POLISH-01 — latest-intended-answer contract.
 *
 * Visual selection is optimistic. Persistence is ordered. A stale in-flight
 * write must not revert a newer selection.
 */

export type OptimisticAnswerValue = string | number | boolean | string[];

export function isLaterAnswerSeq(persistedSeq: number, latestSeq: number): boolean {
  return persistedSeq >= latestSeq;
}

export function mergeMultiSelectToggle(
  selected: readonly string[],
  option: string
): string[] {
  if (selected.includes(option)) {
    return selected.filter((item) => item !== option);
  }
  return [...selected, option];
}

/**
 * FIFO persist of the value captured at click time is safe when writes are
 * serialised: the latest click is persisted last. If a persist completes for
 * an older seq, the caller must ignore it when latestSeq is greater.
 */
export function shouldAcceptPersistedAnswer(params: {
  persistedSeq: number;
  latestSeqForKey: number;
}): boolean {
  return isLaterAnswerSeq(params.persistedSeq, params.latestSeqForKey);
}
