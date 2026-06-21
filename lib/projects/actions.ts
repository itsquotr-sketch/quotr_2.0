"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { projectDetailsSchema } from "@/lib/projects/schema";
import {
  applyProjectListFilter,
  hasLifecycleColumns,
  isMissingLifecycleColumnsError,
  markLifecycleColumnsUnavailable,
  PROJECT_SELECT,
  PROJECT_SELECT_BASE,
  withLifecycleDefaults,
} from "@/lib/projects/query-utils";
import type {
  Project,
  ProjectActionState,
  ProjectListFilter,
  ProjectListItem,
} from "@/lib/projects/types";

export async function listProjects(
  options?: {
    filter?: ProjectListFilter;
    search?: string;
  },
  retried = false
): Promise<ProjectListItem[]> {
  const context = await getAuthOrgContext();
  if (!context) {
    return [];
  }

  const filter = options?.filter ?? "active";
  const search = options?.search?.trim().toLowerCase() ?? "";
  const lifecycleAvailable = await hasLifecycleColumns(context.supabase);

  let query = context.supabase
    .from("projects")
    .select(lifecycleAvailable ? PROJECT_SELECT : PROJECT_SELECT_BASE)
    .order("created_at", { ascending: false });

  if (lifecycleAvailable) {
    query = query.is("deleted_at", null);

    if (filter === "active") {
      query = query.is("archived_at", null);
    } else if (filter === "archived") {
      query = query.not("archived_at", "is", null);
    }
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingLifecycleColumnsError(error) && !retried) {
      markLifecycleColumnsUnavailable();
      return listProjects(options, true);
    }

    console.error("[listProjects] query failed:", error.message);
    return [];
  }

  let projects = ((data ?? []) as unknown[]).map((row) =>
    withLifecycleDefaults(row as Record<string, unknown>)
  );

  if (!lifecycleAvailable) {
    projects = applyProjectListFilter(projects, filter, false);
  }

  if (search) {
    projects = projects.filter((project) => {
      const haystack = [
        project.title,
        project.client_name,
        project.site_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }

  if (projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((project) => project.id);
  const { data: estimates, error: estimatesError } = await context.supabase
    .from("estimates")
    .select("project_id, is_stale")
    .in("project_id", projectIds);

  if (estimatesError) {
    console.error("[listProjects] estimates query failed:", estimatesError.message);
  }

  const estimateByProject = new Map(
    (estimates ?? []).map((estimate) => [
      estimate.project_id,
      { is_stale: estimate.is_stale ?? false },
    ])
  );

  return projects.map((project) => {
    const estimate = estimateByProject.get(project.id);
    return {
      ...project,
      has_estimate: Boolean(estimate),
      estimate_is_stale: estimate?.is_stale ?? false,
    };
  });
}

export async function getProject(
  projectId: string,
  retried = false
): Promise<Project> {
  const context = await getAuthOrgContext();
  if (!context) {
    notFound();
  }

  const lifecycleAvailable = await hasLifecycleColumns(context.supabase);

  let query = context.supabase
    .from("projects")
    .select(lifecycleAvailable ? PROJECT_SELECT : PROJECT_SELECT_BASE)
    .eq("id", projectId);

  if (lifecycleAvailable) {
    query = query.is("deleted_at", null);
  }

  const { data: project, error } = await query.maybeSingle();

  if (error) {
    if (isMissingLifecycleColumnsError(error) && !retried) {
      markLifecycleColumnsUnavailable();
      return getProject(projectId, true);
    }

    console.error("[getProject] query failed:", error.message);
    notFound();
  }

  if (!project) {
    notFound();
  }

  const mapped = withLifecycleDefaults(project as unknown as Record<string, unknown>);

  if (lifecycleAvailable && mapped.deleted_at) {
    notFound();
  }

  return mapped;
}

export async function createProject(
  input: Parameters<typeof projectDetailsSchema.parse>[0]
): Promise<ProjectActionState> {
  const parsed = projectDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return {
      error:
        "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }

  const { supabase, user, orgId } = context;
  const {
    title,
    client_name,
    site_address,
    brief_text,
    priority,
    due_date,
    notes,
  } = parsed.data;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: orgId,
      created_by: user.id,
      title,
      client_name: client_name || null,
      site_address: site_address || null,
      brief_text: brief_text || null,
      priority,
      due_date: due_date || null,
      notes: notes || null,
      stage: "brief",
      quality_level: "unknown",
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !project) {
    console.error("[createProject] insert failed:", error?.message);
    return { error: error?.message ?? "Failed to create project." };
  }

  revalidatePath("/app/dashboard");
  redirect(`/app/projects/${project.id}`);
}

export async function updateProject(
  projectId: string,
  input: Parameters<typeof projectDetailsSchema.parse>[0]
): Promise<ProjectActionState> {
  const parsed = projectDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return {
      error:
        "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }

  const { supabase, orgId } = context;
  const lifecycleAvailable = await hasLifecycleColumns(supabase);
  const {
    title,
    client_name,
    site_address,
    brief_text,
    priority,
    due_date,
    notes,
  } = parsed.data;

  let query = supabase
    .from("projects")
    .update({
      title,
      client_name: client_name || null,
      site_address: site_address || null,
      brief_text: brief_text || null,
      priority,
      due_date: due_date || null,
      notes: notes || null,
    })
    .eq("id", projectId)
    .eq("org_id", orgId);

  if (lifecycleAvailable) {
    query = query.is("deleted_at", null);
  }

  const { error } = await query;

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app/dashboard");
  revalidatePath(`/app/projects/${projectId}`);

  return { success: true };
}
