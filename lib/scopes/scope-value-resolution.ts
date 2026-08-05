/**
 * Stage 3.1D — Deterministic scope value resolution (pure).
 *
 * Rules:
 * 1. project_facts are the sole authority for estimating and missing-fact readiness.
 * 2. Question answers are a capture journal / UI mirror — never estimate inputs.
 * 3. When merging for display, facts win over question-derived baselines.
 * 4. Derived facts merge into fact records without overwriting source=user.
 */

import { isNotSureValue } from "@/lib/scopes/fact-labels";
import {
  buildFactLookup,
  factHasValue,
  type ProjectFactRecord,
} from "@/lib/scopes/fact-values";
import {
  factSourcePrecedence,
  isReservedConstraintKey,
  looksLikeScopedFactKey,
} from "@/lib/scopes/domain-ownership";

export type QuestionAnswerRecord = {
  workAreaId: string | null;
  key: string;
  answerValue: unknown;
};

export type ScopeValueResolution = {
  key: string;
  workAreaId: string | null;
  value: unknown;
  /** Where the winning value came from for this resolution. */
  resolvedFrom: "fact" | "question_fallback" | "none";
  factSource?: string | null;
};

/**
 * Resolve a single scope value for estimating / readiness.
 * Question answers are ignored — facts only.
 */
export function resolveFactValueForEstimate(params: {
  facts: ProjectFactRecord[];
  workAreaId: string | null;
  key: string;
}): ScopeValueResolution {
  const match = params.facts.find((fact) => {
    if (fact.key !== params.key) return false;
    return (fact.work_area_id ?? null) === (params.workAreaId ?? null);
  });

  if (match && factHasValue(match.value)) {
    return {
      key: params.key,
      workAreaId: params.workAreaId,
      value: match.value,
      resolvedFrom: "fact",
      factSource: match.source ?? null,
    };
  }

  return {
    key: params.key,
    workAreaId: params.workAreaId,
    value: null,
    resolvedFrom: "none",
  };
}

/**
 * Display / Scope Review merge: question answers as baseline, facts win.
 * Returns a fact-lookup map keyed by workAreaId:key.
 */
export function mergeQuestionBaselineWithFacts(params: {
  workAreaId: string;
  facts: ProjectFactRecord[];
  questionAnswers: QuestionAnswerRecord[];
}): Map<string, ProjectFactRecord> {
  const byKey = new Map<string, ProjectFactRecord>();

  for (const answer of params.questionAnswers) {
    if (answer.workAreaId !== params.workAreaId) continue;
    if (!factHasValue(answer.answerValue)) continue;
    byKey.set(answer.key, {
      key: answer.key,
      work_area_id: params.workAreaId,
      value: answer.answerValue,
      source: "user",
    });
  }

  for (const fact of params.facts) {
    if (fact.work_area_id !== params.workAreaId) continue;
    byKey.set(fact.key, fact);
  }

  return buildFactLookup([...byKey.values()]);
}

/**
 * Pick the higher-precedence fact when two records share a key.
 * Used for defensive merges; user always beats derived.
 */
export function pickWinningFact(
  a: ProjectFactRecord,
  b: ProjectFactRecord
): ProjectFactRecord {
  const aRank = factSourcePrecedence(a.source);
  const bRank = factSourcePrecedence(b.source);
  if (aRank === bRank) {
    // Prefer the newer-looking non-null value; default to b (incoming).
    return factHasValue(b.value) ? b : a;
  }
  return aRank >= bRank ? a : b;
}

/**
 * Question answers that have a persistable value but no matching fact.
 * These are ownership drift cases that must be healed into project_facts.
 */
export function findQuestionAnswersNeedingFactHeal(params: {
  questionAnswers: QuestionAnswerRecord[];
  facts: ProjectFactRecord[];
  /** Optional select options by `${workAreaId}:${key}` for not-sure filtering. */
  selectOptionsByKey?: Map<string, string[] | undefined>;
}): Array<{
  workAreaId: string | null;
  key: string;
  value: unknown;
}> {
  const factKeys = new Set(
    params.facts
      .filter((fact) => factHasValue(fact.value))
      .map((fact) => `${fact.work_area_id ?? "null"}:${fact.key}`)
  );

  const out: Array<{
    workAreaId: string | null;
    key: string;
    value: unknown;
  }> = [];

  const seen = new Set<string>();

  for (const answer of params.questionAnswers) {
    if (isReservedConstraintKey(answer.key)) continue;
    if (!factHasValue(answer.answerValue)) continue;

    const optionsKey = `${answer.workAreaId ?? "null"}:${answer.key}`;
    const options = params.selectOptionsByKey?.get(optionsKey);
    if (isNotSureValue(answer.answerValue, options)) continue;

    const dedupe = `${answer.workAreaId ?? "null"}:${answer.key}`;
    if (seen.has(dedupe)) continue;
    if (factKeys.has(dedupe)) continue;

    seen.add(dedupe);
    out.push({
      workAreaId: answer.workAreaId,
      key: answer.key,
      value: answer.answerValue,
    });
  }

  return out;
}

/**
 * Whether a question-only answer may satisfy missing-fact readiness.
 * Stage 3.1D: never — facts are the sole authority.
 */
export function questionAnswerSatisfiesFactReadiness(): boolean {
  return false;
}

/**
 * Validate namespace separation for writes.
 */
export function assertFactConstraintNamespace(params: {
  target: "fact" | "constraint";
  key: string;
}): { ok: true } | { ok: false; error: string } {
  if (params.target === "fact" && isReservedConstraintKey(params.key)) {
    return {
      ok: false,
      error:
        "Constraint keys cannot be stored as project facts. Use the constraints table.",
    };
  }
  if (params.target === "constraint" && looksLikeScopedFactKey(params.key)) {
    return {
      ok: false,
      error:
        "Scoped fact keys cannot be stored as constraints. Use project_facts.",
    };
  }
  return { ok: true };
}
