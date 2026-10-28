import type { SupabaseClient } from "@supabase/supabase-js";
import { commercialConditionBlock } from "@/lib/estimate/condition-basis";

/**
 * Commercial readiness reads the saved conditions. It does not write them,
 * and a pricing review does not count as an answer.
 */
export async function materialConditionQuoteBlock(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string
): Promise<string | null> {
  const [{ data: constraints, error: constraintError }, { data: workAreas, error: workAreaError }] =
    await Promise.all([
      supabase
        .from("constraints")
        .select("key, value, source")
        .eq("project_id", projectId)
        .eq("org_id", orgId),
      supabase
        .from("work_areas")
        .select("type, status")
        .eq("project_id", projectId)
        .eq("org_id", orgId),
    ]);
  if (constraintError || workAreaError) {
    return "Project conditions could not be checked, so this was not treated as decided.";
  }
  return commercialConditionBlock({
    constraints: (constraints ?? []).map((row) => ({
      key: String(row.key ?? ""),
      value: row.value,
      source: typeof row.source === "string" ? row.source : null,
    })),
    workAreaTypes: (workAreas ?? [])
      .filter((row) => row.status !== "excluded")
      .map((row) => String(row.type ?? "")),
  });
}
