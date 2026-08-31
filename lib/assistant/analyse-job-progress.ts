/**
 * Analyse Job staged progress copy (3.1B.6R3 / INCIDENT-AI-ANALYSE-02).
 * Pure — no React. No fabricated percentages.
 */

export const ANALYSE_JOB_PROGRESS_STEPS = Object.freeze([
  "Reviewing the project brief",
  "Reading site observations",
  "Identifying likely work areas",
  "Organising the project scope",
  "Analysing your job…",
] as const);

export function analyseJobProgressLabel(elapsedMs: number): string {
  if (elapsedMs < 2500) return ANALYSE_JOB_PROGRESS_STEPS[0];
  if (elapsedMs < 5500) return ANALYSE_JOB_PROGRESS_STEPS[1];
  if (elapsedMs < 9000) return ANALYSE_JOB_PROGRESS_STEPS[2];
  if (elapsedMs < 15000) return ANALYSE_JOB_PROGRESS_STEPS[3];
  if (elapsedMs < 30000) return ANALYSE_JOB_PROGRESS_STEPS[4];
  return "Still analysing — this can take a moment";
}
