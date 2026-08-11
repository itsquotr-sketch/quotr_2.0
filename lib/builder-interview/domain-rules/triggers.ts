/**
 * Stage 3.2.1 — Deterministic trigger / override / conditional rules.
 */

import { isMeaningfulKnownValue } from "@/lib/builder-interview/authority";
import type {
  BuilderInterviewInput,
  InterviewWorkAreaInput,
  SemanticTopicId,
} from "@/lib/builder-interview/types";

export type TriggerContext = {
  input: BuilderInterviewInput;
  confirmedWorkAreas: readonly InterviewWorkAreaInput[];
  confirmedTypes: ReadonlySet<string>;
  workArea?: InterviewWorkAreaInput;
};

export type TriggerResult = { ok: true } | { ok: false; reason: string };

const ALWAYS: (ctx: TriggerContext) => TriggerResult = () => ({ ok: true });

function hasConfirmedType(ctx: TriggerContext, type: string): boolean {
  return ctx.confirmedTypes.has(type);
}

function hasAnyConfirmedType(
  ctx: TriggerContext,
  types: readonly string[]
): boolean {
  return types.some((t) => ctx.confirmedTypes.has(t));
}

/** Reno / strip-out risk pack relevance. */
const RENO_TYPES = [
  "demolition",
  "bathroom",
  "kitchen",
  "internal_walls",
  "ceilings",
  "flooring",
  "painting",
  "plastering",
  "doors",
] as const;

export const TRIGGER_RULES: Record<
  string,
  (ctx: TriggerContext) => TriggerResult
> = {
  always: ALWAYS,

  has_confirmed_work_areas: (ctx) =>
    ctx.confirmedWorkAreas.length > 0
      ? { ok: true }
      : { ok: false, reason: "No confirmed work areas" },

  has_demolition_wa: (ctx) =>
    hasConfirmedType(ctx, "demolition")
      ? { ok: true }
      : { ok: false, reason: "No demolition work area" },

  has_reno_or_demolition: (ctx) =>
    hasAnyConfirmedType(ctx, RENO_TYPES)
      ? { ok: true }
      : { ok: false, reason: "No renovation/demolition-related work area" },

  has_deck_wa: (ctx) =>
    hasConfirmedType(ctx, "deck")
      ? { ok: true }
      : { ok: false, reason: "No deck work area" },

  has_bathroom_wa: (ctx) =>
    hasConfirmedType(ctx, "bathroom")
      ? { ok: true }
      : { ok: false, reason: "No bathroom work area" },

  /** WA-scoped entry must bind to a confirmed WA of matching type. */
  work_area_type_matches: (ctx) => {
    if (!ctx.workArea) {
      return { ok: false, reason: "Missing work area binding" };
    }
    if (ctx.workArea.status !== "confirmed") {
      return { ok: false, reason: "Work area not confirmed" };
    }
    return { ok: true };
  },
};

export function evaluateTriggers(
  ruleIds: readonly string[],
  ctx: TriggerContext
): TriggerResult {
  for (const id of ruleIds) {
    const rule = TRIGGER_RULES[id];
    if (!rule) {
      return { ok: false, reason: `Unknown trigger rule: ${id}` };
    }
    const result = rule(ctx);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/**
 * Explicit WA override predicates (D8 / D11).
 * Keep registry-driven and testable — no vague "extreme conditions".
 */
export function evaluateLocalOverride(params: {
  semanticTopic: SemanticTopicId;
  workArea: InterviewWorkAreaInput;
  input: BuilderInterviewInput;
}): { allow: boolean; reason: string } {
  const { semanticTopic, workArea, input } = params;

  if (semanticTopic === "site.access" || semanticTopic === "site.floor_level") {
    // Demolition on a different floor than project-wide floor_level → local access may differ.
    if (workArea.type === "demolition") {
      const projectFloor = input.constraints.find((c) => c.key === "floor_level");
      const waFloor = input.facts.find(
        (f) =>
          f.key === "demolition.floor_level" && f.workAreaId === workArea.id
      );
      if (
        projectFloor &&
        isMeaningfulKnownValue(projectFloor.value) &&
        waFloor &&
        isMeaningfulKnownValue(waFloor.value) &&
        String(projectFloor.value).toLowerCase() !==
          String(waFloor.value).toLowerCase()
      ) {
        return {
          allow: true,
          reason:
            "demolition.floor_level differs from project floor_level — local access override",
        };
      }

      // Existing local access Fact that already differs from project site_access.
      const projectAccess = input.constraints.find((c) => c.key === "site_access");
      const waAccess = input.facts.find(
        (f) => f.key === "demolition.access" && f.workAreaId === workArea.id
      );
      if (
        projectAccess &&
        isMeaningfulKnownValue(projectAccess.value) &&
        waAccess &&
        isMeaningfulKnownValue(waAccess.value) &&
        String(projectAccess.value).toLowerCase() !==
          String(waAccess.value).toLowerCase()
      ) {
        return {
          allow: true,
          reason: "Existing demolition.access differs from project site_access",
        };
      }
    }
  }

  return { allow: false, reason: "No explicit local override predicate matched" };
}

/**
 * Parent applicability for conditional children.
 * Parent unknown → child omitted unless registry explicitly allows (MVP: never).
 */
export function isParentConditionSatisfied(params: {
  parentQuestionKey: string;
  input: BuilderInterviewInput;
  /** Map of questionKey → whether parent would be applicable & answered affirmatively */
  parentAnswerLookup: (questionKey: string) => "true" | "false" | "unknown";
}): "true" | "false" | "unknown" {
  return params.parentAnswerLookup(params.parentQuestionKey);
}

export function readParentFactBoolean(params: {
  input: BuilderInterviewInput;
  factKey: string;
  workAreaId?: string | null;
}): "true" | "false" | "unknown" {
  const row = params.input.facts.find(
    (f) =>
      f.key === params.factKey &&
      (params.workAreaId
        ? f.workAreaId === params.workAreaId
        : f.workAreaId === null || f.workAreaId === undefined)
  );
  if (!row || !isMeaningfulKnownValue(row.value)) return "unknown";
  const v = row.value;
  if (v === true || v === "true" || v === "Yes" || v === "yes") return "true";
  if (v === false || v === "false" || v === "No" || v === "no") return "false";
  return "unknown";
}
