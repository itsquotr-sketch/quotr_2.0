import "server-only";
import { resolveBillingEnvironment } from "@/lib/billing/environment";
import { loadOrgBillingState } from "@/lib/billing/state";
import { createSupabaseBillingStore } from "@/lib/billing/supabase-store";
import type { OrgBillingState } from "@/lib/billing/types";

/**
 * Server-side organisation billing summary. Input to entitlement evaluation.
 * Does not cache across requests. Webhook updates are visible on the next read.
 */
export async function getOrgBillingState(
  orgId: string
): Promise<OrgBillingState> {
  const billingEnvironment = resolveBillingEnvironment();
  return loadOrgBillingState(
    orgId,
    billingEnvironment,
    createSupabaseBillingStore()
  );
}
