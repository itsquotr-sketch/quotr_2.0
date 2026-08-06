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
  | "clarifications"
  | "other"
  | "conflicts";

export interface ScopeDiscoveryGroupedSuggestions {
  readonly important: readonly SafeSuggestionView[];
  readonly worthChecking: readonly SafeSuggestionView[];
  readonly clarifications: readonly SafeSuggestionView[];
  readonly other: readonly SafeSuggestionView[];
  readonly conflicts: readonly SafeSuggestionView[];
  readonly dismissed: readonly SafeSuggestionView[];
  readonly added: readonly SafeSuggestionView[];
  readonly inactive: readonly SafeSuggestionView[];
}

export type WorkAreaSuggestionSection = {
  readonly workAreaId: string | null;
  readonly workAreaLabel: string;
  readonly grouped: ScopeDiscoveryGroupedSuggestions;
  readonly openCount: number;
  readonly decidedCount: number;
};

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
  const proposalClass = String(
    (s as SafeSuggestionView).proposalClass ?? ""
  ).toUpperCase();

  if (
    proposalClass === "CLARIFICATION" ||
    kind === "CLARIFICATION_REQUIRED"
  ) {
    return "clarifications";
  }

  if (
    band === "HIGH" ||
    kind === "MISSING_SCOPE" ||
    (s.originHint === "deterministic" && band !== "LOW" && band !== "MEDIUM")
  ) {
    return "important";
  }

  if (band === "LOW" || kind === "POSSIBLE_EXCLUSION") {
    return "other";
  }

  return "worthChecking";
}

export function groupSuggestionsByRelatedWorkArea(
  suggestions: readonly SafeSuggestionView[]
): ReadonlyMap<string | null, SafeSuggestionView[]> {
  const map = new Map<string | null, SafeSuggestionView[]>();
  for (const s of suggestions) {
    const key = s.relatedWorkAreaId ?? null;
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return map;
}

/**
 * Nest suggestions under confirmed Work Areas when relatedWorkAreaId is present.
 * Unlinked suggestions appear under a project-level section.
 */
export function groupSuggestionsByWorkAreaSections(
  suggestions: readonly SafeSuggestionView[],
  workAreaLabels: ReadonlyMap<string, string> | Record<string, string> = {}
): readonly WorkAreaSuggestionSection[] {
  const labelLookup =
    workAreaLabels instanceof Map
      ? workAreaLabels
      : new Map(Object.entries(workAreaLabels));

  const byParent = groupSuggestionsByRelatedWorkArea(suggestions);
  const sections: WorkAreaSuggestionSection[] = [];

  const keys = [...byParent.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    const la = labelLookup.get(a) ?? a;
    const lb = labelLookup.get(b) ?? b;
    return la.localeCompare(lb);
  });

  for (const key of keys) {
    const list = byParent.get(key) ?? [];
    const grouped = groupSuggestionsForUi(list);
    const counts = summariseGroupCounts(grouped);
    sections.push({
      workAreaId: key,
      workAreaLabel:
        key === null
          ? "Project-wide"
          : (labelLookup.get(key) ?? "Related work area"),
      grouped,
      openCount: counts.openTotal,
      decidedCount: counts.added + counts.dismissed,
    });
  }

  return sections;
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
  const clarifications: SafeSuggestionView[] = [];
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
    else if (group === "clarifications") clarifications.push(s);
    else if (group === "other") other.push(s);
    else conflicts.push(s);
  }

  return {
    important,
    worthChecking,
    clarifications,
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
  readonly clarifications: number;
  readonly other: number;
  readonly conflicts: number;
  readonly dismissed: number;
  readonly added: number;
  readonly openTotal: number;
} {
  const important = grouped.important.length;
  const worthChecking = grouped.worthChecking.length;
  const clarifications = grouped.clarifications.length;
  const other = grouped.other.length;
  const conflicts = grouped.conflicts.length;
  return {
    important,
    worthChecking,
    clarifications,
    other,
    conflicts,
    dismissed: grouped.dismissed.length,
    added: grouped.added.length,
    openTotal:
      important + worthChecking + clarifications + other + conflicts,
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
