"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssistantStage, QualityLevel } from "@/components/assistant/types";
import { extractFromBrief } from "@/lib/ai/extract";
import {
  aiFactsToRows,
  aiWorkAreasToRows,
  factDedupeKey,
} from "@/lib/ai/mappers";
import { AIExtractionError } from "@/lib/ai/schema";
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
import {
  calculateEstimate,
  EstimateEngineError,
} from "@/lib/estimate/calculate-estimate";
import { getEstimateContext } from "@/lib/estimate/context";
import { buildLineItemNotes } from "@/lib/estimate/line-items";
import { createClient } from "@/lib/supabase/server";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "@/lib/scopes/derived-facts";
import { buildQuestionBlockFromProjectState } from "@/lib/scopes/questions";
import { normalizeAnswerForStorage } from "@/lib/scopes/fact-values";

const BRIEF_MAX_LENGTH = 5000;

const BRIEF_ANALYSIS_ERROR =
  "We couldn't analyse your brief. Please try again or check your setup.";
const NO_WORK_AREAS_ERROR =
  "No supported work areas were detected. Try adding more detail or check your enabled work areas in Setup.";

const CATALOGUE_TYPES = SCOPE_CATALOGUE.map((item) => item.type);
const CATALOGUE_BY_TYPE = new Map(
  SCOPE_CATALOGUE.map((item) => [item.type, item])
);

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

