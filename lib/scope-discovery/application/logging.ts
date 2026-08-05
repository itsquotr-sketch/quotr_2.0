/**
 * Safe structured logging for scope discovery application layer.
 * Never logs secrets, brief/notes content, evidence excerpts, or raw DB errors.
 */

export type DiscoveryLogEvent =
  | "run_requested"
  | "run_reused"
  | "run_started"
  | "deterministic_completed"
  | "provider_completed"
  | "provider_failed"
  | "persistence_completed"
  | "persistence_failed"
  | "decision_completed"
  | "decision_failed"
  | "feature_disabled"
  | "results_read";

export interface DiscoveryLogFields {
  readonly event: DiscoveryLogEvent;
  readonly projectId?: string;
  readonly runId?: string;
  readonly suggestionId?: string;
  readonly decisionId?: string;
  readonly status?: string;
  readonly code?: string;
  readonly elapsedMs?: number;
  readonly inputTokens?: number | null;
  readonly outputTokens?: number | null;
  readonly providerCalled?: boolean;
  readonly reused?: boolean;
  readonly featureEnabled?: boolean;
}

export function logDiscoveryEvent(fields: DiscoveryLogFields): void {
  const payload: Record<string, unknown> = {
    scope: "scope-discovery",
    event: fields.event,
  };
  if (fields.projectId) payload.projectId = fields.projectId;
  if (fields.runId) payload.runId = fields.runId;
  if (fields.suggestionId) payload.suggestionId = fields.suggestionId;
  if (fields.decisionId) payload.decisionId = fields.decisionId;
  if (fields.status) payload.status = fields.status;
  if (fields.code) payload.code = fields.code;
  if (fields.elapsedMs != null) payload.elapsedMs = fields.elapsedMs;
  if (fields.inputTokens != null) payload.inputTokens = fields.inputTokens;
  if (fields.outputTokens != null) payload.outputTokens = fields.outputTokens;
  if (fields.providerCalled != null) payload.providerCalled = fields.providerCalled;
  if (fields.reused != null) payload.reused = fields.reused;
  if (fields.featureEnabled != null) payload.featureEnabled = fields.featureEnabled;

  if (
    fields.event === "persistence_failed" ||
    fields.event === "decision_failed" ||
    fields.event === "provider_failed"
  ) {
    console.error("[scope-discovery]", payload);
    return;
  }

  console.info("[scope-discovery]", payload);
}
