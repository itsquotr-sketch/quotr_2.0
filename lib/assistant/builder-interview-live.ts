/**
 * Stage 3.2.2 — Narrow live input builder for Builder Interview engine.
 * Pure. No Supabase.
 */

import type {
  AssistantInterviewFact,
  ConstraintRow,
  WorkArea,
} from "@/lib/assistant/types";
import type { BuilderInterviewInput } from "@/lib/builder-interview/types";
import { buildProjectConditionsSnapshot } from "@/lib/builder-interview/project-filter";

export function buildLiveBuilderInterviewInput(params: {
  projectId: string;
  qualityLevel?: string | null;
  workAreas: readonly Pick<WorkArea, "id" | "type" | "name" | "status">[];
  facts: readonly AssistantInterviewFact[];
  constraints: readonly Pick<ConstraintRow, "key" | "value" | "source">[];
  excludedScopeItemTypes?: readonly string[];
}): BuilderInterviewInput {
  return {
    project: {
      id: params.projectId,
      qualityLevel: params.qualityLevel ?? null,
    },
    workAreas: params.workAreas.map((wa, index) => ({
      id: wa.id,
      type: wa.type,
      name: wa.name,
      status:
        wa.status === "confirmed" || wa.status === "excluded" || wa.status === "suggested"
          ? wa.status
          : "suggested",
      sortOrder: index,
    })),
    facts: params.facts.map((f) => ({
      key: f.key,
      workAreaId: f.workAreaId,
      value: f.value,
      source: f.source ?? null,
    })),
    constraints: params.constraints.map((c) => ({
      key: c.key,
      value: c.value,
      source: c.source ?? null,
    })),
    excludedScopeItemTypes: params.excludedScopeItemTypes,
  };
}

export function buildLiveProjectConditionsSnapshot(params: {
  projectId: string;
  qualityLevel?: string | null;
  workAreas: readonly Pick<WorkArea, "id" | "type" | "name" | "status">[];
  facts: readonly AssistantInterviewFact[];
  constraints: readonly Pick<ConstraintRow, "key" | "value" | "source">[];
  excludedScopeItemTypes?: readonly string[];
}) {
  return buildProjectConditionsSnapshot(
    buildLiveBuilderInterviewInput(params)
  );
}
