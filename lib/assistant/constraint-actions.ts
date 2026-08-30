"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { upsertProjectConstraintRecord } from "@/lib/assistant/scope-persistence";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import { markEstimateStaleWithContext } from "@/lib/estimate/stale";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
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

  const ownedProject = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!project) {
    return { error: "Project not found." };
  }

  const storedValue = inputType
    ? normalizeAnswerForStorage(value, inputType)
    : value;

  // Stage 3.1D: constraints own project-level keys; reject scoped fact keys.
  const result = await upsertProjectConstraintRecord(supabase, {
    orgId,
    projectId,
    key,
    label,
    value: storedValue,
    source: "user",
  });

  if (!result.ok) {
    return { error: result.error };
  }

  await markEstimateStaleWithContext(context, projectId);
  revalidateAssistantPaths(projectId);
  return { success: true };
}
