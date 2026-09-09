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
import { resolveUiQuestionInputType } from "@/lib/scopes/question-input-types";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import { DERIVABLE_RESULT_FACT_KEYS } from "@/lib/scopes/dimension-derivation";
import { disclosedBoardWidthForNotSure } from "@/lib/estimate/deck-board-width";
import { disclosedWallHeightForNotSure } from "@/lib/estimate/bathroom-geometry";
import {
  INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
  INTERNAL_WALLS_WALL_TYPES_FACT_KEY,
  applyInternalWallsFactWrite,
  isInternalWallsWallTypeWriteKey,
  parseInternalWallsCollectionEnvelope,
} from "@/lib/estimate/internal-walls-wall-types";
import type { EstimateFact } from "@/lib/estimate/types";

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

export const INTERNAL_WALLS_COLLECTION_WRITE_MAX_ATTEMPTS = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function persistInternalWallsCollectionWrite(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    projectId: string;
    workAreaId: string;
    key: string;
    value: unknown;
    wallTypeId?: string | null;
  }
): Promise<ScopePersistResult | null> {
  if (!isInternalWallsWallTypeWriteKey(params.key)) return null;

  for (let attempt = 0; attempt < INTERNAL_WALLS_COLLECTION_WRITE_MAX_ATTEMPTS; attempt++) {
    const { data: rows, error } = await supabase
      .from("project_facts")
      .select("id, key, value, work_area_id, updated_at")
      .eq("project_id", params.projectId)
      .eq("work_area_id", params.workAreaId)
      .in("key", [
        INTERNAL_WALLS_WALL_TYPES_FACT_KEY,
        INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
      ]);

    if (error) {
      return { ok: false, error: error.message };
    }

    const current: EstimateFact[] = (rows ?? []).map((row) => ({
      key: row.key,
      work_area_id: row.work_area_id,
      value: row.value,
    }));
    const next = applyInternalWallsFactWrite({
      facts: current,
      workAreaId: params.workAreaId,
      key: params.key,
      value: params.value,
      wallTypeId: params.wallTypeId,
    });

    const wallTypes = next.find(
      (row) =>
        row.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY &&
        row.work_area_id === params.workAreaId
    );
    const active = next.find(
      (row) =>
        row.key === INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY &&
        row.work_area_id === params.workAreaId
    );

    const typesRow = (rows ?? []).find(
      (row) => row.key === INTERNAL_WALLS_WALL_TYPES_FACT_KEY
    );
    const envelope = parseInternalWallsCollectionEnvelope(typesRow?.value);
    const nextEnvelope = {
      v: envelope.v + 1,
      types: parseInternalWallsCollectionEnvelope(wallTypes?.value).types,
    };
    if (typesRow) {
      let updateQuery = supabase
        .from("project_facts")
        .update({
          label: "Wall types",
          value: nextEnvelope,
          source: "user",
          confidence: 1,
        })
        .eq("id", typesRow.id)
        .eq("project_id", params.projectId);
      if (isRecord(typesRow.value) && typeof typesRow.value.v === "number") {
        updateQuery = updateQuery.filter(
          "value->>v",
          "eq",
          String(typesRow.value.v)
        );
      } else {
        updateQuery = updateQuery.eq("updated_at", typesRow.updated_at);
      }
      const { data: updated, error: updateError } = await updateQuery.select("id");
      if (updateError) {
        return { ok: false, error: updateError.message };
      }
      if (!updated?.length) {
        continue;
      }
    } else {
      const typesResult = await upsertScopedFact(supabase, {
        orgId: params.orgId,
        projectId: params.projectId,
        workAreaId: params.workAreaId,
        key: INTERNAL_WALLS_WALL_TYPES_FACT_KEY,
        label: "Wall types",
        value: nextEnvelope,
        source: "user",
      });
      if (!typesResult.ok) {
        if (attempt < INTERNAL_WALLS_COLLECTION_WRITE_MAX_ATTEMPTS - 1) {
          continue;
        }
        return typesResult;
      }
    }

    const activeRow = (rows ?? []).find(
      (row) => row.key === INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY
    );
    if (active?.value) {
      const activeResult = await upsertScopedFact(supabase, {
        orgId: params.orgId,
        projectId: params.projectId,
        workAreaId: params.workAreaId,
        key: INTERNAL_WALLS_ACTIVE_WALL_TYPE_ID_FACT_KEY,
        label: "Selected wall type",
        value: active.value,
        source: "user",
      });
      if (!activeResult.ok) return activeResult;
    } else if (activeRow) {
      const { error: deleteError } = await supabase
        .from("project_facts")
        .delete()
        .eq("id", activeRow.id)
        .eq("project_id", params.projectId);
      if (deleteError) {
        return { ok: false, error: deleteError.message };
      }
    }

    return { ok: true };
  }

  return {
    ok: false,
    error: "Wall types could not be saved. Try again.",
  };
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
  // Known input type: one set-based UPDATE, no per-row SELECT.
  // 0 matching rows is success — same as looping an empty select.
  if (params.inputType) {
    const storedValue = normalizeAnswerForStorage(
      params.value as string | number | boolean | string[],
      params.inputType as
        | "number"
        | "select"
        | "boolean"
        | "text"
        | "multi_select"
    );

    let updateQuery = supabase
      .from("questions")
      .update({
        answer_value: storedValue,
        answer_source: "user",
      })
      .eq("project_id", params.projectId)
      .eq("key", params.key);

    if (params.workAreaId) {
      updateQuery = updateQuery.eq("work_area_id", params.workAreaId);
    }

    const { error } = await updateQuery;
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  let questionQuery = supabase
    .from("questions")
    .select("id, input_type, options")
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
    const template = getQuestionTemplateByKey(params.key);
    const inputType = resolveUiQuestionInputType({
      persistedInputType: question.input_type,
      options: question.options,
      key: params.key,
      templateInputType: template?.inputType,
    }) as
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
    wallTypeId?: string | null;
  }
): Promise<ScopePersistResult> {
  const storedValue = normalizeAnswerForStorage(params.value, params.inputType);

  const collectionWrite = params.workAreaId
    ? await persistInternalWallsCollectionWrite(supabase, {
        orgId: params.orgId,
        projectId: params.projectId,
        workAreaId: params.workAreaId,
        key: params.key,
        value: storedValue,
        wallTypeId: params.wallTypeId,
      })
    : null;
  if (collectionWrite && !collectionWrite.ok) {
    return collectionWrite;
  }

  const factResult = collectionWrite?.ok
    ? { ok: true as const }
    : await upsertScopedFact(supabase, {
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
    wallTypeId?: string | null;
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
  // Derived dimension results may be deliberately overridden by the user (3.1B.6R3).
  const allowDerivedOverride =
    existingFact?.source === "derived" &&
    DERIVABLE_RESULT_FACT_KEYS.has(params.key);
  if (existingFact?.source === "derived" && !allowDerivedOverride) {
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

  if (params.workAreaId && isInternalWallsWallTypeWriteKey(params.key)) {
    const collectionWrite = await persistInternalWallsCollectionWrite(supabase, {
      orgId: params.orgId,
      projectId: params.projectId,
      workAreaId: params.workAreaId,
      key: params.key,
      value: storedValue,
      wallTypeId: params.wallTypeId,
    });
    if (collectionWrite && !collectionWrite.ok) {
      return collectionWrite;
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

  const disclosedBoardWidth = disclosedBoardWidthForNotSure(storedValue);
  const disclosedWallHeight = disclosedWallHeightForNotSure(storedValue);
  const factValue =
    params.key === "deck.board_width_mm" && disclosedBoardWidth
      ? disclosedBoardWidth.value
      : params.key === "bathroom.wall_height_m" && disclosedWallHeight
        ? disclosedWallHeight.value
        : storedValue;
  const factSource =
    params.key === "deck.board_width_mm" && disclosedBoardWidth
      ? disclosedBoardWidth.source
      : params.key === "bathroom.wall_height_m" && disclosedWallHeight
        ? disclosedWallHeight.source
        : "user";

  const factResult = await upsertScopedFact(supabase, {
    orgId: params.orgId,
    projectId: params.projectId,
    workAreaId: params.workAreaId,
    key: params.key,
    label: params.label,
    value: factValue,
    unit:
      params.key === "deck.board_width_mm"
        ? params.unit ?? "mm"
        : params.unit,
    source: factSource,
  });

  if (!factResult.ok) {
    return factResult;
  }

  const mirror = await mirrorFactOntoQuestions(supabase, {
    projectId: params.projectId,
    workAreaId: params.workAreaId,
    key: params.key,
    value: factValue,
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
