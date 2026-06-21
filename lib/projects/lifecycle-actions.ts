"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAuthOrgContext } from "@/lib/assistant/state";
import {
  isMissingLifecycleColumnsError,
  isMissingBusinessStatusColumnsError,
  mapLifecycleActionError,
  markLifecycleColumnsUnavailable,
} from "@/lib/projects/query-utils";
import type { ProjectActionState } from "@/lib/projects/types";

async function loadOwnedProject(projectId: string) {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." as const };
  }

  const { data: project, error } = await context.supabase
    .from("projects")
    .select("id, title, archived_at, deleted_at")
    .eq("id", projectId)
    .eq("org_id", context.orgId)
    .maybeSingle();

  if (error) {
    if (isMissingLifecycleColumnsError(error)) {
      markLifecycleColumnsUnavailable();
      return { error: mapLifecycleActionError(error) };
    }
    console.error("[loadOwnedProject]", error.message);
    return { error: "Project not found." as const };
  }

  if (!project) {
    return { error: "Project not found." as const };
  }

  if (project.deleted_at) {
    return { error: "Project not found." as const };
  }

  return { ...context, project };
}

function revalidateProjectPaths(projectId: string) {
  revalidatePath("/app/dashboard");
  revalidatePath(`/app/projects/${projectId}`);
}

export async function archiveProject(
  projectId: string
): Promise<ProjectActionState> {
  const loaded = await loadOwnedProject(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, project } = loaded;

  if (project.archived_at) {
    return { success: true };
  }

  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("org_id", loaded.orgId);

  if (error) {
    if (isMissingLifecycleColumnsError(error)) {
      markLifecycleColumnsUnavailable();
    }
    return { error: mapLifecycleActionError(error) };
  }

  revalidateProjectPaths(projectId);
  return { success: true };
}

export async function restoreProject(
  projectId: string
): Promise<ProjectActionState> {
  const loaded = await loadOwnedProject(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase } = loaded;

  const { error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", projectId)
    .eq("org_id", loaded.orgId);

  if (error) {
    if (isMissingLifecycleColumnsError(error)) {
      markLifecycleColumnsUnavailable();
    }
    return { error: mapLifecycleActionError(error) };
  }

  revalidateProjectPaths(projectId);
  return { success: true };
}

export async function deleteProject(
  projectId: string,
  options?: { redirectToDashboard?: boolean }
): Promise<ProjectActionState> {
  const loaded = await loadOwnedProject(projectId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase } = loaded;

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("org_id", loaded.orgId);

  if (error) {
    if (isMissingLifecycleColumnsError(error)) {
      markLifecycleColumnsUnavailable();
    }
    return { error: mapLifecycleActionError(error) };
  }

  revalidatePath("/app/dashboard");

  if (options?.redirectToDashboard) {
    redirect("/app/dashboard");
  }

  return { success: true };
}

export async function duplicateProject(projectId: string): Promise<never> {
  const context = await getAuthOrgContext();
  if (!context) {
    notFound();
  }

  const { supabase, user, orgId } = context;

  const { data: source, error: sourceError } = await supabase
    .from("projects")
    .select(
      "id, title, brief_text, client_name, site_address, priority, due_date, notes, quality_level, status, deleted_at"
    )
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (sourceError) {
    if (isMissingLifecycleColumnsError(sourceError)) {
      throw new Error(mapLifecycleActionError(sourceError));
    }
    notFound();
  }

  if (!source || source.deleted_at) {
    notFound();
  }

  const insertPayload = {
    org_id: orgId,
    created_by: user.id,
    title: `${source.title} Copy`,
    brief_text: source.brief_text,
    client_name: source.client_name,
    site_address: null,
    priority: source.priority,
    due_date: source.due_date,
    notes: source.notes,
    quality_level: source.quality_level,
    status: source.status === "archived" ? "draft" : source.status,
    stage: "confirm_work_areas" as const,
    duplicated_from_project_id: source.id,
    business_status: "lead" as const,
  };

  let { data: newProject, error: insertError } = await supabase
    .from("projects")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError && isMissingBusinessStatusColumnsError(insertError)) {
    const fallbackPayload = { ...insertPayload };
    delete (fallbackPayload as { business_status?: string }).business_status;
    ({ data: newProject, error: insertError } = await supabase
      .from("projects")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (insertError || !newProject) {
    if (insertError && isMissingLifecycleColumnsError(insertError)) {
      throw new Error(mapLifecycleActionError(insertError));
    }
    throw new Error(insertError?.message ?? "Failed to duplicate project.");
  }

  const newProjectId = newProject.id;
  const workAreaIdMap = new Map<string, string>();

  const { data: workAreas } = await supabase
    .from("work_areas")
    .select(
      "id, type, name, status, ai_confidence, summary, sort_order"
    )
    .eq("project_id", projectId)
    .order("sort_order");

  if (workAreas && workAreas.length > 0) {
    const workAreaRows = workAreas.map((workArea) => ({
      org_id: orgId,
      project_id: newProjectId,
      type: workArea.type,
      name: workArea.name,
      status: workArea.status,
      ai_confidence: workArea.ai_confidence,
      summary: workArea.summary,
      sort_order: workArea.sort_order,
    }));

    const { data: insertedWorkAreas, error: workAreaError } = await supabase
      .from("work_areas")
      .insert(workAreaRows)
      .select("id, type, sort_order");

    if (workAreaError || !insertedWorkAreas) {
      throw new Error(workAreaError?.message ?? "Failed to copy work areas.");
    }

    for (const workArea of workAreas) {
      const match = insertedWorkAreas.find(
        (inserted) =>
          inserted.type === workArea.type &&
          inserted.sort_order === workArea.sort_order
      );
      if (match) {
        workAreaIdMap.set(workArea.id, match.id);
      }
    }
  }

  const { data: facts } = await supabase
    .from("project_facts")
    .select("work_area_id, key, label, value, unit, source, confidence")
    .eq("project_id", projectId);

  if (facts && facts.length > 0) {
    const factRows = facts
      .map((fact) => {
        const mappedWorkAreaId = fact.work_area_id
          ? workAreaIdMap.get(fact.work_area_id)
          : null;

        if (fact.work_area_id && !mappedWorkAreaId) {
          return null;
        }

        return {
          org_id: orgId,
          project_id: newProjectId,
          work_area_id: mappedWorkAreaId,
          key: fact.key,
          label: fact.label,
          value: fact.value,
          unit: fact.unit,
          source: fact.source,
          confidence: fact.confidence,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (factRows.length > 0) {
      const { error: factsError } = await supabase
        .from("project_facts")
        .insert(factRows);

      if (factsError) {
        throw new Error(factsError.message);
      }
    }
  }

  const { data: constraints } = await supabase
    .from("constraints")
    .select("key, label, value")
    .eq("project_id", projectId);

  if (constraints && constraints.length > 0) {
    const { error: constraintsError } = await supabase.from("constraints").insert(
      constraints.map((constraint) => ({
        org_id: orgId,
        project_id: newProjectId,
        key: constraint.key,
        label: constraint.label,
        value: constraint.value,
      }))
    );

    if (constraintsError) {
      throw new Error(constraintsError.message);
    }
  }

  revalidatePath("/app/dashboard");
  redirect(`/app/projects/${newProjectId}`);
}
