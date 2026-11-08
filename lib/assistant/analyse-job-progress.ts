/**
 * Analyse Job staged progress copy (3.1B.6R3 / INCIDENT-AI-ANALYSE-02 / BETA-2).
 * Pure — no React. No fabricated percentages. No provider language.
 */

export const ANALYSE_BRIEF_LABEL = "Analysing your brief" as const;

export const ANALYSE_JOB_PROGRESS_STEPS = Object.freeze([
  ANALYSE_BRIEF_LABEL,
] as const);

/**
 * The extraction call is one wait. Later phases are not announced unless
 * the application has actually moved to them.
 */
export function analyseJobProgressLabel(_elapsedMs: number): string {
  return ANALYSE_BRIEF_LABEL;
}

export function analyseJobElapsedLabel(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Estimate generation progress — calculators and rates, not AI.
 * Elapsed-based only. No fake percentages.
 */
export const ESTIMATE_GENERATE_PROGRESS_STEPS = Object.freeze([
  "Building labour and materials…",
  "Applying your rates and Quotr benchmarks…",
  "Checking assumptions…",
] as const);

export function estimateGenerateProgressLabel(elapsedMs: number): string {
  if (elapsedMs < 1200) return ESTIMATE_GENERATE_PROGRESS_STEPS[0];
  if (elapsedMs < 2800) return ESTIMATE_GENERATE_PROGRESS_STEPS[1];
  return ESTIMATE_GENERATE_PROGRESS_STEPS[2];
}
