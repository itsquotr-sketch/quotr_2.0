"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssistantStage, QualityLevel } from "@/components/assistant/types";
import {
  STATIC_ESTIMATE_TOTALS,
  STATIC_LINE_ITEM_SEEDS,
  STATIC_QUESTION_BLOCK,
  STATIC_QUESTION_SEEDS,
  STATIC_WORK_AREA_SEEDS,
} from "@/lib/assistant/mock-seed";
import {
  canRunStageAction,
  getAuthOrgContext,
} from "@/lib/assistant/state";
import { isStageAtOrBeyond } from "@/lib/assistant/stage";
import type {
  AssistantActionState,
  ConstraintInput,
  QuestionAnswerInput,
  WorkAreaSelection,
} from "@/lib/assistant/types";
import { createClient } from "@/lib/supabase/server";

const BRIEF_MAX_LENGTH = 5000;

const qualityLevelSchema = z.enum([
  "budget",
  "standard",
  "premium",
  "unknown",
]);

const workAreaSelectionSchema = z.object({
  work_area_id: z.string().uuid(),
  status: z.enum(["confirmed", "excluded"]),
});

function revalidateAssistantPaths(projectId: string) {
  revalidatePath("/app/dashboard");
  revalidatePath(`/app/projects/${projectId}`);
}

async function loadProjectStage(projectId: string) {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." as const };
  }

  const { supabase, orgId } = context;

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, stage, org_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project) {
    return { error: "Project not found." as const };
  }

  return {
    supabase,
    orgId,
    projectId: project.id,
    stage: project.stage as AssistantStage,
  };
}

export async function saveBriefAndSeedWorkAreas(
  projectId: string,
  briefText: string
): Promise<AssistantActionState> {
  const trimmed = briefText.trim();
  if (!trimmed) {
    return { error: "Please enter a project brief." };
  }
  if (trimmed.length > BRIEF_MAX_LENGTH) {
    return {
      error: `Brief must be ${BRIEF_MAX_LENGTH} characters or fewer.`,
    };
  }

  const loaded = await loadProjectStage(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, stage } = loaded;

  if (isStageAtOrBeyond(stage, "confirm_work_areas")) {
    return { success: true };
  }

  if (!canRunStageAction(stage, "save_brief")) {
    return { error: "This action is not available at the current stage." };
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      brief_text: trimmed,
      stage: "confirm_work_areas",
    })
    .eq("id", projectId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { data: existingWorkAreas } = await supabase
    .from("work_areas")
    .select("type")
    .eq("project_id", projectId);

  const existingTypes = new Set(
    (existingWorkAreas ?? []).map((row) => row.type)
  );

  const toInsert = STATIC_WORK_AREA_SEEDS.filter(
    (seed) => !existingTypes.has(seed.type)
  ).map((seed) => ({
    org_id: orgId,
    project_id: projectId,
    type: seed.type,
    name: seed.name,
    status: seed.status,
    ai_confidence: seed.ai_confidence,
    sort_order: seed.sort_order,
  }));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("work_areas")
      .insert(toInsert);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidateAssistantPaths(projectId);
  return { success: true };
}

export async function confirmWorkAreas(
  projectId: string,
  selections: WorkAreaSelection[]
): Promise<AssistantActionState> {
  const parsed = z.array(workAreaSelectionSchema).safeParse(selections);
  if (!parsed.success) {
    return { error: "Invalid work area selections." };
  }

  const confirmedCount = parsed.data.filter(
    (s) => s.status === "confirmed"
  ).length;
  if (confirmedCount === 0) {
    return { error: "At least one work area must be confirmed." };
  }

  const loaded = await loadProjectStage(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, stage } = loaded;

  if (isStageAtOrBeyond(stage, "quality")) {
    return { success: true };
  }

  if (!canRunStageAction(stage, "confirm_work_areas")) {
    return { error: "This action is not available at the current stage." };
  }

  for (const selection of parsed.data) {
    const { error } = await supabase
      .from("work_areas")
      .update({ status: selection.status })
      .eq("id", selection.work_area_id)
      .eq("project_id", projectId);

    if (error) {
      return { error: error.message };
    }
  }

  const { error: stageError } = await supabase
    .from("projects")
    .update({ stage: "quality" })
    .eq("id", projectId);

  if (stageError) {
    return { error: stageError.message };
  }

  revalidateAssistantPaths(projectId);
  return { success: true };
}

