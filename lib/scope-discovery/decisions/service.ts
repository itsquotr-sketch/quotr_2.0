/**
 * Stage 3.1B.5A — Scope discovery decision lifecycle service.
 *
 * Calls SECURITY INVOKER RPCs. Org is derived from auth profile via auth.uid().
 * Unused by production UI / Analyse Job in this batch.
 */

import type { PersistenceAuthContext } from "../persistence/context";
import {
  DECISION_ERROR_CODES,
  ScopeDiscoveryDecisionError,
  mapDecisionRpcError,
  safeDecisionFailureMessage,
} from "./errors";
import { mapRpcSuccess } from "./mappers";
import {
  acceptSuggestionSchema,
  modifyAcceptSuggestionSchema,
  rejectSuggestionSchema,
} from "./schemas";
import type {
  AcceptSuggestionInput,
  DecisionLifecycleResult,
  ModifyAcceptSuggestionInput,
  RejectSuggestionInput,
} from "./types";

function failureFromError(error: ScopeDiscoveryDecisionError): DecisionLifecycleResult {
  return {
    ok: false,
    code: error.code,
    message: safeDecisionFailureMessage(error.code),
  };
}

function requireAuth(ctx: PersistenceAuthContext): void {
  if (!ctx.userId || !ctx.orgId) {
    throw new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.UNAUTHENTICATED);
  }
}

export async function acceptScopeSuggestion(
  ctx: PersistenceAuthContext,
  input: AcceptSuggestionInput
): Promise<DecisionLifecycleResult> {
  try {
    requireAuth(ctx);
    const parsed = acceptSuggestionSchema.safeParse(input);
    if (!parsed.success) {
      return failureFromError(
        new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.VALIDATION_FAILED)
      );
    }

    const { data, error } = await ctx.supabase.rpc(
      "accept_scope_discovery_suggestion",
      {
        p_suggestion_id: parsed.data.suggestionId,
        p_project_id: parsed.data.projectId,
        p_source_revision: parsed.data.sourceRevision,
        p_reason_code: parsed.data.reasonCode ?? null,
        p_user_note: parsed.data.userNote ?? null,
      }
    );

    if (error) {
      return failureFromError(mapDecisionRpcError(error));
    }

    const mapped = mapRpcSuccess(data);
    if (!mapped) {
      return failureFromError(
        new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.TRANSACTION_FAILED)
      );
    }
    return mapped;
  } catch (e) {
    if (e instanceof ScopeDiscoveryDecisionError) {
      return failureFromError(e);
    }
    return failureFromError(
      new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.TRANSACTION_FAILED)
    );
  }
}

export async function rejectScopeSuggestion(
  ctx: PersistenceAuthContext,
  input: RejectSuggestionInput
): Promise<DecisionLifecycleResult> {
  try {
    requireAuth(ctx);
    const parsed = rejectSuggestionSchema.safeParse(input);
    if (!parsed.success) {
      return failureFromError(
        new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.VALIDATION_FAILED)
      );
    }

    const { data, error } = await ctx.supabase.rpc(
      "reject_scope_discovery_suggestion",
      {
        p_suggestion_id: parsed.data.suggestionId,
        p_project_id: parsed.data.projectId,
        p_source_revision: parsed.data.sourceRevision,
        p_reason_code: parsed.data.reasonCode ?? null,
        p_user_note: parsed.data.userNote ?? null,
      }
    );

    if (error) {
      return failureFromError(mapDecisionRpcError(error));
    }

    const mapped = mapRpcSuccess(data);
    if (!mapped) {
      return failureFromError(
        new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.TRANSACTION_FAILED)
      );
    }
    return mapped;
  } catch (e) {
    if (e instanceof ScopeDiscoveryDecisionError) {
      return failureFromError(e);
    }
    return failureFromError(
      new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.TRANSACTION_FAILED)
    );
  }
}

export async function modifyAcceptScopeSuggestion(
  ctx: PersistenceAuthContext,
  input: ModifyAcceptSuggestionInput
): Promise<DecisionLifecycleResult> {
  try {
    requireAuth(ctx);
    const parsed = modifyAcceptSuggestionSchema.safeParse(input);
    if (!parsed.success) {
      return failureFromError(
        new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.INVALID_MODIFICATION)
      );
    }

    const { data, error } = await ctx.supabase.rpc(
      "modify_accept_scope_discovery_suggestion",
      {
        p_suggestion_id: parsed.data.suggestionId,
        p_project_id: parsed.data.projectId,
        p_modified_title: parsed.data.modifiedTitle,
        p_modified_description: parsed.data.modifiedDescription,
        p_modified_work_area_type: parsed.data.modifiedWorkAreaType,
        p_source_revision: parsed.data.sourceRevision,
        p_reason_code: parsed.data.reasonCode ?? null,
        p_user_note: parsed.data.userNote ?? null,
      }
    );

    if (error) {
      return failureFromError(mapDecisionRpcError(error));
    }

    const mapped = mapRpcSuccess(data);
    if (!mapped) {
      return failureFromError(
        new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.TRANSACTION_FAILED)
      );
    }
    return mapped;
  } catch (e) {
    if (e instanceof ScopeDiscoveryDecisionError) {
      return failureFromError(e);
    }
    return failureFromError(
      new ScopeDiscoveryDecisionError(DECISION_ERROR_CODES.TRANSACTION_FAILED)
    );
  }
}
