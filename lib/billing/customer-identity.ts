import type { BillingEnvironment } from "@/lib/billing/types";

export type BillingIdentity = {
  companyName: string;
  billingEmail: string | null;
};

/**
 * Stripe Customer CREATE body. Must stay identical for a given org+env so the
 * deterministic idempotency key cannot mismatch when company name or email
 * change between retries. Mutable profile fields are applied with UPDATE.
 */
export function stripeCustomerCreateParams(
  orgId: string,
  billingEnvironment: BillingEnvironment
): { metadata: { org_id: string; billing_environment: BillingEnvironment } } {
  return {
    metadata: {
      org_id: orgId,
      billing_environment: billingEnvironment,
    },
  };
}

export function stripeCustomerProfileUpdateParams(identity: BillingIdentity): {
  name: string;
  email?: string;
} {
  return {
    name: identity.companyName,
    ...(identity.billingEmail ? { email: identity.billingEmail } : {}),
  };
}

export function customerCreateParamsAreStable(
  params: Record<string, unknown>
): boolean {
  return (
    !Object.prototype.hasOwnProperty.call(params, "name") &&
    !Object.prototype.hasOwnProperty.call(params, "email") &&
    typeof params.metadata === "object" &&
    params.metadata !== null
  );
}
