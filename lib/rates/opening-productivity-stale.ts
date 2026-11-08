import { INTERNAL_WALLS_OPENING_FORM_HOURS_EACH_KEY } from "@/lib/estimate/internal-walls-openings";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";

/**
 * Same invalidation as mark_estimates_stale_for_work_area_type: flag the
 * estimate, and leave its saved money and any Pricing document untouched.
 */
export function openingFormationProductivityKey(
  itemKey: string | null | undefined
): boolean {
  return itemKey === INTERNAL_WALLS_OPENING_FORM_HOURS_EACH_KEY;
}

export async function flagEstimatesForOpeningFormationProductivity(
  context: AuthOrgContext
): Promise<void> {
  const { supabase, orgId } = context;
  const { data, error } = await supabase
    .from("work_areas")
    .select("project_id")
    .eq("org_id", orgId)
    .eq("type", "internal_walls")
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
