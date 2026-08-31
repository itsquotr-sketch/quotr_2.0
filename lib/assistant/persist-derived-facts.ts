import type { createClient } from "@/lib/supabase/server";
import {
  isDerivationOwnedSource,
  planDerivedFactWrites,
  type DerivedFactRemoval,
  type DerivedFactWriteRow,
} from "@/lib/assistant/derived-fact-write-plan";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "@/lib/scopes/derived-facts";
import { detectDerivedFactConflicts } from "@/lib/scopes/derived-fact-conflicts";

type ProjectFactRow = {
  key: string;
  work_area_id: string | null;
  value: unknown;
  source?: string | null;
  conflict_warning?: string | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type PersistDerivedFactsResult = {
  facts: ProjectFactRow[];
  error?: string;
};

function factsAfterReconciliation(
  projectFacts: ProjectFactRow[],
  derivedFacts: Parameters<typeof mergeDerivedFactsIntoRecords>[1],
  toRetire: DerivedFactRemoval[]
): ProjectFactRow[] {
  const retired = new Set(
    toRetire.map((row) => `${row.work_area_id}:${row.key}`)
  );
  const remaining = projectFacts.filter(
    (fact) =>
      !(
        isDerivationOwnedSource(fact.source) &&
        retired.has(`${fact.work_area_id ?? ""}:${fact.key}`)
      )
  );
  return mergeDerivedFactsIntoRecords(remaining, derivedFacts);
}

async function insertDerivedFactRows(
  supabase: SupabaseClient,
  rows: DerivedFactWriteRow[]
): Promise<{ error?: string }> {
  if (rows.length === 0) {
    return {};
  }
  const { error } = await supabase.from("project_facts").insert(rows);
  return error ? { error: error.message } : {};
}

async function updateDerivedFactRows(
  supabase: SupabaseClient,
  rows: DerivedFactWriteRow[]
): Promise<{ error?: string }> {
  if (rows.length === 0) {
    return {};
  }

  const updates = await Promise.all(
    rows.map((row) =>
      supabase
        .from("project_facts")
        .update({
          label: row.label,
          value: row.value,
          unit: row.unit,
          source: row.source,
          confidence: row.confidence,
          conflict_warning: row.conflict_warning,
        })
        .eq("project_id", row.project_id)
        .eq("org_id", row.org_id)
        .eq("work_area_id", row.work_area_id)
        .eq("key", row.key)
        .neq("source", "user")
    )
  );
  const failed = updates.find((result) => result.error);
  return failed?.error ? { error: failed.error.message } : {};
}

async function retireDerivedFactRows(
  supabase: SupabaseClient,
  removals: DerivedFactRemoval[]
): Promise<{ error?: string }> {
  if (removals.length === 0) {
    return {};
  }

  const byWorkArea = new Map<
    string,
    { org_id: string; project_id: string; keys: string[] }
  >();
  for (const removal of removals) {
    const group = byWorkArea.get(removal.work_area_id);
    if (group) {
      group.keys.push(removal.key);
      continue;
    }
    byWorkArea.set(removal.work_area_id, {
      org_id: removal.org_id,
      project_id: removal.project_id,
      keys: [removal.key],
    });
  }

  const deletes = await Promise.all(
    [...byWorkArea.entries()].map(([workAreaId, group]) =>
      supabase
        .from("project_facts")
        .delete()
        .eq("org_id", group.org_id)
        .eq("project_id", group.project_id)
        .eq("source", "derived")
        .eq("work_area_id", workAreaId)
        .in("key", group.keys)
    )
  );
  const failed = deletes.find((result) => result.error);
  return failed?.error ? { error: failed.error.message } : {};
}

export async function persistDerivedFactsForProject(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  workAreas: { id: string; type: string; status: string }[],
  projectFacts: ProjectFactRow[]
): Promise<PersistDerivedFactsResult> {
  const confirmed = workAreas.filter(
    (workArea) => workArea.status === "confirmed"
  );
  const derivedFacts = deriveFactsForProject({
    workAreas: confirmed.map((workArea) => ({
      id: workArea.id,
      type: workArea.type,
    })),
    projectFacts,
  });

  const conflicts = detectDerivedFactConflicts(projectFacts, derivedFacts);
  const conflictByKey = new Map(
    conflicts.map((conflict) => [
      `${conflict.workAreaId}:${conflict.key}`,
      conflict.warning,
    ])
  );

  const plan = planDerivedFactWrites({
    orgId,
    projectId,
    projectFacts,
    derivedFacts,
    conflictByKey,
    evaluatedWorkAreaIds: confirmed.map((workArea) => workArea.id),
  });

  const reconciled = factsAfterReconciliation(
    projectFacts,
    derivedFacts,
    plan.toRetire
  );

  const inserted = await insertDerivedFactRows(supabase, plan.toInsert);
  if (inserted.error) {
    return { facts: reconciled, error: inserted.error };
  }

  const updated = await updateDerivedFactRows(supabase, plan.toUpdate);
  if (updated.error) {
    return { facts: reconciled, error: updated.error };
  }

  const retired = await retireDerivedFactRows(supabase, plan.toRetire);
  if (retired.error) {
    return { facts: reconciled, error: retired.error };
  }

  return { facts: reconciled };
}
