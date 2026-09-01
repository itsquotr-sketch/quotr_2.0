import { assertCustomerMappingAssignable } from "@/lib/billing/customers";
import type { BillingStore } from "@/lib/billing/store";
import type {
  BillingEnvironment,
  OrgBillingCustomer,
} from "@/lib/billing/types";

export async function getOrgBillingCustomerMapping(
  store: BillingStore,
  orgId: string,
  billingEnvironment: BillingEnvironment
): Promise<OrgBillingCustomer | null> {
  return store.getCustomerByOrg(orgId, billingEnvironment);
}

/**
 * Trusted server upsert. Never accept Stripe customer IDs from the browser.
 * Does not call Stripe APIs; BILLING-3 Checkout creates the Stripe Customer.
 */
export async function upsertTrustedCustomerMapping(
  store: BillingStore,
  input: {
    orgId: string;
    billingEnvironment: BillingEnvironment;
    stripeCustomerId: string;
    billingName?: string | null;
    billingEmail?: string | null;
  }
): Promise<
  | { ok: true; customer: OrgBillingCustomer }
  | { ok: false; errorCode: string; errorSafe: string }
> {
  const existingByOrg = await store.getCustomerByOrg(
    input.orgId,
    input.billingEnvironment
  );
  const existingByCustomer = await store.getCustomerByStripeId(
    input.stripeCustomerId,
    input.billingEnvironment
  );
  const allowed = assertCustomerMappingAssignable({
    orgId: input.orgId,
    billingEnvironment: input.billingEnvironment,
    stripeCustomerId: input.stripeCustomerId,
    existingByOrg,
    existingByCustomer,
  });
  if (!allowed.ok) {
    return allowed;
  }

  const customer = await store.upsertCustomer({
    orgId: input.orgId,
    billingEnvironment: input.billingEnvironment,
    stripeCustomerId: input.stripeCustomerId,
    billingName: input.billingName ?? existingByOrg?.billingName ?? null,
    billingEmail: input.billingEmail ?? existingByOrg?.billingEmail ?? null,
  });
  return { ok: true, customer };
}
