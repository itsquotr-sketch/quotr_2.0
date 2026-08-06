/**
 * Apply / Keep scope-impact recommendations (3.1B.6R3.1).
 *
 * Apply uses existing batch scope-item decision lifecycle (no Work Area, no Fact).
 * Keep appends a same-state decision with reason scope_impact_kept and the
 * recommendation id in user_note — no migration required.
 */

import { randomUUID } from "node:crypto";
import { classifyScopeProposal } from "../classification";
import {
  DECISION_ERROR_CODES,
  ScopeDiscoveryDecisionError,
  safeDecisionFailureMessage,
} from "../decisions/errors";
import {
  getSuggestionDetailById,
  insertDiscoveryDecision,
  listDecisionsForSuggestion,
} from "../persistence";
import { getScopeDiscoveryAvailability } from "../configuration";
import {
  SCOPE_IMPACT_KEEP_REASON,
  collectDismissedRecommendationIds,
  isScopeImpactKeepReason,
} from "../ui/scope-impact-identity";
import { APPLICATION_ERROR_CODES, applicationFailure } from "./errors";
import { logDiscoveryEvent } from "./logging";
import { batchConfirmScopeItemsApp } from "./batch-confirm-scope";
import type { DecisionServiceDeps } from "./decision-services";
import type { ApplicationFailure } from "./types";

export type ScopeImpactRecommendationActionInput = {
  readonly projectId: string;
  readonly runId: string;
  readonly sourceRevision: string;
  readonly suggestionId: string;
  readonly recommendationId: string;
  readonly intendedState: "INCLUDED" | "NOT_REQUIRED";
};

export type ScopeImpactRecommendationActionSuccess = {
  readonly ok: true;
  readonly success: true;
  readonly projectId: string;
  readonly suggestionId: string;
  readonly recommendationId: string;
  readonly action: "apply" | "keep";
  readonly decisionId: string | null;
  readonly createdWorkAreaId: null;
  readonly createdFact: false;
  readonly idempotentReuse: boolean;
  readonly message: string;
};

export type ScopeImpactRecommendationActionOutcome =
  | ScopeImpactRecommendationActionSuccess
  | ApplicationFailure;

function requireFeature(
  env: Readonly<Record<string, string | undefined>> | undefined
): ApplicationFailure | null {
  const availability = getScopeDiscoveryAvailability(env ?? process.env);
  if (!availability.featureEnabled) {
    return applicationFailure(APPLICATION_ERROR_CODES.FEATURE_DISABLED);
  }
  return null;
}

async function loadOwnedSuggestion(
  deps: DecisionServiceDeps,
  suggestionId: string,
  projectId: string,
  runId: string
) {
  const row = await getSuggestionDetailById(deps.ctx, suggestionId);
  if (
    !row ||
    row.project_id !== projectId ||
    row.org_id !== deps.ctx.orgId ||
    row.run_id !== runId
  ) {
    throw new ScopeDiscoveryDecisionError(
      DECISION_ERROR_CODES.SUGGESTION_NOT_FOUND
    );
  }
  return row;
}

/**
 * Apply a scope-impact recommendation via batch scope-item decision.
 * Never creates Work Areas or Facts.
 */