async function loadAllowedWorkAreaTypes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<string[]> {
  const { data: orgWorkAreas, error } = await supabase
    .from("organisation_work_areas")
    .select("work_area_type")
    .eq("org_id", orgId)
    .eq("enabled", true);

  if (error) {
    throw new Error(error.message);
  }

  const catalogueSet = new Set(CATALOGUE_TYPES);
  const enabled = (orgWorkAreas ?? [])
    .map((row) => row.work_area_type)
    .filter((type) => catalogueSet.has(type));

  if (enabled.length > 0) {
    return enabled;
  }

  return SCOPE_CATALOGUE.filter((item) => item.defaultEnabled).map(
    (item) => item.type
  );
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

  const { error: briefError } = await supabase
    .from("projects")
    .update({ brief_text: trimmed })
    .eq("id", projectId);

  if (briefError) {
    return { error: briefError.message };
  }

  let allowedTypes: string[];
  try {
    allowedTypes = await loadAllowedWorkAreaTypes(supabase, orgId);
  } catch {
    return { error: BRIEF_ANALYSIS_ERROR };
  }

  let extraction;
  try {
    extraction = await extractFromBrief({
      briefText: trimmed,
      allowedTypes,
      catalogueTypes: CATALOGUE_TYPES,
    });
  } catch (error) {
    if (
      error instanceof AIExtractionError &&
      error.message.includes("No valid work areas")
    ) {
      return { error: NO_WORK_AREAS_ERROR };
    }
    return { error: BRIEF_ANALYSIS_ERROR };
  }

  const { data: existingWorkAreas } = await supabase
    .from("work_areas")
    .select("id, type")
    .eq("project_id", projectId);

  const existingTypes = new Set(
    (existingWorkAreas ?? []).map((row) => row.type)
  );

  const workAreaRows = aiWorkAreasToRows({
    output: extraction,
    orgId,
    projectId,
    catalogueByType: CATALOGUE_BY_TYPE,
  }).filter((row) => !existingTypes.has(row.type));

  if (workAreaRows.length > 0) {
    const { error: insertError } = await supabase
      .from("work_areas")
      .insert(workAreaRows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  const { data: allWorkAreas, error: workAreasError } = await supabase
    .from("work_areas")
    .select("id, type")
    .eq("project_id", projectId);

  if (workAreasError || !allWorkAreas || allWorkAreas.length === 0) {
    return { error: NO_WORK_AREAS_ERROR };
  }

  const workAreaIdByType = new Map(
    allWorkAreas.map((wa) => [wa.type, wa.id])
  );

  const factRows = aiFactsToRows({
    output: extraction,
    orgId,
    projectId,
    workAreaIdByType,
  });

  if (factRows.length > 0) {
    const { data: existingFacts } = await supabase
      .from("project_facts")
      .select("id, key, work_area_id, source")
      .eq("project_id", projectId);

    const existingByKey = new Map(
      (existingFacts ?? []).map((fact) => [
        factDedupeKey(fact.work_area_id, fact.key),
        fact,
      ])
    );

    const factsToInsert: typeof factRows = [];

    for (const row of factRows) {
      const dedupeKey = factDedupeKey(row.work_area_id, row.key);
      const existing = existingByKey.get(dedupeKey);

      if (existing?.source === "user") {
        continue;
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from("project_facts")
          .update({
            label: row.label,
            value: row.value,
            unit: row.unit,
            source: "ai_extracted",
            confidence: row.confidence,
          })
          .eq("id", existing.id)
          .eq("project_id", projectId);

        if (updateError) {
          return { error: updateError.message };
        }
        continue;
      }

      factsToInsert.push(row);
    }

    if (factsToInsert.length > 0) {
      const { error: factsError } = await supabase
        .from("project_facts")
        .insert(factsToInsert);

      if (factsError) {
        return { error: factsError.message };
      }
    }
  }

  const { error: stageError } = await supabase
    .from("projects")
    .update({ stage: "confirm_work_areas" })
    .eq("id", projectId);

  if (stageError) {
    return { error: stageError.message };
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

type ProjectFactRow = {
  key: string;
  work_area_id: string | null;
  value: unknown;
  source?: string | null;
};

async function persistDerivedFacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  projectId: string,
  workAreas: { id: string; type: string; status: string }[],
  projectFacts: ProjectFactRow[]
): Promise<ProjectFactRow[]> {
  const confirmed = workAreas.filter((workArea) => workArea.status === "confirmed");
  const derivedFacts = deriveFactsForProject({
    workAreas: confirmed.map((workArea) => ({
      id: workArea.id,
      type: workArea.type,
    })),
    projectFacts,
  });

  for (const derived of derivedFacts) {
    let factQuery = supabase
      .from("project_facts")
      .select("id, source")
      .eq("project_id", projectId)
      .eq("key", derived.key);

    if (derived.work_area_id) {
      factQuery = factQuery.eq("work_area_id", derived.work_area_id);
    } else {
      factQuery = factQuery.is("work_area_id", null);
    }

    const { data: existingFact } = await factQuery.maybeSingle();

    if (existingFact?.source === "user") {
      continue;
    }

    const factPayload = {
      label: derived.label,
      value: derived.value,
      unit: derived.unit,
      source: "derived" as const,
      confidence: 1,
    };

    if (existingFact) {
      await supabase
        .from("project_facts")
        .update(factPayload)
        .eq("id", existingFact.id)
        .eq("project_id", projectId);
    } else {
      await supabase.from("project_facts").insert({
        org_id: orgId,
        project_id: projectId,
        work_area_id: derived.work_area_id,
        key: derived.key,
        ...factPayload,
      });
    }
  }

  return mergeDerivedFactsIntoRecords(projectFacts, derivedFacts);
}

async function createDynamicQuestionBlockIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  projectId: string,
  qualityLevel: QualityLevel
): Promise<
  | { error: string }
  | { blockId: string | null; nextStage: "work_area_questions" | "constraints" }
> {
  const { data: existingBlocks } = await supabase
    .from("question_blocks")
    .select("id")
    .eq("project_id", projectId)
    .eq("stage", "work_area_questions")
    .in("status", ["active", "submitted"]);

  if (existingBlocks && existingBlocks.length > 0) {
    return { blockId: existingBlocks[0].id, nextStage: "work_area_questions" };
  }

  const [{ data: workAreas }, { data: projectFactsRaw }] = await Promise.all([
    supabase
      .from("work_areas")
      .select("id, type, name, status, sort_order")
      .eq("project_id", projectId)
      .eq("status", "confirmed")
      .order("sort_order"),
    supabase
      .from("project_facts")
      .select("key, work_area_id, value, source")
      .eq("project_id", projectId),
  ]);

  const projectFacts = await persistDerivedFacts(
    supabase,
    orgId,
    projectId,
    workAreas ?? [],
    projectFactsRaw ?? []
  );

  const built = buildQuestionBlockFromProjectState({
    project: { quality_level: qualityLevel },
    confirmedWorkAreas: workAreas ?? [],
    projectFacts,
  });

  if (built.questions.length === 0) {
    return { blockId: null, nextStage: "constraints" };
  }

  const { data: block, error: blockError } = await supabase
    .from("question_blocks")
    .insert({
      org_id: orgId,
      project_id: projectId,
      stage: "work_area_questions",
      title: built.title,
      description: built.description,
      status: "active",
      sort_order: 1,
    })
    .select("id")
    .single();

  if (blockError || !block) {
    return { error: blockError?.message ?? "Failed to create question block." };
  }

  const questionRows = built.questions.map((question) => ({
    org_id: orgId,
    project_id: projectId,
    question_block_id: block.id,
    work_area_id: question.workAreaId,
    key: question.key,
    label: question.label,
    question_text: question.questionText,
    input_type: question.inputType,
    options: question.options ?? null,
    required: question.required,
    unit: question.unit ?? null,
    sort_order: question.sortOrder,
    answer_value:
      question.initialAnswerValue === null ||
      question.initialAnswerValue === undefined ||
      question.initialAnswerValue === ""
        ? null
        : normalizeAnswerForStorage(
            question.initialAnswerValue,
            question.inputType
          ),
    answer_source: question.initialAnswerSource ?? null,
  }));

  const { error: questionsError } = await supabase
    .from("questions")
    .insert(questionRows);

  if (questionsError) {
    return { error: questionsError.message };
  }

  return { blockId: block.id, nextStage: "work_area_questions" };
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

  const blockResult = await createDynamicQuestionBlockIfNeeded(
    supabase,
    orgId,
    projectId,
    parsed.data
  );
  if ("error" in blockResult) {
    return { error: blockResult.error };
  }

  const nextStage = blockResult.nextStage;

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      quality_level: parsed.data,
      stage: nextStage,
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

  const { supabase, orgId, stage } = loaded;

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

  const { data: blockQuestions } = await supabase
    .from("questions")
    .select("id, key, label, unit, work_area_id, input_type")
    .eq("question_block_id", questionBlockId)
    .eq("project_id", projectId);

  const questionById = new Map(
    (blockQuestions ?? []).map((question) => [question.id, question])
  );

  for (const answer of parsed.data) {
    const question = questionById.get(answer.question_id);
    const storedValue = question
      ? normalizeAnswerForStorage(
          answer.value,
          question.input_type as "number" | "select" | "boolean" | "text"
        )
      : answer.value;

    const { error } = await supabase
      .from("questions")
      .update({
        answer_value: storedValue,
        answer_source: "user",
      })
      .eq("id", answer.question_id)
      .eq("question_block_id", questionBlockId)
      .eq("project_id", projectId);

    if (error) {
      return { error: error.message };
    }

    if (!question) {
      continue;
    }

    let factQuery = supabase
      .from("project_facts")
      .select("id")
      .eq("project_id", projectId)
      .eq("key", question.key);

    if (question.work_area_id) {
      factQuery = factQuery.eq("work_area_id", question.work_area_id);
    } else {
      factQuery = factQuery.is("work_area_id", null);
    }

    const { data: existingFact } = await factQuery.maybeSingle();

    const factPayload = {
      label: question.label,
      value: storedValue,
      unit: question.unit,
      source: "user" as const,
      confidence: 1,
    };

    if (existingFact) {
      const { error: factError } = await supabase
        .from("project_facts")
        .update(factPayload)
        .eq("id", existingFact.id)
        .eq("project_id", projectId);

      if (factError) {
        return { error: factError.message };
      }
    } else {
      const { error: factError } = await supabase.from("project_facts").insert({
        org_id: orgId,
        project_id: projectId,
        work_area_id: question.work_area_id,
        key: question.key,
        ...factPayload,
      });

      if (factError) {
        return { error: factError.message };
      }
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

  const { data: workAreas } = await supabase
    .from("work_areas")
    .select("id, type, status")
    .eq("project_id", projectId);

  const { data: projectFactsRaw } = await supabase
    .from("project_facts")
    .select("key, work_area_id, value, source")
    .eq("project_id", projectId);

  await persistDerivedFacts(
    supabase,
    orgId,
    projectId,
    workAreas ?? [],
    projectFactsRaw ?? []
  );

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

  const contextResult = await getEstimateContext(projectId);
  if ("error" in contextResult) {
    return { error: contextResult.error };
  }

  let estimateResult;
  try {
    estimateResult = calculateEstimate(contextResult);
  } catch (error) {
    if (error instanceof EstimateEngineError) {
      return { error: error.message };
    }
    return {
      error:
        error instanceof Error ? error.message : "Failed to generate estimate.",
    };
  }

  const estimatePayload = {
    org_id: orgId,
    project_id: projectId,
    status: "ready",
    cost_low: estimateResult.costLow,
    cost_high: estimateResult.costHigh,
    sell_low: estimateResult.sellLow,
    sell_high: estimateResult.sellHigh,
    recommended_cost: estimateResult.recommendedCost,
    recommended_sell: estimateResult.recommendedSell,
    gross_profit: estimateResult.grossProfit,
    margin_percent: estimateResult.marginPercent,
    markup_percent: estimateResult.markupPercent,
    confidence: estimateResult.confidence,
    rate_source_summary: estimateResult.rateSourceSummary,
    assumptions: estimateResult.assumptions,
    missing_info: estimateResult.missingInfo,
    exclusions: estimateResult.exclusions,
    generated_at: new Date().toISOString(),
  };

  const lineItemRows = estimateResult.lineItems.map((item) => ({
    org_id: orgId,
    project_id: projectId,
    work_area_id: item.workAreaId,
    work_area_name: item.workAreaName,
    label: item.label,
    category: item.category,
    cost_low: item.costLow,
    cost_high: item.costHigh,
    sell_low: item.sellLow,
    sell_high: item.sellHigh,
    recommended_cost: item.recommendedCost,
    recommended_sell: item.recommendedSell,
    gross_profit: item.grossProfit,
    margin_percent: item.marginPercent,
    markup_percent: item.markupPercent ?? null,
    rate_source: item.rateSource,
    notes: buildLineItemNotes(item),
    sort_order: item.sortOrder,
  }));

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

  const { error: lineItemsError } = await supabase
    .from("estimate_line_items")
    .insert(
      lineItemRows.map((row) => ({
        ...row,
        estimate_id: estimateId,
      }))
    );

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

/** Deterministic estimate engine entry point (Phase 5A). */
export const generateEstimate = generateStaticEstimate;
