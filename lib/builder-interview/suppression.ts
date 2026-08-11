/**
 * Stage 3.2.1 — Semantic topic helpers + project-wide known topic detection.
 */

import {
  isMeaningfulKnownValue,
  resolveConstraintEvidence,
  resolveFactEvidence,
} from "@/lib/builder-interview/authority";
import type {
  BuilderInterviewInput,
  SemanticTopicId,
} from "@/lib/builder-interview/types";

/** Canonical project constraint key for a semantic topic (when applicable). */
export const TOPIC_PROJECT_CONSTRAINT_KEY: Partial<
  Record<SemanticTopicId, string>
> = {
  "site.access": "site_access",
  "site.carry": "material_carry_distance",
  "site.floor_level": "floor_level",
  "site.occupied": "occupied_site",
  "site.working_hours": "working_hours",
  "site.parking_loading": "parking_loading",
  "site.waste_bin": "waste_bin_access",
  "risk.hazmat": "hazardous_materials_risk",
  "risk.services": "services_isolated",
  "risk.protection": "protection_dust_control",
};

/** WA fact key suffixes / patterns that map to a topic (for project suppress). */
export const TOPIC_WA_FACT_SUFFIXES: Partial<
  Record<SemanticTopicId, readonly string[]>
> = {
  "site.access": [".access"],
  "site.carry": [".carting_distance_m"],
  "site.floor_level": [".floor_level"],
  "risk.hazmat": [".hazardous_materials_risk"],
  "risk.services": [".services_isolated"],
};

export function isProjectTopicKnown(
  input: BuilderInterviewInput,
  topic: SemanticTopicId
): boolean {
  const constraintKey = TOPIC_PROJECT_CONSTRAINT_KEY[topic];
  if (constraintKey) {
    const evidence = resolveConstraintEvidence(input.constraints, constraintKey);
    if (isMeaningfulKnownValue(evidence.value)) return true;
  }
  return false;
}

export function findWaFactForTopic(params: {
  input: BuilderInterviewInput;
  topic: SemanticTopicId;
  workAreaId: string;
  workAreaType: string;
}): boolean {
  const suffixes = TOPIC_WA_FACT_SUFFIXES[params.topic] ?? [];
  for (const suffix of suffixes) {
    const key = `${params.workAreaType}${suffix}`;
    const evidence = resolveFactEvidence(
      params.input.facts,
      key,
      params.workAreaId
    );
    if (isMeaningfulKnownValue(evidence.value)) return true;
  }
  return false;
}
