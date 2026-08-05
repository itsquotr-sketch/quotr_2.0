/**
 * Pure/injected scope discovery execution pipeline.
 * No persistence, no Anthropic SDK, no environment access, no mutation of caller inputs.
 */

import {
  evaluateScopeRelationships,
  SCOPE_RELATIONSHIP_CATALOGUE,
} from "../catalogue";
import type { CatalogueEvaluationResult } from "../catalogue/evaluator";
import { deepFreeze } from "../immutability";
import type { ScopeDiscoveryProviderInput } from "../provider/types";
import type { ScopeDiscoveryProviderResult } from "../provider/types";
import type { ScopeDiscoverySuggestion } from "../types";
import {
  ORCHESTRATION_ERROR_CODES,
  ScopeDiscoveryOrchestrationError,
  safeOrchestrationFailureMessage,
} from "./errors";
import {
  buildIdempotencyKey,
  decideIdempotencyAction,
  isProviderAuthorised,
  triggerFamily,
} from "./idempotency";
import {
  buildPriorDecisionInputs,
  mergeDiscoveryStreams,
  validateFinalSuggestions,
} from "./merge-results";
import { buildRunResult, failureError } from "./result";
import {
  assertValidSnapshot,
  buildSourceSnapshot,
  computeSourceFingerprint,
  toContractSourceSnapshot,
} from "./source-snapshot";
import type {
  ExecutionContext,
  InjectedProviderRunner,
  ScopeDiscoveryRequest,
  ScopeDiscoveryRunResult,
} from "./types";
import { validateDiscoveryRequest } from "./validation";

function relationshipLookup(
  relationshipId: string
): { candidateScopeType: string } | null {
  const rel = SCOPE_RELATIONSHIP_CATALOGUE.find(
    (r) => r.relationshipId === relationshipId
  );
  return rel ? { candidateScopeType: rel.candidateScopeType } : null;
}

function isAborted(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted);
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  signal: AbortSignal | undefined
): Promise<T> {
  if (!timeoutMs && !signal) return promise;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      reject(
        new ScopeDiscoveryOrchestrationError(
          ORCHESTRATION_ERROR_CODES.CANCELLED,
          "Scope discovery was cancelled."
        )
      );
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(
          new ScopeDiscoveryOrchestrationError(
            ORCHESTRATION_ERROR_CODES.CANCELLED,
            "Scope discovery provider timed out."
          )
        );
      }, timeoutMs);
    }

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function mapProviderFailureCode(
  result: ScopeDiscoveryProviderResult
): (typeof ORCHESTRATION_ERROR_CODES)[keyof typeof ORCHESTRATION_ERROR_CODES] {
  switch (result.failureCode) {
    case "PROVIDER_CONFIGURATION_MISSING":
      return ORCHESTRATION_ERROR_CODES.PROVIDER_CONFIGURATION_MISSING;
    case "REPAIR_FAILED":
      return ORCHESTRATION_ERROR_CODES.PROVIDER_REPAIR_FAILED;
    case "OUTPUT_VALIDATION_FAILED":
    case "MALFORMED_OUTPUT":
      return ORCHESTRATION_ERROR_CODES.PROVIDER_OUTPUT_INVALID;
    default:
      return ORCHESTRATION_ERROR_CODES.PROVIDER_FAILED;
  }
}

