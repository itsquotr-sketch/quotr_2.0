/**
 * Stage 3.1B.7D — Approved Assistant action language (presentation only).
 */

export const ASSISTANT_ACTION_LABELS = Object.freeze({
  analyseJob: "Analyse job",
  confirmWorkAreas: "Looks right — continue",
  looksRight: "Looks right — continue",
  savingWorkAreas: "Saving Work Areas…",
  workAreasSaved: "Work Areas saved",
  removeWorkArea: "Remove",
  confirmScope: "Confirm scope",
  editScope: "Edit",
  includeInScope: "Include in scope",
  notRequired: "Not required",
  answerInScopeDetails: "Answer in details",
  selectSpecification: "Select specification",
  save: "Save",
  saveSpecification: "Save",
  reviewDetails: "Review details",
  generateEstimate: "Create estimate",
  estimateNow: "Create estimate",
  estimateNowUsingAssumptions: "Estimate now using assumptions",
  useQuotrAssumption: "Not sure — use Quotr assumption",
  refineEstimate: "Refine estimate",
  reviewEstimate: "Review estimate",
  reviewPreviousEstimate: "Review previous estimate",
  editJob: "Edit job",
  editJobDetails: "Edit job details",
  continueToPricing: "Continue to Pricing",
  updateEstimate: "Update estimate",
  updatingEstimate: "Updating estimate…",
  done: "Done",
  recalculateEstimate: "Recalculate estimate",
  viewFullBreakdown: "View full breakdown",
  analyseAgain: "Try again",
  analyseScope: "Analyse scope",
  saving: "Saving…",
  saved: "Saved",
  couldNotSave: "Could not save",
  retry: "Try again",
  cancel: "Cancel",
  addWorkArea: "Add another Work Area",
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
  estimateGenerate: "Building your estimate…",
  estimateRecalculate: "Updating estimate…",
  includeExclude: "Updating scope…",
} as const);
