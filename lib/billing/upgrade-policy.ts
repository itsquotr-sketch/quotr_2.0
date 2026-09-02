import type { StripePriceConfig } from "@/lib/billing/types";

/**
 * Owner V1 Builder → Business economics.
 *
 * - Entitlement switches only after webhook confirms the **current** Business Price.
 * - Billing cycle anchor stays unchanged (not reset to now).
 * - Remaining-period price difference is prorated and invoiced immediately.
 * - `payment_behavior=pending_if_incomplete`: if that invoice does not pay,
 *   Stripe keeps the current Builder Price and may store a pending_update.
 *   Quotr must not treat pending_update as plan authority.
 *
 * `create_prorations` would defer the net difference onto the next invoice
 * (Stripe's documented $100→$200 example bills $250 at renewal). That is
 * not the owner outcome.
 */
export const BUILDER_TO_BUSINESS_PRORATION_BEHAVIOR = "always_invoice" as const;
export const BUILDER_TO_BUSINESS_BILLING_CYCLE_ANCHOR = "unchanged" as const;
export const BUILDER_TO_BUSINESS_PAYMENT_BEHAVIOR =
  "pending_if_incomplete" as const;

export type BuilderToBusinessUpgradeParams = {
  proration_behavior: typeof BUILDER_TO_BUSINESS_PRORATION_BEHAVIOR;
  billing_cycle_anchor: typeof BUILDER_TO_BUSINESS_BILLING_CYCLE_ANCHOR;
  payment_behavior: typeof BUILDER_TO_BUSINESS_PAYMENT_BEHAVIOR;
  items: Array<{
    id: string;
    price: string;
    quantity: 1;
  }>;
  metadata: Record<string, string>;
};

export type StripePendingUpdateLike = {
  subscription_items?: Array<{
    price?: string | { id?: string | null } | null;
  }>;
} | null;

export type UpgradeMutationDecision =
  | "already_business"
  | "pending_equivalent"
  | "mutate";

export type UpgradeConfirmKind = "pending" | "payment";

export function subscriptionAlreadyOnBusinessPrice(
  items: ReadonlyArray<{ priceId: string }>,
  prices: StripePriceConfig
): boolean {
  return items.some((item) => item.priceId === prices.businessBaseMonthly);
}

export function pendingUpdatePriceIds(
  pending: StripePendingUpdateLike
): string[] {
  if (!pending?.subscription_items) {
    return [];
  }
  return pending.subscription_items.flatMap((item) => {
    if (typeof item.price === "string" && item.price) {
      return [item.price];
    }
    const id = item.price && typeof item.price === "object" ? item.price.id : null;
    return id ? [id] : [];
  });
}

export function pendingUpdateRequestsBusinessPrice(
  pending: StripePendingUpdateLike,
  businessPriceId: string
): boolean {
  return pendingUpdatePriceIds(pending).includes(businessPriceId);
}

/**
 * Skip a second `subscriptions.update` when Stripe already has the intended
 * Business change applied or pending. Prevents duplicate proration invoices.
 */
export function resolveBuilderToBusinessMutation(input: {
  currentPriceIds: ReadonlyArray<string>;
  pendingUpdate: StripePendingUpdateLike;
  prices: StripePriceConfig;
}): UpgradeMutationDecision {
  const currentItems = input.currentPriceIds.map((priceId) => ({ priceId }));
  if (subscriptionAlreadyOnBusinessPrice(currentItems, input.prices)) {
    return "already_business";
  }
  if (
    pendingUpdateRequestsBusinessPrice(
      input.pendingUpdate,
      input.prices.businessBaseMonthly
    )
  ) {
    return "pending_equivalent";
  }
  return "mutate";
}

export function resolveUpgradeConfirmKind(input: {
  currentPriceIds: ReadonlyArray<string>;
  pendingUpdate: StripePendingUpdateLike;
  prices: StripePriceConfig;
}): UpgradeConfirmKind {
  const currentItems = input.currentPriceIds.map((priceId) => ({ priceId }));
  if (subscriptionAlreadyOnBusinessPrice(currentItems, input.prices)) {
    return "pending";
  }
  return "payment";
}

export function upgradeConfirmPath(kind: UpgradeConfirmKind): string {
  return `/app/settings/billing?upgrade=${kind}`;
}

/**
 * Stripe TEST (API 2026-08-26.dahlia) rejects both `items[].tax_rates` and
 * `default_tax_rates` on `subscriptions.update` when
 * `payment_behavior=pending_if_incomplete`.
 *
 * GST continuity does not require those fields: Checkout already stored the
 * NZ GST Tax Rate on `subscription.default_tax_rates` (and the current item).
 * A price-only pending update keeps that authority, so the proration invoice
 * and later renewals still receive 15% exclusive GST.
 */
export function buildBuilderToBusinessUpgradeParams(input: {
  builderItemId: string;
  businessPriceId: string;
  orgId: string;
  billingEnvironment: string;
  existingMetadata: Record<string, string>;
}): BuilderToBusinessUpgradeParams {
  return {
    proration_behavior: BUILDER_TO_BUSINESS_PRORATION_BEHAVIOR,
    billing_cycle_anchor: BUILDER_TO_BUSINESS_BILLING_CYCLE_ANCHOR,
    payment_behavior: BUILDER_TO_BUSINESS_PAYMENT_BEHAVIOR,
    items: [
      {
        id: input.builderItemId,
        price: input.businessPriceId,
        quantity: 1,
      },
    ],
    metadata: {
      ...input.existingMetadata,
      org_id: input.orgId,
      billing_environment: input.billingEnvironment,
      selected_plan: "business",
    },
  };
}
