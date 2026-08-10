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
import { canRunStageAction } from "@/lib/assistant/state";
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
import { persistEstimateResult } from "@/lib/estimate/persist-estimate";
import { markEstimateStale } from "@/lib/estimate/stale";
import { getAnthropicModel } from "@/lib/ai/anthropic";
import { buildInitialAnalysisInput } from "@/lib/project-notes/build-analysis-source";
import { isInternalProjectNote } from "@/lib/project-notes/types";
import { USER_ERRORS } from "@/lib/errors/user-message";
import { createClient } from "@/lib/supabase/server";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import { getAnalysisCapableWorkAreaTypes } from "@/lib/scopes/capability";
import { persistDerivedFactsForProject } from "@/lib/assistant/persist-derived-facts";
import { ensureMissingDetailsQuestionBlock } from "@/lib/assistant/missing-questions";
import { filterPersistableAnswers } from "@/lib/assistant/answer-persistence";
import {
  commitUserAnswerToScope,
  upsertProjectConstraintRecord,
} from "@/lib/assistant/scope-persistence";
import { buildQuestionBlockFromProjectState } from "@/lib/scopes/questions";
import { normalizeAnswerForStorage, factHasValue } from "@/lib/scopes/fact-values";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import { isScopeDiscoveryEnabled } from "@/lib/scope-discovery/configuration";

const BRIEF_MAX_LENGTH = 5000;

const UNKNOWN_ANALYSIS_ERROR =
  "We couldn't analyse your job. Please try again.";
const NO_CAPTURE_ERROR =
  "Add a brief or at least one site note before analysing.";
const AI_SETUP_ERROR =
  "AI setup is missing. Check your Anthropic API key.";
const AI_PARSE_ERROR =
  "Quotr could not understand the analysis response. Please try again.";
const NO_WORK_AREAS_ERROR =
  "No supported work areas were detected. Try adding more detail about the job, or add a work area manually.";

function logBriefAnalysisFailure(
  projectId: string,
  context: {
    briefLength: number;
    noteCount: number;
    combinedInputLength: number;
    reason: string;
  }
) {
  console.error("[saveBriefAndSeedWorkAreas]", {
    projectId,
    briefLength: context.briefLength,
    noteCount: context.noteCount,
    combinedInputLength: context.combinedInputLength,
    model: getAnthropicModel(),
    reason: context.reason,
  });
}

function userMessageForAnalysisError(error: unknown): string {
  if (error instanceof AIExtractionError) {
    if (error.message.includes("No valid work areas")) {
      return NO_WORK_AREAS_ERROR;
    }
    if (
      error.message.includes("schema validation") ||
      error.message.includes("parse AI response")
    ) {
      return AI_PARSE_ERROR;
    }
    if (error.message.includes("No allowed work area types")) {
      return AI_SETUP_ERROR;
    }
  }

  if (error instanceof Error) {
    if (error.message.includes("ANTHROPIC_API_KEY")) {
      return AI_SETUP_ERROR;
    }
  }

  return UNKNOWN_ANALYSIS_ERROR;
}

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

/** Targeted revalidation for answer saves — avoid dashboard reload every edit. */
function revalidateProjectAssistantPath(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
}

function toSafeAssistantError(fallback: string): string {
  return fallback;
}

async function loadProjectStage(projectId: string) {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return {
      error:
        auth.code === "organisation_required"
          ? auth.error
          : ("Not authenticated." as const),
    };
  }

  const owned = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in owned) {
    return { error: "Project not found." as const };
  }

  const { supabase, orgId } = auth;

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, stage")
    .eq("id", projectId)
    .eq("org_id", orgId)
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

/**
 * Analyse Job capability types — full Quotr catalogue.
 * Company Setup preferences must not restrict extraction (3.1C.3-R2B).
 */
function loadAnalysisCapableWorkAreaTypes(): string[] {
  return getAnalysisCapableWorkAreaTypes();
}

