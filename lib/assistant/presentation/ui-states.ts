/**
 * Stage 3.1B.7D — Assistant UI state inventory (presentation only).
 * Documents expected stage presentations; does not replace completion helpers.
 */

export const ASSISTANT_STAGE_KEYS = [
  "project_capture",
  "work_areas",
  "scope_review",
  "specification",
  "scope_details",
  "site_constraints",
  "estimate_review",
  "quick_estimate",
] as const;

export type AssistantStageKey = (typeof ASSISTANT_STAGE_KEYS)[number];

export const ASSISTANT_UI_STATES = [
  "initial",
  "empty",
  "ready",
  "loading",
  "saving",
  "saved",
  "warning",
  "error",
  "incomplete",
  "locked",
  "complete",
  "stale",
  "disabled",
  "collapsed",
  "expanded",
] as const;

export type AssistantUiState = (typeof ASSISTANT_UI_STATES)[number];

/**
 * Canonical empty-state copy (restrained, no technical/blame language).
 */
export const ASSISTANT_EMPTY_STATES = Object.freeze({
  project_capture: {
    title: "No project information has been added yet.",
    nextAction: "Add a project brief to continue.",
  },
  work_areas: {
    title: "No Work Areas have been confirmed.",
    nextAction: "Confirm Work Areas to continue.",
  },
  scope_review: {
    title:
      "Quotr did not identify additional scope from the current project information.",
    nextAction: "Confirm the scope to continue, or Analyse again if details change.",
  },
  specification: {
    title: "No specification has been selected yet.",
    nextAction: "Select specification to continue.",
  },
  scope_details: {
    title: "No additional details are required for the confirmed scope.",
    nextAction: null,
  },
  site_constraints: {
    title:
      "No site constraints have been identified yet. Confirm anything that may affect how the work is carried out.",
    nextAction: "Review common site constraints below.",
  },
  estimate_review: {
    title:
      "The estimate review will appear once the required project details are complete.",
    nextAction: "Complete Scope Details and Project Conditions to continue.",
  },
  quick_estimate: {
    title: "Job plan confirmed. Estimate when clarified or safely assumed.",
    nextAction: "Answer remaining Clarify questions, or Estimate now using assumptions.",
  },
} as const);

/**
 * Which presentation states each stage is expected to support.
 * Inventory for verification — not a runtime state machine.
 */
export const STAGE_STATE_INVENTORY: Readonly<
  Record<AssistantStageKey, readonly AssistantUiState[]>
> = Object.freeze({
  project_capture: [
    "initial",
    "empty",
    "loading",
    "saving",
    "error",
    "incomplete",
    "complete",
    "collapsed",
    "expanded",
  ],
  work_areas: [
    "initial",
    "empty",
    "ready",
    "saving",
    "error",
    "incomplete",
    "complete",
    "collapsed",
    "expanded",
  ],
  scope_review: [
    "initial",
    "empty",
    "ready",
    "loading",
    "saving",
    "saved",
    "warning",
    "error",
    "incomplete",
    "locked",
    "complete",
    "stale",
    "disabled",
    "collapsed",
    "expanded",
  ],
  specification: [
    "initial",
    "empty",
    "ready",
    "saving",
    "saved",
    "error",
    "locked",
    "incomplete",
    "complete",
    "collapsed",
    "expanded",
  ],
  scope_details: [
    "initial",
    "empty",
    "ready",
    "saving",
    "saved",
    "error",
    "incomplete",
    "complete",
    "collapsed",
    "expanded",
  ],
  site_constraints: [
    "initial",
    "empty",
    "ready",
    "saving",
    "saved",
    "error",
    "incomplete",
    "complete",
    "collapsed",
    "expanded",
  ],
  estimate_review: [
    "initial",
    "empty",
    "ready",
    "saving",
    "warning",
    "error",
    "incomplete",
    "complete",
    "stale",
    "collapsed",
    "expanded",
  ],
  quick_estimate: [
    "initial",
    "empty",
    "ready",
    "loading",
    "saving",
    "warning",
    "error",
    "incomplete",
    "complete",
    "stale",
    "disabled",
    "collapsed",
    "expanded",
  ],
});

export function emptyStateForStage(stage: AssistantStageKey): {
  readonly title: string;
  readonly nextAction: string | null;
} {
  return ASSISTANT_EMPTY_STATES[stage];
}
