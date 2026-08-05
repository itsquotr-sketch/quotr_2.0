import { deepFreeze } from "./immutability";
import { identityKeyForSuggestion } from "./identity";
import type { ScopeDiscoverySuggestion } from "./types";

/**
 * Collapse exact identity duplicates, preferring deterministic origin then
 * higher confidence band, then lexicographic suggestionId.
 */
export function dedupeByIdentity(
  suggestions: readonly ScopeDiscoverySuggestion[]
): {
  readonly unique: readonly ScopeDiscoverySuggestion[];
  readonly collapsed: readonly {
    readonly keptId: string;
    readonly droppedId: string;
  }[];
} {
  const byKey = new Map<string, ScopeDiscoverySuggestion>();
  const collapsed: { keptId: string; droppedId: string }[] = [];

  const ranked = [...suggestions].sort(compareSuggestions);

  for (const suggestion of ranked) {
    const key = identityKeyForSuggestion(suggestion);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, suggestion);
      continue;
    }
    const winner = prefer(existing, suggestion);
    const loser = winner === existing ? suggestion : existing;
    byKey.set(key, winner);
    collapsed.push({ keptId: winner.suggestionId, droppedId: loser.suggestionId });
  }

  const unique = [...byKey.values()].sort(compareSuggestions);
  return deepFreeze({ unique, collapsed });
}

function bandRank(band: ScopeDiscoverySuggestion["confidenceBand"]): number {
  if (band === "HIGH") return 3;
  if (band === "MEDIUM") return 2;
  return 1;
}

function originRank(origin: ScopeDiscoverySuggestion["origin"]): number {
  if (origin === "deterministic") return 3;
  if (origin === "merged") return 2;
  return 1;
}

function prefer(
  a: ScopeDiscoverySuggestion,
  b: ScopeDiscoverySuggestion
): ScopeDiscoverySuggestion {
  const originDiff = originRank(b.origin) - originRank(a.origin);
  if (originDiff !== 0) return originDiff > 0 ? b : a;
  const bandDiff = bandRank(b.confidenceBand) - bandRank(a.confidenceBand);
  if (bandDiff !== 0) return bandDiff > 0 ? b : a;
  return a.suggestionId <= b.suggestionId ? a : b;
}

export function compareSuggestions(
  a: ScopeDiscoverySuggestion,
  b: ScopeDiscoverySuggestion
): number {
  const originDiff = originRank(b.origin) - originRank(a.origin);
  if (originDiff !== 0) return originDiff > 0 ? 1 : -1;
  const bandDiff = bandRank(b.confidenceBand) - bandRank(a.confidenceBand);
  if (bandDiff !== 0) return bandDiff > 0 ? 1 : -1;
  const kind = a.suggestionKind.localeCompare(b.suggestionKind);
  if (kind !== 0) return kind;
  const type = (a.proposedWorkAreaType ?? "").localeCompare(
    b.proposedWorkAreaType ?? ""
  );
  if (type !== 0) return type;
  return a.suggestionId.localeCompare(b.suggestionId);
}
