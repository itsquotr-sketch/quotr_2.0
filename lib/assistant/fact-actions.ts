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
import { runInsideAuthScope } from "@/lib/security/auth-org-context";
import type { AssistantActionState } from "@/lib/assistant/types";
import { markEstimateStaleWithContext } from "@/lib/estimate/stale";
import { runSaveTrace, traceOp, traceSync } from "@/lib/perf/confirm-trace";
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
  nestedItemId: z.string().min(1).max(80).optional(),
  componentId: z.string().min(1).max(80).optional(),
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

  const { projectId } = parsed.data;
  return runInsideAuthScope(() => runSaveTrace(projectId, async () => {
  const context = await traceOp("auth", () => getAuthOrgContext());
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId, user } = context;
  const { workAreaId, key, label, value, unit, valueType, wallTypeId, openingId, nestedItemId, componentId } =
    parsed.data;

  const denied = await traceOp("permission", () =>
    permissionDeniedError({
      orgId,
      userId: user.id,
      permission: "projects.edit",
      entitlement: "projects.create",
    })
  );
  if (denied) return denied;

  const [ownedProject, workAreaLookup] = await traceOp("ownership", () =>
    Promise.all([
      assertOrgOwnsActiveProjectWithStage(context, projectId),
      workAreaId
        ? supabase
            .from("work_areas")
            .select("id")
            .eq("id", workAreaId)
            .eq("project_id", projectId)
            .maybeSingle()
        : Promise.resolve({ data: { id: "ok" } }),
    ])
  );
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
  }

  if (workAreaId && !workAreaLookup.data) {
    return { error: "Work area not found." };
  }

  // Stage 3.1D: Fact SoT commit, then question mirror.
  const commit = await traceOp("write", () =>
    commitUserFactEdit(supabase, {
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
      nestedItemId,
      componentId,
    })
  );

  if (!commit.ok) {
    return { error: commit.error };
  }

  const [workAreasResult, projectFactsResult] = await traceOp("postRead", () =>
    Promise.all([
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
    ])
  );
  const workAreas = workAreasResult.data;
  const projectFactsRaw = projectFactsResult.data;

  const derivedPersist = await traceOp("derived", () =>
    persistDerivedFactsForProject(
      supabase,
      orgId,
      projectId,
      workAreas ?? [],
      projectFactsRaw ?? []
    )
  );

  if (derivedPersist.error) {
    return { error: derivedPersist.error };
  }

  const ensureResult = await traceOp("readiness", () =>
    ensureMissingDetailsQuestionBlock(
      supabase,
      orgId,
      projectId,
      {
        stage: ownedProject.stage as AssistantStage,
        qualityLevel: ownedProject.quality_level,
        skipDerivedPersist: true,
      }
    )
  );

  if (ensureResult.error) {
    return { error: ensureResult.error };
  }

  await traceOp("stale", () => markEstimateStaleWithContext(context, projectId));
  const mutation = await traceOp("reload", () =>
    completeAssistantMutation(
      context,
      projectId,
      scalarFactWorkAreaReuse({
        key,
        workAreas,
        error: workAreasResult.error,
      })
    )
  );
  traceSync("revalidate", () => {
    revalidateProjectPath(projectId);
  });
  return mutation;
  }));
}

const updateFactsSchema = z.object({
  projectId: z.string().uuid(),
  workAreaId: z.string().uuid(),
  facts: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        value: z.union([z.string(), z.number(), z.boolean()]),
        valueType: z.enum(["number", "select", "text", "boolean"]).optional(),
      })
    )
    .min(1)
    .max(16),
});

/** One request for a group of Deck answers, then one stale mark. */
export async function updateProjectFacts(
  input: z.infer<typeof updateFactsSchema>
): Promise<AssistantActionState> {
  const parsed = updateFactsSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid fact update." };

  return runInsideAuthScope(async () => {
  const context = await getAuthOrgContext();
  if (!context) return { error: "Not authenticated." };

  const { supabase, orgId, user } = context;
  const { projectId, workAreaId, facts } = parsed.data;
  const denied = await permissionDeniedError({
    orgId,
    userId: user.id,
    permission: "projects.edit",
    entitlement: "projects.create",
  });
  if (denied) return denied;

  const ownedProject = await assertOrgOwnsActiveProjectWithStage(context, projectId);
  if ("error" in ownedProject) return { error: ownedProject.error };
  const workAreaLookup = await supabase
    .from("work_areas")
    .select("id")
    .eq("id", workAreaId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!workAreaLookup.data) return { error: "Work area not found." };

  for (const fact of facts) {
    const commit = await commitUserFactEdit(supabase, {
      orgId,
      projectId,
      workAreaId,
      key: fact.key,
      label: fact.label,
      value: fact.value,
      valueType: fact.valueType,
    });
    if (!commit.ok) return { error: commit.error };
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
  const derivedPersist = await persistDerivedFactsForProject(
    supabase,
    orgId,
    projectId,
    workAreasResult.data ?? [],
    projectFactsResult.data ?? []
  );
  if (derivedPersist.error) return { error: derivedPersist.error };

  const ensureResult = await ensureMissingDetailsQuestionBlock(supabase, orgId, projectId, {
    stage: ownedProject.stage as AssistantStage,
    qualityLevel: ownedProject.quality_level,
    skipDerivedPersist: true,
  });
  if (ensureResult.error) return { error: ensureResult.error };

  await markEstimateStaleWithContext(context, projectId);
  const mutation = await completeAssistantMutation(
    context,
    projectId,
    scalarFactWorkAreaReuse({
      key: facts[0]?.key ?? "deck.hole_shape",
      workAreas: workAreasResult.data,
      error: workAreasResult.error,
    })
  );
  revalidateProjectPath(projectId);
  return mutation;
  });
}
