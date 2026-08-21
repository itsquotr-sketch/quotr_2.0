/**
 * Canonical Work Area activity for remove-from-estimate.
 *
 * Active = present in `work_areas` and not excluded. Suggested and confirmed
 * both count. Job Plan card count, adapters, and focus must not be used.
 */

export const LAST_ACTIVE_WORK_AREA_MESSAGE =
  "At least one work area must remain in the estimate.";

export type CanonicalWorkAreaRef = {
  readonly id: string;
  readonly status: string;
};

export function isActiveCanonicalWorkAreaStatus(status: string): boolean {
  return status !== "excluded";
}

export function projectActiveCanonicalWorkAreas<T extends CanonicalWorkAreaRef>(
  serverWorkAreas: readonly T[],
  options?: {
    readonly optimisticExcludedIds?: readonly string[];
    readonly pendingAdded?: readonly T[];
  }
): T[] {
  const optimisticExcluded = new Set(options?.optimisticExcludedIds ?? []);
  const serverVisible = serverWorkAreas.filter(
    (wa) =>
      isActiveCanonicalWorkAreaStatus(wa.status) && !optimisticExcluded.has(wa.id)
  );
  const serverIds = new Set(serverVisible.map((wa) => wa.id));
  const pending = (options?.pendingAdded ?? []).filter(
    (wa) => !serverIds.has(wa.id) && !optimisticExcluded.has(wa.id)
  );
  return [...serverVisible, ...pending];
}

/**
 * Block only when `workAreaId` is the final remaining active canonical WA.
 */
export function canRemoveCanonicalWorkArea(
  active: readonly CanonicalWorkAreaRef[],
  workAreaId: string
): boolean {
  return active.filter((wa) => wa.id !== workAreaId).length >= 1;
}
