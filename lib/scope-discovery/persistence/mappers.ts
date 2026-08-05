import type {
  CompleteRunInput,
  PersistDecisionInput,
  PersistRunInput,
  PersistSuggestionInput,
} from "./types";

/** Strip accidental secret-looking keys from JSON metadata before persist. */
function sanitiseMetadata(
  value: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!value) return null;
  const blocked = new Set([
    "apiKey",
    "api_key",
    "ANTHROPIC_API_KEY",
    "secret",
    "password",
    "rawResponse",
    "raw_response",
    "prompt",
    "systemPrompt",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (blocked.has(key)) continue;
    out[key] = child;
  }
  return out;
}

export function mapRunInsert(
  input: PersistRunInput,
  orgId: string,
  requestedBy: string | null
) {
  return {
    id: input.id,
    org_id: orgId,
    project_id: input.projectId,
    requested_by: requestedBy,
    trigger: input.trigger,
    status: input.status,
    source_fingerprint: input.sourceFingerprint,
    idempotency_key: input.idempotencyKey,
    contract_version: input.contractVersion,
    catalogue_version: input.catalogueVersion,
    prompt_version: input.promptVersion,
    provider: input.provider,
    model: input.model,
    analysis_objective: input.analysisObjective,
    source_snapshot: input.sourceSnapshot,
    provider_metadata: sanitiseMetadata(input.providerMetadata),
    warnings: [...input.warnings],
    errors: [...input.errors],
    latency_ms: input.latencyMs,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    repair_attempted: input.repairAttempted,
    provider_called: input.providerCalled,
    reused_run_id: input.reusedRunId,
    superseded_run_id: input.supersededRunId,
    started_at: input.startedAt,
    completed_at: input.completedAt,
  };
}

export function mapCompleteRunPatch(input: CompleteRunInput) {
  return {
    status: input.status,
    warnings: input.warnings ? [...input.warnings] : undefined,
    errors: input.errors ? [...input.errors] : undefined,
    latency_ms: input.latencyMs,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    repair_attempted: input.repairAttempted,
    provider_called: input.providerCalled,
    provider: input.provider,
    model: input.model,
    provider_metadata: sanitiseMetadata(input.providerMetadata ?? null),
    completed_at: input.completedAt,
  };
}

export function mapSuggestionInsert(
  input: PersistSuggestionInput,
  orgId: string
) {
  return {
    id: input.id,
    org_id: orgId,
    project_id: input.projectId,
    run_id: input.runId,
    suggestion_identity: input.suggestionIdentity,
    suggestion_kind: input.suggestionKind,
    proposed_work_area_type: input.proposedWorkAreaType,
    proposed_title: input.proposedTitle,
    proposed_description: input.proposedDescription,
    related_work_area_id: input.relatedWorkAreaId,
    parent_suggestion_id: input.parentSuggestionId,
    confidence: input.confidence,
    confidence_band: input.confidenceBand,
    original_status: "PROPOSED" as const,
    evidence: [...input.evidence],
    source_snapshot: input.sourceSnapshot,
    dependency_references: [...input.dependencyReferences],
    conflict_references: [...input.conflictReferences],
    missing_information: [...input.missingInformation],
    rationale_code: input.rationaleCode,
    contract_version: input.contractVersion,
    catalogue_version: input.catalogueVersion,
    prompt_version: input.promptVersion,
    provider_metadata: sanitiseMetadata(input.providerMetadata),
  };
}

export function mapDecisionInsert(
  input: PersistDecisionInput,
  orgId: string,
  decidedBy: string
) {
  return {
    id: input.id,
    org_id: orgId,
    project_id: input.projectId,
    run_id: input.runId,
    suggestion_id: input.suggestionId,
    decision_type: input.decisionType,
    decided_by: decidedBy,
    decided_at: input.decidedAt,
    reason_code: input.reasonCode,
    user_note: input.userNote,
    modified_title: input.modifiedTitle,
    modified_description: input.modifiedDescription,
    modified_work_area_type: input.modifiedWorkAreaType,
    source_revision: input.sourceRevision,
    created_work_area_id: null,
  };
}
