/**
 * FOUNDATION-R1 — Legacy Work-Area project-condition Facts.
 *
 * Historical `bathroom.access` / `demolition.access` rows are not deleted.
 * New question generation never re-asks them.
 *
 * Authority: canonical `constraints` win when present (including Easy / No).
 * UNKNOWN / empty project values do not invent a WA fallback *question*,
 * but estimate reproducibility may still read a user-confirmed historical Fact
 * when the project constraint is absent. No bidirectional sync.
 */

import type { EstimateConstraint, EstimateFact } from "@/lib/estimate/types";
import {
  DUPLICATE_FACT_TO_CONSTRAINT,
  type CanonicalProjectConditionKey,
} from "@/lib/project-conditions/canonical";

function isUnknownLike(value: string | null | undefined): boolean {
  if (value == null) return true;
  const lower = value.trim().toLowerCase();
  return (
    lower === "" ||
    lower === "not sure" ||
    lower === "unknown" ||
    lower === "unsure" ||
    lower === "n/a"
  );
}

function constraintRaw(
  constraints: readonly EstimateConstraint[],
  key: CanonicalProjectConditionKey
): string | null {
  const row = constraints.find((c) => c.key === key);
  if (!row || row.value === null || row.value === undefined) return null;
  const text = String(row.value).trim();
  return text === "" ? null : text;
}

function factRaw(
  facts: readonly EstimateFact[],
  workAreaId: string,
  factKey: string
): string | null {
  const row = facts.find(
    (f) => f.key === factKey && f.work_area_id === workAreaId
  );
  if (!row || row.value === null || row.value === undefined) return null;
  const text = String(row.value).trim();
  return text === "" ? null : text;
}

export type ResolvedProjectCondition = {
  value: string | null;
  source: "constraint" | "legacy_wa_fact" | "absent";
  constraintKey: CanonicalProjectConditionKey;
  legacyFactKey?: string;
};

/**
 * Project constraint wins whenever it has any stored value, including Easy / No.
 * UNKNOWN ("Not sure") on the project key is still the project answer — do not
 * promote a WA Fact over it.
 */
export function resolveProjectCondition(params: {
  readonly constraints: readonly EstimateConstraint[];
  readonly facts?: readonly EstimateFact[];
  readonly workAreaId?: string;
  readonly constraintKey: CanonicalProjectConditionKey;
  readonly legacyFactKey?: string;
}): ResolvedProjectCondition {
  const constraintValue = constraintRaw(params.constraints, params.constraintKey);
  if (constraintValue !== null) {
    return {
      value: constraintValue,
      source: "constraint",
      constraintKey: params.constraintKey,
      legacyFactKey: params.legacyFactKey,
    };
  }

  if (params.facts && params.workAreaId && params.legacyFactKey) {
    const legacy = factRaw(params.facts, params.workAreaId, params.legacyFactKey);
    if (legacy !== null && !isUnknownLike(legacy)) {
      return {
        value: legacy,
        source: "legacy_wa_fact",
        constraintKey: params.constraintKey,
        legacyFactKey: params.legacyFactKey,
      };
    }
  }

  return {
    value: null,
    source: "absent",
    constraintKey: params.constraintKey,
    legacyFactKey: params.legacyFactKey,
  };
}

/** Site-access string for labour helpers: constraint first, else legacy WA Fact. */
export function resolveLegacyWorkAreaAccess(params: {
  readonly constraints: readonly EstimateConstraint[];
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly workAreaType: string;
}): string | null {
  const factKey = `${params.workAreaType}.access`;
  const mapped = DUPLICATE_FACT_TO_CONSTRAINT[factKey] ?? "site_access";
  const resolved = resolveProjectCondition({
    constraints: params.constraints,
    facts: params.facts,
    workAreaId: params.workAreaId,
    constraintKey: mapped,
    legacyFactKey: factKey,
  });
  if (resolved.source === "constraint") {
    // Combined helper reads constraints directly; returning null here prevents
    // a second WA multiply when the project key exists (including Easy).
    return null;
  }
  return resolved.value;
}

export function resolveLegacyFloorLevel(params: {
  readonly constraints: readonly EstimateConstraint[];
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
}): string | null {
  return resolveProjectCondition({
    constraints: params.constraints,
    facts: params.facts,
    workAreaId: params.workAreaId,
    constraintKey: "floor_level",
    legacyFactKey: "demolition.floor_level",
  }).value;
}

export function resolveLegacyServicesIsolated(params: {
  readonly constraints: readonly EstimateConstraint[];
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
}): string | null {
  return resolveProjectCondition({
    constraints: params.constraints,
    facts: params.facts,
    workAreaId: params.workAreaId,
    constraintKey: "services_isolated",
    legacyFactKey: "demolition.services_isolated",
  }).value;
}

export function resolveLegacyHazmat(params: {
  readonly constraints: readonly EstimateConstraint[];
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
}): string | null {
  return resolveProjectCondition({
    constraints: params.constraints,
    facts: params.facts,
    workAreaId: params.workAreaId,
    constraintKey: "hazardous_materials_risk",
    legacyFactKey: "demolition.hazardous_materials_risk",
  }).value;
}

/** Metres-only haulage quantity. Never a second access multiplier. */
export function resolveLegacyCartingMetres(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly factKey: "demolition.carting_distance_m" | "retaining_wall.carting_distance_m";
}): number | null {
  const row = params.facts.find(
    (f) => f.key === params.factKey && f.work_area_id === params.workAreaId
  );
  if (row == null || row.value == null) return null;
  const n = typeof row.value === "number" ? row.value : Number.parseFloat(String(row.value));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
