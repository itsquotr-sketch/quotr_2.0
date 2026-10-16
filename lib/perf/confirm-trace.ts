import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * PERFORMANCE-02 — confirmation action timings.
 * Preview and local development only. Identifiers and durations, no request bodies.
 */

type Span = { name: string; ms: number };

type Trace = {
  spans: Span[];
};

const storage = new AsyncLocalStorage<Trace>();

export function isConfirmTraceEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return (
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "preview"
  );
}

export async function traceOp<T>(name: string, run: () => PromiseLike<T>): Promise<T> {
  const trace = storage.getStore();
  if (!trace) return run();
  const started = performance.now();
  try {
    return await run();
  } finally {
    trace.spans.push({ name, ms: Math.round(performance.now() - started) });
  }
}

export function traceSync(name: string, run: () => void): void {
  const trace = storage.getStore();
  if (!trace) {
    run();
    return;
  }
  const started = performance.now();
  try {
    run();
  } finally {
    trace.spans.push({ name, ms: Math.round(performance.now() - started) });
  }
}

export async function runConfirmTrace<T>(
  projectId: string,
  run: () => Promise<T>
): Promise<T> {
  if (!isConfirmTraceEnabled()) return run();
  const trace: Trace = { spans: [] };
  const started = performance.now();
  try {
    return await storage.run(trace, run);
  } finally {
    const total = Math.round(performance.now() - started);
    const uptimeMs = Math.round(process.uptime() * 1000);
    const detail = trace.spans.map((span) => `${span.name}=${span.ms}`).join(" ");
    console.info(
      `[perf-02] confirm project=${projectId} uptimeMs=${uptimeMs} total=${total} ops=${trace.spans.length} ${detail}`
    );
  }
}
