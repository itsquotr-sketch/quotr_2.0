import { deepFreeze } from "../immutability";
import type { EvidenceItem } from "../types";
import type { ConditionContext } from "./condition-eval";
import type { ScopeRelationship } from "./types";

export function buildRelationshipEvidence(
  relationship: ScopeRelationship,
  ctx: ConditionContext,
  relatedWorkAreaId: string | null
): readonly EvidenceItem[] {
  const now = "1970-01-01T00:00:00.000Z"; // caller may refresh timestamps externally
  const items: EvidenceItem[] = [
    {
      sourceType: "DETERMINISTIC_RULE",
      sourceId: relationship.relationshipId,
      excerptOrValue: relationship.rationaleCode,
      relevance: "primary",
      timestamp: now,
      provenance: "deterministic_rule",
      userAuthored: false,
      authoritative: false,
    },
  ];

  for (const wa of ctx.acceptedWorkAreas) {
    items.push({
      sourceType: "EXISTING_WORK_AREA",
      sourceId: wa.workAreaId,
      excerptOrValue: wa.type,
      relevance: "supporting",
      timestamp: now,
      provenance: "user",
      userAuthored: true,
      authoritative: true,
    });
  }

  for (const key of relationship.evidenceRequirements.factKeys) {
    if (!ctx.facts.has(key)) continue;
    const value = ctx.facts.get(key);
    items.push({
      sourceType: "USER_FACT",
      sourceId: key,
      excerptOrValue: String(value),
      relevance: "supporting",
      timestamp: now,
      provenance: "user",
      userAuthored: true,
      authoritative: true,
    });
  }

  for (const key of relationship.evidenceRequirements.constraintKeys) {
    if (!ctx.constraints.has(key)) continue;
    items.push({
      sourceType: "CONSTRAINT",
      sourceId: key,
      excerptOrValue: String(ctx.constraints.get(key)),
      relevance: "supporting",
      timestamp: now,
      provenance: "user",
      userAuthored: true,
      authoritative: true,
    });
  }

  if (relatedWorkAreaId) {
    const exists = items.some(
      (i) =>
        i.sourceType === "EXISTING_WORK_AREA" && i.sourceId === relatedWorkAreaId
    );
    if (!exists) {
      items.push({
        sourceType: "EXISTING_WORK_AREA",
        sourceId: relatedWorkAreaId,
        excerptOrValue: relationship.parentScopeType,
        relevance: "supporting",
        timestamp: now,
        provenance: "user",
        userAuthored: true,
        authoritative: true,
      });
    }
  }

  // Dedupe by sourceType|sourceId|relevance
  const seen = new Set<string>();
  const unique: EvidenceItem[] = [];
  for (const item of items) {
    const key = `${item.sourceType}|${item.sourceId}|${item.relevance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return deepFreeze(unique);
}
