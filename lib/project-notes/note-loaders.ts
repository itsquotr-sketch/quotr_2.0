import "server-only";

import { mapProjectNote } from "@/lib/project-notes/mappers";
import { mapNoteProposalRow } from "@/lib/project-notes/proposals/mappers";
import type { NoteProposal } from "@/lib/project-notes/proposals/types";
import type { ProjectNote } from "@/lib/project-notes/types";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";

const INITIAL_NOTES_LIMIT = 20;

export type ProjectNoteListResult = {
  notes: ProjectNote[];
  totalCount: number;
  pendingAnalysisCount: number;
};

async function fetchProjectNoteCounts(
  supabase: AuthOrgContext["supabase"],
  orgId: string,
  projectId: string
): Promise<{ totalCount: number; pendingAnalysisCount: number }> {
  const [
    { count: totalCount, error: totalError },
    { count: pendingCount, error: pendingError },
  ] = await Promise.all([
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

export async function listProjectNotesWithContext(
  context: AuthOrgContext,
  projectId: string,
  options?: { limit?: number }
): Promise<ProjectNoteListResult> {
  const owned = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in owned) {
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

export async function listProjectNotesForRequest(
  projectId: string,
  options?: { limit?: number }
): Promise<ProjectNoteListResult> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { notes: [], totalCount: 0, pendingAnalysisCount: 0 };
  }
  return listProjectNotesWithContext(context, projectId, options);
}

export async function getPendingNoteProposalWithContext(
  context: AuthOrgContext,
  projectId: string
): Promise<NoteProposal | null> {
  const owned = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in owned) return null;

  const { data } = await context.supabase
    .from("note_proposals")
    .select(
      "id, project_id, note_ids, summary, status, proposed_work_areas, proposed_facts, proposed_constraints, created_at, reviewed_at"
    )
    .eq("project_id", projectId)
    .eq("org_id", context.orgId)
    .eq("status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapNoteProposalRow(data) : null;
}
