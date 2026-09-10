/**
 * EF02-D1 — persist accepted ASSUME_IF_SKIPPED values as assumption facts.
 * Does not write false exclusions or unresolved ASK_NOW / HARD_MINIMUM.
 */

import type { ClarifyCandidate, ClarifyView } from "@/lib/assistant/clarify/types";
import { composeClarifyView } from "@/lib/assistant/clarify/compose";
import { composeJobPlan } from "@/lib/assistant/job-plan/compose";
import {
  upsertProjectConstraintRecord,
  upsertScopedFact,
} from "@/lib/assistant/scope-persistence";
import { disclosedAssumptionValue } from "@/lib/estimate/disclosed-assumptions";
import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import {
  disclosedProjectConditionValue,
  consumedProjectConditionAskClass,
} from "@/lib/project-conditions/consumed-authority";
import { safeFactPresentationLabel } from "@/lib/assistant/presentation/fact-key-labels";
import type { createClient } from "@/lib/supabase/server";

export type PlannedAssumptionWrite = {
  readonly kind: "FACT" | "CONSTRAINT";
  readonly workAreaId: string | null;
  readonly key: string;
  readonly label: string;
  readonly value: string | number;
  readonly source: "assumption";
};

function isResolved(value: unknown): boolean {
  return hasFactValue(value) && !isNotSureValue(value);
}

export function plannedAssumptionWrites(params: {
  readonly view: Pick<ClarifyView, "candidates" | "deferred">;
  readonly facts: readonly {
    readonly key: string;
    readonly work_area_id: string | null;
    readonly value: unknown;
  }[];
  readonly constraints: readonly {
    readonly key: string;
    readonly value: unknown;
  }[];
}): PlannedAssumptionWrite[] {
  const out: PlannedAssumptionWrite[] = [];
  const seen = new Set<string>();
  const rows: readonly ClarifyCandidate[] = [
    ...params.view.candidates,
    ...params.view.deferred,
  ];

  for (const row of rows) {
    if (row.wallTypeId || row.openingId) continue;
    if (row.askClass !== "ASSUME_IF_SKIPPED" || !row.assumable) continue;

    if (row.constraintKey) {
      const ask = consumedProjectConditionAskClass(row.constraintKey);
      if (ask !== "ASSUME_IF_SKIPPED") continue;
      const existing = params.constraints.find((c) => c.key === row.constraintKey);
      if (isResolved(existing?.value)) continue;
      const value = disclosedProjectConditionValue(row.constraintKey);
      if (value == null) continue;
      const dedupe = `constraint:${row.constraintKey}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({
        kind: "CONSTRAINT",
        workAreaId: null,
        key: row.constraintKey,
        label: row.label || safeFactPresentationLabel(row.constraintKey),
        value,
        source: "assumption",
      });
      continue;
    }

    if (!row.factKey || !row.workAreaId) continue;
    const existing = params.facts.find(
      (fact) => fact.key === row.factKey && fact.work_area_id === row.workAreaId
    );
    if (isResolved(existing?.value)) continue;
    const assumed = disclosedAssumptionValue(row.factKey);
    if (!assumed) continue;
    const dedupe = `fact:${row.workAreaId}:${row.factKey}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      kind: "FACT",
      workAreaId: row.workAreaId,
      key: row.factKey,
      label: row.label || safeFactPresentationLabel(row.factKey),
      value: assumed.value,
      source: "assumption",
    });
  }

  return out;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function persistSkippedClarifyAssumptions(params: {
  supabase: SupabaseClient;
  orgId: string;
  projectId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, orgId, projectId } = params;
  const { data: project } = await supabase
    .from("projects")
    .select("stage, brief_text, quality_level")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };

  const [{ data: workAreas }, { data: facts }, { data: constraints }] =
    await Promise.all([
      supabase
        .from("work_areas")
        .select("id, type, name, status")
        .eq("project_id", projectId)
        .eq("org_id", orgId),
      supabase
        .from("project_facts")
        .select("key, work_area_id, value, source")
        .eq("project_id", projectId)
        .eq("org_id", orgId),
      supabase
        .from("constraints")
        .select("key, value, source")
        .eq("project_id", projectId)
        .eq("org_id", orgId),
    ]);

  const mappedWorkAreas = (workAreas ?? []).map((wa) => ({
    id: wa.id,
    type: wa.type,
    name: wa.name,
    status:
      wa.status === "confirmed" ||
      wa.status === "excluded" ||
      wa.status === "suggested"
        ? wa.status
        : "suggested",
  }));
  const mappedFacts = facts ?? [];
  const mappedConstraints = constraints ?? [];
  const jobPlan = composeJobPlan({
    workAreas: mappedWorkAreas,
    facts: mappedFacts,
    constraints: mappedConstraints,
    qualityLevel: project.quality_level,
    briefText: project.brief_text,
  });
  const view = composeClarifyView({
    stage: project.stage,
    briefText: project.brief_text,
    qualityLevel: project.quality_level,
    workAreas: mappedWorkAreas,
    facts: mappedFacts,
    constraints: mappedConstraints,
    jobPlan,
  });
  const writes = plannedAssumptionWrites({
    view,
    facts: mappedFacts,
    constraints: mappedConstraints,
  });
  for (const write of writes) {
    if (write.kind === "CONSTRAINT") {
      const result = await upsertProjectConstraintRecord(supabase, {
        orgId,
        projectId,
        key: write.key,
        label: write.label,
        value: write.value,
        source: write.source,
      });
      if (!result.ok) return result;
      continue;
    }
    const result = await upsertScopedFact(supabase, {
      orgId,
      projectId,
      workAreaId: write.workAreaId,
      key: write.key,
      label: write.label,
      value: write.value,
      source: write.source,
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}
