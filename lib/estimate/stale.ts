import { getAuthOrgContext } from "@/lib/assistant/state";
import { assertOrgOwnsProject } from "@/lib/security/org-ownership";

export async function markEstimateStale(projectId: string): Promise<void> {
  const context = await getAuthOrgContext();
  if (!context) return;

  const owned = await assertOrgOwnsProject(context, projectId);
  if ("error" in owned) return;

  const { supabase, orgId } = context;

  await supabase
    .from("estimates")
    .update({ is_stale: true })
    .eq("project_id", projectId)
    .eq("org_id", orgId);
}
