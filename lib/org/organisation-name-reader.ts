/**
 * PERFORMANCE-01D — request-scoped organisation display name.
 *
 * SELECT name only. Not identity authority — org id still comes from
 * requireAuthOrgContext. React.cache key: orgId.
 */
import "server-only";

import { cache } from "react";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";

async function loadOrganisationNameUncached(
  orgId: string
): Promise<string | null> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok || auth.orgId !== orgId) {
    return null;
  }

  const { data, error } = await auth.supabase
    .from("organisations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.name ?? null;
}

export const loadOrganisationName: (
  orgId: string
) => Promise<string | null> = cache(loadOrganisationNameUncached);
