import type { StripePriceConfig } from "@/lib/billing/types";
import { extraSeatQuantityFromPaidSeats } from "@/lib/billing/seats";
import type { StripePendingUpdateLike } from "@/lib/billing/upgrade-policy";
import { pendingUpdatePriceIds } from "@/lib/billing/upgrade-policy";

/**
 * Additional-user Stripe item.
 *
 * paid_seat_quantity = total active paid users.
 * Additional-user Price quantity = max(0, total - 1).
 * Do not send this quantity from the browser.
 *
 * Add: take effect immediately, keep billing-cycle anchor, prorate remaining
 * period, collect immediately (`always_invoice` + `pending_if_incomplete`).
 * Remove: `create_prorations` so credit sits on the next invoice — no
 * automatic cash refund. Access is revoked immediately regardless.
 *
 * When extra quantity returns to 0: delete the seat item (canonical: no
 * seat item when extra=0).
 *
 * Do not pass item tax_rates or default_tax_rates on pending_if_incomplete
 * updates. Subscription.default_tax_rates remains GST authority.
 */

export const SEAT_ADD_PRORATION_BEHAVIOR = "always_invoice" as const;
export const SEAT_ADD_PAYMENT_BEHAVIOR = "pending_if_incomplete" as const;
export const SEAT_ADD_BILLING_CYCLE_ANCHOR = "unchanged" as const;
export const SEAT_REMOVE_PRORATION_BEHAVIOR = "create_prorations" as const;

export type StripeSeatItemLike = {
  id: string;
  priceId: string;
  quantity: number;
};

export type SeatStripeMutation =
  | {
      kind: "add_item";
      items: Array<{ price: string; quantity: number }>;
      proration_behavior: typeof SEAT_ADD_PRORATION_BEHAVIOR;
      payment_behavior: typeof SEAT_ADD_PAYMENT_BEHAVIOR;
      billing_cycle_anchor: typeof SEAT_ADD_BILLING_CYCLE_ANCHOR;
    }
  | {
      kind: "update_item";
      items: Array<{ id: string; quantity: number }>;
      proration_behavior: typeof SEAT_ADD_PRORATION_BEHAVIOR;
      payment_behavior: typeof SEAT_ADD_PAYMENT_BEHAVIOR;
      billing_cycle_anchor: typeof SEAT_ADD_BILLING_CYCLE_ANCHOR;
    }
  | {
      kind: "delete_item";
      items: Array<{ id: string; deleted: true }>;
      proration_behavior: typeof SEAT_REMOVE_PRORATION_BEHAVIOR;
    }
  | {
      kind: "update_item_remove";
      items: Array<{ id: string; quantity: number }>;
      proration_behavior: typeof SEAT_REMOVE_PRORATION_BEHAVIOR;
    }
  | { kind: "noop" };

export function findSeatItem(
  items: ReadonlyArray<StripeSeatItemLike>,
  prices: StripePriceConfig
): StripeSeatItemLike | null {
  return items.find((item) => item.priceId === prices.businessSeatMonthly) ?? null;
}

export function currentExtraSeatQuantity(
  items: ReadonlyArray<StripeSeatItemLike>,
  prices: StripePriceConfig
): number {
  return items
    .filter((item) => item.priceId === prices.businessSeatMonthly)
    .reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
}

export function resolveSeatAddMutation(input: {
  items: ReadonlyArray<StripeSeatItemLike>;
  prices: StripePriceConfig;
  desiredPaidSeatQuantity: number;
  pendingUpdate: StripePendingUpdateLike;
}): SeatStripeMutation | { errorCode: string; errorSafe: string } {
  const extra = extraSeatQuantityFromPaidSeats(input.desiredPaidSeatQuantity);
  if (extra < 1) {
    return { kind: "noop" };
  }
  if (extra > 4) {
    return {
      errorCode: "seat_limit",
      errorSafe: "Business includes up to 5 people. Contact Quotr for more.",
    };
  }

  const currentExtra = currentExtraSeatQuantity(input.items, input.prices);
  if (currentExtra === extra) {
    return { kind: "noop" };
  }

  const pendingIds = pendingUpdatePriceIds(input.pendingUpdate);
  if (
    pendingIds.includes(input.prices.businessSeatMonthly) &&
    currentExtra !== extra
  ) {
    return {
      errorCode: "seat_payment_pending",
      errorSafe:
        "Your seat couldn't be activated because the account payment needs attention.",
    };
  }

  const existing = findSeatItem(input.items, input.prices);
  if (!existing) {
    return {
      kind: "add_item",
      items: [{ price: input.prices.businessSeatMonthly, quantity: extra }],
      proration_behavior: SEAT_ADD_PRORATION_BEHAVIOR,
      payment_behavior: SEAT_ADD_PAYMENT_BEHAVIOR,
      billing_cycle_anchor: SEAT_ADD_BILLING_CYCLE_ANCHOR,
    };
  }

  return {
    kind: "update_item",
    items: [{ id: existing.id, quantity: extra }],
    proration_behavior: SEAT_ADD_PRORATION_BEHAVIOR,
    payment_behavior: SEAT_ADD_PAYMENT_BEHAVIOR,
    billing_cycle_anchor: SEAT_ADD_BILLING_CYCLE_ANCHOR,
  };
}

export function resolveSeatRemoveMutation(input: {
  items: ReadonlyArray<StripeSeatItemLike>;
  prices: StripePriceConfig;
  desiredPaidSeatQuantity: number;
}): SeatStripeMutation {
  const extra = extraSeatQuantityFromPaidSeats(input.desiredPaidSeatQuantity);
  const existing = findSeatItem(input.items, input.prices);
  const currentExtra = currentExtraSeatQuantity(input.items, input.prices);

  if (extra === 0) {
    if (!existing) return { kind: "noop" };
    return {
      kind: "delete_item",
      items: [{ id: existing.id, deleted: true }],
      proration_behavior: SEAT_REMOVE_PRORATION_BEHAVIOR,
    };
  }

  if (!existing) {
    return { kind: "noop" };
  }
  if (currentExtra === extra) {
    return { kind: "noop" };
  }
  return {
    kind: "update_item_remove",
    items: [{ id: existing.id, quantity: extra }],
    proration_behavior: SEAT_REMOVE_PRORATION_BEHAVIOR,
  };
}

export function seatMutationAlreadyApplied(
  items: ReadonlyArray<StripeSeatItemLike>,
  prices: StripePriceConfig,
  desiredPaidSeatQuantity: number
): boolean {
  const extra = extraSeatQuantityFromPaidSeats(desiredPaidSeatQuantity);
  return currentExtraSeatQuantity(items, prices) === extra;
}

export const SEAT_ADD_DISCLOSURE =
  "This user will cost $35 + GST/month once they join. Their first charge is prorated for the remainder of your billing period. If they never join, you are not charged.";

export const SEAT_REMOVE_DISCLOSURE =
  "Removing this person will immediately remove their access. Your Business subscription will be updated to the lower user count. Any unused time is credited to your next invoice — it is not refunded as cash.";

/**
 * Catalogue-only renewal math for 2 users. Not invoice authority.
 * 7900 + 3500 = 11400 exclusive; 15% GST = 1710; total 13110 cents.
 */
export function expectedTwoUserRenewalCents(): {
  exclusiveCents: number;
  gstCents: number;
  totalCents: number;
} {
  const exclusiveCents = 7900 + 3500;
  const gstCents = Math.round(exclusiveCents * 0.15);
  return {
    exclusiveCents,
    gstCents,
    totalCents: exclusiveCents + gstCents,
  };
}
