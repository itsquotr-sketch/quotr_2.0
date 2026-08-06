/**
 * Stage 3.1B.7D — Lightweight Preview-only timing helper.
 * Observational only — not SLOs. No external analytics. No sensitive payloads.
 */

export type PreviewPerfMark =
  | "assistant_server_render"
  | "analyse_job"
  | "scope_review_run"
  | "confirm_scope"
  | "question_save_ack"
  | "question_save_complete"
  | "estimate_generate"
  | "decision_action";

type PerfSample = {
  readonly mark: PreviewPerfMark;
  readonly durationMs: number;
  readonly at: number;
};

const samples: PerfSample[] = [];
const MAX_SAMPLES = 40;

function isPreviewInstrumentationEnabled(): boolean {
  if (typeof process === "undefined") return false;
  // Local/Preview only — never force in production builds via public flag.
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.SCOPE_DISCOVERY_ENABLED === "true"
  );
}

export function previewPerfNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * Record a completed timing. Never logs brief, notes, client data, evidence,
 * API keys, or provider bodies.
 */
export function recordPreviewPerf(
  mark: PreviewPerfMark,
  durationMs: number
): void {
  if (!isPreviewInstrumentationEnabled()) return;
  if (!Number.isFinite(durationMs) || durationMs < 0) return;

  samples.push({
    mark,
    durationMs: Math.round(durationMs),
    at: Date.now(),
  });
  if (samples.length > MAX_SAMPLES) {
    samples.shift();
  }

  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[quotr-preview-perf] ${mark}=${Math.round(durationMs)}ms`);
  }
}

export function startPreviewPerf(mark: PreviewPerfMark): () => void {
  const started = previewPerfNow();
  return () => {
    recordPreviewPerf(mark, previewPerfNow() - started);
  };
}

/** Test/inspection helper — returns a copy of recent samples. */
export function getPreviewPerfSamples(): readonly PerfSample[] {
  return samples.slice();
}

export function clearPreviewPerfSamples(): void {
  samples.length = 0;
}
