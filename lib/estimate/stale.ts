import { getAuthOrgContext } from "@/lib/assistant/state";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";

export async function markEstimateStaleWithContext(
  context: AuthOrgContext,
  projectId: string
): Promise<void> {
  const owned = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in owned) return;

  const { supabase, orgId } = context;

  await supabase
    .from("estimates")
    .update({ is_stale: true })
    .eq("project_id", projectId)
    .eq("org_id", orgId);
}

export async function markEstimateStale(projectId: string): Promise<void> {
  const context = await getAuthOrgContext();
  if (!context) return;

  await markEstimateStaleWithContext(context, projectId);
}
