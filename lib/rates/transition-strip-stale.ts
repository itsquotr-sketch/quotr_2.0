import { FLOORING_TRANSITION_STRIP_KEY } from "@/lib/estimate/flooring-identities";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";

/**
 * A saved strip cost does not rewrite an estimate by itself.
 * Flag the flooring estimate so the builder can update it.
 * Saved Pricing rows and issued quotes stay untouched.
 */
export function transitionStripRateKey(itemKey: string | null | undefined): boolean {
  return itemKey === FLOORING_TRANSITION_STRIP_KEY;
}

export async function flagEstimatesForTransitionStripRate(
  context: AuthOrgContext
): Promise<void> {
  const { supabase, orgId } = context;
  const { data, error } = await supabase
    .from("work_areas")
    .select("project_id")
    .eq("org_id", orgId)
    .eq("type", "flooring")
    .neq("status", "excluded");
  if (error || !data?.length) return;
  const projectIds = [
    ...new Set(
      data
        .map((row) => row.project_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  if (projectIds.length === 0) return;
  await supabase
    .from("estimates")
    .update({ is_stale: true })
    .eq("org_id", orgId)
    .in("project_id", projectIds);
}
