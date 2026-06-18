"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { projectDetailsSchema } from "@/lib/projects/schema";
import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectActionState } from "@/lib/projects/types";

const PROJECT_SELECT =
  "id, title, brief_text, client_name, site_address, priority, due_date, notes, stage, quality_level, status, created_at";

async function getAuthOrgContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return null;
  }

  return { supabase, user, orgId: profile.org_id };
}

export async function listProjects(): Promise<Project[]> {
  const context = await getAuthOrgContext();
  if (!context) {
    return [];
  }

  const { data, error } = await context.supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as Project[];
}

export async function getProject(projectId: string): Promise<Project> {
  const context = await getAuthOrgContext();
  if (!context) {
    notFound();
  }

  const { data: project, error } = await context.supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project) {
    notFound();
  }

  return project as Project;
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
    return { error: error?.message ?? "Failed to create project." };
  }

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

  const { supabase } = context;
  const {
    title,
    client_name,
    site_address,
    brief_text,
    priority,
    due_date,
    notes,
  } = parsed.data;

  const { error } = await supabase
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
    .eq("id", projectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app/dashboard");
  revalidatePath(`/app/projects/${projectId}`);

  return { success: true };
}
