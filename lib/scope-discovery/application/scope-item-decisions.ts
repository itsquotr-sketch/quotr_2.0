/**
 * Scope-item inclusion / modification without Work Area creation (3.1B.6R1).
 *
 * Uses append-only scope_discovery_decisions with created_work_area_id = null.
 * Does not call accept/modify Work Area RPCs. No migration required.
 */

import { randomUUID } from "node:crypto";
import {
  actionFamilyForClass,
  classifyScopeProposal,
  evaluateDecidability,
} from "../classification";
import {
  DECISION_ERROR_CODES,
  ScopeDiscoveryDecisionError,
  safeDecisionFailureMessage,
} from "../decisions/errors";
import {
  insertDiscoveryDecision,
  listDecisionsForSuggestion,
  getSuggestionDetailById,
  type PersistenceAuthContext,
} from "../persistence";
import { APPLICATION_ERROR_CODES, applicationFailure } from "./errors";
import { logDiscoveryEvent } from "./logging";
import type {
  AcceptDecisionAppInput,
  DecisionOutcome,
  ModifyDecisionAppInput,
} from "./types";
import type { DecisionServiceDeps } from "./decision-services";
import { getScopeDiscoveryAvailability } from "../configuration";

const INCLUDE_REASON = "scope_item_included";
const MODIFY_INCLUDE_REASON = "scope_item_modified_included";

function requireFeature(
  env: Readonly<Record<string, string | undefined>> | undefined
): DecisionOutcome | null {
  const availability = getScopeDiscoveryAvailability(env ?? process.env);
  if (!availability.featureEnabled) {
    return applicationFailure(APPLICATION_ERROR_CODES.FEATURE_DISABLED);
  }
  return null;
}

async function loadSuggestionForDecision(
  ctx: PersistenceAuthContext,
  suggestionId: string,
  projectId: string
) {
  const row = await getSuggestionDetailById(ctx, suggestionId);
  if (!row || row.project_id !== projectId || row.org_id !== ctx.orgId) {
    throw new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.SUGGESTION_NOT_FOUND);
  }
  return row;
}

function latestDecisionType(
  decisions: readonly { decision_type: string; created_work_area_id?: string | null }[]
): string | null {
  if (decisions.length === 0) return null;
  return decisions[decisions.length - 1]?.decision_type ?? null;
}

export async function includeScopeItemApp(
  input: AcceptDecisionAppInput,
  deps: DecisionServiceDeps
): Promise<DecisionOutcome> {
  const disabled = requireFeature(deps.env);
  if (disabled) return disabled;
  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  try {
    const sug = await loadSuggestionForDecision(
      deps.ctx,
      input.suggestionId,
      input.projectId
    );
    const proposalClass = classifyScopeProposal({
      suggestionKind: sug.suggestion_kind,
      proposedWorkAreaType: sug.proposed_work_area_type,
      relatedWorkAreaId: null,
    });
    if (
      actionFamilyForClass(proposalClass) !== "scope_item" &&
      proposalClass !== "SCOPE_ITEM"
    ) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message:
          "This suggestion is not a scope item and cannot be included in scope this way.",
      };
    }

    const decisions = await listDecisionsForSuggestion(
      deps.ctx,
      input.suggestionId
    );
    if (decisions.some((d) => d.decision_type === "ACCEPT")) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(DECISION_ERROR_CODES.ALREADY_ACCEPTED),
      };
    }
    if (
      decisions.some(
        (d) =>
          d.decision_type === "MODIFY" ||
          (d as { created_work_area_id?: string | null }).created_work_area_id
      )
    ) {
      // MODIFY without WA is allowed only via modifyScopeItem; block if WA created
    }
    const hasScopeCreate = decisions.some((d) => {
      const detail = d as { created_work_area_id?: string | null };
      return (
        (d.decision_type === "ACCEPT" || d.decision_type === "MODIFY") &&
        detail.created_work_area_id
      );
    });
    if (hasScopeCreate) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(
          DECISION_ERROR_CODES.ALREADY_SCOPE_CREATED
        ),
      };
    }
    if (sug.stale_reason) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(DECISION_ERROR_CODES.STALE_SUGGESTION),
      };
    }
    if (sug.superseded_by_suggestion_id) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(
          DECISION_ERROR_CODES.SUPERSEDED_SUGGESTION
        ),
      };
    }

    const decidability = evaluateDecidability({
      suggestionKind: sug.suggestion_kind,
      proposedWorkAreaType: sug.proposed_work_area_type,
      decisionState: "PROPOSED",
      proposedTitle: sug.proposed_title,
    });
    if (!decidability.canIncludeInScope) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message:
          decidability.reason ??
          safeDecisionFailureMessage(DECISION_ERROR_CODES.SUGGESTION_NOT_ELIGIBLE),
      };
    }

    const decisionId = randomUUID();
    await insertDiscoveryDecision(deps.ctx, {
      id: decisionId,
      projectId: input.projectId,
      runId: sug.run_id,
      suggestionId: input.suggestionId,
      decisionType: "ACCEPT",
      decidedAt: new Date().toISOString(),
      reasonCode: input.reasonCode ?? INCLUDE_REASON,
      userNote: input.userNote ?? null,
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
      status: "ACCEPT_SCOPE_ITEM",
    });

    if (deps.revalidate) {
      await deps.revalidate(input.projectId);
    }

    return {
      ok: true,
      success: true,
      decisionId,
      suggestionId: input.suggestionId,
      projectId: input.projectId,
      decisionType: "ACCEPT",
      createdWorkAreaId: null,
      idempotentReuse: false,
      message: "Scope item included. No work area was created.",
    };
  } catch (error) {
    if (error instanceof ScopeDiscoveryDecisionError) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: error.message,
      };
    }
    return applicationFailure(APPLICATION_ERROR_CODES.DECISION_FAILED);
  }
}

