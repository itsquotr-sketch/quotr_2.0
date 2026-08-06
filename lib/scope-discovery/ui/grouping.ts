/**
 * UI grouping for scope discovery suggestions (OCD-ISD-02 + Step 3).
 * Pure helpers — safe for verification without React.
 */

import type {
  ComposedDecisionState,
  SafeSuggestionView,
} from "../application/types";

export type ScopeDiscoveryUiGroupId =
  | "important"
  | "worthChecking"
  | "other"
  | "conflicts";

export interface ScopeDiscoveryGroupedSuggestions {
  readonly important: readonly SafeSuggestionView[];
  readonly worthChecking: readonly SafeSuggestionView[];
  readonly other: readonly SafeSuggestionView[];
  readonly conflicts: readonly SafeSuggestionView[];
  readonly dismissed: readonly SafeSuggestionView[];
  readonly added: readonly SafeSuggestionView[];
  readonly inactive: readonly SafeSuggestionView[];
}

function bandOf(s: SafeSuggestionView): string {
  return String(s.confidenceBand ?? "").toUpperCase();
}

function kindOf(s: SafeSuggestionView): string {
  return String(s.suggestionKind ?? "").toUpperCase();
}

function stateOf(s: SafeSuggestionView): ComposedDecisionState | string {
  return s.decisionState;
}

export function isActionableProposed(s: SafeSuggestionView): boolean {
  const state = stateOf(s);
  return state === "PROPOSED";
}

export function isConflictKind(s: SafeSuggestionView): boolean {
  const kind = kindOf(s);
  return kind === "CONFLICT_WARNING" || kind === "DUPLICATE_WARNING";
}

export function assignUiGroup(
  s: SafeSuggestionView
): ScopeDiscoveryUiGroupId {
  if (isConflictKind(s)) return "conflicts";

  const kind = kindOf(s);
  const band = bandOf(s);

  if (
    band === "HIGH" ||
    kind === "MISSING_SCOPE" ||
    kind === "CLARIFICATION_REQUIRED" ||
    (s.originHint === "deterministic" && band !== "LOW" && band !== "MEDIUM")
  ) {
    return "important";
  }

  if (band === "LOW" || kind === "POSSIBLE_EXCLUSION") {
    return "other";
  }

  // MEDIUM and likely/conditional defaults
  return "worthChecking";
}

/**
 * Partition suggestions for display.
 * Suppressed suggestions are not passed in (server omits them).
 * Rejected/accepted/modified/stale/superseded are separated from open groups.
 */
export function groupSuggestionsForUi(
  suggestions: readonly SafeSuggestionView[]
): ScopeDiscoveryGroupedSuggestions {
  const important: SafeSuggestionView[] = [];
  const worthChecking: SafeSuggestionView[] = [];
  const other: SafeSuggestionView[] = [];
  const conflicts: SafeSuggestionView[] = [];
  const dismissed: SafeSuggestionView[] = [];
  const added: SafeSuggestionView[] = [];
  const inactive: SafeSuggestionView[] = [];

  for (const s of suggestions) {
    const state = stateOf(s);
    if (state === "REJECTED") {
      dismissed.push(s);
      continue;
    }
    if (state === "ACCEPTED" || state === "MODIFIED") {
      added.push(s);
      continue;
    }
    if (state === "STALE" || state === "SUPERSEDED") {
      inactive.push(s);
      continue;
    }

    // PROPOSED
    const group = assignUiGroup(s);
    if (group === "important") important.push(s);
    else if (group === "worthChecking") worthChecking.push(s);
    else if (group === "other") other.push(s);
    else conflicts.push(s);
  }

  return {
    important,
    worthChecking,
    other,
    conflicts,
    dismissed,
    added,
    inactive,
  };
}

export function summariseGroupCounts(
  grouped: ScopeDiscoveryGroupedSuggestions
): {
  readonly important: number;
  readonly worthChecking: number;
  readonly other: number;
  readonly conflicts: number;
  readonly dismissed: number;
  readonly added: number;
  readonly openTotal: number;
} {
  const important = grouped.important.length;
  const worthChecking = grouped.worthChecking.length;
  const other = grouped.other.length;
  const conflicts = grouped.conflicts.length;
  return {
    important,
    worthChecking,
    other,
    conflicts,
    dismissed: grouped.dismissed.length,
    added: grouped.added.length,
    openTotal: important + worthChecking + other + conflicts,
  };
}

export function hasOpenSuggestions(
  grouped: ScopeDiscoveryGroupedSuggestions
): boolean {
  return summariseGroupCounts(grouped).openTotal > 0;
}

export function allSuggestionsDecided(
  suggestions: readonly SafeSuggestionView[]
): boolean {
  if (suggestions.length === 0) return false;
  const grouped = groupSuggestionsForUi(suggestions);
  return (
    !hasOpenSuggestions(grouped) &&
    (grouped.added.length > 0 || grouped.dismissed.length > 0)
  );
}
