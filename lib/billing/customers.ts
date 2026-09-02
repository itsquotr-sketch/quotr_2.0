import type { BillingEnvironment, OrgBillingCustomer } from "@/lib/billing/types";

export type CustomerMappingConflict =
  | { ok: true }
  | { ok: false; errorCode: string; errorSafe: string };

/**
 * Mapping primitives. BILLING-3 Checkout lazily creates one Stripe Customer
 * per organisation and persists the mapping. Never one Customer per user.
 */
export function assertCustomerMappingAssignable(input: {
  orgId: string;
  billingEnvironment: BillingEnvironment;
  stripeCustomerId: string;
  existingByOrg: Pick<
    OrgBillingCustomer,
    "orgId" | "billingEnvironment" | "stripeCustomerId"
  > | null;
  existingByCustomer: Pick<
    OrgBillingCustomer,
    "orgId" | "billingEnvironment" | "stripeCustomerId"
  > | null;
}): CustomerMappingConflict {
  const { existingByOrg, existingByCustomer } = input;

  if (
    existingByCustomer &&
    existingByCustomer.orgId !== input.orgId &&
    existingByCustomer.billingEnvironment === input.billingEnvironment
  ) {
    return {
      ok: false,
      errorCode: "cross_org_customer",
      errorSafe: "Stripe customer is already mapped to another organisation.",
    };
  }

  if (
    existingByOrg &&
    existingByOrg.stripeCustomerId !== input.stripeCustomerId &&
    existingByOrg.billingEnvironment === input.billingEnvironment
  ) {
    return {
      ok: false,
      errorCode: "customer_reassignment",
      errorSafe:
        "Organisation already has a different Stripe customer in this billing environment.",
    };
  }

  return { ok: true };
}

export function metadataOrgId(
  metadata: Record<string, string> | null | undefined
): string | null {
  const value = metadata?.org_id?.trim();
  return value || null;
}

export function metadataBillingEnvironment(
  metadata: Record<string, string> | null | undefined
): string | null {
  const value = metadata?.billing_environment?.trim();
  return value || null;
}

export function validateTrustedBillingMetadata(input: {
  billingEnvironment: BillingEnvironment;
  mappedOrgId: string;
  metadata: Record<string, string> | null | undefined;
}): CustomerMappingConflict {
  const metaEnv = metadataBillingEnvironment(input.metadata);
  if (metaEnv && metaEnv !== input.billingEnvironment) {
    return {
      ok: false,
      errorCode: "metadata_environment_mismatch",
      errorSafe: "Stripe metadata billing_environment does not match this environment.",
    };
  }

  const metaOrg = metadataOrgId(input.metadata);
  if (metaOrg && metaOrg !== input.mappedOrgId) {
    return {
      ok: false,
      errorCode: "metadata_org_mismatch",
      errorSafe: "Stripe metadata org_id does not match the customer mapping.",
    };
  }

  return { ok: true };
}
