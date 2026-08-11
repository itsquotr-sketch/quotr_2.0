/**
 * Batch scope-item confirmation (3.1B.6R2).
 *
 * Controlled sequential append of decisions — no Work Area, no Facts.
 * Uses existing 028/029 tables; no migration.
 *
 * Idempotent when latest decision already matches intended state.
 * Supports reversal (include ↔ not required) via append-only newest-wins.
 */

/**
 * Batch scope-item confirmation (3.1B.6R2).
 *
 * Controlled sequential append of decisions — no Work Area, no Facts.
 * Uses existing 028/029 tables; no migration.
 *
 * Idempotent when latest decision already matches intended state.
 * Supports reversal (include ↔ not required) via append-only newest-wins.
 */

import { randomUUID } from "node:crypto";
import { classifyScopeProposal } from "../classification";
import {
  DECISION_ERROR_CODES,
  ScopeDiscoveryDecisionError,
  safeDecisionFailureMessage,
} from "../decisions/errors";
import {
  insertDiscoveryDecision,
  listDecisionsForSuggestion,
  listSuggestionDetailsForRun,
  type DiscoverySuggestionDetailRow,
} from "../persistence";
import { getScopeDiscoveryAvailability } from "../configuration";
import { routeClarificationToScopeDetails } from "../ui/clarification-routing";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import { APPLICATION_ERROR_CODES, applicationFailure } from "./errors";
import { logDiscoveryEvent } from "./logging";
import type { DecisionServiceDeps } from "./decision-services";
import type { ApplicationFailure } from "./types";

/** Clarifications without an answerable Scope Details question include cleanly. */
function clarificationNeedsPendingDetail(
  sug: DiscoverySuggestionDetailRow
): boolean {
  const route = routeClarificationToScopeDetails({
    rationaleCode: sug.rationale_code,
    suggestionKind: String(sug.suggestion_kind ?? ""),
    title: sug.proposed_title,
  });
  if (route.kind !== "SCOPE_DETAIL") return false;
  if (!route.mapped || !route.factKey) return false;
  return Boolean(getQuestionTemplateByKey(route.factKey));
}

export const BATCH_SCOPE_STATES = [
  "INCLUDED",
  "NOT_REQUIRED",
  "UNRESOLVED_CLARIFICATION",
] as const;

export type BatchScopeItemState = (typeof BATCH_SCOPE_STATES)[number];

export type BatchScopeItemInput = {
  readonly suggestionId: string;
  readonly intendedState: BatchScopeItemState;
  readonly modifiedTitle?: string | null;
  readonly modifiedDescription?: string | null;
};

export type BatchConfirmScopeInput = {
  readonly projectId: string;
  readonly runId: string;
  readonly sourceRevision: string;
  readonly items: readonly BatchScopeItemInput[];
};

export type BatchItemResult = {
  readonly suggestionId: string;
  readonly intendedState: BatchScopeItemState;
  readonly ok: boolean;
  readonly decisionId: string | null;
  readonly idempotentReuse: boolean;
  readonly message: string;
};

export type BatchConfirmScopeSuccess = {
  readonly ok: true;
  readonly success: true;
  readonly projectId: string;
  readonly runId: string;
  readonly results: readonly BatchItemResult[];
  readonly writtenCount: number;
  readonly reusedCount: number;
  readonly createdWorkAreaCount: 0;
  readonly message: string;
};

export type BatchConfirmScopeOutcome =
  | BatchConfirmScopeSuccess
  | ApplicationFailure;

const REASON = {
  INCLUDED: "scope_item_included",
  NOT_REQUIRED: "scope_item_not_required",
  UNRESOLVED_CLARIFICATION: "clarification_routed_to_scope_details",
  INCLUDED_PENDING: "included_pending_detail",
} as const;

function latestDecision(
  decisions: readonly { decision_type: string; reason_code?: string | null }[]
): { decision_type: string; reason_code: string | null } | null {
  if (decisions.length === 0) return null;
  const last = decisions[decisions.length - 1]!;
  return {
    decision_type: last.decision_type,
    reason_code: last.reason_code ?? null,
  };
}

