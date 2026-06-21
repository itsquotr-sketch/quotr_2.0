"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureMissingDetailsQuestionBlock } from "@/lib/assistant/missing-questions";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import { markEstimateStale } from "@/lib/estimate/stale";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";

const CATALOGUE_BY_TYPE = new Map(
  SCOPE_CATALOGUE.map((item) => [item.type, item])
);

function revalidateAssistantPaths(projectId: string) {
  revalidatePath("/app/dashboard");
  revalidatePath(`/app/projects/${projectId}`);
}

export async function addWorkAreaToProject(input: {
  projectId: string;
  workAreaType: string;
}): Promise<AssistantActionState> {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      workAreaType: z.string().min(1),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { error: "Invalid work area request." };
  }

  const catalogueItem = CATALOGUE_BY_TYPE.get(parsed.data.workAreaType);
  if (!catalogueItem) {
    return { error: "That work area type is not supported." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const { projectId, workAreaType } = parsed.data;

  const { data: project } = await supabase
    .from("projects")
    .select("id, quality_level, stage")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return { error: "Project not found." };
  }

  const { data: existingAreas } = await supabase
    .from("work_areas")
    .select("id, type, name, status, sort_order")
    .eq("project_id", projectId)
    .eq("type", workAreaType);

  const confirmedDuplicate = (existingAreas ?? []).find(
    (area) => area.status === "confirmed"
  );
  if (confirmedDuplicate) {
    return {
      error: `${catalogueItem.label} is already included in this project.`,
    };
  }

  let workArea = (existingAreas ?? []).find(
    (area) => area.status === "excluded" || area.status === "suggested"
  );

  if (workArea) {
    const { error } = await supabase
      .from("work_areas")
      .update({
        status: "confirmed",
        name: catalogueItem.label,
        summary: catalogueItem.description,
      })
      .eq("id", workArea.id)
      .eq("project_id", projectId);

    if (error) {
      return { error: error.message };
    }

    workArea = {
      ...workArea,
      status: "confirmed",
      name: catalogueItem.label,
    };
  } else {
    const { data: allAreas } = await supabase
      .from("work_areas")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = (allAreas?.[0]?.sort_order ?? 0) + 1;

    const { data: inserted, error } = await supabase
      .from("work_areas")
      .insert({
        org_id: orgId,
        project_id: projectId,
        type: workAreaType,
        name: catalogueItem.label,
        status: "confirmed",
        ai_confidence: null,
        summary: catalogueItem.description,
        sort_order: nextSortOrder,
      })
      .select("id, type, name, status, sort_order")
      .single();

    if (error || !inserted) {
      return { error: error?.message ?? "Failed to add work area." };
    }

    workArea = inserted;
  }

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
  revalidateAssistantPaths(projectId);
  return { success: true };
}

export async function excludeWorkAreaFromProject(input: {
  projectId: string;
  workAreaId: string;
}): Promise<AssistantActionState> {
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      workAreaId: z.string().uuid(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { error: "Invalid work area request." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const { projectId, workAreaId } = parsed.data;

  const { data: workArea } = await supabase
    .from("work_areas")
    .select("id, status, name")
    .eq("id", workAreaId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!workArea) {
    return { error: "Work area not found." };
  }

  if (workArea.status === "excluded") {
    return { success: true };
  }

  const { data: confirmedCount } = await supabase
    .from("work_areas")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "confirmed");

  if ((confirmedCount ?? []).length <= 1 && workArea.status === "confirmed") {
    return { error: "At least one work area must remain in the estimate." };
  }

  const { error } = await supabase
    .from("work_areas")
    .update({ status: "excluded" })
    .eq("id", workAreaId)
    .eq("project_id", projectId);

  if (error) {
    return { error: error.message };
  }

  await markEstimateStale(projectId);

  const { data: project } = await supabase
    .from("projects")
    .select("stage, quality_level")
    .eq("id", projectId)
    .maybeSingle();

  if (project) {
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
  }

  revalidateAssistantPaths(projectId);
  return { success: true };
}
