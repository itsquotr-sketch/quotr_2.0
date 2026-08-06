/**
 * Analyse Job staged progress copy (3.1B.6R3).
 * Pure — no React; shared with Scope Review pattern but task-specific wording.
 */

export const ANALYSE_JOB_PROGRESS_STEPS = Object.freeze([
  "Reviewing the project brief",
  "Reading site observations",
  "Identifying likely work areas",
  "Organising the project scope",
  "Preparing work areas for review",
] as const);

export function analyseJobProgressLabel(elapsedMs: number): string {
  if (elapsedMs < 2500) return ANALYSE_JOB_PROGRESS_STEPS[0];
  if (elapsedMs < 5500) return ANALYSE_JOB_PROGRESS_STEPS[1];
  if (elapsedMs < 9000) return ANALYSE_JOB_PROGRESS_STEPS[2];
  if (elapsedMs < 14000) return ANALYSE_JOB_PROGRESS_STEPS[3];
  return ANALYSE_JOB_PROGRESS_STEPS[4];
}