async function seedQuestionBlockIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  projectId: string
): Promise<AssistantActionState | { blockId: string }> {
  const { data: existingBlocks } = await supabase
    .from("question_blocks")
    .select("id")
    .eq("project_id", projectId)
    .eq("stage", "work_area_questions")
    .in("status", ["active", "submitted"]);

  if (existingBlocks && existingBlocks.length > 0) {
    return { blockId: existingBlocks[0].id };
  }

  const { data: workAreas } = await supabase
    .from("work_areas")
    .select("id, type, name")
    .eq("project_id", projectId);

  const workAreaByType = new Map(
    (workAreas ?? []).map((wa) => [wa.type, wa])
  );

  const { data: block, error: blockError } = await supabase
    .from("question_blocks")
    .insert({
      org_id: orgId,
      project_id: projectId,
      stage: STATIC_QUESTION_BLOCK.stage,
      title: STATIC_QUESTION_BLOCK.title,
      description: STATIC_QUESTION_BLOCK.description,
      status: "active",
      sort_order: STATIC_QUESTION_BLOCK.sort_order,
    })
    .select("id")
    .single();

  if (blockError || !block) {
    return { error: blockError?.message ?? "Failed to create question block." };
  }

  const questionRows = STATIC_QUESTION_SEEDS.map((seed) => {
    const workArea = seed.work_area_type
      ? workAreaByType.get(seed.work_area_type)
      : undefined;

    return {
      org_id: orgId,
      project_id: projectId,
      question_block_id: block.id,
      work_area_id: workArea?.id ?? null,
      key: seed.key,
      label: seed.label,
      question_text: seed.question_text,
      input_type: seed.input_type,
      options: seed.options ?? null,
      required: seed.required,
      unit: seed.unit ?? null,
      sort_order: seed.sort_order,
    };
  });

  const { error: questionsError } = await supabase
    .from("questions")
    .insert(questionRows);

  if (questionsError) {
    return { error: questionsError.message };
  }

  return { blockId: block.id };
}

export async function saveQuality(
  projectId: string,
  qualityLevel: QualityLevel
): Promise<AssistantActionState> {
  const parsed = qualityLevelSchema.safeParse(qualityLevel);
  if (!parsed.success) {
    return { error: "Invalid quality level." };
  }

  const loaded = await loadProjectStage(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, stage } = loaded;

  if (isStageAtOrBeyond(stage, "work_area_questions")) {
    return { success: true };
  }

  if (!canRunStageAction(stage, "save_quality")) {
    return { error: "This action is not available at the current stage." };
  }

  const seedResult = await seedQuestionBlockIfNeeded(
    supabase,
    orgId,
    projectId
  );
  if ("error" in seedResult) {
    return seedResult;
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      quality_level: parsed.data,
      stage: "work_area_questions",
    })
    .eq("id", projectId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidateAssistantPaths(projectId);
  return { success: true };
}

export async function saveQuestionBlockAnswers(
  projectId: string,
  questionBlockId: string,
  answers: QuestionAnswerInput[]
): Promise<AssistantActionState> {
  const answerSchema = z.object({
    question_id: z.string().uuid(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  });

  const parsed = z.array(answerSchema).safeParse(answers);
  if (!parsed.success) {
    return { error: "Invalid answers." };
  }

  const loaded = await loadProjectStage(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, stage } = loaded;

  if (isStageAtOrBeyond(stage, "constraints")) {
    return { success: true };
  }

  if (!canRunStageAction(stage, "save_question_answers")) {
    return { error: "This action is not available at the current stage." };
  }

  const { data: block } = await supabase
    .from("question_blocks")
    .select("id, status")
    .eq("id", questionBlockId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!block) {
    return { error: "Question block not found." };
  }

  for (const answer of parsed.data) {
    const { error } = await supabase
      .from("questions")
      .update({
        answer_value: answer.value,
        answer_source: "user",
      })
      .eq("id", answer.question_id)
      .eq("question_block_id", questionBlockId)
      .eq("project_id", projectId);

    if (error) {
      return { error: error.message };
    }
  }

  if (block.status !== "submitted") {
    const { error: blockError } = await supabase
      .from("question_blocks")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", questionBlockId);

    if (blockError) {
      return { error: blockError.message };
    }
  }

  const { error: stageError } = await supabase
    .from("projects")
    .update({ stage: "constraints" })
    .eq("id", projectId);

  if (stageError) {
    return { error: stageError.message };
  }

  revalidateAssistantPaths(projectId);
  return { success: true };
}

export async function saveConstraints(
  projectId: string,
  constraints: ConstraintInput[]
): Promise<AssistantActionState> {
  const constraintSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()]),
  });

  const parsed = z.array(constraintSchema).safeParse(constraints);
  if (!parsed.success) {
    return { error: "Invalid constraints." };
  }

  const loaded = await loadProjectStage(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, stage } = loaded;

  if (isStageAtOrBeyond(stage, "ready_to_estimate")) {
    return { success: true };
  }

  if (!canRunStageAction(stage, "save_constraints")) {
    return { error: "This action is not available at the current stage." };
  }

  const { data: existing } = await supabase
    .from("constraints")
    .select("id, key")
    .eq("project_id", projectId);

  const existingByKey = new Map(
    (existing ?? []).map((row) => [row.key, row.id])
  );

  for (const constraint of parsed.data) {
    const existingId = existingByKey.get(constraint.key);

    if (existingId) {
      const { error } = await supabase
        .from("constraints")
        .update({
          label: constraint.label,
          value: constraint.value,
          source: "user",
        })
        .eq("id", existingId)
        .eq("project_id", projectId);

      if (error) {
        return { error: error.message };
      }
    } else {
      const { error } = await supabase.from("constraints").insert({
        org_id: orgId,
        project_id: projectId,
        key: constraint.key,
        label: constraint.label,
        value: constraint.value,
        source: "user",
      });

      if (error) {
        return { error: error.message };
      }
    }
  }

  const { error: stageError } = await supabase
    .from("projects")
    .update({ stage: "ready_to_estimate" })
    .eq("id", projectId);

  if (stageError) {
    return { error: stageError.message };
  }

  revalidateAssistantPaths(projectId);
  return { success: true };
}

