/**
 * FOUNDATION-R1-R1 — Deterministic Project Condition applicability.
 *
 * Project Conditions remain the sole ask authority for site-wide topics.
 * This module decides which canonical keys are material for the confirmed
 * Work Areas / Facts — it does not persist and does not create a second store.
 */

import { isMeaningfulKnownValue } from "@/lib/builder-interview/authority";
import type { CanonicalProjectConditionKey } from "@/lib/project-conditions/canonical";
import type {
  BuilderInterviewInput,
  InterviewConstraintInput,
  InterviewFactInput,
} from "@/lib/builder-interview/types";

export const PROJECT_CONDITIONS_APPLICABILITY_VERSION = "foundation-r1r1.0" as const;

export type ProjectConditionReadinessClass =
  | "required"
  | "assumable"
  | "optional";

export type ApplicableProjectCondition = {
  key: CanonicalProjectConditionKey;
  readiness: ProjectConditionReadinessClass;
  reason: string;
};

const OUTDOOR_TYPES = new Set([
  "deck",
  "fence",
  "pergola",
  "retaining_wall",
  "external_stairs",
]);

const INTERIOR_TYPES = new Set([
  "bathroom",
  "kitchen",
  "internal_walls",
  "ceilings",
  "doors",
  "flooring",
  "painting",
  "plastering",
]);

const RENO_TYPES = new Set([
  "demolition",
  "bathroom",
  "kitchen",
  "internal_walls",
  "ceilings",
  "doors",
  "flooring",
  "painting",
  "plastering",
]);

const CONSENT_TYPES = new Set([
  "deck",
  "retaining_wall",
  "pergola",
  "external_stairs",
]);

const WASTE_FACT_KEYS = [
  "existing_deck_removal",
  "demolition_required",
  "demolition_included",
  "existing_removal",
  "disposal_included",
  "disposal_required",
  "excavation_required",
  "skip_bin_included",
] as const;

function confirmedTypes(input: BuilderInterviewInput): Set<string> {
  return new Set(
    input.workAreas.filter((w) => w.status === "confirmed").map((w) => w.type)
  );
}

function hasType(types: ReadonlySet<string>, set: ReadonlySet<string>): boolean {
  for (const type of types) {
    if (set.has(type)) return true;
  }
  return false;
}

function factIsAffirmative(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    return lower === "yes" || lower === "true" || lower === "included";
  }
  return false;
}

function hasWasteOrRemovalScope(
  types: ReadonlySet<string>,
  facts: readonly InterviewFactInput[]
): boolean {
  if (types.has("demolition")) return true;
  return facts.some((fact) => {
    const suffix = fact.key.includes(".")
      ? fact.key.slice(fact.key.indexOf(".") + 1)
      : fact.key;
    if (!(WASTE_FACT_KEYS as readonly string[]).includes(suffix)) {
      return false;
    }
    return factIsAffirmative(fact.value);
  });
}

function add(
  into: Map<CanonicalProjectConditionKey, ApplicableProjectCondition>,
  key: CanonicalProjectConditionKey,
  readiness: ProjectConditionReadinessClass,
  reason: string
): void {
  const existing = into.get(key);
  if (!existing) {
    into.set(key, { key, readiness, reason });
    return;
  }
  const rank = { required: 3, assumable: 2, optional: 1 };
  if (rank[readiness] > rank[existing.readiness]) {
    into.set(key, { key, readiness, reason });
  }
}

/**
 * Union of applicable Project Conditions for the confirmed Work Areas.
 * Irrelevant keys are omitted. Known constraints do not remove applicability —
 * they only suppress the ASK (TARGET_KNOWN).
 */
export function evaluateApplicableProjectConditions(
  input: BuilderInterviewInput
): ApplicableProjectCondition[] {
  const types = confirmedTypes(input);
  if (types.size === 0) return [];

  const into = new Map<
    CanonicalProjectConditionKey,
    ApplicableProjectCondition
  >();

  add(into, "site_access", "required", "Labour productivity / site logistics");
  add(
    into,
    "material_carry_distance",
    "required",
    "Materials logistics / haulage"
  );

  const outdoor = hasType(types, OUTDOOR_TYPES);
  const interior = hasType(types, INTERIOR_TYPES);
  const reno = hasType(types, RENO_TYPES);
  const waste = hasWasteOrRemovalScope(types, input.facts);

  if (outdoor) {
    add(into, "site_slope", "assumable", "Outdoor labour / ground condition");
    add(into, "parking_loading", "optional", "Loading convenience");
  }

  if (interior || types.has("demolition")) {
    add(
      into,
      "floor_level",
      types.has("demolition") ? "required" : "assumable",
      "Vertical logistics"
    );
  }

  if (reno || interior) {
    add(into, "occupied_site", "assumable", "Occupied-site productivity");
    add(into, "working_hours", "assumable", "Restricted-hours productivity");
    add(into, "parking_loading", "optional", "Loading convenience");
  }

  if (waste) {
    add(into, "waste_bin_access", "required", "Disposal / haulage");
  }

  if (types.has("demolition")) {
    add(into, "services_isolated", "required", "Strip-out safety / method");
    add(
      into,
      "hazardous_materials_risk",
      "required",
      "Hazmat method / programme"
    );
    add(into, "protection_dust_control", "assumable", "Occupied/adjacent protection");
  } else if (reno) {
    add(into, "services_isolated", "assumable", "Services risk on reno/strip-out");
    add(
      into,
      "hazardous_materials_risk",
      "assumable",
      "Hazmat risk on renovation"
    );
    add(into, "protection_dust_control", "assumable", "Dust/protection");
  }

  if (hasType(types, CONSENT_TYPES)) {
    add(
      into,
      "consent_engineering",
      "assumable",
      "Consent/engineering may change scope"
    );
  }

  if (types.has("kitchen") || types.has("bathroom") || types.has("painting") || types.has("doors")) {
    add(into, "client_supplied_items", "optional", "Supply split");
  }
  if (types.has("kitchen") || types.has("bathroom") || types.has("doors")) {
    add(into, "by_others_trades", "optional", "Trade split");
  }

  return [...into.values()];
}

export function isProjectConditionKeyApplicable(
  input: BuilderInterviewInput,
  key: string
): boolean {
  return evaluateApplicableProjectConditions(input).some((item) => item.key === key);
}

export function getRequiredApplicableKeys(
  input: BuilderInterviewInput
): CanonicalProjectConditionKey[] {
  return evaluateApplicableProjectConditions(input)
    .filter((item) => item.readiness === "required")
    .map((item) => item.key);
}

export function isProjectConditionResolved(
  constraints: readonly InterviewConstraintInput[],
  key: string
): boolean {
  const row = constraints.find((c) => c.key === key);
  return Boolean(row && isMeaningfulKnownValue(row.value));
}

export function getUnresolvedRequiredProjectConditionKeys(
  input: BuilderInterviewInput
): CanonicalProjectConditionKey[] {
  return getRequiredApplicableKeys(input).filter(
    (key) => !isProjectConditionResolved(input.constraints, key)
  );
}

export const PROJECT_CONDITIONS_ESTIMATE_BLOCK_MESSAGE =
  "Complete the remaining project information before generating the estimate.";
