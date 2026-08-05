import { deepFreeze } from "./immutability";
import type {
  MaterialSourceKey,
  ScopeDiscoverySuggestion,
  ScopeDiscoverySuggestionStatus,
  SourceSnapshot,
  StalenessEvaluation,
  StalenessReason,
} from "./types";

const MATERIAL_KEYS: readonly MaterialSourceKey[] = [
  "briefRevision",
  "noteRevisionSet",
  "factRevisions",
  "constraintRevisions",
  "workAreaRevisions",
  "catalogueVersion",
  "contractVersion",
] as const;

const REASON_BY_KEY: Readonly<Record<MaterialSourceKey, StalenessReason>> =
  Object.freeze({
    briefRevision: "brief_changed",
    noteRevisionSet: "notes_changed",
    factRevisions: "facts_changed",
    constraintRevisions: "constraints_changed",
    workAreaRevisions: "work_areas_changed",
    catalogueVersion: "catalogue_version_changed",
    contractVersion: "contract_version_changed",
  });

/**
 * Pure staleness evaluator.
 *
 * - Accepted / modified suggestions do not become stale automatically.
 * - Provider/model-only changes are not material.
 * - Formatting-only changes are not material.
 * - Rejected suggestions: suppressionResetEligible when material sources change.
 */
export function evaluateStaleness(input: {
  readonly suggestion: ScopeDiscoverySuggestion;
  readonly currentSnapshot: SourceSnapshot;
  /** Optional allow-list of material keys to consider (defaults to all). */
  readonly relevantKeys?: readonly MaterialSourceKey[];
}): StalenessEvaluation {
  const status: ScopeDiscoverySuggestionStatus = input.suggestion.status;
  const prior = input.suggestion.sourceSnapshot;
  const current = input.currentSnapshot;
  const keys = input.relevantKeys ?? MATERIAL_KEYS;

  const changedSources: MaterialSourceKey[] = [];
  for (const key of keys) {
    if (prior[key] !== current[key]) {
      changedSources.push(key);
    }
  }

  const reasons = changedSources.map((k) => REASON_BY_KEY[k]);

  // Provider/model and formatting are never material on their own.
  const providerOnlyChanged =
    prior.providerModelId !== current.providerModelId &&
    changedSources.length === 0;
  const formattingOnlyChanged =
    prior.formattingRevision !== current.formattingRevision &&
    changedSources.length === 0;

  void providerOnlyChanged;
  void formattingOnlyChanged;

  const materialChanged = changedSources.length > 0;

  if (status === "ACCEPTED" || status === "MODIFIED") {
    return deepFreeze({
      isStale: false,
      reasons: [],
      changedSources: [],
      suppressionResetEligible: false,
    });
  }

  if (status === "REJECTED") {
    return deepFreeze({
      isStale: false,
      reasons: materialChanged ? reasons : [],
      changedSources: materialChanged ? changedSources : [],
      suppressionResetEligible: materialChanged,
    });
  }

  if (status === "PROPOSED") {
    return deepFreeze({
      isStale: materialChanged,
      reasons: materialChanged ? reasons : [],
      changedSources: materialChanged ? changedSources : [],
      suppressionResetEligible: false,
    });
  }

  // STALE / SUPERSEDED / FAILED — already non-actionable; report change info only.
  return deepFreeze({
    isStale: status === "STALE" || materialChanged,
    reasons: materialChanged ? reasons : [],
    changedSources: materialChanged ? changedSources : [],
    suppressionResetEligible: false,
  });
}
