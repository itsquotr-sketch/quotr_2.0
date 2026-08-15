/**
 * Stage 3.2.1 — Builder Interview candidate engine types (pure).
 *
 * No DB / React / server imports.
 */

import type { FactSource } from "@/lib/scopes/fact-values";

export const INTERVIEW_REGISTRY_VERSION = "3.2.1.0" as const;

export type InterviewDomain =
  | "PROJECT_IDENTITY"
  | "SITE_ACCESS"
  | "EXISTING_CONDITIONS"
  | "DIMENSIONS"
  | "SCOPE_CONTEXT"
  | "SPECIFICATION_CONTEXT"
  | "LOGISTICS"
  | "COMPLIANCE_RISK"
  | "TRADE_INTERFACES"
  | "COMMERCIAL_DELIVERY";

export type InterviewScope = "PROJECT" | "WORK_AREA";

export type InterviewWriteTarget =
  | "FACT"
  | "CONSTRAINT"
  | "ASSUMPTION"
  | "NONE";

export type PriorityClass = "P0" | "P1" | "P2" | "P3";

export type AskPolicy = "ASK" | "ASSUME" | "BENCHMARK" | "DEFER" | "FLAG";

export type Answerability =
  | "ON_SITE"
  | "REQUIRES_MEASUREMENT"
  | "REQUIRES_EXPERT"
  | "NOT_APPLICABLE";

export type ImpactLevel = "none" | "low" | "medium" | "high";

export type EstimateImpactKind =
  | "none"
  | "quantity"
  | "labour"
  | "material"
  | "risk"
  | "confidence";

/** Stable semantic topic for project↔WA deduplication (not key-string equality). */
export type SemanticTopicId =
  | "site.access"
  | "site.carry"
  | "site.floor_level"
  | "site.occupied"
  | "site.working_hours"
  | "site.parking_loading"
  | "site.waste_bin"
  | "site.slope"
  | "risk.hazmat"
  | "risk.services"
  | "risk.protection"
  | "compliance.consent"
  | "commercial.client_supplied"
  | "commercial.by_others"
  | "demo.salvage"
  | "scope.existence"
  | "details.component";

export type EvidenceState =
  | "KNOWN"
  | "UNKNOWN"
  | "LOWER_AUTHORITY_EVIDENCE"
  | "USER_CONFLICT"
  | "ASSUMED"
  | "DERIVED"
  | "SUPPRESSED"
  | "NOT_SURE";

export type AssumptionStatus =
  | "CURRENT"
  | "SUPERSEDED"
  | "TRIGGER_NO_LONGER_APPLIES"
  | "WORK_AREA_REMOVED"
  | "SCOPE_EXCLUDED"
  | "PROJECT_SUPPRESSED"
  | "CONDITIONAL_PARENT_FALSE";

export type InterviewReadinessState =
  | "READY"
  | "READY_WITH_ASSUMPTIONS"
  | "NEEDS_IMPORTANT_INFORMATION";

export type FactSourceName = FactSource | string;

export type InterviewWorkAreaStatus = "suggested" | "confirmed" | "excluded";

export type InterviewWorkAreaInput = {
  id: string;
  type: string;
  name: string;
  status: InterviewWorkAreaStatus;
  sortOrder?: number;
};

export type InterviewFactInput = {
  key: string;
  workAreaId: string | null;
  value: unknown;
  source?: FactSourceName | null;
};

export type InterviewConstraintInput = {
  /** Canonical constraint key — use `occupied_site`, never `site_occupied`. */
  key: string;
  value: unknown;
  source?: FactSourceName | null;
};

export type InterviewScopeItemInput = {
  workAreaId: string;
  /** Catalogue / scope item type id */
  type: string;
  included: boolean;
};

export type InterviewAssumptionInput = {
  questionKey: string;
  assumedValue: unknown;
  reason?: string;
  source?: FactSourceName | null;
  targetKey?: string;
  writeTarget?: InterviewWriteTarget;
  workAreaId?: string | null;
  semanticTopic?: SemanticTopicId;
  confidenceImpact?: ImpactLevel;
};

export type InterviewMissingInfoInput = {
  key: string;
  severity?: "critical" | "high" | "medium" | "low";
};

export type BuilderInterviewProjectInput = {
  id?: string;
  qualityLevel?: string | null;
};

