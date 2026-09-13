/**
 * PERFORMANCE-01E — Generate Estimate as a synchronization boundary.
 *
 * Initiation may proceed while local answers are complete and writes are
 * still in flight. Generation itself still requires settled writes, no write
 * failures, and EF02 readiness against current/persisted state.
 */

import type { AssistantActionState, AssistantMutationResult } from "@/lib/assistant/types";

export type GenerateEstimateStage = "saving" | "readiness" | "building";

export type PendingWriteOutcome = {
  readonly ok: boolean;
  readonly error?: string;
  readonly mutation?: AssistantMutationResult;
};

export type GenerateAfterSyncDecision =
  | { readonly generate: true; readonly reason: "ready" }
  | { readonly generate: false; readonly reason: "write_failed" }
  | { readonly generate: false; readonly reason: "readiness_changed" }
  | { readonly generate: false; readonly reason: "pending_writes" };

export const GENERATE_MIN_VISIBLE_MS = 320;
export const GENERATE_EXTENDED_COPY_MS = 2000;

export const GENERATE_STATUS_COPY = Object.freeze({
  headline: "Generating your estimate",
  saving: "Saving job details",
  readiness: "Checking estimate readiness",
  building: "Building your estimate",
  extended: "Checking your job details and building the estimate…",
});

export function canInitiateGenerateEstimate(params: {
  readonly viewEnoughToEstimate: boolean;
  readonly blocksEstimate: boolean;
  readonly persistError?: string | null;
}): boolean {
  return (
    params.viewEnoughToEstimate === true &&
    params.blocksEstimate !== true &&
    !params.persistError
  );
}

export function remainingGenerateMinDisplayMs(
  elapsedMs: number,
  minMs: number = GENERATE_MIN_VISIBLE_MS
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs >= minMs) return 0;
  return Math.max(0, minMs - elapsedMs);
}

export function generateStatusDetail(params: {
  readonly stage: GenerateEstimateStage;
  readonly elapsedMs: number;
}): string {
  if (params.stage === "saving") return GENERATE_STATUS_COPY.saving;
  if (params.stage === "readiness") return GENERATE_STATUS_COPY.readiness;
  if (params.elapsedMs >= GENERATE_EXTENDED_COPY_MS) {
    return GENERATE_STATUS_COPY.extended;
  }
  return GENERATE_STATUS_COPY.building;
}

export function decideGenerateAfterSync(params: {
  readonly writeFailed: boolean;
  readonly pendingWritesRemaining: number;
  readonly permissionReady: boolean;
}): GenerateAfterSyncDecision {
  if (params.writeFailed) {
    return { generate: false, reason: "write_failed" };
  }
  if (params.pendingWritesRemaining > 0) {
    return { generate: false, reason: "pending_writes" };
  }
  if (!params.permissionReady) {
    return { generate: false, reason: "readiness_changed" };
  }
  return { generate: true, reason: "ready" };
}

export function actionStateToPendingWriteOutcome(
  result: AssistantActionState
): PendingWriteOutcome {
  if (result.error) {
    return {
      ok: false,
      error: result.error,
      mutation: result.assistantMutation,
    };
  }
  return {
    ok: true,
    mutation: result.assistantMutation,
  };
}

export function createPendingWriteTracker() {
  const inflight = new Set<Promise<PendingWriteOutcome>>();
  let lastFailure: PendingWriteOutcome | null = null;
  let lastMutation: AssistantMutationResult | undefined;

  function trackAction(
    work: Promise<AssistantActionState>
  ): Promise<AssistantActionState> {
    const tracked: Promise<PendingWriteOutcome> = work
      .then((result) => {
        const outcome = actionStateToPendingWriteOutcome(result);
        if (!outcome.ok) lastFailure = outcome;
        else {
          lastFailure = null;
          if (outcome.mutation) lastMutation = outcome.mutation;
        }
        return outcome;
      })
      .catch(() => {
        const outcome: PendingWriteOutcome = {
          ok: false,
          error: "Could not save. Please try again.",
        };
        lastFailure = outcome;
        return outcome;
      })
      .finally(() => {
        inflight.delete(tracked);
      });
    inflight.add(tracked);
    return work;
  }

  async function waitAll(): Promise<{
    readonly failed: PendingWriteOutcome | null;
    readonly lastMutation: AssistantMutationResult | undefined;
    readonly pendingRemaining: number;
  }> {
    const outcomes: PendingWriteOutcome[] = [];
    const seen = new Set<Promise<PendingWriteOutcome>>();
    while (inflight.size > 0) {
      const batch = [...inflight].filter((row) => !seen.has(row));
      if (batch.length === 0) break;
      for (const row of batch) seen.add(row);
      outcomes.push(...(await Promise.all(batch)));
    }
    const inflightFailed = outcomes.find((row) => !row.ok) ?? null;
    const failed = inflightFailed ?? lastFailure;
    lastFailure = null;
    const mutation =
      [...outcomes].reverse().find((row) => row.mutation)?.mutation ??
      lastMutation;
    return {
      failed,
      lastMutation: mutation,
      pendingRemaining: inflight.size,
    };
  }

  function clearFailure(): void {
    lastFailure = null;
  }

  return {
    trackAction,
    waitAll,
    clearFailure,
    get size() {
      return inflight.size;
    },
  };
}

export function createGenerateOnceLock() {
  let locked = false;
  return {
    tryAcquire(): boolean {
      if (locked) return false;
      locked = true;
      return true;
    },
    release(): void {
      locked = false;
    },
    get locked() {
      return locked;
    },
  };
}

export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
