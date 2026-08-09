/**
 * Company Work Area preferences (Stage 3.1C.3-R2B).
 *
 * Authority B — what this company commonly prices.
 * Persisted as organisation_work_areas.enabled (legacy column name).
 *
 * Preferences may personalise Rates Setup order/filtering and future
 * calibration suggestions. They must NEVER gate Analyse Job, Scope Discovery,
 * calculators, or project Work Area confirmation.
 */

import type { createClient } from "@/lib/supabase/server";
import { isSupportedWorkAreaType } from "@/lib/scopes/capability";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Load preferred (enabled) work-area types for personalisation only.
 * Empty array means no preferences claimed — not a capability restriction.
 */
export async function loadPreferredWorkAreaTypes(
  supabase: Supabase,
  orgId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("organisation_work_areas")
    .select("work_area_type")
    .eq("org_id", orgId)
    .eq("enabled", true);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => row.work_area_type as string)
    .filter((type) => isSupportedWorkAreaType(type));
}

/** True when the org has at least one enabled preference row. */
export async function orgHasWorkTypePreferences(
  supabase: Supabase,
  orgId: string
): Promise<boolean> {
  const preferred = await loadPreferredWorkAreaTypes(supabase, orgId);
  return preferred.length > 0;
}
