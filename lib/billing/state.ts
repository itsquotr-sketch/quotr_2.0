import type {
  BillingEnvironment,
  OrgBillingCustomer,
  OrgBillingOverride,
  OrgBillingState,
  OrgSubscription,
} from "@/lib/billing/types";
import { selectActiveBillingOverride } from "@/lib/billing/overrides";
import type { BillingStore } from "@/lib/billing/store";

/**
 * Read helper for BILLING-2. Does not enforce capabilities.
 */
export async function loadOrgBillingState(
  orgId: string,
  billingEnvironment: BillingEnvironment,
  store: BillingStore,
  now: Date = new Date()
): Promise<OrgBillingState> {
  const [customer, subscription, overrides] = await Promise.all([
    store.getCustomerByOrg(orgId, billingEnvironment),
    store.getSubscriptionByOrg(orgId, billingEnvironment),
    store.listOverrides(orgId, billingEnvironment),
  ]);

  return assembleOrgBillingState({
    orgId,
    billingEnvironment,
    customer,
    subscription,
    overrides,
    now,
  });
}

export function assembleOrgBillingState(input: {
  orgId: string;
  billingEnvironment: BillingEnvironment;
  customer: OrgBillingCustomer | null;
  subscription: OrgSubscription | null;
  overrides: OrgBillingOverride[];
  now?: Date;
}): OrgBillingState {
  return {
    orgId: input.orgId,
    billingEnvironment: input.billingEnvironment,
    customer: input.customer,
    subscription: input.subscription,
    activeOverride: selectActiveBillingOverride(
      input.overrides,
      input.now ?? new Date()
    ),
  };
}
