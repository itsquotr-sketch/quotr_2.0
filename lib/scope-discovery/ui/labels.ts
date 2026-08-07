/**
 * Human-facing labels for Scope Discovery Assistant UI (3.1B.6).
 * Pure — no React, no secrets, no raw underscore codes in user copy.
 */

import type { ComposedDecisionState } from "../application/types";

export const CONFIDENCE_BAND_LABELS = Object.freeze({
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
} as const);

export type UiConfidenceBand = keyof typeof CONFIDENCE_BAND_LABELS;

export function confidenceBandLabel(band: string | null | undefined): string {
  const normalised = String(band ?? "").toUpperCase();
  if (normalised === "HIGH") return CONFIDENCE_BAND_LABELS.HIGH;
  if (normalised === "MEDIUM") return CONFIDENCE_BAND_LABELS.MEDIUM;
  if (normalised === "LOW") return CONFIDENCE_BAND_LABELS.LOW;
  return "Confidence unknown";
}

export const SUGGESTION_KIND_LABELS = Object.freeze({
  WORK_AREA: "Work area",
  SUB_SCOPE: "Related scope",
  MISSING_SCOPE: "Missing scope",
  DEPENDENCY: "Dependency",
  POSSIBLE_EXCLUSION: "Possible exclusion",
  CLARIFICATION_REQUIRED: "Needs clarification",
  DUPLICATE_WARNING: "Possible duplicate",
  CONFLICT_WARNING: "Conflict",
} as const);

export function suggestionKindLabel(kind: string | null | undefined): string {
  const key = String(kind ?? "").toUpperCase();
  if (key in SUGGESTION_KIND_LABELS) {
    return SUGGESTION_KIND_LABELS[key as keyof typeof SUGGESTION_KIND_LABELS];
  }
  return "Suggestion";
}

export const DECISION_STATE_LABELS = Object.freeze({
  PROPOSED: "Open",
  ACCEPTED: "Added",
  REJECTED: "Not required",
  MODIFIED: "Added (edited)",
  STALE: "Out of date",
  SUPERSEDED: "Superseded",
} as const);

export function decisionStateLabel(
  state: ComposedDecisionState | string | null | undefined
): string {
  const key = String(state ?? "").toUpperCase();
  if (key in DECISION_STATE_LABELS) {
    return DECISION_STATE_LABELS[key as keyof typeof DECISION_STATE_LABELS];
  }
  return "Open";
}

/** Reject reason codes for dismiss dialog — persisted; never become company rules. */
export const DISMISS_REASON_OPTIONS = Object.freeze([
  { code: "already_covered", label: "Already covered" },
  { code: "not_part_of_job", label: "Not part of this job" },
  { code: "client_excluded", label: "Client excluded" },
  { code: "not_required", label: "Not required" },
  { code: "incorrect_suggestion", label: "Incorrect suggestion" },
  { code: "consider_later", label: "Consider later" },
  { code: "other", label: "Other" },
] as const);

export type DismissReasonCode =
  (typeof DISMISS_REASON_OPTIONS)[number]["code"];

export const SCOPE_DISCOVERY_UI_COPY = Object.freeze({
  cardTitle: "Scope Review",
  cardSubtitle:
    "Review related work items within your confirmed work areas — inclusions, omissions and clarifications.",
  emptyPurpose:
    "Quotr analyses scope after you confirm work areas. Review the checklist, then confirm the scope.",
  batchIntro:
    "Quotr has selected the scope items it believes are likely to apply. Untick anything that is not part of this job, then confirm the scope.",
  analyseButton: "Analyse scope",
  analyseAgainButton: "Analyse again",
  confirmScopeButton: "Confirm scope",
  editScopeButton: "Edit scope",
  savingScope: "Saving scope decisions…",
  scopeConfirmed: "Scope confirmed.",
  preparingAnalysis: "Preparing scope review…",
  staleNotice:
    "Your project information has changed since this scope review.",
  noSuggestions:
    "Quotr did not identify additional scope items from the current project information.",
  allDecided:
    "You have reviewed the current scope suggestions. Analyse again if project information changes.",
  providerPartialFailure:
    "Quotr completed the structured scope checks, but additional contextual suggestions were unavailable.",
  featureUnavailable: "Scope review is unavailable for this project.",
  qualityLocked:
    "Confirm the scope items above before selecting the specification level.",
  addWorkArea: "Add work area",
  editAndAdd: "Edit and add",
  includeInScope: "Include in scope",
  editAndInclude: "Edit and include",
  notRequired: "Not required",
  dismiss: "Dismiss",
  review: "Review",
  answerInScopeDetails: "Answer in Scope Details",
  reviewInScopeDetails: "Review in Scope Details",
  includePendingDetail: "Include pending detail",
  detailRequired: "Detail required",
  added: "Added",
  included: "Included",
  dismissed: "Not required",
  needsDetail: "To confirm in Scope Details",
  pendingScopeDetailsTitle: "To confirm in Scope Details",
  pendingScopeDetailsHint:
    "These items are included in scope. Quotr will ask for the missing information in Scope Details.",
  addedByYou: "Added by you",
  pricingRequired: "Pricing required",
  addScopeItem: "Add scope item",
  groupImportant: "Important inclusions",
  groupWorthChecking: "Worth checking",
  groupClarifications: "Clarifications",
  groupOther: "Other possibilities",
  groupConflicts: "Conflicts or issues",
  groupExcluded: "Not required",
} as const);

export const ANALYSIS_PROGRESS_STEPS = Object.freeze([
  "Preparing project information",
  "Reviewing related scope",
  "Checking for missing items",
  "Finalising suggestions",
] as const);

export function analysisProgressLabel(elapsedMs: number): string {
  if (elapsedMs < 2500) return ANALYSIS_PROGRESS_STEPS[0];
  if (elapsedMs < 6000) return ANALYSIS_PROGRESS_STEPS[1];
  if (elapsedMs < 12000) return ANALYSIS_PROGRESS_STEPS[2];
  return ANALYSIS_PROGRESS_STEPS[3];
}
