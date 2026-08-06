/**
 * Decision application services — wrap 3.1B.5A RPCs behind the feature flag.
 * Routes Work Area vs Scope Item decisions (3.1B.6R1).
 */

import { getScopeDiscoveryAvailability } from "../configuration";
import { classifyScopeProposal } from "../classification";
import type { PersistenceAuthContext } from "../persistence/context";
import { getSuggestionDetailById } from "../persistence";
import {
  acceptScopeSuggestion as acceptRpc,
  rejectScopeSuggestion as rejectRpc,
  modifyAcceptScopeSuggestion as modifyRpc,
} from "../decisions/service";
import { APPLICATION_ERROR_CODES, applicationFailure } from "./errors";
import { logDiscoveryEvent } from "./logging";
import {
  includeScopeItemApp,
  modifyIncludeScopeItemApp,
} from "./scope-item-decisions";
import type {
  AcceptDecisionAppInput,
  DecisionOutcome,
  ModifyDecisionAppInput,
  RejectDecisionAppInput,
} from "./types";

export interface DecisionServiceDeps {
  readonly ctx: PersistenceAuthContext;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly revalidate?: (projectId: string) => void | Promise<void>;
}

function requireFeature(
  env: Readonly<Record<string, string | undefined>> | undefined
): DecisionOutcome | null {
  const availability = getScopeDiscoveryAvailability(env ?? process.env);
  if (!availability.featureEnabled) {
    return applicationFailure(APPLICATION_ERROR_CODES.FEATURE_DISABLED);
  }
  return null;
}

async function classifySuggestion(
  ctx: PersistenceAuthContext,
  suggestionId: string,
  projectId: string
) {
  const sug = await getSuggestionDetailById(ctx, suggestionId);
  if (!sug || sug.project_id !== projectId || sug.org_id !== ctx.orgId) {
    return null;
  }
  return {
    sug,
    proposalClass: classifyScopeProposal({
      suggestionKind: sug.suggestion_kind,
      proposedWorkAreaType: sug.proposed_work_area_type,
      relatedWorkAreaId: sug.related_work_area_id,
    }),
  };
}

export async function acceptScopeSuggestionApp(
  input: AcceptDecisionAppInput,
  deps: DecisionServiceDeps
): Promise<DecisionOutcome> {
  const disabled = requireFeature(deps.env);
  if (disabled) return disabled;

  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  const classified = await classifySuggestion(
    deps.ctx,
    input.suggestionId,
    input.projectId
  );
  if (!classified) {
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.DECISION_FAILED,
      message: "Suggestion was not found.",
    };
  }

  if (
    classified.proposalClass === "SCOPE_ITEM" ||
    classified.proposalClass === "EXCLUSION"
  ) {
    return includeScopeItemApp(input, deps);
  }

  if (classified.proposalClass !== "HIGH_LEVEL_WORK_AREA") {
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.DECISION_FAILED,
      message:
        classified.proposalClass === "CLARIFICATION"
          ? "Clarifications are answered in Scope Details, or mark as not applicable."
          : "This suggestion cannot create a work area. Review or dismiss it instead.",
    };
  }

  const result = await acceptRpc(deps.ctx, input);
  if (!result.ok) {
    logDiscoveryEvent({
      event: "decision_failed",
      projectId: input.projectId,
      suggestionId: input.suggestionId,
      code: result.code,
    });
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.DECISION_FAILED,
      message: result.message,
    };
  }

  logDiscoveryEvent({
    event: "decision_completed",
    projectId: input.projectId,
    suggestionId: input.suggestionId,
    decisionId: result.decisionId,
    status: result.decisionType,
  });

  if (deps.revalidate) {
    await deps.revalidate(input.projectId);
  }

  return {
    ok: true,
    success: true,
    decisionId: result.decisionId,
    suggestionId: result.suggestionId,
    projectId: result.projectId,
    decisionType: "ACCEPT",
    createdWorkAreaId: result.workAreaId,
    idempotentReuse: Boolean(result.idempotentReuse),
    message: "Suggestion accepted. Work Area created.",
  };
}

export async function rejectScopeSuggestionApp(
  input: RejectDecisionAppInput,
  deps: DecisionServiceDeps
): Promise<DecisionOutcome> {
  const disabled = requireFeature(deps.env);
  if (disabled) return disabled;

  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  const result = await rejectRpc(deps.ctx, input);
  if (!result.ok) {
    logDiscoveryEvent({
      event: "decision_failed",
      projectId: input.projectId,
      suggestionId: input.suggestionId,
      code: result.code,
    });
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.DECISION_FAILED,
      message: result.message,
    };
  }

  logDiscoveryEvent({
    event: "decision_completed",
    projectId: input.projectId,
    suggestionId: input.suggestionId,
    decisionId: result.decisionId,
    status: result.decisionType,
  });

  if (deps.revalidate) {
    await deps.revalidate(input.projectId);
  }

  return {
    ok: true,
    success: true,
    decisionId: result.decisionId,
    suggestionId: result.suggestionId,
    projectId: result.projectId,
    decisionType: "REJECT",
    createdWorkAreaId: null,
    idempotentReuse: Boolean(result.idempotentReuse),
    message: result.idempotentReuse
      ? "Suggestion was already dismissed."
      : "Suggestion marked as not required.",
  };
}

export async function modifyScopeSuggestionApp(
  input: ModifyDecisionAppInput,
  deps: DecisionServiceDeps
): Promise<DecisionOutcome> {
  const disabled = requireFeature(deps.env);
  if (disabled) return disabled;

  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
  }

  const classified = await classifySuggestion(
    deps.ctx,
    input.suggestionId,
    input.projectId
  );
  if (!classified) {
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.DECISION_FAILED,
      message: "Suggestion was not found.",
    };
  }

  if (
    classified.proposalClass === "SCOPE_ITEM" ||
    classified.proposalClass === "EXCLUSION"
  ) {
    return modifyIncludeScopeItemApp(input, deps);
  }

  if (classified.proposalClass !== "HIGH_LEVEL_WORK_AREA") {
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.DECISION_FAILED,
      message: "This suggestion cannot be edited into a work area.",
    };
  }

  const result = await modifyRpc(deps.ctx, {
    suggestionId: input.suggestionId,
    projectId: input.projectId,
    modifiedTitle: input.modifiedTitle,
    modifiedDescription: input.modifiedDescription ?? null,
    modifiedWorkAreaType: input.modifiedWorkAreaType,
    sourceRevision: input.sourceRevision,
    reasonCode: input.reasonCode,
    userNote: input.userNote,
  });

  if (!result.ok) {
    logDiscoveryEvent({
      event: "decision_failed",
      projectId: input.projectId,
      suggestionId: input.suggestionId,
      code: result.code,
    });
    return {
      ok: false,
      success: false,
      code: APPLICATION_ERROR_CODES.DECISION_FAILED,
      message: result.message,
    };
  }

  logDiscoveryEvent({
    event: "decision_completed",
    projectId: input.projectId,
    suggestionId: input.suggestionId,
    decisionId: result.decisionId,
    status: result.decisionType,
  });

  if (deps.revalidate) {
    await deps.revalidate(input.projectId);
  }

  return {
    ok: true,
    success: true,
    decisionId: result.decisionId,
    suggestionId: result.suggestionId,
    projectId: result.projectId,
    decisionType: "MODIFY",
    createdWorkAreaId: result.workAreaId,
    idempotentReuse: Boolean(result.idempotentReuse),
    message: "Suggestion modified and Work Area created.",
  };
}
