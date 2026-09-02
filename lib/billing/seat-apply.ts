import "server-only";

import { resolveBillingEnvironment } from "@/lib/billing/environment";
import { requireStripePriceConfig } from "@/lib/billing/prices";
import {
  resolveSeatAddMutation,
  resolveSeatRemoveMutation,
  type StripeSeatItemLike,
} from "@/lib/billing/seat-change";
import { getStripeClient } from "@/lib/billing/stripe";
import {
  stripeSeatAddIdempotencyKey,
  stripeSeatRemoveIdempotencyKey,
} from "@/lib/billing/stripe-idempotency";
import { paidSeatQuantityFromExtraSeats } from "@/lib/billing/seats";
import type { StripePendingUpdateLike } from "@/lib/billing/upgrade-policy";

function pendingFromStripe(pending: unknown): StripePendingUpdateLike {
  if (!pending || typeof pending !== "object") return null;
  const items = (pending as { subscription_items?: unknown }).subscription_items;
  if (!Array.isArray(items)) return { subscription_items: [] };
  return {
    subscription_items: items.map((item) => {
      if (!item || typeof item !== "object") return { price: null };
      return {
        price: (item as { price?: string | { id?: string | null } | null }).price ?? null,
      };
    }),
  };
}

function itemsFromSubscription(subscription: {
  items: { data: Array<{ id: string; quantity?: number | null; price: { id?: string | null } }> };
}): StripeSeatItemLike[] {
  return subscription.items.data.map((item) => ({
    id: item.id,
    priceId: item.price.id ?? "",
    quantity: item.quantity ?? 0,
  }));
}

export type SeatStripeApplyResult =
  | {
      ok: true;
      currentPaidSeatQuantity: number;
      pendingPayment: boolean;
    }
  | { ok: false; errorCode: string; errorSafe: string };

export async function applyPaidSeatIncrease(input: {
  stripeSubscriptionId: string;
  orgId: string;
  operationId: string;
  desiredPaidSeatQuantity: number;
}): Promise<SeatStripeApplyResult> {
  const prices = requireStripePriceConfig();
  const stripe = getStripeClient();
  const billingEnvironment = resolveBillingEnvironment();
  const subscription = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
  const items = itemsFromSubscription(subscription);
  const mutation = resolveSeatAddMutation({
    items,
    prices,
    desiredPaidSeatQuantity: input.desiredPaidSeatQuantity,
    pendingUpdate: pendingFromStripe(subscription.pending_update),
  });
  if ("errorCode" in mutation) {
    return { ok: false, errorCode: mutation.errorCode, errorSafe: mutation.errorSafe };
  }
  if (mutation.kind === "noop") {
    const extraAfter = items
      .filter((item) => item.priceId === prices.businessSeatMonthly)
      .reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
    return {
      ok: true,
      currentPaidSeatQuantity: paidSeatQuantityFromExtraSeats(extraAfter),
      pendingPayment: false,
    };
  }

  if (mutation.kind !== "add_item" && mutation.kind !== "update_item") {
    return {
      ok: false,
      errorCode: "seat_add_unexpected",
      errorSafe: "This seat change could not be applied.",
    };
  }

  const params = {
    items: mutation.items,
    proration_behavior: mutation.proration_behavior,
    payment_behavior: mutation.payment_behavior,
    billing_cycle_anchor: mutation.billing_cycle_anchor,
  };

  const updated = await stripe.subscriptions.update(
    input.stripeSubscriptionId,
    params,
    {
      idempotencyKey: stripeSeatAddIdempotencyKey(
        billingEnvironment,
        input.orgId,
        input.operationId,
        input.desiredPaidSeatQuantity
      ),
    }
  );

  const extraAfter = updated.items.data
    .filter((item) => item.price.id === prices.businessSeatMonthly)
    .reduce((sum, item) => sum + Math.max(0, item.quantity ?? 0), 0);
  const currentPaid = paidSeatQuantityFromExtraSeats(extraAfter);
  const pendingPayment = Boolean(updated.pending_update) && currentPaid < input.desiredPaidSeatQuantity;

  return {
    ok: true,
    currentPaidSeatQuantity: currentPaid,
    pendingPayment,
  };
}

export async function applyPaidSeatDecrease(input: {
  stripeSubscriptionId: string;
  orgId: string;
  operationId: string;
  desiredPaidSeatQuantity: number;
}): Promise<SeatStripeApplyResult> {
  const prices = requireStripePriceConfig();
  const stripe = getStripeClient();
  const billingEnvironment = resolveBillingEnvironment();
  const subscription = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
  const items = itemsFromSubscription(subscription);
  const mutation = resolveSeatRemoveMutation({
    items,
    prices,
    desiredPaidSeatQuantity: input.desiredPaidSeatQuantity,
  });
  if (mutation.kind === "noop") {
    return {
      ok: true,
      currentPaidSeatQuantity: input.desiredPaidSeatQuantity,
      pendingPayment: false,
    };
  }

  const updated = await stripe.subscriptions.update(
    input.stripeSubscriptionId,
    {
      items: mutation.items,
      proration_behavior: mutation.proration_behavior,
    },
    {
      idempotencyKey: stripeSeatRemoveIdempotencyKey(
        billingEnvironment,
        input.orgId,
        input.operationId,
        input.desiredPaidSeatQuantity
      ),
    }
  );
  const extraAfter = updated.items.data
    .filter((item) => item.price.id === prices.businessSeatMonthly)
    .reduce((sum, item) => sum + Math.max(0, item.quantity ?? 0), 0);
  return {
    ok: true,
    currentPaidSeatQuantity: paidSeatQuantityFromExtraSeats(extraAfter),
    pendingPayment: false,
  };
}
