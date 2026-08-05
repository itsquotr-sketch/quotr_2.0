import { resolveCanonicalScopeId } from "./normalisation";
import type {
  AcceptedWorkAreaRef,
  CatalogueCondition,
  EvaluationConstraint,
  EvaluationFact,
} from "./types";

export interface ConditionContext {
  readonly acceptedWorkAreas: readonly AcceptedWorkAreaRef[];
  readonly facts: ReadonlyMap<string, unknown>;
  readonly constraints: ReadonlyMap<string, unknown>;
}

export function buildFactMap(
  facts: readonly EvaluationFact[]
): ReadonlyMap<string, unknown> {
  const map = new Map<string, unknown>();
  for (const fact of facts) {
    map.set(fact.key, fact.value);
  }
  return map;
}

export function buildConstraintMap(
  constraints: readonly EvaluationConstraint[]
): ReadonlyMap<string, unknown> {
  const map = new Map<string, unknown>();
  for (const c of constraints) {
    map.set(c.key, c.value);
  }
  return map;
}

function hasAcceptedScope(
  accepted: readonly AcceptedWorkAreaRef[],
  scopeType: string
): boolean {
  const target = resolveCanonicalScopeId(scopeType) ?? scopeType;
  return accepted.some((wa) => {
    const resolved = resolveCanonicalScopeId(wa.type) ?? wa.type;
    return resolved === target || wa.type === scopeType;
  });
}

function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim().toLowerCase();
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return normalizeComparable(a) === normalizeComparable(b);
}

const EXPLICIT_NO = new Set(["no", "false", "0", "none"]);
const EXPLICIT_YES = new Set(["yes", "true", "1"]);
const UNKNOWN_TOKENS = new Set([
  "unknown",
  "not sure",
  "not_sure",
  "unsure",
  "",
]);

function isExplicitNo(value: unknown): boolean {
  if (value === false) return true;
  const n = normalizeComparable(value);
  return EXPLICIT_NO.has(n);
}

function isExplicitYes(value: unknown): boolean {
  if (value === true) return true;
  const n = normalizeComparable(value);
  return EXPLICIT_YES.has(n);
}

function isUnknownValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const n = normalizeComparable(value);
  return UNKNOWN_TOKENS.has(n);
}

function isDeliberateNone(value: unknown): boolean {
  return normalizeComparable(value) === "none";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Three-valued evaluation: true / false / unknown.
 * Missing data is unknown unless the operator is fact_missing / fact_exists.
 */
export type TriState = true | false | "unknown";

export function evaluateCondition(
  condition: CatalogueCondition,
  ctx: ConditionContext
): TriState {
  switch (condition.op) {
    case "all": {
      let sawUnknown = false;
      for (const child of condition.conditions) {
        const result = evaluateCondition(child, ctx);
        if (result === false) return false;
        if (result === "unknown") sawUnknown = true;
      }
      return sawUnknown ? "unknown" : true;
    }
    case "any": {
      let sawUnknown = false;
      for (const child of condition.conditions) {
        const result = evaluateCondition(child, ctx);
        if (result === true) return true;
        if (result === "unknown") sawUnknown = true;
      }
      return sawUnknown ? "unknown" : false;
    }
    case "fact_exists":
      return ctx.facts.has(condition.factKey) &&
        ctx.facts.get(condition.factKey) !== null &&
        ctx.facts.get(condition.factKey) !== undefined
        ? true
        : false;
    case "fact_missing":
      return !ctx.facts.has(condition.factKey) ||
        ctx.facts.get(condition.factKey) === null ||
        ctx.facts.get(condition.factKey) === undefined
        ? true
        : false;
    case "fact_equals": {
      if (!ctx.facts.has(condition.factKey)) return "unknown";
      const value = ctx.facts.get(condition.factKey);
      if (isUnknownValue(value)) return "unknown";
      return valuesEqual(value, condition.value);
    }
    case "fact_not_equals": {
      if (!ctx.facts.has(condition.factKey)) return "unknown";
      const value = ctx.facts.get(condition.factKey);
      if (isUnknownValue(value)) return "unknown";
      return !valuesEqual(value, condition.value);
    }
    case "fact_is_none": {
      if (!ctx.facts.has(condition.factKey)) return "unknown";
      return isDeliberateNone(ctx.facts.get(condition.factKey));
    }
    case "fact_is_unknown": {
      if (!ctx.facts.has(condition.factKey)) return true;
      return isUnknownValue(ctx.facts.get(condition.factKey));
    }
    case "fact_is_explicit_no": {
      if (!ctx.facts.has(condition.factKey)) return "unknown";
      const value = ctx.facts.get(condition.factKey);
      if (isUnknownValue(value)) return "unknown";
      return isExplicitNo(value);
    }
    case "fact_is_explicit_yes": {
      if (!ctx.facts.has(condition.factKey)) return "unknown";
      const value = ctx.facts.get(condition.factKey);
      if (isUnknownValue(value)) return "unknown";
      return isExplicitYes(value);
    }
    case "constraint_equals": {
      if (!ctx.constraints.has(condition.constraintKey)) return "unknown";
      const value = ctx.constraints.get(condition.constraintKey);
      if (isUnknownValue(value)) return "unknown";
      return valuesEqual(value, condition.value);
    }
    case "constraint_exists":
      return ctx.constraints.has(condition.constraintKey);
    case "accepted_wa_exists":
      return hasAcceptedScope(ctx.acceptedWorkAreas, condition.scopeType);
    case "accepted_wa_missing":
      return !hasAcceptedScope(ctx.acceptedWorkAreas, condition.scopeType);
    case "numeric_gte":
    case "numeric_gt":
    case "numeric_lte":
    case "numeric_lt": {
      if (!ctx.facts.has(condition.factKey)) return "unknown";
      const n = toNumber(ctx.facts.get(condition.factKey));
      if (n === null) return "unknown";
      if (condition.op === "numeric_gte") return n >= condition.value;
      if (condition.op === "numeric_gt") return n > condition.value;
      if (condition.op === "numeric_lte") return n <= condition.value;
      return n < condition.value;
    }
    default: {
      const _exhaustive: never = condition;
      void _exhaustive;
      return "unknown";
    }
  }
}

/** Trigger must be true (not unknown). */
export function isTriggered(
  condition: CatalogueCondition,
  ctx: ConditionContext
): boolean {
  return evaluateCondition(condition, ctx) === true;
}

/** Suppress when explicitly true — unknown does not suppress. */
export function isSuppressed(
  condition: CatalogueCondition | null,
  ctx: ConditionContext
): boolean {
  if (!condition) return false;
  return evaluateCondition(condition, ctx) === true;
}

/** Conflict when explicitly true. */
export function isConflict(
  condition: CatalogueCondition | null,
  ctx: ConditionContext
): boolean {
  if (!condition) return false;
  return evaluateCondition(condition, ctx) === true;
}
