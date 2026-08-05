import { SCOPE_DISCOVERY_ERROR_CODES } from "./codes";
import { deepFreeze } from "./immutability";
import type {
  ScopeDiscoveryDecision,
  ScopeDiscoverySuggestion,
  ScopeDiscoverySuggestionStatus,
  TransitionCommand,
  TransitionCommandType,
  TransitionResult,
  ValidationIssue,
} from "./types";
import { validateScopeDiscoverySuggestion } from "./validation";

export const ALLOWED_TRANSITIONS: Readonly<
  Record<ScopeDiscoverySuggestionStatus, readonly TransitionCommandType[]>
> = Object.freeze({
  PROPOSED: Object.freeze([
    "ACCEPT",
    "REJECT",
    "MODIFY",
    "MARK_STALE",
    "SUPERSEDE",
    "MARK_FAILED",
  ] as const),
  ACCEPTED: Object.freeze([] as const),
  REJECTED: Object.freeze(["SUPERSEDE"] as const),
  MODIFIED: Object.freeze([] as const),
  STALE: Object.freeze(["SUPERSEDE"] as const),
  SUPERSEDED: Object.freeze([] as const),
  FAILED: Object.freeze([] as const),
});

export function isTransitionAllowed(
  status: ScopeDiscoverySuggestionStatus,
  command: TransitionCommandType
): boolean {
  return ALLOWED_TRANSITIONS[status].includes(command);
}

function fail(
  current: ScopeDiscoverySuggestion,
  command: TransitionCommand,
  issues: readonly ValidationIssue[]
): TransitionResult {
  return deepFreeze({
    ok: false,
    suggestion: null,
    issues,
    fromStatus: current.status,
    toStatus: null,
    commandType: command.type,
    audit: command.audit,
  });
}

function buildDecision(
  current: ScopeDiscoverySuggestion,
  command: Extract<
    TransitionCommand,
    { type: "ACCEPT" | "REJECT" | "MODIFY" }
  >
): ScopeDiscoveryDecision {
  if (command.type === "ACCEPT") {
    return deepFreeze({
      decisionType: "accept" as const,
      decidedByUserId: command.audit.actorUserId,
      decidedAt: command.audit.occurredAt,
      originalSuggestionId: current.suggestionId,
      modifiedTitle: null,
      modifiedDescription: null,
      modifiedWorkAreaType: null,
      reasonCode: command.reasonCode,
      userNote: command.audit.note,
      sourceRevision: command.audit.sourceRevision,
      resultingWorkAreaId: command.resultingWorkAreaId,
    });
  }
  if (command.type === "REJECT") {
    return deepFreeze({
      decisionType: "reject" as const,
      decidedByUserId: command.audit.actorUserId,
      decidedAt: command.audit.occurredAt,
      originalSuggestionId: current.suggestionId,
      modifiedTitle: null,
      modifiedDescription: null,
      modifiedWorkAreaType: null,
      reasonCode: command.reasonCode,
      userNote: command.userNote,
      sourceRevision: command.audit.sourceRevision,
      resultingWorkAreaId: null,
    });
  }
  return deepFreeze({
    decisionType: "modify" as const,
    decidedByUserId: command.audit.actorUserId,
    decidedAt: command.audit.occurredAt,
    originalSuggestionId: current.suggestionId,
    modifiedTitle: command.modifiedTitle,
    modifiedDescription: command.modifiedDescription,
    modifiedWorkAreaType: command.modifiedWorkAreaType,
    reasonCode: command.reasonCode,
    userNote: command.userNote,
    sourceRevision: command.audit.sourceRevision,
    resultingWorkAreaId: command.resultingWorkAreaId,
  });
}

/**
 * Apply a lifecycle command. Never mutates `current`.
 * Original proposal fields remain immutable on MODIFY (corrections live in decision).
 */
export function transitionScopeSuggestion(
  current: ScopeDiscoverySuggestion,
  command: TransitionCommand
): TransitionResult {
  const snapshotBefore = JSON.stringify(current);

  if (!isTransitionAllowed(current.status, command.type)) {
    return fail(current, command, [
      {
        code: SCOPE_DISCOVERY_ERROR_CODES.INVALID_TRANSITION,
        message: `Cannot apply ${command.type} from status ${current.status}.`,
        path: "status",
      },
    ]);
  }

  let nextStatus: ScopeDiscoverySuggestionStatus;
  let decision = current.decision;
  let staleReason = current.staleReason;
  let supersededBySuggestionId = current.supersededBySuggestionId;
  let failureCode = current.failureCode;
  let failureMessage = current.failureMessage;

  switch (command.type) {
    case "ACCEPT":
      nextStatus = "ACCEPTED";
      decision = buildDecision(current, command);
      staleReason = null;
      supersededBySuggestionId = null;
      failureCode = null;
      failureMessage = null;
      break;
    case "REJECT":
      nextStatus = "REJECTED";
      decision = buildDecision(current, command);
      staleReason = null;
      supersededBySuggestionId = null;
      failureCode = null;
      failureMessage = null;
      break;
    case "MODIFY":
      nextStatus = "MODIFIED";
      decision = buildDecision(current, command);
      staleReason = null;
      supersededBySuggestionId = null;
      failureCode = null;
      failureMessage = null;
      break;
    case "MARK_STALE":
      nextStatus = "STALE";
      staleReason = command.staleReason;
      break;
    case "SUPERSEDE":
      nextStatus = "SUPERSEDED";
      supersededBySuggestionId = command.supersededBySuggestionId;
      break;
    case "MARK_FAILED":
      nextStatus = "FAILED";
      failureCode = command.failureCode;
      failureMessage = command.failureMessage;
      break;
    default: {
      const _exhaustive: never = command;
      return fail(current, _exhaustive, [
        {
          code: SCOPE_DISCOVERY_ERROR_CODES.INVALID_COMMAND,
          message: "Unknown transition command.",
          path: "type",
        },
      ]);
    }
  }

  const next: ScopeDiscoverySuggestion = deepFreeze({
    ...current,
    status: nextStatus,
    decision,
    staleReason,
    supersededBySuggestionId,
    failureCode,
    failureMessage,
    updatedAt: command.audit.occurredAt,
    // Explicitly preserve original proposal body
    proposedTitle: current.proposedTitle,
    proposedDescription: current.proposedDescription,
    proposedWorkAreaType: current.proposedWorkAreaType,
    evidence: current.evidence,
    confidence: current.confidence,
    confidenceBand: current.confidenceBand,
    rationaleKey: current.rationaleKey,
    sourceSnapshot: current.sourceSnapshot,
  });

  const validated = validateScopeDiscoverySuggestion(next);
  if (!validated.ok || !validated.suggestion) {
    return fail(current, command, validated.issues);
  }

  if (JSON.stringify(current) !== snapshotBefore) {
    return fail(current, command, [
      {
        code: SCOPE_DISCOVERY_ERROR_CODES.ORIGINAL_IMMUTABLE,
        message: "Input suggestion was mutated during transition.",
        path: "$",
      },
    ]);
  }

  return deepFreeze({
    ok: true,
    suggestion: validated.suggestion,
    issues: [],
    fromStatus: current.status,
    toStatus: nextStatus,
    commandType: command.type,
    audit: command.audit,
  });
}
