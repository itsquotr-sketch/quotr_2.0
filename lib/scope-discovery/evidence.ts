import { deepFreeze } from "./immutability";
import type { EvidenceItem } from "./types";

export function evidenceIdentityKey(item: EvidenceItem): string {
  return `${item.sourceType}|${item.sourceId}|${item.relevance}`;
}

export function hasDuplicateEvidence(
  evidence: readonly EvidenceItem[]
): boolean {
  const seen = new Set<string>();
  for (const item of evidence) {
    const key = evidenceIdentityKey(item);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

export function normalizeEvidenceList(
  evidence: readonly EvidenceItem[]
): readonly EvidenceItem[] {
  const sorted = [...evidence].sort((a, b) =>
    evidenceIdentityKey(a).localeCompare(evidenceIdentityKey(b))
  );
  return deepFreeze(sorted);
}
