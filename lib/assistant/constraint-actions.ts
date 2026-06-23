"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import { markEstimateStale } from "@/lib/estimate/stale";
import { normalizeAnswerForStorage } from "@/lib/scopes/fact-values";

const updateConstraintSchema = z.object({
  projectId: z.string().uuid(),
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  inputType: z.enum(["select", "boolean"]).optional(),
});

function revalidateAssistantPaths(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
}

export async function updateProjectConstraint(
  input: z.infer<typeof updateConstraintSchema>
): Promise<AssistantActionState> {
  const parsed = updateConstraintSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid constraint update." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const { projectId, key, label, value, inputType } = parsed.data;

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return { error: "Project not found." };
  }

  const storedValue = inputType
    ? normalizeAnswerForStorage(value, inputType)
    : value;

  const { data: existing } = await supabase
    .from("constraints")
    .select("id")
    .eq("project_id", projectId)
    .eq("key", key)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("constraints")
      .update({
        label,
        value: storedValue,
        source: "user",
      })
      .eq("id", existing.id)
      .eq("project_id", projectId);

    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("constraints").insert({
      org_id: orgId,
      project_id: projectId,
      key,
      label,
      value: storedValue,
      source: "user",
    });

    if (error) {
      return { error: error.message };
    }
  }

  await markEstimateStale(projectId);
  revalidateAssistantPaths(projectId);
  return { success: true };
}
