/**
 * Stage 3.1D — Shared scope persistence helpers.
 *
 * Deterministic write order:
 *   1. Upsert project_facts (source of truth)
 *   2. Mirror questions.answer_value (capture journal)
 *   3. Caller recomputes derived facts
 *
 * No "use server" — callers are server actions that own auth/ownership checks.
 */

import type { createClient } from "@/lib/supabase/server";
import {
  assertFactConstraintNamespace,
  findQuestionAnswersNeedingFactHeal,
} from "@/lib/scopes/scope-value-resolution";
import { shouldWriteDerivedFact } from "@/lib/scopes/domain-ownership";
import { normalizeAnswerForStorage } from "@/lib/scopes/fact-values";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ScopeFactUpsertInput = {
  orgId: string;
  projectId: string;
  workAreaId: string | null;
  key: string;
  label: string;
  value: unknown;
  unit?: string | null;
  source?: "user" | "ai_extracted" | "default" | "assumption" | "system";
  confidence?: number;
};

export type ScopePersistResult = { ok: true } | { ok: false; error: string };

/**
 * Upsert a user/AI fact. Rejects reserved constraint keys.
 * Does not write derived source — use persistDerivedFactsForProject.
 */
export async function upsertScopedFact(
  supabase: SupabaseClient,
  input: ScopeFactUpsertInput
): Promise<ScopePersistResult> {
  const namespace = assertFactConstraintNamespace({
    target: "fact",
    key: input.key,
  });
  if (!namespace.ok) {
    return { ok: false, error: namespace.error };
  }

  let factQuery = supabase
    .from("project_facts")
    .select("id, source")
    .eq("project_id", input.projectId)
    .eq("key", input.key);

  if (input.workAreaId) {
    factQuery = factQuery.eq("work_area_id", input.workAreaId);
  } else {
    factQuery = factQuery.is("work_area_id", null);
  }

  const { data: existingFact, error: selectError } = await factQuery.maybeSingle();
  if (selectError) {
    return { ok: false, error: selectError.message };
  }

  const source = input.source ?? "user";
  const factPayload = {
    label: input.label,
    value: input.value,
    unit: input.unit ?? null,
    source,
    confidence: input.confidence ?? 1,
  };

  if (existingFact) {
    // User commits always win; allow overwrite of derived/AI/default.
    // Non-user writers must not clobber derived rows — derived rewrite owns that path.
    if (existingFact.source === "derived" && source !== "user") {
      return { ok: true };
    }

    const { error } = await supabase
      .from("project_facts")
      .update(factPayload)
      .eq("id", existingFact.id)
      .eq("project_id", input.projectId);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { error } = await supabase.from("project_facts").insert({
    org_id: input.orgId,
    project_id: input.projectId,
    work_area_id: input.workAreaId,
    key: input.key,
    ...factPayload,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Mirror a fact value onto matching question rows (capture journal).
 * Never creates questions — only updates existing rows.
 */
export async function mirrorFactOntoQuestions(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    workAreaId: string | null;
    key: string;
    value: unknown;
    inputType?: string | null;
  }
): Promise<ScopePersistResult> {
  let questionQuery = supabase
    .from("questions")
    .select("id, input_type")
    .eq("project_id", params.projectId)
    .eq("key", params.key);

  if (params.workAreaId) {
    questionQuery = questionQuery.eq("work_area_id", params.workAreaId);
  }

  const { data: questions, error: selectError } = await questionQuery;
  if (selectError) {
    return { ok: false, error: selectError.message };
  }

  for (const question of questions ?? []) {
    const inputType = (params.inputType ??
      question.input_type) as
      | "number"
      | "select"
      | "boolean"
      | "text"
      | "multi_select";

    const storedValue = normalizeAnswerForStorage(
      params.value as string | number | boolean | string[],
      inputType
    );

    const { error } = await supabase
      .from("questions")
      .update({
        answer_value: storedValue,
        answer_source: "user",
      })
      .eq("id", question.id)
      .eq("project_id", params.projectId);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

/**
 * Deterministic answer commit:
 * Fact (SoT) first, then question mirror.
 */
export async function commitUserAnswerToScope(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    projectId: string;
    questionId: string;
    questionBlockId: string;
    workAreaId: string | null;
    key: string;
    label: string;
    unit: string | null;
    inputType: "number" | "select" | "boolean" | "text" | "multi_select";
    value: string | number | boolean | string[];
  }
): Promise<ScopePersistResult> {
  const storedValue = normalizeAnswerForStorage(params.value, params.inputType);

  const factResult = await upsertScopedFact(supabase, {
    orgId: params.orgId,
    projectId: params.projectId,
    workAreaId: params.workAreaId,
    key: params.key,
    label: params.label,
    value: storedValue,
    unit: params.unit,
    source: "user",
    confidence: 1,
  });

  if (!factResult.ok) {
    return factResult;
  }

  const { error: questionError } = await supabase
    .from("questions")
    .update({
      answer_value: storedValue,
      answer_source: "user",
    })
    .eq("id", params.questionId)
    .eq("question_block_id", params.questionBlockId)
    .eq("project_id", params.projectId);

  if (questionError) {
    return { ok: false, error: questionError.message };
  }

  return { ok: true };
}

/**
 * Direct fact edit commit: Fact SoT, then mirror questions.
 * Rejects editing when caller marks derived-only (caller should check source).
 */
export async function commitUserFactEdit(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    projectId: string;
    workAreaId: string | null;
    key: string;
    label: string;
    value: unknown;
    unit?: string | null;
    valueType?: "number" | "select" | "boolean" | "text" | "multi_select";
  }
): Promise<ScopePersistResult & { blockedDerived?: boolean }> {
  const namespace = assertFactConstraintNamespace({
    target: "fact",
    key: params.key,
  });
  if (!namespace.ok) {
    return { ok: false, error: namespace.error };
  }

  let factQuery = supabase
    .from("project_facts")
    .select("id, source")
    .eq("project_id", params.projectId)
    .eq("key", params.key);

  if (params.workAreaId) {
    factQuery = factQuery.eq("work_area_id", params.workAreaId);
  } else {
    factQuery = factQuery.is("work_area_id", null);
  }

  const { data: existingFact } = await factQuery.maybeSingle();
  if (existingFact?.source === "derived") {
    return {
      ok: false,
      error: "Calculated values cannot be edited directly.",
      blockedDerived: true,
    };
  }

  const storedValue = params.valueType
    ? normalizeAnswerForStorage(
        params.value as string | number | boolean | string[],
        params.valueType
      )
    : params.value;

  const factResult = await upsertScopedFact(supabase, {
    orgId: params.orgId,
    projectId: params.projectId,
    workAreaId: params.workAreaId,
    key: params.key,
    label: params.label,
    value: storedValue,
    unit: params.unit,
    source: "user",
  });

  if (!factResult.ok) {
    return factResult;
  }

  const mirror = await mirrorFactOntoQuestions(supabase, {
    projectId: params.projectId,
    workAreaId: params.workAreaId,
    key: params.key,
    value: storedValue,
    inputType: params.valueType,
  });

  return mirror;
}

/**
 * Upsert a constraint — rejects scoped fact keys.
 */
export async function upsertProjectConstraintRecord(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    projectId: string;
    key: string;
    label: string;
    value: unknown;
    source?: "user" | "ai_extracted" | "derived" | "default" | "assumption" | "system";
  }
): Promise<ScopePersistResult> {
  const namespace = assertFactConstraintNamespace({
    target: "constraint",
    key: params.key,
  });
  if (!namespace.ok) {
    return { ok: false, error: namespace.error };
  }

  const { data: existing } = await supabase
    .from("constraints")
    .select("id")
    .eq("project_id", params.projectId)
    .eq("key", params.key)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("constraints")
      .update({
        label: params.label,
        value: params.value,
        source: params.source ?? "user",
      })
      .eq("id", existing.id)
      .eq("project_id", params.projectId);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { error } = await supabase.from("constraints").insert({
    org_id: params.orgId,
    project_id: params.projectId,
    key: params.key,
    label: params.label,
    value: params.value,
    source: params.source ?? "user",
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Heal drift: question answers with values but no matching fact → write facts.
 * Returns number of facts healed.
 */
export async function healQuestionAnswersIntoFacts(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    projectId: string;
    questionRows: Array<{
      work_area_id: string | null;
      key: string;
      label?: string | null;
      answer_value: unknown;
      unit?: string | null;
    }>;
    factRows: Array<{
      key: string;
      work_area_id: string | null;
      value: unknown;
    }>;
  }
): Promise<{ healed: number; error?: string }> {
  const needingHeal = findQuestionAnswersNeedingFactHeal({
    questionAnswers: params.questionRows.map((row) => ({
      workAreaId: row.work_area_id,
      key: row.key,
      answerValue: row.answer_value,
    })),
    facts: params.factRows.map((row) => ({
      key: row.key,
      work_area_id: row.work_area_id,
      value: row.value,
    })),
  });

  let healed = 0;
  for (const item of needingHeal) {
    const labelRow = params.questionRows.find(
      (row) =>
        row.key === item.key &&
        (row.work_area_id ?? null) === (item.workAreaId ?? null)
    );

    const result = await upsertScopedFact(supabase, {
      orgId: params.orgId,
      projectId: params.projectId,
      workAreaId: item.workAreaId,
      key: item.key,
      label: labelRow?.label?.trim() || item.key,
      value: item.value,
      unit: labelRow?.unit ?? null,
      source: "user",
    });

    if (!result.ok) {
      return { healed, error: result.error };
    }
    healed += 1;
  }

  return { healed };
}

/** Re-export for derived write guards at call sites. */
export { shouldWriteDerivedFact };
