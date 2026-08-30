"use server";

import { generateStaticEstimate, saveConstraints, saveQuality } from "@/lib/assistant/actions";
import { saveBuilderInterviewProjectAnswers } from "@/lib/assistant/builder-interview-actions";
import { writeJobPlanScopeDecision } from "@/lib/assistant/job-plan/actions";
import { updateProjectFact } from "@/lib/assistant/fact-actions";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import type { QualityLevel } from "@/components/assistant/types";
import type { JobPlanScopeWrite } from "@/lib/assistant/job-plan/types";
import { DEFAULT_ESTIMATE_QUALITY } from "@/lib/assistant/clarify/quality-gate";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import { revalidatePath } from "next/cache";

function revalidateProject(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
}

export async function answerClarifyFact(input: {
  projectId: string;
  workAreaId: string;
  write: JobPlanScopeWrite;
  presentation: "INCLUDED" | "NOT_INCLUDED";
}): Promise<AssistantActionState> {
  return writeJobPlanScopeDecision({
    projectId: input.projectId,
    workAreaId: input.workAreaId,
    write: input.write,
    presentation: input.presentation,
  });
}

export async function answerClarifySelectFact(input: {
  projectId: string;
  workAreaId: string | null;
  key: string;
  label: string;
  value: string | number | boolean;
  valueType: "number" | "select" | "boolean";
}): Promise<AssistantActionState> {
  return updateProjectFact({
    projectId: input.projectId,
    workAreaId: input.workAreaId,
    key: input.key,
    label: input.label,
    value: input.value,
    valueType: input.valueType,
  });
}

export async function answerClarifyConstraint(input: {
  projectId: string;
  questionKey: string;
  value: string | number | boolean;
}): Promise<AssistantActionState> {
  const result = await saveBuilderInterviewProjectAnswers({
    projectId: input.projectId,
    answers: [
      {
        questionKey: input.questionKey,
        kind: "answer",
        value: input.value,
      },
    ],
  });
  if (result.error) return { error: result.error };
  return {
    success: true,
    assistantMutation: result.assistantMutation,
    recoveryRefresh: result.recoveryRefresh,
  };
}

async function submitOpenQuestionBlock(
  projectId: string
): Promise<AssistantActionState> {
  const context = await getAuthOrgContext();
  if (!context) return { error: "Not authenticated." };
  const owned = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in owned) return { error: owned.error };

  const { supabase, orgId } = context;
  const { data: project } = await supabase
    .from("projects")
    .select("stage")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!project) return { error: "Project not found." };
  if (project.stage !== "work_area_questions") return { success: true };

  const { data: block } = await supabase
    .from("question_blocks")
    .select("id")
    .eq("project_id", projectId)
    .eq("stage", "work_area_questions")
    .eq("status", "active")
    .maybeSingle();

  if (block) {
    const { error } = await supabase
      .from("question_blocks")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", block.id)
      .eq("project_id", projectId);
    if (error) return { error: "Could not continue." };
  }

  const { error: stageError } = await supabase
    .from("projects")
    .update({ stage: "constraints" })
    .eq("id", projectId);
  if (stageError) return { error: "Could not continue." };
  revalidateProject(projectId);
  return { success: true };
}

/**
 * Advance internal quality / questions / constraints without showing those
 * panels. Does not write false Facts for skipped assumable items.
 */
export async function completeClarifyPlanning(input: {
  projectId: string;
  qualityLevel?: QualityLevel | null;
  generate?: boolean;
}): Promise<AssistantActionState> {
  const context = await getAuthOrgContext();
  if (!context) return { error: "Not authenticated." };
  const owned = await assertOrgOwnsActiveProject(context, input.projectId);
  if ("error" in owned) return { error: owned.error };

  const { supabase, orgId } = context;
  const { data: project } = await supabase
    .from("projects")
    .select("stage, quality_level")
    .eq("id", input.projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!project) return { error: "Project not found." };

  let stage = project.stage as
    | "quality"
    | "work_area_questions"
    | "constraints"
    | "ready_to_estimate"
    | "estimate_ready"
    | "brief"
    | "confirm_work_areas";

  if (stage === "quality") {
    const level =
      input.qualityLevel && input.qualityLevel !== "unknown"
        ? input.qualityLevel
        : project.quality_level && project.quality_level !== "unknown"
          ? (project.quality_level as QualityLevel)
          : DEFAULT_ESTIMATE_QUALITY;
    const saved = await saveQuality(input.projectId, level);
    if (saved.error) return saved;
  } else if (
    (!project.quality_level || project.quality_level === "unknown") &&
    (stage === "work_area_questions" ||
      stage === "constraints" ||
      stage === "ready_to_estimate")
  ) {
    const { error: qualityError } = await supabase
      .from("projects")
      .update({ quality_level: DEFAULT_ESTIMATE_QUALITY })
      .eq("id", input.projectId)
      .eq("org_id", orgId);
    if (qualityError) return { error: qualityError.message };
  }

  const { data: afterQuality } = await supabase
    .from("projects")
    .select("stage")
    .eq("id", input.projectId)
    .maybeSingle();
  stage = (afterQuality?.stage ?? stage) as typeof stage;

  if (stage === "work_area_questions") {
    const submitted = await submitOpenQuestionBlock(input.projectId);
    if (submitted.error) return submitted;
  }

  const { data: afterQuestions } = await supabase
    .from("projects")
    .select("stage")
    .eq("id", input.projectId)
    .maybeSingle();
  stage = (afterQuestions?.stage ?? stage) as typeof stage;

  if (stage === "constraints") {
    const saved = await saveConstraints(input.projectId, []);
    if (saved.error) return saved;
  }

  if (input.generate) {
    return generateStaticEstimate(input.projectId);
  }

  revalidateProject(input.projectId);
  return { success: true };
}