export async function modifyIncludeScopeItemApp(
  input: ModifyDecisionAppInput,
  deps: DecisionServiceDeps
): Promise<DecisionOutcome> {
  const disabled = requireFeature(deps.env);
  if (disabled) return disabled;
  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  try {
    const sug = await loadSuggestionForDecision(
      deps.ctx,
      input.suggestionId,
      input.projectId
    );
    const proposalClass = classifyScopeProposal({
      suggestionKind: sug.suggestion_kind,
      proposedWorkAreaType: sug.proposed_work_area_type,
    });
    if (proposalClass !== "SCOPE_ITEM" && proposalClass !== "EXCLUSION") {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: "Only scope items can be edited and included this way.",
      };
    }
    if (!input.modifiedTitle.trim()) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(
          DECISION_ERROR_CODES.INVALID_MODIFICATION
        ),
      };
    }

    const decisions = await listDecisionsForSuggestion(
      deps.ctx,
      input.suggestionId
    );
    if (decisions.some((d) => d.decision_type === "ACCEPT")) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(DECISION_ERROR_CODES.ALREADY_ACCEPTED),
      };
    }
    if (sug.stale_reason) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: safeDecisionFailureMessage(DECISION_ERROR_CODES.STALE_SUGGESTION),
      };
    }

    const decisionId = randomUUID();
    await insertDiscoveryDecision(deps.ctx, {
      id: decisionId,
      projectId: input.projectId,
      runId: sug.run_id,
      suggestionId: input.suggestionId,
      decisionType: "MODIFY",
      decidedAt: new Date().toISOString(),
      reasonCode: input.reasonCode ?? MODIFY_INCLUDE_REASON,
      userNote: input.userNote ?? null,
      modifiedTitle: input.modifiedTitle.trim(),
      modifiedDescription: input.modifiedDescription ?? null,
      modifiedWorkAreaType: input.modifiedWorkAreaType,
      sourceRevision: input.sourceRevision,
      createdWorkAreaId: null,
    });

    logDiscoveryEvent({
      event: "decision_completed",
      projectId: input.projectId,
      suggestionId: input.suggestionId,
      decisionId,
      status: "MODIFY_SCOPE_ITEM",
    });

    if (deps.revalidate) {
      await deps.revalidate(input.projectId);
    }

    return {
      ok: true,
      success: true,
      decisionId,
      suggestionId: input.suggestionId,
      projectId: input.projectId,
      decisionType: "MODIFY",
      createdWorkAreaId: null,
      idempotentReuse: false,
      message: "Scope item included with your edits. No work area was created.",
    };
  } catch (error) {
    if (error instanceof ScopeDiscoveryDecisionError) {
      return {
        ok: false,
        success: false,
        code: APPLICATION_ERROR_CODES.DECISION_FAILED,
        message: error.message,
      };
    }
    return applicationFailure(APPLICATION_ERROR_CODES.DECISION_FAILED);
  }
}

export { latestDecisionType };
