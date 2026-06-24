"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { persistDerivedFactsForProject } from "@/lib/assistant/persist-derived-facts";
import { ensureMissingDetailsQuestionBlock } from "@/lib/assistant/missing-questions";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import { markEstimateStale } from "@/lib/estimate/stale";
import { normalizeAnswerForStorage } from "@/lib/scopes/fact-values";

const updateFactSchema = z.object({
  projectId: z.string().uuid(),
  workAreaId: z.string().uuid().nullable(),
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  unit: z.string().optional(),
  valueType: z
    .enum(["number", "select", "boolean", "text", "multi_select"])
    .optional(),
});

function revalidateProjectPath(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
}

export async function updateProjectFact(
  input: z.infer<typeof updateFactSchema>
): Promise<AssistantActionState> {
  const parsed = updateFactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid fact update." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const { projectId, workAreaId, key, label, value, unit, valueType } =
    parsed.data;

  const { data: project } = await supabase
    .from("projects")
    .select("id, stage, quality_level")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return { error: "Project not found." };
  }

  if (workAreaId) {
    const { data: workArea } = await supabase
      .from("work_areas")
      .select("id")
      .eq("id", workAreaId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (!workArea) {
      return { error: "Work area not found." };
    }
  }

  const storedValue = valueType
    ? normalizeAnswerForStorage(value, valueType)
    : value;

  let factQuery = supabase
    .from("project_facts")
    .select("id, source")
    .eq("project_id", projectId)
    .eq("key", key);

  if (workAreaId) {
    factQuery = factQuery.eq("work_area_id", workAreaId);
  } else {
    factQuery = factQuery.is("work_area_id", null);
  }

  const { data: existingFact } = await factQuery.maybeSingle();

  if (existingFact?.source === "derived") {
    return { error: "Calculated values cannot be edited directly." };
  }

  const factPayload = {
    label,
    value: storedValue,
    unit: unit ?? null,
    source: "user" as const,
    confidence: 1,
  };

  if (existingFact) {
    const { error } = await supabase
      .from("project_facts")
      .update(factPayload)
      .eq("id", existingFact.id)
      .eq("project_id", projectId);

    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("project_facts").insert({
      org_id: orgId,
      project_id: projectId,
      work_area_id: workAreaId,
      key,
      ...factPayload,
    });

    if (error) {
      return { error: error.message };
    }
  }

  let questionQuery = supabase
    .from("questions")
    .select("id, input_type")
    .eq("project_id", projectId)
    .eq("key", key);

  if (workAreaId) {
    questionQuery = questionQuery.eq("work_area_id", workAreaId);
  }

  const { data: question } = await questionQuery.maybeSingle();

  if (question) {
    await supabase
      .from("questions")
      .update({
        answer_value: storedValue,
        answer_source: "user",
      })
      .eq("id", question.id)
      .eq("project_id", projectId);
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

  const ensureResult = await ensureMissingDetailsQuestionBlock(
    supabase,
    orgId,
    projectId,
    {
      stage: project.stage,
      qualityLevel: project.quality_level,
    }
  );

  if (ensureResult.error) {
    return { error: ensureResult.error };
  }

  await markEstimateStale(projectId);
  revalidateProjectPath(projectId);
  return { success: true };
}