function composedStateFromLatest(
  latest: { decision_type: string; reason_code: string | null } | null
): BatchScopeItemState | "PROPOSED" {
  if (!latest) return "PROPOSED";
  const t = latest.decision_type.toUpperCase();
  const reason = String(latest.reason_code ?? "");
  if (
    reason.includes("routed_to_scope_details") ||
    reason.includes("answer_in_scope_details")
  ) {
    return "UNRESOLVED_CLARIFICATION";
  }
  if (t === "ACCEPT" || t === "MODIFY") return "INCLUDED";
  if (t === "REJECT") return "NOT_REQUIRED";
  return "PROPOSED";
}

function isBatchEligibleKind(kind: string, proposalClass: string): boolean {
  if (proposalClass === "HIGH_LEVEL_WORK_AREA") return false;
  if (proposalClass === "WARNING") return false;
  return (
    proposalClass === "SCOPE_ITEM" ||
    proposalClass === "EXCLUSION" ||
    proposalClass === "CLARIFICATION" ||
    kind === "MISSING_SCOPE" ||
    kind === "DEPENDENCY" ||
    kind === "SUB_SCOPE" ||
    kind === "POSSIBLE_EXCLUSION" ||
    kind === "CLARIFICATION_REQUIRED"
  );
}

/**
 * Validate then append decisions. Stops before writing if any row is invalid.
 * Sequential writes — reports partial failure if a later insert fails after
 * earlier successes (rare); caller should refresh and retry.
 */
