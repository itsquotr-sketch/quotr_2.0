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
  extended: "This can take up to a minute.",
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
}): string {
  if (params.stage === "saving") return GENERATE_STATUS_COPY.saving;
  if (params.stage === "readiness") return GENERATE_STATUS_COPY.readiness;
  return GENERATE_STATUS_COPY.building;
}

/** Honest wait note. It does not replace the stage the client already knows. */
export function generateStatusSupporting(elapsedMs: number): string | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < GENERATE_EXTENDED_COPY_MS) {
    return null;
  }
  return GENERATE_STATUS_COPY.extended;
}

/** Persisted facts win. A pre-save snapshot is only a fallback when nothing settled. */
export function settledFactsForGenerate<T>(
  snapshot: readonly T[],
  settled: readonly T[]
): readonly T[] {
  return settled.length > 0 ? settled : snapshot;
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
  result: AssistantActionState | null | undefined
): PendingWriteOutcome {
  if (!result || result.error) {
    return {
      ok: false,
      error: result?.error || "Could not save. Please try again.",
      mutation: result?.assistantMutation,
    };
  }
  return {
    ok: true,
    mutation: result.assistantMutation,
  };
}

/** Bound for a save request that never settles. A settled rejection finishes immediately. */
export const SAVE_REQUEST_TIMEOUT_MS = 45_000;

/** Above the measured productivity apply. Only an unsettled request fails here. */
export const PRODUCTIVITY_APPLY_TIMEOUT_MS = 90_000;

/**
 * Follow the request. A rejection is the result. The timeout applies only when
 * the promise does not settle, and it fails the save rather than treating it as done.
 */
export function settleSaveRequest<T>(
  work: Promise<T>,
  timeoutMs: number = SAVE_REQUEST_TIMEOUT_MS
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Could not save. Please try again."));
    }, timeoutMs);
    work.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("Could not save. Please try again."));
      }
    );
  });
}

type TrackedWriteMeta = {
  readonly requestSeq?: number;
  readonly keys?: readonly string[];
};

type WriteAttempt = {
  readonly seq: number;
  readonly keys: readonly string[];
  readonly ok: boolean;
  readonly error?: string;
  readonly mutation?: AssistantMutationResult;
};

type TrackedWrite = {
  readonly seq: number;
  readonly keys: readonly string[];
  readonly promise: Promise<PendingWriteOutcome>;
};

export function createPendingWriteTracker() {
  const inflight = new Set<TrackedWrite>();
  const attempts: WriteAttempt[] = [];
  let wake: () => void = () => {};

  function poke(): void {
    const current = wake;
    wake = () => {};
    current();
  }

  function latestByKey(): Map<string, WriteAttempt> {
    const latest = new Map<string, WriteAttempt>();
    for (const attempt of attempts) {
      const keys = attempt.keys.length > 0 ? attempt.keys : ["*"];
      for (const key of keys) {
        const prev = latest.get(key);
        if (!prev || attempt.seq >= prev.seq) latest.set(key, attempt);
      }
    }
    return latest;
  }

  function blockingFailure(open: readonly TrackedWrite[]): PendingWriteOutcome | null {
    for (const [key, attempt] of latestByKey()) {
      if (attempt.ok) continue;
      const superseded = open.some(
        (row) =>
          row.seq > attempt.seq &&
          (row.keys.length === 0 || row.keys.includes(key) || key === "*")
      );
      if (!superseded) {
        return {
          ok: false,
          error: attempt.error,
          mutation: attempt.mutation,
        };
      }
    }
    return null;
  }

  function settledAuthority(): {
    readonly lastMutation: AssistantMutationResult | undefined;
    readonly lastMutationSeq: number;
    readonly authoritativeSeq: number;
  } {
    let authoritativeSeq = -1;
    let lastMutationSeq = -1;
    let lastMutation: AssistantMutationResult | undefined;
    for (const attempt of attempts) {
      if (!attempt.ok) continue;
      if (attempt.seq >= authoritativeSeq) authoritativeSeq = attempt.seq;
      if (attempt.mutation && attempt.seq >= lastMutationSeq) {
        lastMutationSeq = attempt.seq;
        lastMutation = attempt.mutation;
      }
    }
    return { lastMutation, lastMutationSeq, authoritativeSeq };
  }

  function trackAction(
    work: Promise<AssistantActionState>,
    meta?: TrackedWriteMeta
  ): Promise<AssistantActionState> {
    const seq = meta?.requestSeq ?? 0;
    const keys = meta?.keys ?? [];
    const entry: {
      seq: number;
      keys: readonly string[];
      promise: Promise<PendingWriteOutcome>;
    } = {
      seq,
      keys,
      promise: Promise.resolve({ ok: false }),
    };
    entry.promise = work
      .then((result) => {
        const outcome = actionStateToPendingWriteOutcome(result);
        attempts.push({
          seq,
          keys,
          ok: outcome.ok,
          error: outcome.error,
          mutation: outcome.mutation,
        });
        return outcome;
      })
      .catch(() => {
        const outcome: PendingWriteOutcome = {
          ok: false,
          error: "Could not save. Please try again.",
        };
        attempts.push({ seq, keys, ok: false, error: outcome.error });
        return outcome;
      })
      .finally(() => {
        inflight.delete(entry);
        poke();
      });
    inflight.add(entry);
    return work;
  }

  async function waitAll(): Promise<{
    readonly failed: PendingWriteOutcome | null;
    readonly lastMutation: AssistantMutationResult | undefined;
    readonly lastMutationSeq: number;
    readonly authoritativeSeq: number;
    readonly pendingRemaining: number;
  }> {
    while (true) {
      const failedNow = blockingFailure([...inflight]);
      if (failedNow) {
        return {
          failed: failedNow,
          ...settledAuthority(),
          pendingRemaining: inflight.size,
        };
      }
      if (inflight.size === 0) {
        return {
          failed: blockingFailure([]),
          ...settledAuthority(),
          pendingRemaining: 0,
        };
      }
      await new Promise<void>((resolve) => {
        wake = () => {
          wake = () => {};
          resolve();
        };
        if (blockingFailure([...inflight]) || inflight.size === 0) wake();
      });
    }
  }

  function clearFailure(): void {
    attempts.length = 0;
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
