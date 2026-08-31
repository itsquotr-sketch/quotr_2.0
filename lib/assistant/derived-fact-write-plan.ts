/**
 * Pure planner for derived-fact persistence and reconciliation.
 * Derivation itself stays in deriveFactsForProject; this only decides writes
 * and which derivation-owned rows must leave current Facts SoT.
 */

import { shouldWriteDerivedFact } from "@/lib/scopes/domain-ownership";
import type { DerivedFactCandidate } from "@/lib/scopes/derived-facts";

/**
 * Logical identity of a work-area-scoped project_facts row.
 * Matches partial unique index project_facts_project_work_area_key_idx.
 * PostgREST `.upsert({ onConflict })` cannot restate the index WHERE predicate,
 * so this is documentation of identity — not a live upsert target.
 */
export const DERIVED_FACT_UPSERT_CONFLICT_TARGET = "project_id,work_area_id,key";

/** Sources the derivation persistence layer may overwrite or retire. */
export const DERIVATION_OWNED_SOURCES = ["derived"] as const;

export function isDerivationOwnedSource(
  source: string | null | undefined
): boolean {
  return source === "derived";
}

export type DerivedFactExistingRow = {
  key: string;
  work_area_id: string | null;
  value: unknown;
  source?: string | null;
  conflict_warning?: string | null;
};

export type DerivedFactWriteRow = {
  org_id: string;
  project_id: string;
  work_area_id: string;
  key: string;
  label: string;
  value: number;
  unit: string;
  source: "derived";
  confidence: number;
  conflict_warning: string | null;
};

export type DerivedFactRemoval = {
  org_id: string;
  project_id: string;
  work_area_id: string;
  key: string;
};

export type DerivedFactWritePlan = {
  toInsert: DerivedFactWriteRow[];
  toUpdate: DerivedFactWriteRow[];
  /** Convenience: toInsert + toUpdate (rows that must be persisted). */
  toWrite: DerivedFactWriteRow[];
  toRetire: DerivedFactRemoval[];
  skippedUserOwned: number;
  skippedUnchanged: number;
  skippedNullWorkArea: number;
  considered: number;
};

function derivedValuesEqual(existing: unknown, next: number): boolean {
  if (typeof existing === "number") {
    return existing === next;
  }
  if (typeof existing === "string" && existing.trim() !== "") {
    const parsed = Number(existing);
    return Number.isFinite(parsed) && parsed === next;
  }
  return false;
}

function factIdentity(workAreaId: string | null, key: string): string {
  return `${workAreaId ?? ""}:${key}`;
}

/**
 * Classify derived candidates plus obsolete derivation-owned rows.
 *
 * Scope: confirmed work areas actually passed to deriveFactsForProject.
 * A Deck pass must not retire Retaining Wall / Fence derived rows whose
 * work_area_id is outside that evaluated set.
 *
 * Retires only source=derived. Never user / ai_extracted / default /
 * assumption / system merely because the key is absent from this pass.
 * After ai_extracted is promoted to derived, a later pass may retire it.
 */
export function planDerivedFactWrites(params: {
  orgId: string;
  projectId: string;
  projectFacts: DerivedFactExistingRow[];
  derivedFacts: DerivedFactCandidate[];
  conflictByKey: ReadonlyMap<string, string>;
  evaluatedWorkAreaIds: readonly string[];
}): DerivedFactWritePlan {
  const existingByIdentity = new Map(
    params.projectFacts.map((fact) => [
      factIdentity(fact.work_area_id, fact.key),
      fact,
    ])
  );

  const toInsert: DerivedFactWriteRow[] = [];
  const toUpdate: DerivedFactWriteRow[] = [];
  let skippedUserOwned = 0;
  let skippedUnchanged = 0;
  let skippedNullWorkArea = 0;

  const expectedIdentities = new Set<string>();

  for (const derived of params.derivedFacts) {
    if (!derived.work_area_id) {
      skippedNullWorkArea += 1;
      continue;
    }

    const identity = factIdentity(derived.work_area_id, derived.key);
    expectedIdentities.add(identity);

    const existing = existingByIdentity.get(identity);

    if (!shouldWriteDerivedFact(existing?.source)) {
      skippedUserOwned += 1;
      continue;
    }

    const conflictWarning =
      params.conflictByKey.get(`${derived.work_area_id}:${derived.key}`) ?? null;

    const alreadyDerived =
      existing?.source === "derived" &&
      derivedValuesEqual(existing.value, derived.value) &&
      (existing.conflict_warning ?? null) === conflictWarning;

    if (alreadyDerived) {
      skippedUnchanged += 1;
      continue;
    }

    const row: DerivedFactWriteRow = {
      org_id: params.orgId,
      project_id: params.projectId,
      work_area_id: derived.work_area_id,
      key: derived.key,
      label: derived.label,
      value: derived.value,
      unit: derived.unit,
      source: "derived",
      confidence: 1,
      conflict_warning: conflictWarning,
    };

    if (existing) {
      toUpdate.push(row);
    } else {
      toInsert.push(row);
    }
  }

  const evaluated = new Set(params.evaluatedWorkAreaIds);
  const toRetire: DerivedFactRemoval[] = [];
  const retiredIdentities = new Set<string>();

  for (const fact of params.projectFacts) {
    if (!isDerivationOwnedSource(fact.source)) {
      continue;
    }
    if (!fact.work_area_id || !evaluated.has(fact.work_area_id)) {
      continue;
    }
    const identity = factIdentity(fact.work_area_id, fact.key);
    if (expectedIdentities.has(identity) || retiredIdentities.has(identity)) {
      continue;
    }
    retiredIdentities.add(identity);
    toRetire.push({
      org_id: params.orgId,
      project_id: params.projectId,
      work_area_id: fact.work_area_id,
      key: fact.key,
    });
  }

  return {
    toInsert,
    toUpdate,
    toWrite: [...toInsert, ...toUpdate],
    toRetire,
    skippedUserOwned,
    skippedUnchanged,
    skippedNullWorkArea,
    considered: params.derivedFacts.length,
  };
}

export function derivedFactWriteStatementCount(plan: DerivedFactWritePlan): {
  bulkInserts: number;
  boundedUpdateGroups: number;
  bulkDeletes: number;
  rowSelects: number;
} {
  const deleteGroups = new Set(plan.toRetire.map((row) => row.work_area_id));
  return {
    bulkInserts: plan.toInsert.length > 0 ? 1 : 0,
    boundedUpdateGroups: plan.toUpdate.length > 0 ? 1 : 0,
    bulkDeletes: deleteGroups.size,
    rowSelects: 0,
  };
}
