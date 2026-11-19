import type { AuthOrgContext } from "@/lib/security/auth-org-context";

/** Component costs, productivity and the hourly costs all affect new pergola estimates. */
export function measuredPergolaRateKey(key: string | null | undefined): boolean {
  return key?.startsWith("pergola.measured.") === true ||
    ["labour.carpenter.hour", "labour.labourer.hour", "labour.general.hour"].includes(key ?? "");
}

/** Mark saved estimates stale; never regenerate them or touch Pricing / issued quotes here. */
export async function flagEstimatesForMeasuredPergolaRate(context: AuthOrgContext): Promise<void> {
  const { supabase, orgId } = context;
  const projectIds = new Set<string>();
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("work_areas")
      .select("id, project_id").eq("org_id", orgId).eq("type", "pergola")
      .neq("status", "excluded").order("id").range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      if (typeof row.project_id === "string") projectIds.add(row.project_id);
    }
    if (!data || data.length < pageSize) break;
  }
  const ids = [...projectIds];
  for (let index = 0; index < ids.length; index += 200) {
    const { error } = await supabase.from("estimates").update({ is_stale: true })
      .eq("org_id", orgId).in("project_id", ids.slice(index, index + 200));
    if (error) throw error;
  }
}
