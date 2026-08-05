import { deepFreeze } from "../immutability";
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

  const prior = params.priorSnapshot;
  const current = params.currentSnapshot;

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