export async function saveBriefAndSeedWorkAreas(
  projectId: string,
  briefText: string
): Promise<AssistantActionState> {
  const trimmed = briefText.trim();
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

  const { data: savedNoteRows, error: notesError } = await supabase
    .from("project_notes")
    .select("id, content, note_type, captured_at")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("captured_at", { ascending: true });

  if (notesError) {
    logBriefAnalysisFailure(projectId, {
      briefLength: trimmed.length,
      noteCount: 0,
      combinedInputLength: 0,
      reason: `notes query failed: ${notesError.message}`,
    });
    return { error: UNKNOWN_ANALYSIS_ERROR };
  }

  const noteRows = (savedNoteRows ?? []).filter(
    (note) => !isInternalProjectNote(note.note_type)
  );

  if (!trimmed && noteRows.length === 0) {
    return { error: NO_CAPTURE_ERROR };
  }

  const { error: briefError } = await supabase
    .from("projects")
    .update({ brief_text: trimmed || null })
    .eq("id", projectId);

  if (briefError) {
    return { error: briefError.message };
  }

  // Capability catalogue — not organisation_work_areas preferences.
  const allowedTypes = loadAnalysisCapableWorkAreaTypes();

  const analysisSource = buildInitialAnalysisInput({
    briefText: trimmed,
    notes: noteRows,
  });

  let extractionResult;
  try {
    extractionResult = await extractFromBrief({
      briefText: analysisSource,
      allowedTypes,
      catalogueTypes: CATALOGUE_TYPES,
    });
  } catch (error) {
    logBriefAnalysisFailure(projectId, {
      briefLength: trimmed.length,
      noteCount: noteRows.length,
      combinedInputLength: analysisSource.length,
      reason: error instanceof Error ? error.message : "AI extraction failed",
    });
    return { error: userMessageForAnalysisError(error) };
  }

  const extraction = extractionResult.output;

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
    .update({
      stage: "confirm_work_areas",
      ...(extractionResult.qualityLevel
        ? { quality_level: extractionResult.qualityLevel }
        : {}),
    })
    .eq("id", projectId);

  if (stageError) {
    return { error: stageError.message };
  }

  if (extractionResult.constraints.length > 0) {
    const { data: existingConstraints } = await supabase
      .from("constraints")
      .select("id, key, source")
      .eq("project_id", projectId);

    const existingByKey = new Map(
      (existingConstraints ?? []).map((row) => [row.key, row])
    );

    for (const constraint of extractionResult.constraints) {
      const existing = existingByKey.get(constraint.key);
      if (existing?.source === "user") {
        // User-confirmed constraints remain authoritative.
        continue;
      }
      if (existing) {
        await supabase
          .from("constraints")
          .update({
            label: constraint.label,
            value: constraint.value,
            source: "ai_extracted",
          })
          .eq("id", existing.id)
          .eq("project_id", projectId);
      } else {
        await supabase.from("constraints").insert({
          org_id: orgId,
          project_id: projectId,
          key: constraint.key,
          label: constraint.label,
          value: constraint.value,
          source: "ai_extracted",
        });
      }
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

  await markEstimateStale(projectId);

  // Stage 3.1B.7F-R5 — Acknowledge WA confirmation immediately.
  // Automatic Scope Review is owned by ScopeDiscoveryReviewBlock auto-run
  // after stage advances (preserves approved auto-analysis without blocking
  // Confirm on provider latency). Server no longer awaits runScopeDiscovery.
  revalidateProjectAssistantPath(projectId);
  return { success: true };
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

  const [{ data: workAreas }, { data: projectFactsRaw }, { data: constraintRows }] =
    await Promise.all([
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
      .from("project_constraints")
      .select("key, value")
      .eq("project_id", projectId),
  ]);

  const projectFacts = await persistDerivedFactsForProject(
    supabase,
    orgId,
    projectId,
    workAreas ?? [],
    projectFactsRaw ?? []
  );

  let excludedScopeItemTypes: ReadonlySet<string> | undefined;
  if (isScopeDiscoveryEnabled()) {
    const { loadExcludedScopeItemTypes } = await import(
      "@/lib/scope-discovery/application/load-scope-item-exclusions"
    );
    excludedScopeItemTypes = await loadExcludedScopeItemTypes(
      { supabase, orgId, userId: "" },
      projectId
    );
  }

  const built = buildQuestionBlockFromProjectState({
    project: {
      quality_level: qualityLevel,
      constraints: (constraintRows ?? []).map((row) => ({
        key: row.key,
        value: row.value,
      })),
    },
    confirmedWorkAreas: workAreas ?? [],
    projectFacts,
    excludedScopeItemTypes,
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

  if (isScopeDiscoveryEnabled()) {
    try {
      const auth = await requireAuthOrgContext();
      if (auth.ok) {
        const { getScopeDiscoveryResults } = await import(
          "@/lib/scope-discovery/application/get-results"
        );
        const { evaluateScopeReviewCompletion } = await import(
          "@/lib/scope-discovery/ui/scope-review-completion"
        );
        const results = await getScopeDiscoveryResults(
          { projectId },
          {
            ctx: {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.user.id,
            },
          }
        );
        if (results.ok) {
          const completion = evaluateScopeReviewCompletion(
            results.allSuggestions,
            { hasRun: Boolean(results.runId) }
          );
          if (!completion.complete) {
            return {
              error:
                "Confirm the scope items above before selecting the specification level.",
            };
          }
        } else {
          return {
            error:
              "Confirm the scope items above before selecting the specification level.",
          };
        }
      }
    } catch {
      return {
        error:
          "Confirm the scope items above before selecting the specification level.",
      };
    }
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

export async function updateProjectQualityLevel(
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

  const { supabase, stage } = loaded;

  if (!isStageAtOrBeyond(stage, "work_area_questions")) {
    return { error: "Quality can only be changed after the initial quality step." };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("quality_level")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    return { error: "Project not found." };
  }

  if (project.quality_level === parsed.data) {
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ quality_level: parsed.data })
    .eq("id", projectId);

  if (updateError) {
    return { error: updateError.message };
  }

  await markEstimateStale(projectId);
  revalidateAssistantPaths(projectId);
  return { success: true };
}

export async function saveQuestionBlockAnswers(
  projectId: string,
  questionBlockId: string,
  answers: QuestionAnswerInput[]
): Promise<AssistantActionState> {
  const ANSWER_SAVE_FAILED = "Could not save answers. Please try again.";

  const answerSchema = z.object({
    question_id: z.string().uuid(),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
    ]),
  });

  const filtered = filterPersistableAnswers(answers);
  const parsed = z.array(answerSchema).safeParse(filtered);
  if (!parsed.success) {
    return { error: "Invalid answers." };
  }

  if (parsed.data.length === 0) {
    return { success: true };
  }

  const loaded = await loadProjectStage(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, stage } = loaded;

  const { data: block } = await supabase
    .from("question_blocks")
    .select("id, status")
    .eq("id", questionBlockId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!block) {
    return { error: "Question block not found." };
  }

  const isAdditionalBlock =
    isStageAtOrBeyond(stage, "constraints") && block.status === "active";

  if (!isAdditionalBlock) {
    if (isStageAtOrBeyond(stage, "constraints")) {
      return { success: true };
    }

    if (!canRunStageAction(stage, "save_question_answers")) {
      return { error: "This action is not available at the current stage." };
    }
  }

  const { data: blockQuestions } = await supabase
    .from("questions")
    .select("id, key, label, unit, work_area_id, input_type")
    .eq("question_block_id", questionBlockId)
    .eq("project_id", projectId);

  const questionById = new Map(
    (blockQuestions ?? []).map((question) => [question.id, question])
  );

  const commits: Array<
    Promise<{ ok: true } | { ok: false; error: string }>
  > = [];

  for (const answer of parsed.data) {
    const question = questionById.get(answer.question_id);
    if (!question) {
      continue;
    }

    // Stage 3.1D: Fact SoT first, then question capture mirror.
    commits.push(
      commitUserAnswerToScope(supabase, {
        orgId,
        projectId,
        questionId: answer.question_id,
        questionBlockId,
        workAreaId: question.work_area_id,
        key: question.key,
        label: question.label,
        unit: question.unit,
        inputType: question.input_type as
          | "number"
          | "select"
          | "boolean"
          | "text"
          | "multi_select",
        value: answer.value,
      })
    );
  }

  const commitResults = await Promise.all(commits);
  if (commitResults.some((commit) => !commit.ok)) {
    return { error: toSafeAssistantError(ANSWER_SAVE_FAILED) };
  }

  if (block.status !== "submitted") {
    const { data: updatedQuestions } = await supabase
      .from("questions")
      .select("answer_value")
      .eq("question_block_id", questionBlockId)
      .eq("project_id", projectId);

    const allAnswered = (updatedQuestions ?? []).every((question) =>
      factHasValue(question.answer_value)
    );

    if (allAnswered || !isAdditionalBlock) {
      const { error: blockError } = await supabase
        .from("question_blocks")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", questionBlockId);

      if (blockError) {
        return { error: toSafeAssistantError(ANSWER_SAVE_FAILED) };
      }
    }
  }

  if (!isAdditionalBlock) {
    const { error: stageError } = await supabase
      .from("projects")
      .update({ stage: "constraints" })
      .eq("id", projectId);

    if (stageError) {
      return { error: toSafeAssistantError(ANSWER_SAVE_FAILED) };
    }
  }

  const { data: workAreas } = await supabase
    .from("work_areas")
    .select("id, type, status")
    .eq("project_id", projectId);

  const { data: projectFactsRaw } = await supabase
    .from("project_facts")
    .select("key, work_area_id, value, source")
    .eq("project_id", projectId);

  await persistDerivedFactsForProject(
    supabase,
    orgId,
    projectId,
    workAreas ?? [],
    projectFactsRaw ?? []
  );

  const ensureStage = isAdditionalBlock ? stage : "constraints";

  const ensureResult = await ensureMissingDetailsQuestionBlock(
    supabase,
    orgId,
    projectId,
    { stage: ensureStage, skipDerivedPersist: true }
  );

  if (ensureResult.error) {
    return { error: toSafeAssistantError(ANSWER_SAVE_FAILED) };
  }

  await markEstimateStale(projectId);
  revalidateProjectAssistantPath(projectId);
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

  for (const constraint of parsed.data) {
    const result = await upsertProjectConstraintRecord(supabase, {
      orgId,
      projectId,
      key: constraint.key,
      label: constraint.label,
      value: constraint.value,
      source: "user",
    });

    if (!result.ok) {
      return { error: result.error };
    }
  }

  const { error: stageError } = await supabase
    .from("projects")
    .update({ stage: "ready_to_estimate" })
    .eq("id", projectId);

  if (stageError) {
    return { error: stageError.message };
  }

  await markEstimateStale(projectId);
  revalidateAssistantPaths(projectId);
  return { success: true };
}

async function runEstimateGeneration(
  projectId: string,
  options: { allowRegenerate: boolean }
): Promise<AssistantActionState> {
  const loaded = await loadProjectStage(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, stage } = loaded;

  if (stage === "estimate_ready") {
    if (!options.allowRegenerate) {
      return { success: true };
    }
  } else if (!canRunStageAction(stage, "generate_estimate")) {
    return { error: "This action is not available at the current stage." };
  }

  const [{ data: existingEstimate }, contextResult] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, target_margin_percent")
      .eq("project_id", projectId)
      .maybeSingle(),
    getEstimateContext(projectId),
  ]);

  if ("error" in contextResult) {
    return { error: contextResult.error };
  }

  let estimateResult;
  try {
    estimateResult = calculateEstimate(contextResult);
  } catch (error) {
    if (error instanceof EstimateEngineError) {
      return { error: USER_ERRORS.estimateGenerateFailed };
    }
    return { error: USER_ERRORS.estimateGenerateFailed };
  }

  const targetMargin =
    existingEstimate?.target_margin_percent != null
      ? Number(existingEstimate.target_margin_percent)
      : null;

  if (targetMargin != null) {
    const { applyTargetMarginToLineItems, aggregateEstimateLineTotals } =
      await import("@/lib/estimate/margin-override");
    const adjustedItems = applyTargetMarginToLineItems(
      estimateResult.lineItems,
      targetMargin,
      contextResult.organisationSettings
    );
    const totals = aggregateEstimateLineTotals(adjustedItems);
    estimateResult = {
      ...estimateResult,
      lineItems: adjustedItems,
      recommendedCost: totals.recommendedCost,
      costLow: totals.costLow,
      costHigh: totals.costHigh,
      recommendedSell: totals.recommendedSell,
      sellLow: totals.sellLow,
      sellHigh: totals.sellHigh,
      grossProfit: totals.grossProfit,
      marginPercent: totals.marginPercent,
      markupPercent: totals.markupPercent,
    };
  }

  const persistResult = await persistEstimateResult(
    supabase,
    orgId,
    projectId,
    estimateResult
  );

  if ("error" in persistResult) {
    return { error: persistResult.error };
  }

  if (stage !== "estimate_ready") {
    const { error: stageError } = await supabase
      .from("projects")
      .update({ stage: "estimate_ready" })
      .eq("id", projectId);

    if (stageError) {
      return { error: stageError.message };
    }
  }

  revalidateProjectAssistantPath(projectId);
  return { success: true };
}

export async function generateStaticEstimate(
  projectId: string
): Promise<AssistantActionState> {
  return runEstimateGeneration(projectId, { allowRegenerate: false });
}

export async function regenerateStaticEstimate(
  projectId: string
): Promise<AssistantActionState> {
  const loaded = await loadProjectStage(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  if (loaded.stage !== "estimate_ready") {
    return { error: "Estimate can only be regenerated once a draft exists." };
  }

  return runEstimateGeneration(projectId, { allowRegenerate: true });
}

/** Deterministic estimate engine entry point (Phase 5A). */
export const generateEstimate = generateStaticEstimate;
