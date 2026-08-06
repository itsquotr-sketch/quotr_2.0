/**
 * Scope-impact recommendation identity + human display (3.1B.6R3.1).
 * Deterministic — no React, no provider.
 */

import {
  formatAnswerOptionLabel,
  getFactDisplayLabel,
} from "@/lib/scopes/fact-labels";

/** Persisted on Keep current — scope state unchanged; id lives in user_note. */
export const SCOPE_IMPACT_KEEP_REASON = "scope_impact_kept" as const;

/** Stable short digest of a Fact value for recommendation identity. */
export function factValueDigest(value: unknown): string {
  const normalised =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value.trim().toLowerCase()
        : typeof value === "boolean" || typeof value === "number"
          ? String(value)
          : JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < normalised.length; i += 1) {
    h ^= normalised.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Deterministic recommendation identity — not based on display wording.
 */
export function scopeImpactRecommendationId(params: {
  readonly workAreaId: string | null;
  readonly scopeItemType: string;
  readonly factKey: string;
  readonly factValue: unknown;
  readonly suggestedState: "INCLUDED" | "NOT_REQUIRED";
}): string {
  return [
    params.workAreaId ?? "project",
    params.scopeItemType,
    params.factKey,
    factValueDigest(params.factValue),
    params.suggestedState,
  ].join("|");
}

export function isScopeImpactKeepReason(
  reasonCode: string | null | undefined
): boolean {
  if (!reasonCode) return false;
  return (
    reasonCode === SCOPE_IMPACT_KEEP_REASON ||
    reasonCode.startsWith(`${SCOPE_IMPACT_KEEP_REASON}|`)
  );
}

export function parseKeptRecommendationId(params: {
  readonly reason_code?: string | null;
  readonly user_note?: string | null;
}): string | null {
  if (!isScopeImpactKeepReason(params.reason_code)) return null;
  const note = params.user_note?.trim();
  if (note && note.length > 0) return note;
  // Legacy / truncated form: scope_impact_kept|{id}
  const code = params.reason_code ?? "";
  if (code.startsWith(`${SCOPE_IMPACT_KEEP_REASON}|`)) {
    return code.slice(SCOPE_IMPACT_KEEP_REASON.length + 1) || null;
  }
  return null;
}

export function collectDismissedRecommendationIds(
  decisions: readonly {
    readonly reason_code?: string | null;
    readonly user_note?: string | null;
  }[]
): ReadonlySet<string> {
  const set = new Set<string>();
  for (const d of decisions) {
    const id = parseKeptRecommendationId(d);
    if (id) set.add(id);
  }
  return set;
}

/** Human-readable trigger line — never expose raw Fact keys. */
export function humanTriggeringAnswerSummary(params: {
  readonly factKey: string;
  readonly value: unknown;
}): string {
  const label = getFactDisplayLabel(params.factKey);
  const valueLabel = formatAnswerOptionLabel(params.value);
  return `${label}: ${valueLabel}`;
}

export function humanScopeStateLabel(
  state: "INCLUDED" | "NOT_REQUIRED" | "UNDECIDED"
): string {
  if (state === "INCLUDED") return "Included";
  if (state === "NOT_REQUIRED") return "Not required";
  return "Undecided";
}

export function applyActionLabel(
  suggestedState: "INCLUDED" | "NOT_REQUIRED",
  scopeItemTitle: string
): string {
  if (suggestedState === "NOT_REQUIRED") {
    return `Mark ${scopeItemTitle} not required`;
  }
  return `Include ${scopeItemTitle} in scope`;
}

export function keepActionLabel(scopeItemTitle: string): string {
  return `Keep ${scopeItemTitle} as current scope`;
}
