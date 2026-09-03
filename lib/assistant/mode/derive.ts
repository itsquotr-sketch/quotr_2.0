/**
 * RECOVERY-5A — Deterministic Assistant UI mode.
 *
 * Owner:
 *   projects.stage / estimate row (canonical) + editJobOpen (ephemeral UI)
 * Persistence:
 *   edit_job is NOT persisted. Refresh with a current/stale estimate → estimate_ready.
 *   Hard-minimum missing and no estimate row → planning (Clarify), never an empty Estimate Ready shell.
 * Reset:
 *   Outer Edit Job exit is Done (return to Estimate Ready). Successful
 *   regenerate closes edit_job.
 *
 * Done vs Cancel:
 *   Job Plan / fact / constraint writes persist immediately through canonical
 *   actions, so the workspace exit is Done — not Cancel/rollback.
 *   Inner editors that stage local changes (Quality Save/Cancel) may still
 *   cancel only that staged edit.
 */

import type {
  AssistantUiMode,
  DeriveAssistantUiModeInput,
  StaleMoneyPresentation,
} from "@/lib/assistant/mode/types";

export function deriveAssistantUiMode(
  input: DeriveAssistantUiModeInput
): AssistantUiMode {
  if (!input.hasEstimate) return "planning";
  if (input.editJobOpen) return "edit_job";
  return "estimate_ready";
}

export const STALE_ESTIMATE_HEADING = "Estimate needs updating";
export const STALE_ESTIMATE_EXPLANATION =
  "Update this estimate to apply the latest job details and company settings.";

export function staleEstimateMoneyPresentation(
  isStale: boolean
): StaleMoneyPresentation {
  if (isStale) {
    return {
      heading: STALE_ESTIMATE_HEADING,
      explanation: STALE_ESTIMATE_EXPLANATION,
      sellLabel: "Previous estimate",
      treatAsCurrent: false,
      leadWithPrice: false,
    };
  }
  return {
    heading: "Estimate ready",
    explanation: null,
    sellLabel: "Recommended sell",
    treatAsCurrent: true,
    leadWithPrice: true,
  };
}

export function formatWorkAreaSummaryLine(
  names: readonly string[]
): string {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) return "Project";
  if (cleaned.length === 1) return cleaned[0]!;
  return `${cleaned.length} Work Areas`;
}

export function formatWorkAreaSummaryDetail(
  names: readonly string[]
): string | null {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length <= 1) return null;
  return cleaned.join(" · ");
}