export type BuilderInterviewInput = {
  project?: BuilderInterviewProjectInput;
  workAreas: readonly InterviewWorkAreaInput[];
  facts: readonly InterviewFactInput[];
  /** Project-wide constraints from the live `constraints` table namespace. */
  constraints: readonly InterviewConstraintInput[];
  /** Optional Scope Review / ISD inclusion state */
  scopeItems?: readonly InterviewScopeItemInput[];
  excludedScopeItemTypes?: readonly string[];
  calculatorMissingInfo?: readonly InterviewMissingInfoInput[];
  existingAssumptions?: readonly InterviewAssumptionInput[];
  /**
   * Proposed user answers for conflict modelling only (3.2.1 — no writes).
   * Keyed by questionKey.
   */
  proposedAnswers?: Readonly<Record<string, unknown>>;
};

export type InterviewImpact = {
  estimate: EstimateImpactKind;
  scope: ImpactLevel;
  confidence: ImpactLevel;
};

export type RegistryQuestionDef = {
  questionKey: string;
  version: string;
  domain: InterviewDomain;
  scope: InterviewScope;
  /** When scope=WORK_AREA; omit for project */
  workAreaType?: string;
  writeTarget: InterviewWriteTarget;
  targetKey: string;
  semanticTopic: SemanticTopicId;
  question: string;
  inputType: "select" | "boolean" | "number" | "text" | "multi_select";
  options?: readonly string[];
  priority: PriorityClass;
  askPolicy: AskPolicy;
  reasonForAsking: string;
  impact: InterviewImpact;
  answerability: Answerability;
  /** Deterministic rule ids that must all pass for candidacy */
  triggerRuleIds: readonly string[];
  /** Parent questionKey that must be applicable/true for this child */
  dependsOnQuestionKey?: string;
  /**
   * When true, this WA clone only appears if an explicit override predicate passes
   * (and is not otherwise suppressed).
   */
  requiresLocalOverride?: boolean;
  /** Owning surface when DEFER/FLAG */
  ownedBy?: "SCOPE_DETAILS" | "SCOPE_REVIEW" | "SITE_CONSTRAINTS" | "INTERVIEW";
  registryOrder: number;
};

export type InterviewCandidate = {
  questionKey: string;
  version: string;
  domain: InterviewDomain;
  scope: InterviewScope;
  workAreaId?: string;
  workAreaType?: string;
  writeTarget: InterviewWriteTarget;
  targetKey: string;
  semanticTopic: SemanticTopicId;
  question: string;
  inputType: RegistryQuestionDef["inputType"];
  options?: readonly string[];
  priority: PriorityClass;
  askPolicy: AskPolicy;
  reasonForAsking: string;
  impact: InterviewImpact;
  answerability: Answerability;
  evidenceState: EvidenceState;
  /** If a proposed answer were applied, would write need conflict confirm? */
  proposedWriteRequiresConflictConfirm: boolean;
  triggerRuleId: string;
  provenance: {
    registryVersion: typeof INTERVIEW_REGISTRY_VERSION;
    ruleId: string;
  };
};

export type SuppressedCandidate = {
  questionKey: string;
  workAreaId?: string;
  semanticTopic: SemanticTopicId;
  askPolicy: AskPolicy;
  suppressionReason: string;
  suppressionCode:
    | "TARGET_KNOWN"
    | "PROJECT_TOPIC_SUPPRESSED"
    | "WORK_AREA_ABSENT"
    | "WORK_AREA_EXCLUDED"
    | "SCOPE_ITEM_EXCLUDED"
    | "TRIGGER_FALSE"
    | "CONDITIONAL_PARENT"
    | "POLICY_DEFER"
    | "POLICY_FLAG"
    | "POLICY_ASSUME"
    | "POLICY_BENCHMARK"
    | "OVERRIDE_NOT_MET"
    | "NAMESPACE_INVALID";
  evidenceState: EvidenceState;
};

export type ClassifiedAssumption = {
  questionKey: string;
  status: AssumptionStatus;
  reason: string;
};

export type InterviewReadiness = {
  state: InterviewReadinessState;
  reasons: readonly string[];
  blockingCandidateKeys: readonly string[];
  assumptionCandidateKeys: readonly string[];
  openP0Keys: readonly string[];
  openP1Keys: readonly string[];
  /** Soft-block model for Quick Estimate only (D3). FOUNDATION-R1-R1 wires required Project Conditions as a hard block on Generate. */
  canGenerateQuickEstimate: boolean;
  softBlockQuickEstimate: boolean;
};

export type InterviewDiagnostics = {
  registryVersion: typeof INTERVIEW_REGISTRY_VERSION;
  candidateCount: number;
  suppressedCount: number;
  confirmedWorkAreaCount: number;
  assumptionClassifications: readonly ClassifiedAssumption[];
  recomputeNote: string;
};

export type BuilderInterviewResult = {
  candidates: readonly InterviewCandidate[];
  suppressed: readonly SuppressedCandidate[];
  readiness: InterviewReadiness;
  diagnostics: InterviewDiagnostics;
};
