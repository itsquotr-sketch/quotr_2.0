"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { mapProjectNote } from "@/lib/project-notes/mappers";
import {
  isInternalProjectNote,
  type ProjectNote,
  type ProjectNoteActionState,
  type ProjectNoteSource,
  type ProjectNoteType,
} from "@/lib/project-notes/types";

const noteTypeSchema = z.enum([
  "general",
  "measurement",
  "access",
  "client_request",
  "existing_condition",
  "material_preference",
  "exclusion",
  "risk",
  "calibration_note",
  "other",
]);

const noteSourceSchema = z.enum([
  "site_walk",
  "phone_call",
  "desktop_note",
  "voice_to_text",
  "photo_caption",
  "other",
]);

const createNoteSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().trim().min(1, "Add a note before saving."),
  noteType: noteTypeSchema,
  source: noteSourceSchema.optional(),
});

const updateNoteSchema = z.object({
  noteId: z.string().uuid(),
  projectId: z.string().uuid(),
  content: z.string().trim().min(1, "Add a note before saving."),
  noteType: noteTypeSchema.optional(),
});

const deleteNoteSchema = z.object({
  noteId: z.string().uuid(),
  projectId: z.string().uuid(),
});

function revalidateProjectPath(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
}

async function assertProjectOwned(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  projectId: string,
  orgId: string
): Promise<{ ok: true } | { error: string }> {
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!project) {
    return { error: "Project not found." };
  }

  return { ok: true };
}

const INITIAL_NOTES_LIMIT = 20;

export type ProjectNoteListResult = {
  notes: ProjectNote[];
  totalCount: number;
  pendingAnalysisCount: number;
};

async function fetchProjectNoteCounts(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  orgId: string,
  projectId: string
): Promise<{ totalCount: number; pendingAnalysisCount: number }> {
  const [{ count: totalCount, error: totalError }, { count: pendingCount, error: pendingError }] =
    await Promise.all([
      supabase
        .from("project_notes")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .is("deleted_at", null),
      supabase
        .from("project_notes")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .eq("analysis_status", "pending"),
    ]);

  if (totalError) {
    console.error("[fetchProjectNoteCounts]", totalError.message);
  }
  if (pendingError) {
    console.error("[fetchProjectNoteCounts]", pendingError.message);
  }

  return {
    totalCount: totalCount ?? 0,
    pendingAnalysisCount: pendingCount ?? 0,
  };
}

export async function getProjectNoteCounts(
  projectId: string
): Promise<{ totalCount: number; pendingAnalysisCount: number }> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { totalCount: 0, pendingAnalysisCount: 0 };
  }

  return fetchProjectNoteCounts(context.supabase, context.orgId, projectId);
}

export async function listProjectNotes(
  projectId: string,
  options?: { limit?: number }
): Promise<ProjectNoteListResult> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { notes: [], totalCount: 0, pendingAnalysisCount: 0 };
  }

  const { supabase, orgId } = context;
  const limit = options?.limit ?? INITIAL_NOTES_LIMIT;

  const [{ data, error }, counts] = await Promise.all([
    supabase
      .from("project_notes")
      .select(
        "id, project_id, content, note_type, source, captured_by, captured_at, updated_at, analysis_status"
      )
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("captured_at", { ascending: false })
      .limit(limit),
    fetchProjectNoteCounts(supabase, orgId, projectId),
  ]);

  if (error) {
    console.error("[listProjectNotes]", error.message);
    return { notes: [], totalCount: 0, pendingAnalysisCount: 0 };
  }

  return {
    notes: (data ?? []).map(mapProjectNote),
    totalCount: counts.totalCount,
    pendingAnalysisCount: counts.pendingAnalysisCount,
  };
}

export async function createProjectNote(
  input: z.infer<typeof createNoteSchema>
): Promise<ProjectNoteActionState> {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.content?.[0] ??
      "Invalid note request.";
    return { error: message };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId, user } = context;
  const { projectId, content, noteType, source } = parsed.data;

  const owned = await assertProjectOwned(supabase, projectId, orgId);
  if ("error" in owned) {
    return { error: owned.error };
  }

  const { data: inserted, error } = await supabase
    .from("project_notes")
    .insert({
      org_id: orgId,
      project_id: projectId,
      content,
      note_type: noteType as ProjectNoteType,
      source: (source ?? "site_walk") as ProjectNoteSource,
      captured_by: user.id,
      analysis_status: isInternalProjectNote(noteType) ? "dismissed" : "pending",
    })
    .select(
      "id, project_id, content, note_type, source, captured_by, captured_at, updated_at, analysis_status"
    )
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Could not save note. Please try again." };
  }

  revalidateProjectPath(projectId);
  return { success: true, note: mapProjectNote(inserted) };
}

export async function updateProjectNote(
  input: z.infer<typeof updateNoteSchema>
): Promise<ProjectNoteActionState> {
  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.content?.[0] ??
      "Invalid note update.";
    return { error: message };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const { noteId, projectId, content, noteType } = parsed.data;

  const owned = await assertProjectOwned(supabase, projectId, orgId);
  if ("error" in owned) {
    return { error: owned.error };
  }

  const updatePayload: {
    content: string;
    note_type?: ProjectNoteType;
    analysis_status: "pending" | "dismissed";
  } = {
    content,
    analysis_status:
      noteType && isInternalProjectNote(noteType) ? "dismissed" : "pending",
  };

  if (noteType) {
    updatePayload.note_type = noteType;
  }

  const { data: updated, error } = await supabase
    .from("project_notes")
    .update(updatePayload)
    .eq("id", noteId)
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .select(
      "id, project_id, content, note_type, source, captured_by, captured_at, updated_at, analysis_status"
    )
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!updated) {
    return { error: "Note not found." };
  }

  revalidateProjectPath(projectId);
  return { success: true, note: mapProjectNote(updated) };
}

export async function deleteProjectNote(
  input: z.infer<typeof deleteNoteSchema>
): Promise<ProjectNoteActionState> {
  const parsed = deleteNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid delete request." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Not authenticated." };
  }

  const { supabase, orgId } = context;
  const { noteId, projectId } = parsed.data;

  const owned = await assertProjectOwned(supabase, projectId, orgId);
  if ("error" in owned) {
    return { error: owned.error };
  }

  const { data: updated, error } = await supabase
    .from("project_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!updated) {
    return { error: "Note not found." };
  }

  revalidateProjectPath(projectId);
  return { success: true };
}
