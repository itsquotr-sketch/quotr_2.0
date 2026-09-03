"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { completeAssistantMutation } from "@/lib/assistant/complete-assistant-mutation";
import { persistDerivedFactsForProject } from "@/lib/assistant/persist-derived-facts";
import { ensureMissingDetailsQuestionBlock } from "@/lib/assistant/missing-questions";
import { commitUserFactEdit } from "@/lib/assistant/scope-persistence";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import { markEstimateStaleWithContext } from "@/lib/estimate/stale";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import { permissionDeniedError } from "@/lib/team/permission-server";

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

  const { supabase, orgId, user } = context;
  const { projectId, workAreaId, key, label, value, unit, valueType } =
    parsed.data;

  const denied = await permissionDeniedError({
    orgId,
    userId: user.id,
    permission: "projects.edit",
    entitlement: "projects.create",
  });
  if (denied) return denied;

  const ownedProject = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
  }

  const [{ data: project }, workAreaLookup] = await Promise.all([
    supabase
      .from("projects")
      .select("id, stage, quality_level")
      .eq("id", projectId)
      .eq("org_id", orgId)
      .maybeSingle(),
    workAreaId
      ? supabase
          .from("work_areas")
          .select("id")
          .eq("id", workAreaId)
          .eq("project_id", projectId)
          .maybeSingle()
      : Promise.resolve({ data: { id: "ok" } }),
  ]);

  if (!project) {
    return { error: "Project not found." };
  }

  if (workAreaId && !workAreaLookup.data) {
    return { error: "Work area not found." };
  }

  // Stage 3.1D: Fact SoT commit, then question mirror.
  const commit = await commitUserFactEdit(supabase, {
    orgId,
    projectId,
    workAreaId,
    key,
    label,
    value,
    unit,
    valueType,
  });

  if (!commit.ok) {
    return { error: commit.error };
  }

  const [{ data: workAreas }, { data: projectFactsRaw }] = await Promise.all([
    supabase
      .from("work_areas")
      .select("id, type, status")
      .eq("project_id", projectId),
    supabase
      .from("project_facts")
      .select("key, work_area_id, value, source, conflict_warning")
      .eq("project_id", projectId),
  ]);

  const derivedPersist = await persistDerivedFactsForProject(
    supabase,
    orgId,
    projectId,
    workAreas ?? [],
    projectFactsRaw ?? []
  );

  if (derivedPersist.error) {
    return { error: derivedPersist.error };
  }

  const ensureResult = await ensureMissingDetailsQuestionBlock(
    supabase,
    orgId,
    projectId,
    {
      stage: project.stage,
      qualityLevel: project.quality_level,
      skipDerivedPersist: true,
    }
  );

  if (ensureResult.error) {
    return { error: ensureResult.error };
  }

  await markEstimateStaleWithContext(context, projectId);
  const mutation = await completeAssistantMutation(context, projectId);
  revalidateProjectPath(projectId);
  return mutation;
}
