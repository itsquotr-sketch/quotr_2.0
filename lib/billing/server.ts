import "server-only";
import { cache } from "react";
import { resolveBillingEnvironment } from "@/lib/billing/environment";
import { loadOrgBillingState } from "@/lib/billing/state";
import { createSupabaseBillingStore } from "@/lib/billing/supabase-store";
import type { OrgBillingState } from "@/lib/billing/types";

/**
 * Server-side organisation billing summary. Input to entitlement evaluation.
 *
 * Request-scoped React.cache only — layout chrome and entitlement checks in
 * the same render share one read. Does not cache across requests. Webhook
 * updates are visible on the next read. Not an authorization cache for writes.
 */
async function getOrgBillingStateUncached(
  orgId: string
): Promise<OrgBillingState> {
  const billingEnvironment = resolveBillingEnvironment();
  return loadOrgBillingState(
    orgId,
    billingEnvironment,
    createSupabaseBillingStore()
  );
}

export const getOrgBillingState: (
  orgId: string
) => Promise<OrgBillingState> = cache(getOrgBillingStateUncached);
