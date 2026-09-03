/**
 * Analyse Job staged progress copy (3.1B.6R3 / INCIDENT-AI-ANALYSE-02 / BETA-2).
 * Pure — no React. No fabricated percentages. No provider language.
 */

export const ANALYSE_JOB_PROGRESS_STEPS = Object.freeze([
  "Reading your job details",
  "Finding the work involved",
  "Checking what we still need",
  "Organising the job",
  "Still working — this can take a moment",
] as const);

export function analyseJobProgressLabel(elapsedMs: number): string {
  if (elapsedMs < 2500) return ANALYSE_JOB_PROGRESS_STEPS[0];
  if (elapsedMs < 8000) return ANALYSE_JOB_PROGRESS_STEPS[1];
  if (elapsedMs < 16000) return ANALYSE_JOB_PROGRESS_STEPS[2];
  if (elapsedMs < 30000) return ANALYSE_JOB_PROGRESS_STEPS[3];
  return ANALYSE_JOB_PROGRESS_STEPS[4];
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