export async function generateStaticEstimate(
  projectId: string
): Promise<AssistantActionState> {
  const loaded = await loadProjectStage(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, stage } = loaded;

  if (stage === "estimate_ready") {
    return { success: true };
  }

  if (!canRunStageAction(stage, "generate_estimate")) {
    return { error: "This action is not available at the current stage." };
  }

  const { data: workAreas } = await supabase
    .from("work_areas")
    .select("id, type")
    .eq("project_id", projectId);

  const workAreaIdByType = new Map(
    (workAreas ?? []).map((wa) => [wa.type, wa.id])
  );

  const estimatePayload = {
    org_id: orgId,
    project_id: projectId,
    status: "ready",
    cost_low: STATIC_ESTIMATE_TOTALS.cost_low,
    cost_high: STATIC_ESTIMATE_TOTALS.cost_high,
    sell_low: STATIC_ESTIMATE_TOTALS.sell_low,
    sell_high: STATIC_ESTIMATE_TOTALS.sell_high,
    recommended_cost: STATIC_ESTIMATE_TOTALS.recommended_cost,
    recommended_sell: STATIC_ESTIMATE_TOTALS.recommended_sell,
    gross_profit: STATIC_ESTIMATE_TOTALS.gross_profit,
    margin_percent: STATIC_ESTIMATE_TOTALS.margin_percent,
    markup_percent: STATIC_ESTIMATE_TOTALS.markup_percent,
    confidence: STATIC_ESTIMATE_TOTALS.confidence,
    rate_source_summary: STATIC_ESTIMATE_TOTALS.rate_source_summary,
    assumptions: STATIC_ESTIMATE_TOTALS.assumptions,
    missing_info: STATIC_ESTIMATE_TOTALS.missing_info,
    exclusions: STATIC_ESTIMATE_TOTALS.exclusions,
    generated_at: new Date().toISOString(),
  };

  const { data: existingEstimate } = await supabase
    .from("estimates")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  let estimateId: string;

  if (existingEstimate) {
    const { error: updateError } = await supabase
      .from("estimates")
      .update(estimatePayload)
      .eq("id", existingEstimate.id);

    if (updateError) {
      return { error: updateError.message };
    }
    estimateId = existingEstimate.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("estimates")
      .insert(estimatePayload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { error: insertError?.message ?? "Failed to save estimate." };
    }
    estimateId = inserted.id;
  }

  const { error: deleteError } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", estimateId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const lineItemRows = STATIC_LINE_ITEM_SEEDS.map((seed) => ({
    org_id: orgId,
    project_id: projectId,
    estimate_id: estimateId,
    work_area_id: workAreaIdByType.get(seed.work_area_type) ?? null,
    work_area_name: seed.work_area_name,
    label: seed.label,
    category: seed.category,
    cost_low: seed.cost_low,
    cost_high: seed.cost_high,
    sell_low: seed.sell_low,
    sell_high: seed.sell_high,
    recommended_cost: seed.recommended_cost,
    recommended_sell: seed.recommended_sell,
    gross_profit: seed.gross_profit,
    margin_percent: seed.margin_percent,
    markup_percent: seed.markup_percent ?? null,
    rate_source: seed.rate_source,
    sort_order: seed.sort_order,
  }));

  const { error: lineItemsError } = await supabase
    .from("estimate_line_items")
    .insert(lineItemRows);

  if (lineItemsError) {
    return { error: lineItemsError.message };
  }

  const { error: stageError } = await supabase
    .from("projects")
    .update({ stage: "estimate_ready" })
    .eq("id", projectId);

  if (stageError) {
    return { error: stageError.message };
  }

  revalidateAssistantPaths(projectId);
  return { success: true };
}