export async function batchConfirmScopeItemsApp(
  input: BatchConfirmScopeInput,
  deps: DecisionServiceDeps
): Promise<BatchConfirmScopeOutcome> {
  const availability = getScopeDiscoveryAvailability(deps.env ?? process.env);
  if (!availability.featureEnabled) {
    return applicationFailure(APPLICATION_ERROR_CODES.FEATURE_DISABLED);
  }
  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }
  if (!input.items.length) {
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.VALIDATION_FAILED,
      message: "No scope items were submitted.",
    };
  }
  if (!input.sourceRevision.trim()) {
    return applicationFailure(APPLICATION_ERROR_CODES.VALIDATION_FAILED);
  }

  // Validate all rows first
  type Prepared = {
    suggestionId: string;
    intendedState: BatchScopeItemState;
    sug: DiscoverySuggestionDetailRow;
    latest: ReturnType<typeof latestDecision>;
    skipWrite: boolean;
  };

  const prepared: Prepared[] = [];
  const seen = new Set<string>();

  let runSuggestions: Awaited<ReturnType<typeof listSuggestionDetailsForRun>>;
  try {
    runSuggestions = await listSuggestionDetailsForRun(deps.ctx, input.runId);
  } catch {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_FOUND);
  }

  const byId = new Map(runSuggestions.map((s) => [s.id, s]));

  for (const item of input.items) {
    if (seen.has(item.suggestionId)) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.VALIDATION_FAILED,
        message: "Duplicate suggestion in batch.",
      };
    }
    seen.add(item.suggestionId);

    if (!BATCH_SCOPE_STATES.includes(item.intendedState)) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.VALIDATION_FAILED,
        message: "Invalid intended scope state.",
      };
    }

    const sug = byId.get(item.suggestionId);
    if (
      !sug ||
      sug.project_id !== input.projectId ||
      sug.org_id !== deps.ctx.orgId ||
      sug.run_id !== input.runId
    ) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: "A suggestion in this batch was not found for this run.",
      };
    }

    const proposalClass = classifyScopeProposal({
      suggestionKind: sug.suggestion_kind,
      proposedWorkAreaType: sug.proposed_work_area_type,
      relatedWorkAreaId: sug.related_work_area_id,
    });
    if (
      !isBatchEligibleKind(
        String(sug.suggestion_kind).toUpperCase(),
        proposalClass
      )
    ) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message:
          "Genuine work area suggestions cannot be batch-confirmed. Use Add work area.",
      };
    }

    if (sug.stale_reason || sug.superseded_by_suggestion_id) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(
          sug.stale_reason
            ? DECISION_ERROR_CODES.STALE_SUGGESTION
            : DECISION_ERROR_CODES.SUPERSEDED_SUGGESTION
        ),
      };
    }

    const decisions = await listDecisionsForSuggestion(
      deps.ctx,
      item.suggestionId
    );
    if (
      decisions.some((d) => {
        const detail = d as { created_work_area_id?: string | null };
        return Boolean(detail.created_work_area_id);
      })
    ) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(
          DECISION_ERROR_CODES.ALREADY_SCOPE_CREATED
        ),
      };
    }

    const latest = latestDecision(decisions);
    const current = composedStateFromLatest(latest);
    const skipWrite = current === item.intendedState;

    prepared.push({
      suggestionId: item.suggestionId,
      intendedState: item.intendedState,
      sug,
      latest,
      skipWrite,
    });
  }

  const results: BatchItemResult[] = [];
  let writtenCount = 0;
  let reusedCount = 0;

  for (const row of prepared) {
    if (row.skipWrite) {
      reusedCount += 1;
      results.push({
        suggestionId: row.suggestionId,
        intendedState: row.intendedState,
        ok: true,
        decisionId: null,
        idempotentReuse: true,
        message: "Already at intended state.",
      });
      continue;
    }

    try {
      const decisionId = randomUUID();
      let decisionType: "ACCEPT" | "REJECT" | "MODIFY" = "ACCEPT";
      let reasonCode: string = REASON.INCLUDED;

      if (row.intendedState === "NOT_REQUIRED") {
        decisionType = "REJECT";
        reasonCode = REASON.NOT_REQUIRED;
      } else if (row.intendedState === "UNRESOLVED_CLARIFICATION") {
        decisionType = "REJECT";
        reasonCode = REASON.UNRESOLVED_CLARIFICATION;
      } else {
        decisionType = "ACCEPT";
        reasonCode =
          row.sug &&
          classifyScopeProposal({
            suggestionKind: row.sug.suggestion_kind,
            proposedWorkAreaType: row.sug.proposed_work_area_type,
            relatedWorkAreaId: row.sug.related_work_area_id,
          }) === "CLARIFICATION" &&
          clarificationNeedsPendingDetail(row.sug)
            ? REASON.INCLUDED_PENDING
            : REASON.INCLUDED;
      }

      await insertDiscoveryDecision(deps.ctx, {
        id: decisionId,
        projectId: input.projectId,
        runId: input.runId,
        suggestionId: row.suggestionId,
        decisionType,
        decidedAt: new Date().toISOString(),
        reasonCode,
        userNote: null,
        modifiedTitle: null,
        modifiedDescription: null,
        modifiedWorkAreaType: null,
        sourceRevision: input.sourceRevision,
        createdWorkAreaId: null,
      });

      writtenCount += 1;
      results.push({
        suggestionId: row.suggestionId,
        intendedState: row.intendedState,
        ok: true,
        decisionId,
        idempotentReuse: false,
        message: "Saved.",
      });

      logDiscoveryEvent({
        event: "decision_completed",
        projectId: input.projectId,
        suggestionId: row.suggestionId,
        decisionId,
        status: `BATCH_${row.intendedState}`,
      });
    } catch (error) {
      const message =
        error instanceof ScopeDiscoveryDecisionError
          ? error.message
          : "Failed to save a scope decision.";
      logDiscoveryEvent({
        event: "decision_failed",
        projectId: input.projectId,
        suggestionId: row.suggestionId,
        code: "BATCH_PARTIAL",
      });
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: `${message} ${writtenCount} earlier decision(s) were saved — refresh and retry remaining items.`,
      };
    }
  }

  if (deps.revalidate) {
    await deps.revalidate(input.projectId);
  }

  return {
    ok: true,
    success: true,
    projectId: input.projectId,
    runId: input.runId,
    results,
    writtenCount,
    reusedCount,
    createdWorkAreaCount: 0,
    message:
      writtenCount === 0
        ? "Scope already matched your selections."
        : "Scope confirmed.",
  };
}

/** Pure helper for tests — maps decision history to current batch state. */
export function deriveBatchStateFromDecisions(
  decisions: readonly { decision_type: string; reason_code?: string | null }[]
): BatchScopeItemState | "PROPOSED" {
  return composedStateFromLatest(latestDecision(decisions));
}

export function canIncludeScopeItemAfterRejection(
  decisions: readonly { decision_type: string }[]
): boolean {
  const latest = latestDecision(decisions);
  return latest?.decision_type.toUpperCase() !== "ACCEPT";
}
