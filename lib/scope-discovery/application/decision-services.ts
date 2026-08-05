/**
 * Decision application services — wrap 3.1B.5A RPCs behind the feature flag.
 */

import { getScopeDiscoveryAvailability } from "../configuration";
import type { PersistenceAuthContext } from "../persistence/context";
import {
  acceptScopeSuggestion as acceptRpc,
  rejectScopeSuggestion as rejectRpc,
  modifyAcceptScopeSuggestion as modifyRpc,
} from "../decisions/service";
import { APPLICATION_ERROR_CODES, applicationFailure } from "./errors";
import { logDiscoveryEvent } from "./logging";
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

export async function acceptScopeSuggestionApp(
  input: AcceptDecisionAppInput,
  deps: DecisionServiceDeps
): Promise<DecisionOutcome> {
  const disabled = requireFeature(deps.env);
  if (disabled) return disabled;

  if (!deps.ctx.userId || !deps.ctx.orgId) {
    return applicationFailure(APPLICATION_ERROR_CODES.NOT_AUTHENTICATED);
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
      ? "Suggestion was already rejected."
      : "Suggestion rejected.",
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
