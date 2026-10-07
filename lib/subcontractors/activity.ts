"use server";

import { getAuthOrgContext } from "@/lib/security/auth-org-context";

export type SubcontractorRequestActivity = {
  rfqId: string;
  projectId: string;
  projectTitle: string;
  scopeLabel: string;
  responseState: string;
  when: string | null;
};

export async function listSubcontractorRequestActivity(
  subcontractorId: string
): Promise<SubcontractorRequestActivity[]> {
  const context = await getAuthOrgContext();
  if (!context) return [];
  const recipients = await context.supabase
    .from("rfq_recipients")
    .select("rfq_id, response_state, created_at")
    .eq("org_id", context.orgId)
    .eq("subcontractor_id", subcontractorId)
    .order("created_at", { ascending: false })
    .limit(8);
  const rows = recipients.data ?? [];
  if (rows.length === 0) return [];
  const rfqs = await context.supabase
    .from("rfqs")
    .select("id, project_id, work_area_name, written_scope_label, scope_kind, sent_at")
    .in("id", rows.map((row) => row.rfq_id));
  const rfqById = new Map((rfqs.data ?? []).map((rfq) => [rfq.id, rfq]));
  const projectIds = [...new Set((rfqs.data ?? []).map((rfq) => rfq.project_id))];
  const projects = projectIds.length === 0
    ? { data: [] as Array<{ id: string; title: string | null }> }
    : await context.supabase.from("projects").select("id, title").in("id", projectIds);
  const titles = new Map((projects.data ?? []).map((project) => [project.id, project.title]));
  return rows.flatMap((row) => {
    const rfq = rfqById.get(row.rfq_id);
    if (!rfq) return [];
    const scope = rfq.scope_kind === "written"
      ? rfq.written_scope_label || "Written scope"
      : rfq.work_area_name || "Work area";
    return [{
      rfqId: rfq.id,
      projectId: rfq.project_id,
      projectTitle: titles.get(rfq.project_id) || "Project",
      scopeLabel: scope,
      responseState: row.response_state,
      when: rfq.sent_at ?? row.created_at,
    }];
  });
}
