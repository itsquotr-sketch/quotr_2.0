/**
 * Deterministic eligibility for scope-discovery decisions (application mirror of RPC).
 * Authoritative instance uniqueness: migration 057 (type + normalised name).
 * Migration 029 type-only DUPLICATE_WORK_AREA is superseded; do not edit 029.
 */

import { isDuplicateWorkAreaInstance } from "@/lib/work-areas/instances";
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

export type ConfirmedWorkAreaInstance = {
  readonly type: string;
  readonly name: string;
};

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
  readonly confirmedInstances: readonly ConfirmedWorkAreaInstance[];
  /** @deprecated Type-only uniqueness. Ignored. */
  readonly confirmedWorkAreaTypeExists?: boolean;
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
  if (
    isDuplicateWorkAreaInstance({
      type: snap.proposedWorkAreaType,
      name: snap.proposedTitle,
      confirmed: snap.confirmedInstances,
    })
  ) {
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
  if (
    isDuplicateWorkAreaInstance({
      type: modifiedWorkAreaType,
      name: modifiedTitle,
      confirmed: snap.confirmedInstances,
    })
  ) {
    return { ok: false, reason: "DUPLICATE_WORK_AREA" };
  }
  return { ok: true };
}

export type AcceptedInstance = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly suggestionId: string;
};

/**
 * Sequential accept/modify ledger mirroring RPC instance uniqueness
 * (suggestion id one-shot + type+name duplicate instance).
 */
export function applyScopeDiscoveryAccept(params: {
  readonly suggestionId: string;
  readonly type: string;
  readonly title: string;
  readonly acceptedSuggestionIds: ReadonlySet<string>;
  readonly confirmed: readonly AcceptedInstance[];
}):
  | { ok: true; workAreaId: string; created: boolean }
  | { ok: false; reason: EligibilityBlockReason } {
  if (params.acceptedSuggestionIds.has(params.suggestionId)) {
    return { ok: false, reason: "ALREADY_ACCEPTED" };
  }
  if (
    params.confirmed.some((row) => row.suggestionId === params.suggestionId)
  ) {
    return { ok: false, reason: "ALREADY_SCOPE_CREATED" };
  }
  if (!params.type.trim() || !params.title.trim()) {
    return { ok: false, reason: "SUGGESTION_NOT_ELIGIBLE" };
  }
  if (
    isDuplicateWorkAreaInstance({
      type: params.type,
      name: params.title,
      confirmed: params.confirmed,
    })
  ) {
    return { ok: false, reason: "DUPLICATE_WORK_AREA" };
  }
  return {
    ok: true,
    workAreaId: `wa:${params.suggestionId}`,
    created: true,
  };
}
