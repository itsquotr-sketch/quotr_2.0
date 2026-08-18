/**
 * Stage 3.1B.7D — Approved Assistant action language (presentation only).
 */

export const ASSISTANT_ACTION_LABELS = Object.freeze({
  analyseJob: "Analyse Job",
  confirmWorkAreas: "Confirm Work Areas",
  savingWorkAreas: "Saving Work Areas…",
  workAreasSaved: "Work Areas saved",
  confirmScope: "Confirm scope",
  editScope: "Edit scope",
  includeInScope: "Include in scope",
  notRequired: "Not required",
  answerInScopeDetails: "Answer in Scope Details",
  selectSpecification: "Select specification",
  save: "Save",
  saveSpecification: "Save",
  reviewDetails: "Review details",
  generateEstimate: "Generate estimate",
  estimateNow: "Estimate now",
  reviewEstimate: "Review estimate",
  recalculateEstimate: "Recalculate estimate",
  viewFullBreakdown: "View full breakdown",
  analyseAgain: "Analyse again",
  analyseScope: "Analyse scope",
  saving: "Saving…",
  saved: "Saved",
  couldNotSave: "Could not save",
  retry: "Retry",
  cancel: "Cancel",
} as const);

export type AssistantActionKey = keyof typeof ASSISTANT_ACTION_LABELS;

export function actionLabel(key: AssistantActionKey): string {
  return ASSISTANT_ACTION_LABELS[key];
}

/** Loading copy — task-specific, no provider/config/fake percentages. */
export const ASSISTANT_LOADING_COPY = Object.freeze({
  analyseJob: "Analysing job…",
  scopeReview: "Reviewing scope…",
  analyseAgain: "Updating scope review…",
  confirmScope: "Saving scope decisions…",
  confirmWorkAreas: "Saving Work Areas…",
  questionSave: "Saving details…",
  specificationSave: "Saving specification…",
  constraintSave: "Saving project conditions…",
  estimateGenerate: "Generating Quick Estimate…",
  estimateRecalculate: "Recalculating estimate…",
  includeExclude: "Updating scope…",
} as const);
