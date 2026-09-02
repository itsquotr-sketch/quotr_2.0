import "server-only";

import {
  stripeCustomerCreateParams,
  stripeCustomerProfileUpdateParams,
  type BillingIdentity,
} from "@/lib/billing/customer-identity";
import { upsertTrustedCustomerMapping } from "@/lib/billing/customer-mapping";
import {
  resolveCustomerCreateRace,
  stripeCustomerCreateIdempotencyKey,
} from "@/lib/billing/stripe-idempotency";
import { logBillingEvent } from "@/lib/billing/logging";
import { getStripeClient } from "@/lib/billing/stripe";
import type { BillingStore } from "@/lib/billing/store";
import type {
  BillingEnvironment,
  OrgBillingCustomer,
} from "@/lib/billing/types";

export type { BillingIdentity };

/**
 * One Stripe Customer per organisation per billing environment.
 * Never create one Customer per user.
 * Concurrent first Checkout uses a deterministic Stripe idempotency key with
 * stable (non-mutable) create parameters.
 */
export async function ensureOrgStripeCustomer(input: {
  orgId: string;
  billingEnvironment: BillingEnvironment;
  identity: BillingIdentity;
  store: BillingStore;
}): Promise<
  | { ok: true; customer: OrgBillingCustomer; created: boolean }
  | { ok: false; errorCode: string; errorSafe: string }
> {
  const existing = await input.store.getCustomerByOrg(
    input.orgId,
    input.billingEnvironment
  );
  if (existing) {
    await syncStripeCustomerProfile(
      existing.stripeCustomerId,
      input.identity,
      input.orgId
    );
    return { ok: true, customer: existing, created: false };
  }

  const stripe = getStripeClient();
  const created = await stripe.customers.create(
    stripeCustomerCreateParams(input.orgId, input.billingEnvironment),
    {
      idempotencyKey: stripeCustomerCreateIdempotencyKey(
        input.billingEnvironment,
        input.orgId
      ),
    }
  );

  const raced = await input.store.getCustomerByOrg(
    input.orgId,
    input.billingEnvironment
  );
  const race = resolveCustomerCreateRace({
    mappingAfterCreate: raced
      ? { orgId: raced.orgId, stripeCustomerId: raced.stripeCustomerId }
      : null,
    createdStripeCustomerId: created.id,
    orgId: input.orgId,
  });
  if (race === "reuse" && raced) {
    await syncStripeCustomerProfile(raced.stripeCustomerId, input.identity, input.orgId);
    return { ok: true, customer: raced, created: false };
  }
  if (race === "conflict") {
    return {
      ok: false,
      errorCode: "customer_reassignment",
      errorSafe:
        "Organisation already has a different Stripe customer in this billing environment.",
    };
  }

  const mapped = await upsertTrustedCustomerMapping(input.store, {
    orgId: input.orgId,
    billingEnvironment: input.billingEnvironment,
    stripeCustomerId: created.id,
    billingName: input.identity.companyName,
    billingEmail: input.identity.billingEmail,
  });
  if (!mapped.ok) {
    return mapped;
  }
  if (mapped.customer.stripeCustomerId !== created.id) {
    return {
      ok: false,
      errorCode: "customer_reassignment",
      errorSafe:
        "Organisation already has a different Stripe customer in this billing environment.",
    };
  }
  await syncStripeCustomerProfile(created.id, input.identity, input.orgId);
  return { ok: true, customer: mapped.customer, created: true };
}

async function syncStripeCustomerProfile(
  stripeCustomerId: string,
  identity: BillingIdentity,
  orgId: string
): Promise<void> {
  try {
    await getStripeClient().customers.update(
      stripeCustomerId,
      stripeCustomerProfileUpdateParams(identity)
    );
  } catch {
    logBillingEvent({
      orgId,
      result: "customer_profile_sync_failed",
      errorCode: "customer_profile_sync_failed",
    });
  }
}
