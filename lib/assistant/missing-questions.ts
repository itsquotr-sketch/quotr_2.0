import { persistDerivedFactsForProject } from "@/lib/assistant/persist-derived-facts";
import { isStageAtOrBeyond } from "@/lib/assistant/stage";
import type { AssistantStage } from "@/components/assistant/types";
import {
  buildMissingRequiredQuestionsForWorkAreas,
  MISSING_DETAILS_BLOCK_DESCRIPTION,
  MISSING_DETAILS_BLOCK_TITLE,
  type BuiltQuestion,
} from "@/lib/scopes/questions";
import { normalizeAnswerForStorage } from "@/lib/scopes/fact-values";

type SupabaseClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

function mapExistingQuestions(
  rows: {
    work_area_id: string | null;
    key: string;
    answer_value: unknown;
    question_block_id: string;
  }[],
  blockStatusById: Map<string, string>
) {
  return rows.map((row) => ({
    workAreaId: row.work_area_id,
    key: row.key,
    answerValue: row.answer_value,
    blockStatus: blockStatusById.get(row.question_block_id),
  }));
}

async function insertQuestionsIntoBlock(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  blockId: string,
  questions: BuiltQuestion[],
  startSortOrder: number
) {
  const questionRows = questions.map((question, index) => ({
    org_id: orgId,
    project_id: projectId,
    question_block_id: blockId,
    work_area_id: question.workAreaId,
    key: question.key,
    label: question.label,
    question_text: question.questionText,
    input_type: question.inputType,
    options: question.options ?? null,
    required: question.required,
    unit: question.unit ?? null,
    sort_order: startSortOrder + index + 1,
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

  const { error } = await supabase.from("questions").insert(questionRows);
  return error?.message;
}

export async function ensureMissingDetailsQuestionBlock(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  options?: {
    stage?: AssistantStage;
    qualityLevel?: string | null;
  }
): Promise<{ error?: string; created?: boolean }> {
  const stage = options?.stage;
  if (stage && !isStageAtOrBeyond(stage, "constraints")) {
    return {};
  }

  const [
    { data: workAreas },
    { data: projectFactsRaw },
    { data: questionRows },
    { data: workAreaQuestionBlocks },
  ] = await Promise.all([
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
    supabase
      .from("questions")
      .select("work_area_id, key, answer_value, question_block_id")
      .eq("project_id", projectId),
    supabase
      .from("question_blocks")
      .select("id, status, stage")
      .eq("project_id", projectId)
      .eq("stage", "work_area_questions"),
  ]);

  const blockStatusById = new Map(
    (workAreaQuestionBlocks ?? []).map((block) => [block.id, block.status])
  );

  const scopedQuestionRows = (questionRows ?? []).filter((row) =>
    blockStatusById.has(row.question_block_id)
  );

  const confirmedWorkAreas = workAreas ?? [];
  if (confirmedWorkAreas.length === 0) {
    return {};
  }

  const projectFacts = await persistDerivedFactsForProject(
    supabase,
    orgId,
    projectId,
    confirmedWorkAreas,
    projectFactsRaw ?? []
  );

  let qualityLevel = options?.qualityLevel ?? null;
  if (qualityLevel === undefined) {
    const { data: project } = await supabase
      .from("projects")
      .select("quality_level")
      .eq("id", projectId)
      .maybeSingle();
    qualityLevel = project?.quality_level ?? null;
  }

  const existingQuestions = mapExistingQuestions(
    scopedQuestionRows,
    blockStatusById
  );
  const missingQuestions = buildMissingRequiredQuestionsForWorkAreas({
    project: { quality_level: qualityLevel },
    confirmedWorkAreas,
    projectFacts,
    existingQuestions,
    includeOptional: true,
  });

  if (missingQuestions.length === 0) {
    return {};
  }

  const { data: existingBlock } = await supabase
    .from("question_blocks")
    .select("id")
    .eq("project_id", projectId)
    .eq("stage", "work_area_questions")
    .eq("status", "active")
    .eq("title", MISSING_DETAILS_BLOCK_TITLE)
    .maybeSingle();

  if (existingBlock) {
    const { data: blockQuestions } = await supabase
      .from("questions")
      .select("work_area_id, key, sort_order")
      .eq("question_block_id", existingBlock.id)
      .eq("project_id", projectId);

    const existingKeys = new Set(
      (blockQuestions ?? []).map(
        (question) => `${question.work_area_id}:${question.key}`
      )
    );
    const toAdd = missingQuestions.filter(
      (question) => !existingKeys.has(`${question.workAreaId}:${question.key}`)
    );

    if (toAdd.length === 0) {
      return {};
    }

    const maxSortOrder = Math.max(
      0,
      ...(blockQuestions ?? []).map((question) => question.sort_order ?? 0)
    );
    const error = await insertQuestionsIntoBlock(
      supabase,
      orgId,
      projectId,
      existingBlock.id,
      toAdd,
      maxSortOrder
    );
    return error ? { error } : { created: true };
  }

  const { data: questionBlocks } = await supabase
    .from("question_blocks")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextBlockSortOrder = (questionBlocks?.[0]?.sort_order ?? 0) + 1;

  const { data: block, error: blockError } = await supabase
    .from("question_blocks")
    .insert({
      org_id: orgId,
      project_id: projectId,
      stage: "work_area_questions",
      title: MISSING_DETAILS_BLOCK_TITLE,
      description: MISSING_DETAILS_BLOCK_DESCRIPTION,
      status: "active",
      sort_order: nextBlockSortOrder,
    })
    .select("id")
    .single();

  if (blockError || !block) {
    return {
      error: blockError?.message ?? "Failed to create missing details block.",
    };
  }

  const error = await insertQuestionsIntoBlock(
    supabase,
    orgId,
    projectId,
    block.id,
    missingQuestions,
    0
  );

  return error ? { error } : { created: true };
}
