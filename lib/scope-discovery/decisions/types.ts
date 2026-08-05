import type { DecisionErrorCode } from "./errors";

export type ScopeCreatingDecisionType = "ACCEPT" | "MODIFY";
export type DecisionLifecycleType = "ACCEPT" | "REJECT" | "MODIFY";

export interface AcceptSuggestionInput {
  readonly suggestionId: string;
  readonly projectId: string;
  readonly sourceRevision: string;
  readonly reasonCode?: string | null;
  readonly userNote?: string | null;
}

export interface RejectSuggestionInput {
  readonly suggestionId: string;
  readonly projectId: string;
  readonly sourceRevision: string;
  readonly reasonCode?: string | null;
  readonly userNote?: string | null;
}

export interface ModifyAcceptSuggestionInput {
  readonly suggestionId: string;
  readonly projectId: string;
  readonly modifiedTitle: string;
  readonly modifiedDescription: string | null;
  readonly modifiedWorkAreaType: string;
  readonly sourceRevision: string;
  readonly reasonCode?: string | null;
  readonly userNote?: string | null;
}

export interface DecisionLifecycleSuccess {
  readonly ok: true;
  readonly decisionId: string;
  readonly workAreaId: string | null;
  readonly decisionType: DecisionLifecycleType;
  readonly suggestionId: string;
  readonly projectId: string;
  readonly idempotentReuse?: boolean;
}

export interface DecisionLifecycleFailure {
  readonly ok: false;
  readonly code: DecisionErrorCode;
  readonly message: string;
}

export type DecisionLifecycleResult =
  | DecisionLifecycleSuccess
  | DecisionLifecycleFailure;

/** Work Area fields written by acceptance RPCs — no Facts / commercial values. */
export interface AcceptedWorkAreaMapping {
  readonly orgId: "derived-from-auth";
  readonly projectId: "from-request";
  readonly type: "proposed_or_modified_catalogue_type";
  readonly name: "proposed_or_modified_title";
  readonly status: "confirmed";
  readonly aiConfidence: null;
  readonly summary: "proposed_or_modified_description";
  readonly sortOrder: "max_existing_plus_one";
}

export const ACCEPTED_WORK_AREA_MAPPING: AcceptedWorkAreaMapping = {
  orgId: "derived-from-auth",
  projectId: "from-request",
  type: "proposed_or_modified_catalogue_type",
  name: "proposed_or_modified_title",
  status: "confirmed",
  aiConfidence: null,
  summary: "proposed_or_modified_description",
  sortOrder: "max_existing_plus_one",
};
