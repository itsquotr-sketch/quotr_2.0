import type { PlanCode } from "@/lib/billing/types";

export const PLAN_CATALOGUE_VERSION = 1;

export const TRIAL_DURATION_DAYS = 14;
export const TRIAL_ENTITLEMENT_BASIS_PLAN: PlanCode = "business";
export const TRIAL_INCLUDED_USERS = 1;

export type PlanCatalogueEntry = {
  code: PlanCode;
  includedUsers: number;
  maxUsers: number | null;
  notes: string;
};

/**
 * Product semantics only. No Stripe Price/Product IDs. No dollar amounts
 * as transaction authority. Entitlements are not enforced in BILLING-1.
 */
export const PLAN_CATALOGUE: Record<PlanCode, PlanCatalogueEntry> = {
  builder: {
    code: "builder",
    includedUsers: 1,
    maxUsers: 1,
    notes: "One full user. Identical estimating correctness to Business.",
  },
  business: {
    code: "business",
    includedUsers: 1,
    maxUsers: 5,
    notes:
      "First user included. Additional full users billed separately up to 5 total self-service users.",
  },
  custom: {
    code: "custom",
    includedUsers: 1,
    maxUsers: null,
    notes: "Configurable via billing override / ops. Not a self-service Price.",
  },
};

export function getPlanCatalogueEntry(code: PlanCode): PlanCatalogueEntry {
  return PLAN_CATALOGUE[code];
}