export async function applyScopeImpactRecommendationApp(
  input: ScopeImpactRecommendationActionInput,
  deps: DecisionServiceDeps
): Promise<ScopeImpactRecommendationActionOutcome> {
  const disabled = requireFeature(deps.env);
  if (disabled) return disabled;
  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  try {
    const sug = await loadOwnedSuggestion(
      deps,
      input.suggestionId,
      input.projectId,
      input.runId
    );
    const proposalClass = classifyScopeProposal({
      suggestionKind: sug.suggestion_kind,
      proposedWorkAreaType: sug.proposed_work_area_type,
      relatedWorkAreaId: sug.related_work_area_id,
    });
    if (
      proposalClass !== "SCOPE_ITEM" &&
      proposalClass !== "EXCLUSION" &&
      proposalClass !== "CLARIFICATION"
    ) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message:
          "This recommendation cannot be applied as a scope-item change.",
      };
    }

    const decisions = await listDecisionsForSuggestion(
      deps.ctx,
      input.suggestionId
    );
    if (
      decisions.some((d) => Boolean(d.created_work_area_id))
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

    const latest = decisions[decisions.length - 1];
    const latestType = (latest?.decision_type ?? "").toUpperCase();
    const alreadyIncluded =
      latestType === "ACCEPT" || latestType === "MODIFY";
    const alreadyExcluded = latestType === "REJECT";
    if (
      (input.intendedState === "INCLUDED" && alreadyIncluded) ||
      (input.intendedState === "NOT_REQUIRED" && alreadyExcluded)
    ) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: "This scope change was already applied.",
      };
    }

    const batch = await batchConfirmScopeItemsApp(
      {
        projectId: input.projectId,
        runId: input.runId,
        sourceRevision: input.sourceRevision,
        items: [
          {
            suggestionId: input.suggestionId,
            intendedState: input.intendedState,
          },
        ],
      },
      deps
    );

    if (!batch.ok) {
      return batch;
    }

    const item = batch.results[0];
    logDiscoveryEvent({
      event: "decision_completed",
      projectId: input.projectId,
      suggestionId: input.suggestionId,
      decisionId: item?.decisionId ?? undefined,
      status: `scope_impact_apply_${input.intendedState}`,
    });

    return {
      ok: true,
      success: true,
      projectId: input.projectId,
      suggestionId: input.suggestionId,
      recommendationId: input.recommendationId,
      action: "apply",
      decisionId: item?.decisionId ?? null,
      createdWorkAreaId: null,
      createdFact: false,
      idempotentReuse: Boolean(item?.idempotentReuse),
      message:
        input.intendedState === "NOT_REQUIRED"
          ? "Marked as not required."
          : "Included in scope.",
    };
  } catch (error) {
    if (error instanceof ScopeDiscoveryDecisionError) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(error.code),
      };
    }
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.DECISION_FAILED,
      message: "That scope change could not be applied. Try again.",
    };
  }
}

/**
 * Keep current scope — append same-state decision with keep reason.
 * Does not rewrite Facts, Company Defaults, or stale the run.
 */
export async function keepScopeImpactRecommendationApp(
  input: ScopeImpactRecommendationActionInput,
  deps: DecisionServiceDeps
): Promise<ScopeImpactRecommendationActionOutcome> {
  const disabled = requireFeature(deps.env);
  if (disabled) return disabled;
  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  try {
    await loadOwnedSuggestion(
      deps,
      input.suggestionId,
      input.projectId,
      input.runId
    );

    const decisions = await listDecisionsForSuggestion(
      deps.ctx,
      input.suggestionId
    );
    const dismissed = collectDismissedRecommendationIds(decisions);
    if (dismissed.has(input.recommendationId)) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: "This recommendation was already kept as current scope.",
      };
    }

    const latest = decisions[decisions.length - 1];
    const latestType = (latest?.decision_type ?? "").toUpperCase();
    // Preserve current composed scope: ACCEPT if included, REJECT if not required.
    // Prefer the current decision type over the recommendation's "suggested" state.
    let decisionType: "ACCEPT" | "REJECT" = "ACCEPT";
    if (latestType === "REJECT") {
      decisionType = "REJECT";
    } else if (latestType === "ACCEPT" || latestType === "MODIFY") {
      decisionType = "ACCEPT";
    } else {
      // Undecided should not reach Keep for MVP recommendations
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: "Current scope is undecided; confirm scope first.",
      };
    }

    const decisionId = randomUUID();
    await insertDiscoveryDecision(deps.ctx, {
      id: decisionId,
      projectId: input.projectId,
      runId: input.runId,
      suggestionId: input.suggestionId,
      decisionType,
      decidedAt: new Date().toISOString(),
      reasonCode: SCOPE_IMPACT_KEEP_REASON,
      userNote: input.recommendationId.slice(0, 2000),
      modifiedTitle: null,
      modifiedDescription: null,
      modifiedWorkAreaType: null,
      sourceRevision: input.sourceRevision,
      createdWorkAreaId: null,
    });

    logDiscoveryEvent({
      event: "decision_completed",
      projectId: input.projectId,
      suggestionId: input.suggestionId,
      decisionId,
      status: "scope_impact_keep_current",
    });

    if (deps.revalidate) {
      await deps.revalidate(input.projectId);
    }

    return {
      ok: true,
      success: true,
      projectId: input.projectId,
      suggestionId: input.suggestionId,
      recommendationId: input.recommendationId,
      action: "keep",
      decisionId,
      createdWorkAreaId: null,
      createdFact: false,
      idempotentReuse: false,
      message: "Kept current scope.",
    };
  } catch (error) {
    if (error instanceof ScopeDiscoveryDecisionError) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(error.code),
      };
    }
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.DECISION_FAILED,
      message: "Could not keep current scope. Try again.",
    };
  }
}

export { collectDismissedRecommendationIds, isScopeImpactKeepReason };
