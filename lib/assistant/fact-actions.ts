"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssistantStage } from "@/components/assistant/types";
import { scalarFactWorkAreaReuse } from "@/lib/assistant/assistant-mutation-result-reload";
import { completeAssistantMutation } from "@/lib/assistant/complete-assistant-mutation";
import { ASSISTANT_WORK_AREA_COLUMNS } from "@/lib/assistant/estimate-generation-result";
import { persistDerivedFactsForProject } from "@/lib/assistant/persist-derived-facts";
import { ensureMissingDetailsQuestionBlock } from "@/lib/assistant/missing-questions";
import { commitUserFactEdit } from "@/lib/assistant/scope-persistence";
import { getAuthOrgContext } from "@/lib/assistant/state";
import type { AssistantActionState } from "@/lib/assistant/types";
import { markEstimateStaleWithContext } from "@/lib/estimate/stale";
import { assertOrgOwnsActiveProjectWithStage } from "@/lib/security/org-ownership";
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
  wallTypeId: z.string().min(1).max(80).optional(),
  openingId: z.string().min(1).max(80).optional(),
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
  const { projectId, workAreaId, key, label, value, unit, valueType, wallTypeId, openingId } =
    parsed.data;

  const denied = await permissionDeniedError({
    orgId,
    userId: user.id,
    permission: "projects.edit",
    entitlement: "projects.create",
  });
  if (denied) return denied;

  const [ownedProject, workAreaLookup] = await Promise.all([
    assertOrgOwnsActiveProjectWithStage(context, projectId),
    workAreaId
      ? supabase
          .from("work_areas")
          .select("id")
          .eq("id", workAreaId)
          .eq("project_id", projectId)
          .maybeSingle()
      : Promise.resolve({ data: { id: "ok" } }),
  ]);
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
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
    wallTypeId,
    openingId,
  });

  if (!commit.ok) {
    return { error: commit.error };
  }

  const [workAreasResult, projectFactsResult] = await Promise.all([
    supabase
      .from("work_areas")
      .select(ASSISTANT_WORK_AREA_COLUMNS)
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("project_facts")
      .select("key, work_area_id, value, source, conflict_warning")
      .eq("project_id", projectId),
  ]);
  const workAreas = workAreasResult.data;
  const projectFactsRaw = projectFactsResult.data;

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
      stage: ownedProject.stage as AssistantStage,
      qualityLevel: ownedProject.quality_level,
      skipDerivedPersist: true,
    }
  );

  if (ensureResult.error) {
    return { error: ensureResult.error };
  }

  await markEstimateStaleWithContext(context, projectId);
  const mutation = await completeAssistantMutation(
    context,
    projectId,
    scalarFactWorkAreaReuse({
      key,
      workAreas,
      error: workAreasResult.error,
    })
  );
  revalidateProjectPath(projectId);
  return mutation;
}
