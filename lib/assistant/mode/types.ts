/**
 * RECOVERY-5A — Top-level Assistant UI mode contract.
 * Overlay on projects.stage + local edit disclosure. Not a DB enum.
 */

export const ASSISTANT_UI_MODES = [
  "planning",
  "estimate_ready",
  "edit_job",
] as const;

export type AssistantUiMode = (typeof ASSISTANT_UI_MODES)[number];

export const EDIT_JOB_SECTIONS = [
  "job_plan",
  "project_conditions",
  "details",
  "advanced",
] as const;

export type EditJobSection = (typeof EDIT_JOB_SECTIONS)[number];

export type DeriveAssistantUiModeInput = {
  /** Canonical current estimate row exists (may be stale). */
  readonly hasEstimate: boolean;
  /** Ephemeral local workspace. Not persisted. Refresh returns to estimate_ready. */
  readonly editJobOpen: boolean;
};

export type StaleMoneyPresentation = {
  readonly heading: "Estimate needs updating" | "Estimate ready";
  readonly explanation: string | null;
  readonly sellLabel: "Recommended sell" | "Previous estimate";
  readonly treatAsCurrent: boolean;
  /** When false, do not lead the surface with a current-style price. */
  readonly leadWithPrice: boolean;
};
