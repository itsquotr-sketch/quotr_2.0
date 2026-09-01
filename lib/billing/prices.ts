import type { PlanPriceResolution, StripePriceConfig } from "@/lib/billing/types";
import { paidSeatQuantityFromExtraSeats } from "@/lib/billing/seats";

export const STRIPE_PRICE_ENV_NAMES = [
  "STRIPE_PRICE_BUILDER_MONTHLY",
  "STRIPE_PRICE_BUSINESS_BASE_MONTHLY",
  "STRIPE_PRICE_BUSINESS_SEAT_MONTHLY",
] as const;

export function readStripePriceConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): StripePriceConfig | null {
  const builderMonthly = env.STRIPE_PRICE_BUILDER_MONTHLY?.trim() ?? "";
  const businessBaseMonthly =
    env.STRIPE_PRICE_BUSINESS_BASE_MONTHLY?.trim() ?? "";
  const businessSeatMonthly =
    env.STRIPE_PRICE_BUSINESS_SEAT_MONTHLY?.trim() ?? "";

  const any =
    Boolean(builderMonthly) ||
    Boolean(businessBaseMonthly) ||
    Boolean(businessSeatMonthly);
  if (!any) {
    return null;
  }

  if (!builderMonthly || !businessBaseMonthly || !businessSeatMonthly) {
    throw new Error(
      "Stripe price configuration is incomplete. Set STRIPE_PRICE_BUILDER_MONTHLY, STRIPE_PRICE_BUSINESS_BASE_MONTHLY, and STRIPE_PRICE_BUSINESS_SEAT_MONTHLY together."
    );
  }

  return {
    builderMonthly,
    businessBaseMonthly,
    businessSeatMonthly,
  };
}

export function requireStripePriceConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): StripePriceConfig {
  const config = readStripePriceConfig(env);
  if (!config) {
    throw new Error("Stripe price configuration is not set.");
  }
  return config;
}

export function resolvePlanFromStripePriceItems(
  items: ReadonlyArray<{ priceId: string; quantity: number }>,
  config: StripePriceConfig
): PlanPriceResolution {
  const known = new Set([
    config.builderMonthly,
    config.businessBaseMonthly,
    config.businessSeatMonthly,
  ]);

  const unknown = items.filter((item) => !known.has(item.priceId));
  if (unknown.length > 0) {
    return {
      ok: false,
      errorCode: "unknown_price",
      errorSafe: "Subscription contains a Price ID that is not configured.",
    };
  }

  const builderItems = items.filter(
    (item) => item.priceId === config.builderMonthly
  );
  const businessBaseItems = items.filter(
    (item) => item.priceId === config.businessBaseMonthly
  );
  const seatItems = items.filter(
    (item) => item.priceId === config.businessSeatMonthly
  );

  if (builderItems.length > 0 && businessBaseItems.length > 0) {
    return {
      ok: false,
      errorCode: "ambiguous_plan_prices",
      errorSafe: "Subscription mixes Builder and Business base Prices.",
    };
  }

  if (builderItems.length > 0) {
    if (seatItems.length > 0) {
      return {
        ok: false,
        errorCode: "builder_with_seats",
        errorSafe: "Builder subscriptions cannot include additional-seat Prices.",
      };
    }
    return {
      ok: true,
      planCode: "builder",
      stripeBasePriceId: config.builderMonthly,
      stripeSeatPriceId: null,
      paidSeatQuantity: 1,
      extraSeatQuantity: 0,
    };
  }

  if (businessBaseItems.length > 0) {
    const extraSeatQuantity = seatItems.reduce(
      (sum, item) => sum + Math.max(0, item.quantity),
      0
    );
    return {
      ok: true,
      planCode: "business",
      stripeBasePriceId: config.businessBaseMonthly,
      stripeSeatPriceId:
        extraSeatQuantity > 0 ? config.businessSeatMonthly : null,
      paidSeatQuantity: paidSeatQuantityFromExtraSeats(extraSeatQuantity),
      extraSeatQuantity,
    };
  }

  if (seatItems.length > 0) {
    return {
      ok: false,
      errorCode: "seat_price_without_base",
      errorSafe: "Business seat Price requires the Business base Price.",
    };
  }

  return {
    ok: false,
    errorCode: "missing_plan_price",
    errorSafe: "Subscription has no configured Builder or Business base Price.",
  };
}
