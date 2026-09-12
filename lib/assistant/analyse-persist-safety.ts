/**
 * EF02-FINAL-R3-B / R4-A — Analyse persist retry safety.
 *
 * Work-area insert can succeed while a later fact/constraint/stage write
 * fails. Retry must not stack this-attempt suggested rows, and must restore
 * only the Project Conditions this attempt touched.
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

export type ConstraintPersistRow = {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly value: unknown;
  readonly source: string;
};

export type TouchedConstraintSnapshot = {
  readonly key: string;
  readonly prior: ConstraintPersistRow | null;
};

export type ConstraintRestorePlan = {
  readonly deleteKeys: readonly string[];
  readonly restore: readonly ConstraintPersistRow[];
};

/**
 * Snapshot only keys this Analyse attempt will write.
 * Missing keys are prior=null so failure deletes the this-attempt insert.
 */
export function snapshotTouchedConstraints(
  existing: readonly ConstraintPersistRow[],
  touchedKeys: readonly string[]
): TouchedConstraintSnapshot[] {
  const byKey = new Map(existing.map((row) => [row.key, row]));
  const seen = new Set<string>();
  const snapshots: TouchedConstraintSnapshot[] = [];
  for (const key of touchedKeys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    snapshots.push({
      key,
      prior: byKey.get(key) ?? null,
    });
  }
  return snapshots;
}

/**
 * Restore plan for a failed attempt. Unrelated keys are omitted.
 * New this-attempt rows are deleted. Overwritten rows return to prior
 * value/source/label.
 */
export function planConstraintRollback(
  snapshots: readonly TouchedConstraintSnapshot[]
): ConstraintRestorePlan {
  const deleteKeys: string[] = [];
  const restore: ConstraintPersistRow[] = [];
  for (const snapshot of snapshots) {
    if (snapshot.prior == null) {
      deleteKeys.push(snapshot.key);
    } else {
      restore.push(snapshot.prior);
    }
  }
  return { deleteKeys, restore };
}

export function applyConstraintRollbackToStore<T extends ConstraintPersistRow>(
  current: readonly T[],
  plan: ConstraintRestorePlan
): T[] {
  const deleteSet = new Set(plan.deleteKeys);
  const restoreByKey = new Map(plan.restore.map((row) => [row.key, row]));
  const next = current.filter((row) => !deleteSet.has(row.key));
  return next.map((row) => {
    const prior = restoreByKey.get(row.key);
    if (!prior) return row;
    return {
      ...row,
      label: prior.label,
      value: prior.value,
      source: prior.source,
    };
  });
}

export function analysePersistUserMessage(): string {
  return "Quotr hit a temporary problem analysing this job. Please try again.";
}
