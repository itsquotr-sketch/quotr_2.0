import { deepFreeze } from "../immutability";
import {
  isConstraintMaterialForDiscoveryStale,
  isFactMaterialForDiscoveryStale,
} from "../scope-impact";
import type {
  ScopeDiscoverySourceSnapshot,
  StaleRunComparison,
  StaleRunEvaluation,
} from "./types";

const MATERIAL_FIELDS = [
  "briefRevision",
  "noteRevisionSet",
  "factRevisions",
  "constraintRevisions",
  "workAreaRevisions",
  "catalogueVersion",
  "contractVersion",
  "promptVersion",
  "analysisObjective",
] as const;

type MaterialField = (typeof MATERIAL_FIELDS)[number];

function sortedRevisionDigest(
  items: readonly { readonly revision: string; readonly key?: string; readonly id?: string }[],
  emptyToken: string
): string {
  const joined = [...items]
    .map((i) => `${i.id ?? i.key ?? ""}:${i.revision}`)
    .sort()
    .join("|");
  return joined || emptyToken;
}

/**
 * Strip non-material fact/constraint keys from a snapshot before compare.
 * Fixes historical runs that stored DETAIL_ONLY / ordinary constraints in
 * fingerprints while the collector now filters them from current sources.
 */
export function normaliseSnapshotForStaleCompare(
  snapshot: ScopeDiscoverySourceSnapshot
): ScopeDiscoverySourceSnapshot {
  const factKeys = (snapshot.factKeysAndRevisions ?? []).filter((f) =>
    isFactMaterialForDiscoveryStale(f.key)
  );
  const constraintKeys = (snapshot.constraintKeysAndRevisions ?? []).filter(
    (c) => isConstraintMaterialForDiscoveryStale(c.key)
  );

  return deepFreeze({
    ...snapshot,
    factKeysAndRevisions: factKeys,
    factRevisions: sortedRevisionDigest(factKeys, "facts:empty"),
    constraintKeysAndRevisions: constraintKeys,
    constraintRevisions: sortedRevisionDigest(
      constraintKeys,
      "constraints:empty"
    ),
  });
}

/**
 * Deterministic BEFORE/AFTER diff of material fingerprint fields.
 * Useful for owner diagnostics — does not change evaluation semantics.
 */
export function diffMaterialSourceFields(params: {
  readonly prior: ScopeDiscoverySourceSnapshot | null;
  readonly current: ScopeDiscoverySourceSnapshot;
}): readonly {
  readonly field: MaterialField;
  readonly priorValue: string;
  readonly currentValue: string;
}[] {
  if (!params.prior) return [];
  const prior = normaliseSnapshotForStaleCompare(params.prior);
  const current = normaliseSnapshotForStaleCompare(params.current);
  const out: {
    field: MaterialField;
    priorValue: string;
    currentValue: string;
  }[] = [];
  for (const key of MATERIAL_FIELDS) {
    const a = String(prior[key] ?? "");
    const b = String(current[key] ?? "");
    if (a !== b) {
      out.push({ field: key, priorValue: a, currentValue: b });
    }
  }
  return out;
}

/**
 * Compare a prior run snapshot with current source inputs.
 * Stale means “analysis should be rerun”, not “accepted work should be deleted”.
 * Provider/model-only change does not stale the historical result.
 */
export function evaluateStaleRun(params: {
  readonly priorSnapshot: ScopeDiscoverySourceSnapshot | null;
  readonly currentSnapshot: ScopeDiscoverySourceSnapshot;
  readonly priorRunId: string | null;
  readonly priorOrchestrationVersion?: string | null;
}): StaleRunEvaluation {
  if (!params.priorSnapshot) {
    return deepFreeze({
      comparison: "CANNOT_COMPARE" as StaleRunComparison,
      reasons: ["No prior snapshot supplied."],
      changedSources: [],
      priorRunId: params.priorRunId,
    });
  }

  const prior = normaliseSnapshotForStaleCompare(params.priorSnapshot);
  const current = normaliseSnapshotForStaleCompare(params.currentSnapshot);

  if (
    params.priorOrchestrationVersion &&
    params.priorOrchestrationVersion !== current.orchestrationVersion
  ) {
    // Version drift — do not rewrite old result; flag for review.
    return deepFreeze({
      comparison: "UNKNOWN_VERSION" as StaleRunComparison,
      reasons: [
        "Orchestration or contract lineage differs; historical result retained.",
      ],
      changedSources: ["orchestrationVersion"],
      priorRunId: params.priorRunId,
    });
  }

  const changed: string[] = [];
  for (const key of MATERIAL_FIELDS) {
    const a = prior[key as MaterialField];
    const b = current[key as MaterialField];
    if (a !== b) changed.push(key);
  }

  const providerOnly =
    prior.providerModelId !== current.providerModelId && changed.length === 0;
  const formattingOnly =
    prior.formattingRevision !== current.formattingRevision &&
    changed.length === 0;

  if (providerOnly) {
    return deepFreeze({
      comparison: "CURRENT_PROVIDER_CHANGED_ONLY" as StaleRunComparison,
      reasons: [
        "Provider/model metadata changed only — historical result remains current.",
      ],
      changedSources: ["providerModelId"],
      priorRunId: params.priorRunId,
    });
  }

  if (formattingOnly) {
    return deepFreeze({
      comparison: "CURRENT_FORMATTING_CHANGE_ONLY" as StaleRunComparison,
      reasons: ["Formatting-only change — historical result remains current."],
      changedSources: ["formattingRevision"],
      priorRunId: params.priorRunId,
    });
  }

  if (changed.length > 0) {
    return deepFreeze({
      comparison: "STALE_MATERIAL_CHANGE" as StaleRunComparison,
      reasons: changed.map((c) => `Material source changed: ${c}`),
      changedSources: changed,
      priorRunId: params.priorRunId,
    });
  }

  return deepFreeze({
    comparison: "CURRENT" as StaleRunComparison,
    reasons: [],
    changedSources: [],
    priorRunId: params.priorRunId,
  });
}