function buildProviderInput(params: {
  readonly request: ScopeDiscoveryRequest;
  readonly deterministic: CatalogueEvaluationResult;
  readonly contractSnapshot: ReturnType<typeof toContractSourceSnapshot>;
}): ScopeDiscoveryProviderInput {
  const suppressions = params.deterministic.suppressed
    .map((s) => {
      const rel = relationshipLookup(s.relationshipId);
      if (!rel) return null;
      return {
        relationshipId: s.relationshipId,
        candidateScopeType: rel.candidateScopeType,
        reason: s.classification,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const conflicts = params.deterministic.conflicts
    .map((c) => {
      const rel = relationshipLookup(c.relationshipId);
      if (!rel) return null;
      return {
        relationshipId: c.relationshipId,
        candidateScopeType: rel.candidateScopeType,
        reason: c.classification,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return deepFreeze({
    projectId: params.request.projectId,
    orgId: params.request.orgId,
    analysisRunId: params.request.requestedRunId,
    projectBrief: params.request.projectBrief,
    selectedSiteNotes: params.request.selectedSiteNotes.map((n) => ({
      noteId: n.noteId,
      content: n.content,
    })),
    acceptedWorkAreas: params.request.acceptedWorkAreas.map((w) => ({
      workAreaId: w.workAreaId,
      type: w.type,
      title: w.title,
    })),
    relevantFacts: params.request.authoritativeFacts.map((f) => ({
      key: f.key,
      value: f.value,
    })),
    relevantConstraints: params.request.authoritativeConstraints.map((c) => ({
      key: c.key,
      value: c.value,
    })),
    deterministicSuggestions: params.deterministic.suggestions,
    deterministicSuppressions: suppressions,
    deterministicConflicts: conflicts,
    sourceSnapshot: params.contractSnapshot,
    catalogueVersion: params.request.currentCatalogueVersion,
    contractVersion: params.request.currentContractVersion,
    region: params.request.region,
    analysisObjective: params.request.analysisObjective,
  });
}

/**
 * Execute a pure discovery orchestration run.
 *
 * ORCH-POL-01: deterministic success + provider failure → COMPLETED_WITH_WARNINGS
 * with deterministic-only merged output (aligned with OCD-ISD-05 / OCD-ISD-15).
 */
export async function executeScopeDiscovery(params: {
  readonly request: unknown;
  readonly providerRunner?: InjectedProviderRunner | null;
  readonly context?: ExecutionContext;
}): Promise<ScopeDiscoveryRunResult> {
  const startedAt =
    params.context?.now?.().toISOString() ??
    (typeof params.request === "object" &&
    params.request &&
    "requestedAt" in params.request &&
    typeof (params.request as { requestedAt?: unknown }).requestedAt ===
      "string"
      ? (params.request as { requestedAt: string }).requestedAt
      : new Date().toISOString());
  const signal = params.context?.abortSignal;

  let request: ScopeDiscoveryRequest;
  try {
    request = validateDiscoveryRequest(params.request);
  } catch (error) {
    const code =
      error instanceof ScopeDiscoveryOrchestrationError
        ? error.code
        : ORCHESTRATION_ERROR_CODES.INVALID_REQUEST;
    const details =
      error instanceof ScopeDiscoveryOrchestrationError ? error.details : [];
    const emptySnap = buildSourceSnapshot(
      // Minimal placeholder when validation fails early — use a synthetic request shape if possible
      validateOrSynthetic(params.request)
    );
    const fp = computeSourceFingerprint(emptySnap);
    return buildRunResult({
      runId:
        typeof params.request === "object" &&
        params.request &&
        "requestedRunId" in params.request &&
        typeof (params.request as { requestedRunId?: unknown }).requestedRunId ===
          "string"
          ? (params.request as { requestedRunId: string }).requestedRunId
          : "00000000-0000-4000-8000-000000000099",
      projectId:
        typeof params.request === "object" &&
        params.request &&
        "projectId" in params.request &&
        typeof (params.request as { projectId?: unknown }).projectId === "string"
          ? (params.request as { projectId: string }).projectId
          : "00000000-0000-4000-8000-000000000001",
      orgId:
        typeof params.request === "object" &&
        params.request &&
        "orgId" in params.request &&
        typeof (params.request as { orgId?: unknown }).orgId === "string"
          ? (params.request as { orgId: string }).orgId
          : "00000000-0000-4000-8000-000000000002",
      trigger:
        typeof params.request === "object" &&
        params.request &&
        "trigger" in params.request &&
        typeof (params.request as { trigger?: unknown }).trigger === "string"
          ? ((params.request as { trigger: ScopeDiscoveryRequest["trigger"] })
              .trigger)
          : "USER_REQUESTED_RERUN",
      status: "FAILED_VALIDATION",
      sourceSnapshot: emptySnap,
      sourceFingerprint: fp,
      idempotencyKey: "invalid",
      idempotencyAction: "EXECUTE_NEW_RUN",
      contractVersion:
        typeof params.request === "object" &&
        params.request &&
        "currentContractVersion" in params.request &&
        typeof (params.request as { currentContractVersion?: unknown })
          .currentContractVersion === "string"
          ? (params.request as { currentContractVersion: string })
              .currentContractVersion
          : "unknown",
      catalogueVersion: "unknown",
      promptVersion: "unknown",
      warnings: [],
      errors: [failureError(code, details)],
      startedAt,
      completedAt: params.context?.now?.().toISOString() ?? startedAt,
      failureCode: code,
    });
  }

  if (isAborted(signal)) {
    const snapshot = buildSourceSnapshot(request);
    const fp = computeSourceFingerprint(snapshot);
    return buildRunResult({
      runId: request.requestedRunId,
      projectId: request.projectId,
      orgId: request.orgId,
      trigger: request.trigger,
      status: "CANCELLED",
      sourceSnapshot: snapshot,
      sourceFingerprint: fp,
      idempotencyKey: buildIdempotencyKey({
        projectId: request.projectId,
        triggerFamily: triggerFamily(request.trigger),
        sourceFingerprint: fp,
        contractVersion: request.currentContractVersion,
        catalogueVersion: request.currentCatalogueVersion,
        promptVersion: request.currentPromptVersion,
        analysisObjective: request.analysisObjective,
      }),
      idempotencyAction: "EXECUTE_NEW_RUN",
      contractVersion: request.currentContractVersion,
      catalogueVersion: request.currentCatalogueVersion,
      promptVersion: request.currentPromptVersion,
      errors: [failureError(ORCHESTRATION_ERROR_CODES.CANCELLED)],
      startedAt: request.requestedAt,
      completedAt: params.context?.now?.().toISOString() ?? request.requestedAt,
      failureCode: ORCHESTRATION_ERROR_CODES.CANCELLED,
    });
  }

  const snapshot = buildSourceSnapshot(request);
  try {
    assertValidSnapshot(snapshot);
  } catch (error) {
    const code =
      error instanceof ScopeDiscoveryOrchestrationError
        ? error.code
        : ORCHESTRATION_ERROR_CODES.INVALID_SOURCE_SNAPSHOT;
    return buildRunResult({
      runId: request.requestedRunId,
      projectId: request.projectId,
      orgId: request.orgId,
      trigger: request.trigger,
      status: "FAILED_VALIDATION",
      sourceSnapshot: snapshot,
      sourceFingerprint: computeSourceFingerprint(snapshot),
      idempotencyKey: "invalid-snapshot",
      idempotencyAction: "EXECUTE_NEW_RUN",
      contractVersion: request.currentContractVersion,
      catalogueVersion: request.currentCatalogueVersion,
      promptVersion: request.currentPromptVersion,
      errors: [
        failureError(
          code,
          error instanceof ScopeDiscoveryOrchestrationError
            ? error.details
            : []
        ),
      ],
      startedAt: request.requestedAt,
      completedAt: params.context?.now?.().toISOString() ?? request.requestedAt,
      failureCode: code,
    });
  }

  const sourceFingerprint = computeSourceFingerprint(snapshot);
  const idempotencyKey = buildIdempotencyKey({
    projectId: request.projectId,
    triggerFamily: triggerFamily(request.trigger),
    sourceFingerprint,
    contractVersion: request.currentContractVersion,
    catalogueVersion: request.currentCatalogueVersion,
    promptVersion: request.currentPromptVersion,
    analysisObjective: request.analysisObjective,
  });

  const idempotency = decideIdempotencyAction({
    request,
    snapshot,
    sourceFingerprint,
    idempotencyKey,
    priorRuns: request.priorRunSummaries,
  });

  if (idempotency.action === "REJECT_DUPLICATE_IN_FLIGHT") {
    return buildRunResult({
      runId: request.requestedRunId,
      projectId: request.projectId,
      orgId: request.orgId,
      trigger: request.trigger,
      status: "FAILED_VALIDATION",
      sourceSnapshot: snapshot,
      sourceFingerprint,
      idempotencyKey,
      idempotencyAction: idempotency.action,
      contractVersion: request.currentContractVersion,
      catalogueVersion: request.currentCatalogueVersion,
      promptVersion: request.currentPromptVersion,
      warnings: [idempotency.reason],
      errors: [failureError(ORCHESTRATION_ERROR_CODES.DUPLICATE_IN_FLIGHT)],
      startedAt: request.requestedAt,
      completedAt: params.context?.now?.().toISOString() ?? request.requestedAt,
      failureCode: ORCHESTRATION_ERROR_CODES.DUPLICATE_IN_FLIGHT,
    });
  }

  if (idempotency.action === "REUSE_IDENTICAL_COMPLETED_RUN") {
    const prior = request.priorRunSummaries.find(
      (r) => r.runId === idempotency.reusableRunId
    );
    if (prior?.result) {
      return deepFreeze({
        ...prior.result,
        status: "REUSED" as const,
        idempotencyAction: idempotency.action,
        reusedRunId: prior.runId,
        warnings: [
          ...prior.result.warnings,
          idempotency.reason,
        ],
        completedAt:
          params.context?.now?.().toISOString() ?? prior.result.completedAt,
      });
    }
  }

  const providerAuthorised = isProviderAuthorised(request);
  const contractSnapshot = toContractSourceSnapshot(snapshot);

  // --- Deterministic catalogue ---
  let deterministic: CatalogueEvaluationResult;
  try {
    deterministic = evaluateScopeRelationships({
      projectId: request.projectId,
      orgId: request.orgId,
      analysisRunId: request.requestedRunId,
      acceptedWorkAreas: request.acceptedWorkAreas.map((w) => ({
        workAreaId: w.workAreaId,
        type: w.type,
      })),
      facts: request.authoritativeFacts.map((f) => ({
        key: f.key,
        value: f.value,
      })),
      constraints: request.authoritativeConstraints.map((c) => ({
        key: c.key,
        value: c.value,
      })),
      sourceSnapshot: contractSnapshot,
      rejections: request.priorRejections,
      relationships: SCOPE_RELATIONSHIP_CATALOGUE,
      createdAt: request.requestedAt,
    });
  } catch (error) {
    return buildRunResult({
      runId: request.requestedRunId,
      projectId: request.projectId,
      orgId: request.orgId,
      trigger: request.trigger,
      status: "FAILED_DETERMINISTIC",
      sourceSnapshot: snapshot,
      sourceFingerprint,
      idempotencyKey,
      idempotencyAction: idempotency.action,
      contractVersion: request.currentContractVersion,
      catalogueVersion: request.currentCatalogueVersion,
      promptVersion: request.currentPromptVersion,
      errors: [
        failureError(ORCHESTRATION_ERROR_CODES.DETERMINISTIC_EVALUATION_FAILED, [
          error instanceof Error ? error.message : "unknown",
        ]),
      ],
      startedAt: request.requestedAt,
      completedAt: params.context?.now?.().toISOString() ?? request.requestedAt,
      failureCode: ORCHESTRATION_ERROR_CODES.DETERMINISTIC_EVALUATION_FAILED,
      supersededRunId: idempotency.supersededRunId,
    });
  }

  if (deterministic.validationIssues.length > 0) {
    return buildRunResult({
      runId: request.requestedRunId,
      projectId: request.projectId,
      orgId: request.orgId,
      trigger: request.trigger,
      status: "FAILED_DETERMINISTIC",
      sourceSnapshot: snapshot,
      sourceFingerprint,
      idempotencyKey,
      idempotencyAction: idempotency.action,
      contractVersion: request.currentContractVersion,
      catalogueVersion: request.currentCatalogueVersion,
      promptVersion: request.currentPromptVersion,
      deterministicEvaluation: deterministic,
      errors: [
        failureError(
          ORCHESTRATION_ERROR_CODES.DETERMINISTIC_EVALUATION_FAILED,
          deterministic.validationIssues.map(
            (i) => `${i.path}: ${i.message}`
          )
        ),
      ],
      startedAt: request.requestedAt,
      completedAt: params.context?.now?.().toISOString() ?? request.requestedAt,
      failureCode: ORCHESTRATION_ERROR_CODES.DETERMINISTIC_EVALUATION_FAILED,
      supersededRunId: idempotency.supersededRunId,
    });
  }

  const decisionInputs = buildPriorDecisionInputs({
    request,
    currentSnapshot: contractSnapshot,
  });

  // --- Provider (optional) ---
  let contextual: ScopeDiscoveryProviderResult | null = null;
  let providerCalled = false;
  let providerRepairAttempted = false;
  let providerWarning: string | null = null;
  let providerFailureCode:
    | (typeof ORCHESTRATION_ERROR_CODES)[keyof typeof ORCHESTRATION_ERROR_CODES]
    | null = null;
  let contextualSuggestions: readonly ScopeDiscoverySuggestion[] = [];

  if (providerAuthorised) {
    if (!params.providerRunner) {
      providerWarning =
        "Provider authorised but no injected runner supplied; continuing with deterministic results only.";
      providerFailureCode =
        ORCHESTRATION_ERROR_CODES.PROVIDER_CONFIGURATION_MISSING;
    } else if (isAborted(signal)) {
      return buildRunResult({
        runId: request.requestedRunId,
        projectId: request.projectId,
        orgId: request.orgId,
        trigger: request.trigger,
        status: "CANCELLED",
        sourceSnapshot: snapshot,
        sourceFingerprint,
        idempotencyKey,
        idempotencyAction: idempotency.action,
        contractVersion: request.currentContractVersion,
        catalogueVersion: request.currentCatalogueVersion,
        promptVersion: request.currentPromptVersion,
        deterministicEvaluation: deterministic,
        errors: [failureError(ORCHESTRATION_ERROR_CODES.CANCELLED)],
        startedAt: request.requestedAt,
        completedAt:
          params.context?.now?.().toISOString() ?? request.requestedAt,
        failureCode: ORCHESTRATION_ERROR_CODES.CANCELLED,
        providerAuthorised: true,
      });
    } else {
      const providerInput = buildProviderInput({
        request,
        deterministic,
        contractSnapshot,
      });
      try {
        providerCalled = true;
        contextual = await withTimeout(
          params.providerRunner({
            input: providerInput,
            signal,
          }),
          params.context?.providerTimeoutMs,
          signal
        );
        providerRepairAttempted = contextual.repairAttempted;
        if (!contextual.success) {
          providerFailureCode = mapProviderFailureCode(contextual);
          providerWarning = safeOrchestrationFailureMessage(providerFailureCode);
          // ORCH-POL-01: keep deterministic results
          contextualSuggestions = [];
        } else {
          contextualSuggestions = contextual.contextualSuggestions;
        }
      } catch (error) {
        if (
          error instanceof ScopeDiscoveryOrchestrationError &&
          error.code === ORCHESTRATION_ERROR_CODES.CANCELLED
        ) {
          return buildRunResult({
            runId: request.requestedRunId,
            projectId: request.projectId,
            orgId: request.orgId,
            trigger: request.trigger,
            status: "CANCELLED",
            sourceSnapshot: snapshot,
            sourceFingerprint,
            idempotencyKey,
            idempotencyAction: idempotency.action,
            contractVersion: request.currentContractVersion,
            catalogueVersion: request.currentCatalogueVersion,
            promptVersion: request.currentPromptVersion,
            deterministicEvaluation: deterministic,
            errors: [failureError(ORCHESTRATION_ERROR_CODES.CANCELLED)],
            startedAt: request.requestedAt,
            completedAt:
              params.context?.now?.().toISOString() ?? request.requestedAt,
            failureCode: ORCHESTRATION_ERROR_CODES.CANCELLED,
            providerAuthorised: true,
            providerCalled: true,
          });
        }
        providerFailureCode = ORCHESTRATION_ERROR_CODES.PROVIDER_FAILED;
        providerWarning = safeOrchestrationFailureMessage(providerFailureCode);
        contextualSuggestions = [];
      }
    }
  }

  // --- Merge ---
  let mergeResult;
  try {
    mergeResult = mergeDiscoveryStreams({
      deterministic,
      contextualSuggestions,
      acceptedWorkAreaTypes: request.acceptedWorkAreas.map((w) => w.type),
      priorProposals: decisionInputs.priorProposals,
      rejections: decisionInputs.rejections,
    });
  } catch (error) {
    const details =
      error instanceof ScopeDiscoveryOrchestrationError
        ? error.details
        : [error instanceof Error ? error.message : "unknown"];
    return buildRunResult({
      runId: request.requestedRunId,
      projectId: request.projectId,
      orgId: request.orgId,
      trigger: request.trigger,
      status: "FAILED_MERGE",
      sourceSnapshot: snapshot,
      sourceFingerprint,
      idempotencyKey,
      idempotencyAction: idempotency.action,
      contractVersion: request.currentContractVersion,
      catalogueVersion: request.currentCatalogueVersion,
      promptVersion: request.currentPromptVersion,
      deterministicEvaluation: deterministic,
      contextualProviderResult: contextual,
      errors: [failureError(ORCHESTRATION_ERROR_CODES.MERGE_FAILED, details)],
      startedAt: request.requestedAt,
      completedAt: params.context?.now?.().toISOString() ?? request.requestedAt,
      failureCode: ORCHESTRATION_ERROR_CODES.MERGE_FAILED,
      providerCalled,
      providerAuthorised,
      providerRepairAttempted,
      supersededRunId: idempotency.supersededRunId,
    });
  }

  const merged = [
    ...mergeResult.primarySuggestions,
    ...mergeResult.otherPossibilities,
  ];
  const finalCheck = validateFinalSuggestions(merged);
  if (!finalCheck.ok) {
    return buildRunResult({
      runId: request.requestedRunId,
      projectId: request.projectId,
      orgId: request.orgId,
      trigger: request.trigger,
      status: "FAILED_MERGE",
      sourceSnapshot: snapshot,
      sourceFingerprint,
      idempotencyKey,
      idempotencyAction: idempotency.action,
      contractVersion: request.currentContractVersion,
      catalogueVersion: request.currentCatalogueVersion,
      promptVersion: request.currentPromptVersion,
      deterministicEvaluation: deterministic,
      contextualProviderResult: contextual,
      errors: [
        failureError(
          ORCHESTRATION_ERROR_CODES.FINAL_CONTRACT_INVALID,
          finalCheck.issues
        ),
      ],
      startedAt: request.requestedAt,
      completedAt: params.context?.now?.().toISOString() ?? request.requestedAt,
      failureCode: ORCHESTRATION_ERROR_CODES.FINAL_CONTRACT_INVALID,
      providerCalled,
      providerAuthorised,
      providerRepairAttempted,
      supersededRunId: idempotency.supersededRunId,
    });
  }

  const warnings: string[] = [
    ...deterministic.warnings,
    ...mergeResult.mergeWarnings.map((w) => w.message),
  ];
  if (providerWarning) warnings.push(providerWarning);
  if (
    idempotency.action === "SUPERSEDE_STALE_RUN" ||
    idempotency.action === "RETRY_FAILED_RUN" ||
    (request.forceNewRun && request.trigger === "USER_REQUESTED_RERUN")
  ) {
    warnings.push(idempotency.reason);
  }

  const status =
    providerFailureCode || providerWarning
      ? ("COMPLETED_WITH_WARNINGS" as const)
      : warnings.length > 0
        ? ("COMPLETED_WITH_WARNINGS" as const)
        : ("COMPLETED" as const);

  const completedAt =
    params.context?.now?.().toISOString() ?? new Date().toISOString();
  const startedMs = Date.parse(request.requestedAt);
  const completedMs = Date.parse(completedAt);

  return buildRunResult({
    runId: request.requestedRunId,
    projectId: request.projectId,
    orgId: request.orgId,
    trigger: request.trigger,
    status,
    sourceSnapshot: snapshot,
    sourceFingerprint,
    idempotencyKey,
    idempotencyAction: idempotency.action,
    contractVersion: request.currentContractVersion,
    catalogueVersion: request.currentCatalogueVersion,
    promptVersion: request.currentPromptVersion,
    providerMetadata: contextual
      ? {
          provider: contextual.provider,
          model: contextual.model,
          requestId: null,
          promptVersion: contextual.promptVersion,
          repairAttempted: contextual.repairAttempted,
        }
      : null,
    deterministicEvaluation: deterministic,
    contextualProviderResult: contextual,
    mergedSuggestions: finalCheck.valid,
    primarySuggestions: mergeResult.primarySuggestions.filter((s) =>
      finalCheck.valid.some((v) => v.suggestionId === s.suggestionId)
    ),
    otherPossibilities: mergeResult.otherPossibilities.filter((s) =>
      finalCheck.valid.some((v) => v.suggestionId === s.suggestionId)
    ),
    suppressedSuggestions: mergeResult.suppressedSuggestions,
    conflicts: mergeResult.conflicts.map((c) => ({
      code: c.code,
      message: c.message,
      identityKey: c.identityKey,
    })),
    warnings,
    errors: providerFailureCode
      ? [failureError(providerFailureCode)]
      : [],
    decisionExplanations: decisionInputs.explanations,
    providerCalled,
    providerAuthorised,
    providerRepairAttempted,
    explicitRerunForced:
      request.forceNewRun && request.trigger === "USER_REQUESTED_RERUN",
    startedAt: request.requestedAt,
    completedAt,
    latencyMs:
      Number.isFinite(startedMs) && Number.isFinite(completedMs)
        ? Math.max(0, completedMs - startedMs)
        : null,
    tokenUsage: contextual?.tokenUsage ?? null,
    reusedRunId: null,
    supersededRunId: idempotency.supersededRunId,
  });
}

/** Best-effort synthetic request for early validation failure snapshot only. */
function validateOrSynthetic(raw: unknown): ScopeDiscoveryRequest {
  try {
    return validateDiscoveryRequest(raw);
  } catch {
    const base = {
      projectId: "00000000-0000-4000-8000-000000000001",
      orgId: "00000000-0000-4000-8000-000000000002",
      requestedRunId: "00000000-0000-4000-8000-000000000099",
      trigger: "USER_REQUESTED_RERUN" as const,
      projectBrief: "",
      projectBriefRevision: "invalid",
      selectedSiteNotes: [],
      acceptedWorkAreas: [],
      authoritativeFacts: [],
      authoritativeConstraints: [],
      priorSuggestions: [],
      priorDecisions: [],
      priorProposals: [],
      priorRejections: [],
      currentContractVersion: "scope-discovery-suggestion/v1",
      currentCatalogueVersion: "scope-relationship-catalogue/v1",
      currentPromptVersion: "scope-discovery-prompt/v1",
      region: null,
      analysisObjective: "invalid",
      providerEnabled: false,
      explicitUserInitiation: false,
      forceNewRun: false,
      requestedByUserId: "00000000-0000-4000-8000-000000000004",
      requestedAt: new Date().toISOString(),
      priorRunSummaries: [],
    };
    return deepFreeze(base);
  }
}
