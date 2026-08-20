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
  | "estimate_generate_ack"
  | "estimate_generate_complete"
  | "decision_action"
  | "builder_interview_load"
  | "builder_interview_candidate_build"
  | "builder_interview_batch_save_ack"
  | "builder_interview_batch_save_complete"
  | "builder_interview_recompute"
  | "margin_save_ack"
  | "margin_save_complete"
  | "work_area_remove_complete"
  | "canonical_write_stale_projection";

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
  durationMs: number,
  meta?: { candidateCount?: number; writeCount?: number; ok?: boolean }
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
    const extras = meta
      ? ` candidates=${meta.candidateCount ?? "-"} writes=${meta.writeCount ?? "-"} ok=${meta.ok ?? "-"}`
      : "";
    console.info(
      `[quotr-preview-perf] ${mark}=${Math.round(durationMs)}ms${extras}`
    );
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
