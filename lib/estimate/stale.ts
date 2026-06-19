import { getAuthOrgContext } from "@/lib/assistant/state";

export async function markEstimateStale(projectId: string): Promise<void> {
  const context = await getAuthOrgContext();
  if (!context) return;

  const { supabase } = context;

  await supabase
    .from("estimates")
    .update({ is_stale: true })
    .eq("project_id", projectId);
}

export async function markEstimateFresh(estimateId: string): Promise<void> {
  const context = await getAuthOrgContext();
  if (!context) return;

  const { supabase } = context;

  await supabase
    .from("estimates")
    .update({ is_stale: false })
    .eq("id", estimateId);
}
