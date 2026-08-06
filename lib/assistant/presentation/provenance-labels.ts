/**
 * Stage 3.1B.7C — Provenance / source presentation labels.
 * Does not alter persistence or source precedence.
 */

import type { ScopeReviewSourceLabel } from "@/lib/assistant/types";

/** Approved user-facing source wording. */
export function provenanceLabelForScopeSource(
  source: ScopeReviewSourceLabel | string,
  opts?: { readonly hasManualOverride?: boolean; readonly needsConfirmation?: boolean }
): string {
  if (opts?.hasManualOverride) return "Manual override";
  if (opts?.needsConfirmation) return "Needs confirmation";

  switch (source) {
    case "brief":
      return "From project brief";
    case "answered":
      return "Answered by you";
    case "calculated":
      return "Calculated";
    case "assumed":
      return "Default assumption";
    case "default":
      return "Default assumption";
    case "system":
      return "System";
    case "project spec":
      return "Project specification";
    default:
      return "Answered by you";
  }
}

export function provenanceLabelForQuestionSource(
  source: "user" | "ai_extracted" | "system" | "derived" | string | null | undefined
): string | null {
  if (!source) return null;
  if (source === "user") return "Answered by you";
  if (source === "ai_extracted") return "From project brief";
  if (source === "derived") return "Calculated";
  if (source === "system") return "Default assumption";
  return null;
}
