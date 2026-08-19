/**
 * RECOVERY-4-R2 — ABSENT FROM BRIEF !== NOT_INCLUDED.
 *
 * Negative optional-scope Facts are only exclusions when the brief (or a user
 * write) explicitly supports that polarity. AI/inferred false is treated as
 * unresolved so Estimate now can assume without persisting a fake exclusion.
 */

import type { EstimateFact } from "@/lib/estimate/types";
import { jobPlanBoolean, jobPlanString } from "@/lib/assistant/job-plan/facts";
import type { JobPlanScopePresentation } from "@/lib/assistant/job-plan/types";

export type ScopeExclusionProvenanceKind =
  | "absent"
  | "user"
  | "brief_extraction"
  | "deterministic_rule"
  | "existing_fact"
  | "implicit_absence"
  | "suppressed";

export type ScopeExclusionProvenance = {
  readonly kind: ScopeExclusionProvenanceKind;
  readonly factKey: string;
  readonly presentation: JobPlanScopePresentation;
  readonly persistedFalse: boolean;
  readonly reason: string;
};

const USER_SOURCES = new Set(["user", "builder", "job_plan"]);

const EXPLICIT_NEGATIVE: Record<string, readonly string[]> = {
  "deck.existing_deck_removal": [
    "remove existing deck",
    "no demolition",
    "without demolition",
    "no removal",
    "do not remove",
    "leave existing deck",
  ],
  "deck.vertical_face_boards_required": [
    "no fascia",
    "without fascia",
    "fascia not",
    "no vertical face",
    "without face boards",
  ],
  "deck.balustrade_required": [
    "no balustrade",
    "without balustrade",
    "balustrade not required",
    "balustrade not needed",
    "no railing",
    "without railing",
  ],
  "deck.access_type": [
    "no stairs",
    "without stairs",
    "no steps",
    "without steps",
    "no stair",
  ],
  "deck.handrail_required": [
    "no handrail",
    "without handrail",
    "handrail not required",
  ],
};

function normaliseBrief(text: string | null | undefined): string {
  return (text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function briefSupportsExplicitNegative(
  briefText: string | null | undefined,
  factKey: string
): boolean {
  const brief = normaliseBrief(briefText);
  if (!brief) return false;
  const phrases = EXPLICIT_NEGATIVE[factKey];
  if (!phrases) return false;
  return phrases.some((phrase) => brief.includes(phrase));
}

export function isUserSourcedFact(source: string | null | undefined): boolean {
  if (!source) return false;
  return USER_SOURCES.has(source.toLowerCase());
}

function isNegativeScopeValue(factKey: string, value: unknown): boolean {
  if (value === false) return true;
  if (factKey === "deck.access_type") {
    return String(value).trim().toLowerCase() === "none";
  }
  return false;
}

export function isImplicitScopeExclusion(params: {
  readonly factKey: string;
  readonly value: unknown;
  readonly source?: string | null;
  readonly briefText?: string | null;
}): boolean {
  if (!isNegativeScopeValue(params.factKey, params.value)) return false;
  if (isUserSourcedFact(params.source)) return false;
  if (briefSupportsExplicitNegative(params.briefText, params.factKey)) {
    return false;
  }
  return true;
}

function factRow(
  facts: readonly EstimateFact[],
  workAreaId: string,
  key: string
): EstimateFact | undefined {
  return facts.find(
    (row) => row.key === key && row.work_area_id === workAreaId
  );
}

/**
 * Boolean scope for Job Plan / Clarify. Implicit AI negatives read as unknown.
 * Does not rewrite Facts and does not change calculator inputs.
 */
export function effectiveJobPlanBoolean(
  facts: readonly EstimateFact[],
  workAreaId: string,
  key: string,
  briefText: string | null | undefined
): boolean | null {
  const row = factRow(facts, workAreaId, key);
  const value = jobPlanBoolean(facts, workAreaId, key);
  if (
    value === false &&
    isImplicitScopeExclusion({
      factKey: key,
      value: row?.value ?? value,
      source: row?.source,
      briefText,
    })
  ) {
    return null;
  }
  return value;
}

export function effectiveJobPlanAccessType(
  facts: readonly EstimateFact[],
  workAreaId: string,
  briefText: string | null | undefined
): string | null {
  const row = factRow(facts, workAreaId, "deck.access_type");
  const value = jobPlanString(facts, workAreaId, "deck.access_type");
  if (
    value &&
    isImplicitScopeExclusion({
      factKey: "deck.access_type",
      value,
      source: row?.source,
      briefText,
    })
  ) {
    return null;
  }
  return value;
}

export function scopeExclusionProvenance(params: {
  readonly factKey: string;
  readonly workAreaId: string;
  readonly facts: readonly EstimateFact[];
  readonly briefText: string | null;
  readonly presentation: JobPlanScopePresentation;
  readonly suppressed?: boolean;
}): ScopeExclusionProvenance {
  const row = factRow(params.facts, params.workAreaId, params.factKey);
  if (params.suppressed) {
    return {
      kind: "suppressed",
      factKey: params.factKey,
      presentation: "NOT_CONFIRMED",
      persistedFalse: false,
      reason: "Not material for this Job Plan card",
    };
  }
  if (!row || row.value == null) {
    return {
      kind: "absent",
      factKey: params.factKey,
      presentation: "NOT_CONFIRMED",
      persistedFalse: false,
      reason: "Absent from brief is not an exclusion",
    };
  }
  const negative = isNegativeScopeValue(params.factKey, row.value);
  if (!negative) {
    return {
      kind: "existing_fact",
      factKey: params.factKey,
      presentation: params.presentation,
      persistedFalse: false,
      reason: "Fact present with non-exclusion polarity",
    };
  }
  if (isUserSourcedFact(row.source)) {
    return {
      kind: "user",
      factKey: params.factKey,
      presentation: "NOT_INCLUDED",
      persistedFalse: true,
      reason: "Explicit builder decision",
    };
  }
  if (briefSupportsExplicitNegative(params.briefText, params.factKey)) {
    return {
      kind: "brief_extraction",
      factKey: params.factKey,
      presentation: "NOT_INCLUDED",
      persistedFalse: true,
      reason: "Brief states the exclusion",
    };
  }
  return {
    kind: "implicit_absence",
    factKey: params.factKey,
    presentation: "NOT_CONFIRMED",
    persistedFalse: negative,
    reason: "Absence inferred as exclusion — treat as unresolved",
  };
}
