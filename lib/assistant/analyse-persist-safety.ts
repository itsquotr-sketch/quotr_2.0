/**
 * EF02-FINAL-R3-B — Analyse persist retry safety.
 *
 * Work-area insert can succeed while a later fact/constraint/stage write
 * fails. Retry must not stack this-attempt suggested rows.
 */

export type AnalysePersistFailureClass =
  | "persist_work_areas"
  | "persist_facts"
  | "persist_constraints"
  | "persist_stage";

export type SuggestedWorkAreaRow = {
  readonly id: string;
  readonly status?: string | null;
};

export type AnalyseAttemptState<TWorkArea extends SuggestedWorkAreaRow> = {
  workAreas: TWorkArea[];
  factWorkAreaIds: string[];
  stage: string;
  insertedWorkAreaIds: readonly string[];
};

/**
 * Remove only Work Areas inserted by THIS analyse attempt (suggested),
 * plus facts bound to those ids. Pre-existing confirmed / prior rows stay.
 */
export function rollbackThisAttemptAnalyseState<
  TWorkArea extends SuggestedWorkAreaRow,
>(state: AnalyseAttemptState<TWorkArea>): AnalyseAttemptState<TWorkArea> {
  const inserted = new Set(state.insertedWorkAreaIds);
  return {
    workAreas: state.workAreas.filter(
      (row) =>
        !inserted.has(row.id) ||
        (row.status != null && row.status !== "suggested")
    ),
    factWorkAreaIds: state.factWorkAreaIds.filter((id) => !inserted.has(id)),
    stage: "brief",
    insertedWorkAreaIds: [],
  };
}

export function analysePersistUserMessage(): string {
  return "Quotr hit a temporary problem analysing this job. Please try again.";
}
