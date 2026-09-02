/**
 * Sanitized display catalogue for Billing UI.
 *
 * These amounts are NOT transaction authority. Stripe Price IDs in
 * `STRIPE_PRICE_*` remain Checkout / webhook authority.
 * Changing a Stripe Price ID later must not require entitlement rewrites.
 */

export const BILLING_DISPLAY_CURRENCY = "NZD";
export const BILLING_DISPLAY_GST_PERCENT = 15;

export type PlanDisplayPrice = {
  planCode: "builder" | "business";
  label: string;
  exclusiveMonthlyNzd: number;
  extraSeatExclusiveMonthlyNzd: number | null;
  includedUsers: number;
  maxSelfServiceUsers: number;
  intervalLabel: "month";
};

export const PLAN_DISPLAY_CATALOGUE: Record<
  "builder" | "business",
  PlanDisplayPrice
> = {
  builder: {
    planCode: "builder",
    label: "Quotr Builder",
    exclusiveMonthlyNzd: 65,
    extraSeatExclusiveMonthlyNzd: null,
    includedUsers: 1,
    maxSelfServiceUsers: 1,
    intervalLabel: "month",
  },
  business: {
    planCode: "business",
    label: "Quotr Business",
    exclusiveMonthlyNzd: 79,
    extraSeatExclusiveMonthlyNzd: 35,
    includedUsers: 1,
    maxSelfServiceUsers: 5,
    intervalLabel: "month",
  },
};

export function formatExclusivePlusGst(exclusiveNzd: number): string {
  return `$${exclusiveNzd} + GST / month`;
}

export function gstAmountNzd(exclusiveNzd: number): number {
  return Math.round(exclusiveNzd * BILLING_DISPLAY_GST_PERCENT) / 100;
}
