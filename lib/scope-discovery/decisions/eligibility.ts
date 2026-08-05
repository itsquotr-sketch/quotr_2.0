/**
 * Deterministic eligibility for scope-discovery decisions (application mirror of RPC).
 * Authoritative enforcement remains in migration 029 RPCs.
 */

import { isSupportedWorkAreaType } from "./schemas";

export type EligibilityBlockReason =
  | "SUGGESTION_NOT_FOUND"
  | "FOREIGN_OR_MISSING"
  | "STALE_SUGGESTION"
  | "SUPERSEDED_SUGGESTION"
  | "SUGGESTION_NOT_ELIGIBLE"
  | "ALREADY_SCOPE_CREATED"
  | "ALREADY_ACCEPTED"
  | "DECISION_CONFLICT"
  | "DUPLICATE_WORK_AREA"
  | "INVALID_MODIFICATION";

export interface SuggestionEligibilitySnapshot {
  readonly suggestionId: string;
  readonly orgId: string;
  readonly projectId: string;
  readonly runOrgId: string;
  readonly runProjectId: string;
  readonly suggestionKind: string;
  readonly proposedWorkAreaType: string | null;
  readonly proposedTitle: string;
  readonly staleReason: string | null;
  readonly supersededBySuggestionId: string | null;
  readonly hasScopeCreatingDecision: boolean;
  readonly hasAcceptDecision: boolean;
  readonly hasRejectDecision: boolean;
  readonly confirmedWorkAreaTypeExists: boolean;
}

const SCOPE_KINDS = new Set(["WORK_AREA", "SUB_SCOPE", "MISSING_SCOPE"]);

export function evaluateAcceptEligibility(
  snap: SuggestionEligibilitySnapshot,
  callerOrgId: string,
  projectId: string
): { ok: true } | { ok: false; reason: EligibilityBlockReason } {
  if (snap.orgId !== callerOrgId || snap.projectId !== projectId) {
    return { ok: false, reason: "SUGGESTION_NOT_FOUND" };
  }
  if (snap.runOrgId !== callerOrgId || snap.runProjectId !== projectId) {
    return { ok: false, reason: "FOREIGN_OR_MISSING" };
  }
  if (snap.staleReason) return { ok: false, reason: "STALE_SUGGESTION" };
  if (snap.supersededBySuggestionId) {
    return { ok: false, reason: "SUPERSEDED_SUGGESTION" };
  }
  if (!SCOPE_KINDS.has(snap.suggestionKind)) {
    return { ok: false, reason: "SUGGESTION_NOT_ELIGIBLE" };
  }
  if (snap.hasScopeCreatingDecision) {
    return { ok: false, reason: "ALREADY_SCOPE_CREATED" };
  }
  if (snap.hasAcceptDecision) {
    return { ok: false, reason: "ALREADY_ACCEPTED" };
  }
  if (snap.hasRejectDecision) {
    return { ok: false, reason: "DECISION_CONFLICT" };
  }
  if (
    !snap.proposedWorkAreaType ||
    !isSupportedWorkAreaType(snap.proposedWorkAreaType) ||
    !snap.proposedTitle.trim()
  ) {
    return { ok: false, reason: "SUGGESTION_NOT_ELIGIBLE" };
  }
  if (snap.confirmedWorkAreaTypeExists) {
    return { ok: false, reason: "DUPLICATE_WORK_AREA" };
  }
  return { ok: true };
}

export function evaluateRejectEligibility(
  snap: SuggestionEligibilitySnapshot,
  callerOrgId: string,
  projectId: string
): { ok: true } | { ok: false; reason: EligibilityBlockReason } {
  if (snap.orgId !== callerOrgId || snap.projectId !== projectId) {
    return { ok: false, reason: "SUGGESTION_NOT_FOUND" };
  }
  if (snap.runOrgId !== callerOrgId || snap.runProjectId !== projectId) {
    return { ok: false, reason: "FOREIGN_OR_MISSING" };
  }
  if (snap.staleReason) return { ok: false, reason: "STALE_SUGGESTION" };
  if (snap.supersededBySuggestionId) {
    return { ok: false, reason: "SUPERSEDED_SUGGESTION" };
  }
  if (snap.hasScopeCreatingDecision) {
    return { ok: false, reason: "ALREADY_SCOPE_CREATED" };
  }
  return { ok: true };
}

export function evaluateModifyEligibility(
  snap: SuggestionEligibilitySnapshot,
  callerOrgId: string,
  projectId: string,
  modifiedTitle: string,
  modifiedWorkAreaType: string
): { ok: true } | { ok: false; reason: EligibilityBlockReason } {
  if (snap.orgId !== callerOrgId || snap.projectId !== projectId) {
    return { ok: false, reason: "SUGGESTION_NOT_FOUND" };
  }
  if (snap.runOrgId !== callerOrgId || snap.runProjectId !== projectId) {
    return { ok: false, reason: "FOREIGN_OR_MISSING" };
  }
  if (snap.staleReason) return { ok: false, reason: "STALE_SUGGESTION" };
  if (snap.supersededBySuggestionId) {
    return { ok: false, reason: "SUPERSEDED_SUGGESTION" };
  }
  if (!SCOPE_KINDS.has(snap.suggestionKind)) {
    return { ok: false, reason: "SUGGESTION_NOT_ELIGIBLE" };
  }
  if (snap.hasScopeCreatingDecision) {
    return { ok: false, reason: "ALREADY_SCOPE_CREATED" };
  }
  if (snap.hasRejectDecision) {
    return { ok: false, reason: "DECISION_CONFLICT" };
  }
  if (!modifiedTitle.trim() || !isSupportedWorkAreaType(modifiedWorkAreaType)) {
    return { ok: false, reason: "INVALID_MODIFICATION" };
  }
  if (snap.confirmedWorkAreaTypeExists) {
    return { ok: false, reason: "DUPLICATE_WORK_AREA" };
  }
  return { ok: true };
}
